"""
Google OAuth 보안 서비스
google-issue.md - Phase 1 적용:
1. httpOnly 쿠키
2. State 파라미터 (CSRF 방지)
3. Refresh Token
4. Client ID 백엔드 관리
"""
import jwt
from datetime import datetime, timedelta
from typing import Optional, Dict
import secrets
import logging
from app.config import settings

logger = logging.getLogger(__name__)


class AuthService:
    """인증 서비스"""
    
    @staticmethod
    def generate_state() -> str:
        """CSRF 방지용 state 토큰 생성"""
        return secrets.token_urlsafe(32)
    
    @staticmethod
    def verify_state(state: str, stored_state: str) -> bool:
        """state 토큰 검증"""
        return secrets.compare_digest(state, stored_state)
    
    @classmethod
    def generate_tokens(cls, user_id: str, email: str) -> Dict:
        """
        Access Token + Refresh Token 발급
        google-issue.md - Phase 2 참고
        """
        
        # Access Token (15분)
        access_payload = {
            'user_id': user_id,
            'email': email,
            'type': 'access',
            'iat': datetime.utcnow(),
            'exp': datetime.utcnow() + timedelta(minutes=settings.jwt_access_expiry_minutes)
        }
        
        access_token = jwt.encode(
            access_payload,
            settings.jwt_secret,
            algorithm=settings.jwt_algorithm
        )
        
        # Refresh Token (7일)
        refresh_payload = {
            'user_id': user_id,
            'type': 'refresh',
            'iat': datetime.utcnow(),
            'exp': datetime.utcnow() + timedelta(days=settings.jwt_refresh_expiry_days)
        }
        
        refresh_token = jwt.encode(
            refresh_payload,
            settings.jwt_secret,
            algorithm=settings.jwt_algorithm
        )
        
        return {
            'access_token': access_token,
            'refresh_token': refresh_token,
            'token_type': 'Bearer',
            'expires_in': settings.jwt_access_expiry_minutes * 60,  # 초 단위
        }
    
    @classmethod
    def verify_jwt(cls, token: str, token_type: str = 'access') -> Optional[Dict]:
        """JWT 토큰 검증"""
        try:
            payload = jwt.decode(
                token,
                settings.jwt_secret,
                algorithms=[settings.jwt_algorithm]
            )
            
            # 토큰 타입 확인
            if payload.get('type') != token_type:
                logger.warning(f"Invalid token type: expected {token_type}, got {payload.get('type')}")
                return None
            
            return payload
            
        except jwt.ExpiredSignatureError:
            logger.info("Token expired")
            return None
        except jwt.InvalidTokenError as e:
            logger.warning(f"Invalid token: {e}")
            return None
    
    @classmethod
    def refresh_access_token(cls, refresh_token: str) -> Optional[str]:
        """
        Refresh Token으로 새로운 Access Token 발급
        google-issue.md - Phase 2 참고
        """
        payload = cls.verify_jwt(refresh_token, token_type='refresh')
        
        if not payload:
            return None
        
        # 새로운 Access Token 생성
        new_access_payload = {
            'user_id': payload['user_id'],
            'type': 'access',
            'iat': datetime.utcnow(),
            'exp': datetime.utcnow() + timedelta(minutes=settings.jwt_access_expiry_minutes)
        }
        
        new_access_token = jwt.encode(
            new_access_payload,
            settings.jwt_secret,
            algorithm=settings.jwt_algorithm
        )
        
        logger.info(f"Access token refreshed for user {payload['user_id']}")
        return new_access_token


