"""
인증 라우터
google-issue.md Phase 1-2 적용:
- httpOnly 쿠키
- State 파라미터 (CSRF)
- Refresh Token
- Client ID 백엔드 관리
"""
from fastapi import APIRouter, HTTPException, Depends, Response, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from datetime import datetime
import secrets
import logging

from app.database import get_db
from app.services.auth_service import AuthService, GoogleOAuthService
from app.repositories.user_repo import UserRepository
from app.schemas import GoogleLoginRequest, AuthTokenResponse, RefreshTokenRequest

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])

# 세션에 state 저장 (실제 환경에서는 Redis 권장)
oauth_states = {}


@router.get("/google-init")
async def google_init():
    """
    Google OAuth 초기화
    google-issue.md - Client ID 백엔드 관리
    """
    state = AuthService.generate_state()
    
    # state를 임시로 저장 (실제: Redis 또는 DB)
    oauth_states[state] = {
        'created_at': datetime.utcnow().timestamp(),
    }
    
    auth_url = GoogleOAuthService.get_authorization_url(state)
    
    return {
        'auth_url': auth_url,
        'state': state,
    }
@router.post("/google-login")
async def google_login(
    request: GoogleLoginRequest,
    response: Response,
    db: Session = Depends(get_db)
):
    """
    Google OAuth 로그인 (Main_PJ2 패턴 적용)
    
    Main_PJ2 패턴:
    1. 인증 코드를 받음
    2. State 검증 (CSRF 방지)
    3. 코드를 토큰으로 교환
    4. ID 토큰 검증
    5. 사용자 생성 또는 조회
    6. JWT 발급
    7. httpOnly 쿠키에 저장
    """
    try:
        # 1. state 검증 (CSRF 방지)
        logger.info(f"[GOOGLE-LOGIN] Starting OAuth flow: code={request.code[:20] if request.code else 'N/A'}..., state={request.state}")
        if request.state not in oauth_states:
            logger.warning(f"[GOOGLE-LOGIN] Invalid state: {request.state}")
            raise HTTPException(status_code=400, detail="유효하지 않은 상태값(state)입니다")
        
        del oauth_states[request.state]
        logger.info(f"[GOOGLE-LOGIN] State validated")
        
        # 2. Main_PJ2 패턴: 인증 코드를 토큰으로 교환
        logger.info(f"[GOOGLE-LOGIN] Exchanging code for token...")
        if hasattr(request, 'code') and request.code:
            # Authorization Code Flow (추천)
            token_data = await GoogleOAuthService.exchange_code_for_token(request.code)
            logger.info(f"[GOOGLE-LOGIN] Token exchange response received: {bool(token_data)}")
            if not token_data or not token_data.get('token'):
                logger.warning(f"[GOOGLE-LOGIN] Token exchange failed: {token_data}")
                raise HTTPException(status_code=401, detail="토큰 교환에 실패했습니다")
            
            # ID 토큰이 포함되어 있는지 확인
            id_token = token_data.get('token')
            logger.info(f"[GOOGLE-LOGIN] ID token obtained")
        else:
            # ID 토큰 직접 전달 (Implicit Flow - 테스트용)
            logger.info(f"[GOOGLE-LOGIN] Using direct ID token")
            id_token = request.id_token
        
        # 3. ID 토큰 검증 (Main_PJ2의 verify_google_token 패턴)
        logger.info(f"[GOOGLE-LOGIN] Verifying ID token...")
        idinfo = await GoogleOAuthService.verify_google_token(id_token)
        if not idinfo:
            logger.warning(f"[GOOGLE-LOGIN] ID token verification failed")
            raise HTTPException(status_code=401, detail="유효하지 않은 토큰입니다")
        
        logger.info(f"[GOOGLE-LOGIN] ID token verified")
        
        # 4. 사용자 정보 추출
        logger.info(f"[GOOGLE-LOGIN] Extracting user info...")
        google_id = idinfo.get('sub')
        email = idinfo.get('email')
        name = idinfo.get('name', email)
        picture_url = idinfo.get('picture')
        
        logger.info(f"[GOOGLE-LOGIN] User info: google_id={google_id}, email={email}")
        
        if not google_id or not email:
            logger.error(f"[GOOGLE-LOGIN] Missing user info from idinfo")
            raise HTTPException(status_code=400, detail="사용자 정보가 누락되었습니다")
        
        # 5. 사용자 조회 또는 생성 (Main_PJ2 패턴)
        logger.info(f"[GOOGLE-LOGIN] Querying user by google_id...")
        user = UserRepository.get_by_google_id(db, google_id)
        
        if not user:
            # google_id로 없으면 email로도 확인 (기존 사용자)
            logger.info(f"[GOOGLE-LOGIN] User not found by google_id, checking by email...")
            user = UserRepository.get_by_email(db, email)
            
            if user:
                # 기존 사용자면 google_id만 업데이트
                logger.info(f"[GOOGLE-LOGIN] User found by email, updating google_id...")
                user = UserRepository.update(db, user.id, {
                    'google_id': google_id,
                    'picture_url': picture_url,
                    'last_login': datetime.utcnow()
                })
            else:
                # 완전히 새로운 사용자 생성
                logger.info(f"[GOOGLE-LOGIN] Creating new user: {email}")
                try:
                    user = UserRepository.create(db, {
                        'email': email,
                        'name': name if name else email.split('@')[0],
                        'google_id': google_id,
                        'picture_url': picture_url,
                    })
                    logger.info(f"[GOOGLE-LOGIN] User created: {user.id}")
                except Exception as e:
                    logger.error(f"[GOOGLE-LOGIN] User creation failed: {e}", exc_info=True)
                    # 롤백 후 다시 조회 (동시성 문제 처리)
                    try:
                        db.rollback()
                        user = UserRepository.get_by_email(db, email)
                        if user:
                            logger.info(f"[GOOGLE-LOGIN] User found after rollback: {user.id}")
                            user = UserRepository.update(db, user.id, {
                                'google_id': google_id,
                                'picture_url': picture_url,
                                'last_login': datetime.utcnow()
                            })
                        else:
                            raise
                    except Exception as e2:
                        logger.error(f"[GOOGLE-LOGIN] Recovery failed: {e2}", exc_info=True)
                        raise HTTPException(status_code=500, detail=f"사용자 생성 실패: {str(e2)}")
        else:
            # 기존 사용자 로그인
            logger.info(f"[GOOGLE-LOGIN] User login: {email}")
            user = UserRepository.update_last_login(db, user.id)
        
        logger.info(f"[GOOGLE-LOGIN] Generating JWT tokens...")
        # 6. JWT 발급 (Access + Refresh)
        tokens = AuthService.generate_tokens(user.id, user.email)
        logger.info(f"[GOOGLE-LOGIN] JWT tokens generated successfully")
        
        # 7. 응답 준비 (Main_PJ2 패턴: 토큰을 JSON으로 반환)
        logger.info(f"[GOOGLE-LOGIN] Preparing response...")
        response_data = {
            'user_id': str(user.id),
            'email': user.email,
            'name': user.name,
            'access_token': tokens['access_token'],
            'refresh_token': tokens['refresh_token'],
            'token_type': 'Bearer',
            'expires_in': tokens['expires_in'],
        }
        
        response = JSONResponse(response_data)
        
        # 8. httpOnly 쿠키에도 저장 (google-issue.md - Phase 1)
        response.set_cookie(
            key='access_token',
            value=tokens['access_token'],
            httponly=True,        # JavaScript 접근 불가
            secure=False,         # 개발 환경에서는 False (프로덕션: True)
            samesite='Lax',       # CSRF 방지
            max_age=15*60,        # 15분
            path='/',
        )
        
        response.set_cookie(
            key='refresh_token',
            value=tokens['refresh_token'],
            httponly=True,
            secure=False,         # 개발 환경
            samesite='Lax',
            max_age=7*24*60*60,   # 7일
            path='/',
        )
        
        logger.info(f"[GOOGLE-LOGIN] User logged in successfully: {user.email}")
        return response
    
    except HTTPException as http_exc:
        logger.warning(f"[GOOGLE-LOGIN] HTTPException: {http_exc.detail}")
        raise http_exc
    except Exception as e:
        logger.error(f"[GOOGLE-LOGIN] Unexpected error: {type(e).__name__}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"로그인 실패: {str(e)}")


@router.post("/refresh")
async def refresh_token(
    request: RefreshTokenRequest,
    response: Response
):
    """
    Access Token 갱신
    google-issue.md - Phase 2: Refresh Token
    """
    
    new_access_token = AuthService.refresh_access_token(request.refresh_token)
    
    if not new_access_token:
        raise HTTPException(status_code=401, detail="유효하지 않은 리프레시 토큰입니다")
    
    response = JSONResponse({
        'access_token': new_access_token,
        'token_type': 'Bearer',
        'expires_in': 15*60,
    })
    
    # 새로운 access_token을 쿠키에 설정
    response.set_cookie(
        key='access_token',
        value=new_access_token,
        httponly=True,
        secure=True,
        samesite='Strict',
        max_age=15*60,
    )
    
    return response


@router.post("/logout")
async def logout(response: Response):
    """로그아웃 (쿠키 삭제)"""
    
    response = JSONResponse({'message': 'Logged out successfully'})
    
    # 쿠키 삭제
    response.delete_cookie('access_token')
    response.delete_cookie('refresh_token')
    
    logger.info("User logged out")
    return response


async def get_current_user(
    request: Request,
    db: Session = Depends(get_db)
) -> 'User':
    """현재 사용자 정보 조회 (Dependency)
    Authorization 헤더 또는 쿠키에서 토큰을 읽고 User 객체 반환
    """
    
    # 쿠키 또는 Authorization 헤더에서 access_token 가져오기
    access_token = request.cookies.get('access_token')
    
    # Authorization 헤더 확인 (Bearer token)
    if not access_token:
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            access_token = auth_header.split(' ')[1]
    
    if not access_token:
        logger.warning("[GET_CURRENT_USER] No token provided")
        raise HTTPException(status_code=401, detail="인증되지 않았습니다")
    
    # 토큰 검증
    payload = AuthService.verify_jwt(access_token, token_type='access')
    
    if not payload:
        logger.warning("[GET_CURRENT_USER] Invalid token")
        raise HTTPException(status_code=401, detail="유효하지 않은 토큰입니다")
    
    # 사용자 조회
    user = UserRepository.get_by_id(db, payload['user_id'])
    
    if not user:
        logger.warning(f"[GET_CURRENT_USER] User not found: {payload['user_id']}")
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다")
    
    logger.info(f"[GET_CURRENT_USER] User authenticated: {user.email}")
    return user


@router.patch("/me")
async def update_current_user(
    user_update: dict,
    current_user: 'User' = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """현재 사용자 정보 업데이트"""
    from app.schemas import UserUpdate
    
    # UserUpdate 스키마로 변환
    update_data = UserUpdate(**user_update)
    
    # 업데이트할 필드만 추출
    update_dict = update_data.dict(exclude_unset=True)
    
    # 사용자 정보 업데이트
    updated_user = UserRepository.update(db, current_user.id, update_dict)
    
    return updated_user.to_dict()


@router.get("/me")
async def get_current_user_endpoint(
    current_user: 'User' = Depends(get_current_user)
):
    """현재 사용자 정보 조회 엔드포인트"""
    return current_user.to_dict()

@router.post("/test-google-login")
async def test_google_login(db: Session = Depends(get_db)):
    """
    Google 로그인 디버그 엔드포인트 (테스트용)
    실제 Google 인증 없이 사용자를 생성하고 토큰을 반환합니다
    """
    try:
        logger.info("[TEST] Starting test login flow...")
        
        # 테스트 사용자 정보
        test_email = f"test_user_{secrets.token_hex(4)}@gmail.com"
        test_google_id = f"google_{secrets.token_hex(8)}"
        test_name = "Test User"
        
        logger.info(f"[TEST] Creating test user: {test_email}")
        
        # 사용자 생성
        user = UserRepository.create(db, {
            'email': test_email,
            'name': test_name,
            'google_id': test_google_id,
            'picture_url': 'https://example.com/avatar.jpg',
        })
        
        logger.info(f"[TEST] User created: {user.id}")
        
        # JWT 생성
        logger.info(f"[TEST] Generating JWT tokens...")
        tokens = AuthService.generate_tokens(user.id, user.email)
        
        logger.info(f"[TEST] Tokens generated successfully")
        
        response_data = {
            'user_id': str(user.id),
            'email': user.email,
            'name': user.name,
            'access_token': tokens['access_token'],
            'refresh_token': tokens['refresh_token'],
            'token_type': 'Bearer',
            'expires_in': tokens['expires_in'],
        }
        
        logger.info(f"[TEST] Response data prepared: {response_data}")
        
        response = JSONResponse(response_data)
        
        # httpOnly 쿠키 설정
        response.set_cookie(
            key='access_token',
            value=tokens['access_token'],
            httponly=True,
            secure=False,
            samesite='Lax',
            max_age=15*60,
            path='/',
        )
        
        response.set_cookie(
            key='refresh_token',
            value=tokens['refresh_token'],
            httponly=True,
            secure=False,
            samesite='Lax',
            max_age=7*24*60*60,
            path='/',
        )
        
        logger.info(f"[TEST] Login successful, returning response")
        return response
        
    except Exception as e:
        logger.error(f"[TEST] Error: {type(e).__name__}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"테스트 로그인 실패: {str(e)}")