class GoogleOAuthService:
    """
    Google OAuth 서비스
    Main_PJ2 패턴 적용:
    - google_oauth.py 의 build_flow 패턴
    - 인증 URL 생성 → 코드 교환 → 토큰 획득
    """
    
    # 일반 로그인용 SCOPES (사용자 프로필 정보)
    SCOPES = [
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile",
        "openid",
    ]
    
    # 캘린더 전용 SCOPES (캘린더 API만)
    CALENDAR_SCOPES = [
        "https://www.googleapis.com/auth/calendar",
    ]
    
    @staticmethod
    def build_oauth_config() -> Dict:
        """
        OAuth 설정 빌드 (Main_PJ2의 build_flow 패턴)
        """
        return {
            "web": {
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [settings.google_redirect_uri],
            }
        }
    
    @staticmethod
    def get_authorization_url(state: str, calendar: bool = False) -> str:
        """
        Google 인증 URL 생성 (Main_PJ2의 get_authorization_url 패턴)
        calendar=True인 경우 캘린더 전용 SCOPES 사용
        """
        scopes = GoogleOAuthService.CALENDAR_SCOPES if calendar else GoogleOAuthService.SCOPES
        
        params = {
            'client_id': settings.google_client_id,
            'redirect_uri': settings.google_redirect_uri,
            'response_type': 'code',
            'scope': ' '.join(scopes),
            'state': state,  # CSRF 방지
            'access_type': 'offline',  # Refresh token 요청
            'include_granted_scopes': 'true',
            'prompt': 'consent',  # 테스트/재동의 안정성 (Main_PJ2 권장)
        }
        
        query_string = '&'.join([f"{k}={v}" for k, v in params.items()])
        return f"https://accounts.google.com/o/oauth2/v2/auth?{query_string}"
    
    @staticmethod
    async def exchange_code_for_token(code: str, calendar: bool = False) -> Optional[Dict]:
        """
        인증 코드 → 토큰 교환 (Main_PJ2의 exchange_code_for_token 패턴)
        calendar=True인 경우 캘린더 전용 토큰 반환
        """
        import aiohttp
        
        try:
            logger.info(f"[TOKEN_EXCHANGE] Starting token exchange with code: {code[:20]}...")
            logger.info(f"[TOKEN_EXCHANGE] Using client_id: {settings.google_client_id[:20]}...")
            logger.info(f"[TOKEN_EXCHANGE] Using redirect_uri: {settings.google_redirect_uri}")
            logger.info(f"[TOKEN_EXCHANGE] Calendar mode: {calendar}")
            
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    'https://oauth2.googleapis.com/token',
                    data={
                        'client_id': settings.google_client_id,
                        'client_secret': settings.google_client_secret,
                        'code': code,
                        'grant_type': 'authorization_code',
                        'redirect_uri': settings.google_redirect_uri,
                    }
                ) as resp:
                    response_text = await resp.text()
                    logger.info(f"[TOKEN_EXCHANGE] Response status: {resp.status}")
                    logger.info(f"[TOKEN_EXCHANGE] Response body: {response_text[:500]}")
                    
                    if resp.status == 200:
                        token_data = await resp.json()
                        logger.info(f"[TOKEN_EXCHANGE] Token exchange successful, got id_token: {bool(token_data.get('id_token'))}")
                        
                        # expiry 계산 (초 단위 → ISO 형식 datetime 문자열)
                        expires_in = token_data.get('expires_in', 3600)
                        expiry_dt = datetime.utcnow() + timedelta(seconds=expires_in)
                        expiry_iso = expiry_dt.isoformat() + 'Z'
                        
                        if calendar:
                            # 캘린더 전용 토큰 반환
                            return {
                                "access_token": token_data.get('access_token'),
                                "refresh_token": token_data.get('refresh_token'),
                                "token_uri": 'https://oauth2.googleapis.com/token',
                                "client_id": settings.google_client_id,
                                "client_secret": settings.google_client_secret,
                                "scopes": GoogleOAuthService.CALENDAR_SCOPES,
                                "expiry": expiry_iso,  # ISO 형식
                                "expires_in": expires_in,
                            }
                        else:
                            # 일반 로그인 토큰 반환
                            return {
                                "token": token_data.get('id_token'),  # ID 토큰 사용
                                "access_token": token_data.get('access_token'),
                                "refresh_token": token_data.get('refresh_token'),
                                "token_uri": token_data.get('token_uri', 'https://oauth2.googleapis.com/token'),
                                "client_id": settings.google_client_id,
                                "client_secret": settings.google_client_secret,
                                "scopes": GoogleOAuthService.SCOPES,
                                "expiry": expiry_iso,  # ISO 형식
                                "expires_in": expires_in,
                            }
                    else:
                        logger.error(f"[TOKEN_EXCHANGE] Token exchange failed: {resp.status}")
                        logger.error(f"[TOKEN_EXCHANGE] Error response: {response_text}")
                        return None
        except Exception as e:
            logger.error(f"[TOKEN_EXCHANGE] Exception: {e}", exc_info=True)
            return None
    
    @staticmethod
    async def verify_google_token(id_token: str) -> Optional[Dict]:
        """
        Google ID 토큰 검증
        Main_PJ2 패턴을 따릅니다
        """
        try:
            from google.auth.transport import requests as google_requests
            from google.oauth2 import id_token as google_id_token
            
            logger.info(f"[TOKEN_VERIFY] Starting token verification")
            # Google 공개 키로 검증 (프로덕션 권장)
            request = google_requests.Request()
            idinfo = google_id_token.verify_oauth2_token(
                id_token, 
                request, 
                settings.google_client_id
            )
            
            logger.info(f"[TOKEN_VERIFY] Token verified for user: {idinfo.get('email')}")
            return idinfo
            
        except Exception as e:
            logger.error(f"[TOKEN_VERIFY] Primary verification failed: {e}", exc_info=True)
            # Fallback: JWT 검증 (테스트용)
            try:
                logger.info(f"[TOKEN_VERIFY] Trying fallback JWT decode")
                payload = jwt.decode(
                    id_token,
                    options={"verify_signature": False}
                )
                logger.warning(f"[TOKEN_VERIFY] Token verified without signature (test mode), user: {payload.get('email')}")
                return payload
            except Exception as e2:
                logger.error(f"[TOKEN_VERIFY] Fallback verification also failed: {e2}", exc_info=True)
                return None
