"""
Google Calendar 연동 엔드포인트
"""
import json
import logging
import secrets
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, date

from app.database import get_db
from app.models.user import User
from app.services.calendar_service import GoogleCalendarService
from app.api.routes.auth import get_current_user, oauth_states
from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/calendar",
    tags=["calendar"],
)


@router.post("/sync/{todo_id}")
async def sync_todo_to_google_calendar(
    todo_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """일정을 Google Calendar에 동기화"""
    try:
        # 사용자의 Google Calendar 토큰 확인
        if not current_user.google_calendar_token:
            raise HTTPException(
                status_code=400,
                detail="Google Calendar 연동이 필요합니다. 설정에서 연동해주세요."
            )
        
        # TODO: Todo 모델에서 일정 정보 가져오기
        from app.models.models import Todo
        todo = db.query(Todo).filter(
            Todo.id == todo_id,
            Todo.user_id == current_user.id,
            Todo.deleted_at.is_(None)
        ).first()
        
        if not todo:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="일정을 찾을 수 없습니다"
            )
        
        # Google Calendar에 이벤트 생성
        start_datetime = None
        end_datetime = None
        
        if todo.date:
            if todo.all_day:
                # 종일 이벤트
                start_datetime = datetime.combine(todo.date, datetime.min.time())
                end_datetime = start_datetime + timedelta(days=1)
            else:
                # 시간 지정 이벤트
                if todo.start_time:
                    start_datetime = datetime.combine(todo.date, todo.start_time)
                else:
                    start_datetime = datetime.combine(todo.date, datetime.min.time())
                
                if todo.end_time:
                    end_datetime = datetime.combine(todo.date, todo.end_time)
                else:
                    end_datetime = start_datetime + timedelta(hours=1)
        
        if not start_datetime:
            raise HTTPException(
                status_code=400,
                detail="일정 날짜가 필요합니다"
            )
        
        # Google Calendar에 이벤트 생성
        event = await GoogleCalendarService.create_event(
            token_json=current_user.google_calendar_token,
            title=todo.title,
            description=todo.memo or todo.description or "",
            start_datetime=start_datetime,
            end_datetime=end_datetime,
            location=todo.location or "",
            all_day=todo.all_day
        )
        
        if not event:
            raise HTTPException(
                status_code=500,
                detail="Google Calendar 동기화에 실패했습니다"
            )
        
        # Todo에 Google Calendar 이벤트 ID 저장 (추후 업데이트/삭제용)
        # TODO: Todo 모델에 google_calendar_event_id 필드 추가 필요
        
        return {
            "success": True,
            "event_id": event.get('id'),
            "event_url": event.get('htmlLink'),
            "message": "Google Calendar에 동기화되었습니다"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Google Calendar 동기화 실패: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"동기화 실패: {str(e)}"
        )


@router.get("/google-auth-url")
async def get_google_calendar_auth_url(
    current_user: User = Depends(get_current_user)
):
    """Google Calendar 연동을 위한 OAuth URL 가져오기"""
    from app.services.auth_service import GoogleOAuthService
    from app.api.routes.auth import oauth_states
    from datetime import datetime
    
    state = secrets.token_urlsafe(32)
    oauth_states[state] = {
        'created_at': datetime.utcnow().timestamp(),
    }
    
    # 기본 OAuth URL 생성
    auth_url = GoogleOAuthService.get_authorization_url(state)
    
    # Calendar OAuth임을 나타내는 source 파라미터 추가
    # 프론트엔드에서 이를 감지하여 /calendar/google-callback으로 보내도록 함
    if '?' in auth_url:
        auth_url += '&source=calendar'
    else:
        auth_url += '?source=calendar'
    
    logger.info(f"[GOOGLE_CALENDAR_AUTH_URL] Calendar OAuth URL 생성 - state: {state[:20]}..., source: calendar")
    
    return {
        "auth_url": auth_url,
        "state": state
    }


@router.get("/status")
async def get_calendar_status(
    current_user: User = Depends(get_current_user)
):
    """Google Calendar 연동 상태 확인"""
    import json
    
    token_exists = bool(current_user.google_calendar_token)
    token_valid = False
    
    if token_exists:
        try:
            # 토큰이 유효한 JSON인지 확인
            token_data = json.loads(current_user.google_calendar_token)
            token_valid = bool(token_data.get('access_token'))
        except:
            token_valid = False
    
    logger.info(f"Google Calendar 상태 확인 - 사용자: {current_user.email}, enabled: {current_user.google_calendar_enabled}, token_exists: {token_exists}, token_valid: {token_valid}")
    
    return {
        "enabled": current_user.google_calendar_enabled == "true",
        "connected": token_exists and token_valid,
        "token_exists": token_exists,
        "token_valid": token_valid
    }


@router.post("/enable")
async def enable_calendar_sync(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Google Calendar 연동 활성화"""
    if not current_user.google_calendar_token:
        raise HTTPException(
            status_code=400,
            detail="Google Calendar 토큰이 없습니다. 먼저 Google 로그인을 해주세요."
        )
    
    current_user.google_calendar_enabled = "true"
    db.commit()
    
    return {
        "success": True,
        "message": "Google Calendar 연동이 활성화되었습니다"
    }


@router.post("/disable")
async def disable_calendar_sync(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Google Calendar 연동 비활성화"""
    current_user.google_calendar_enabled = "false"
    db.commit()
    
    return {
        "success": True,
        "message": "Google Calendar 연동이 비활성화되었습니다"
    }


@router.post("/google-callback")
async def google_calendar_callback(
    code: str,
    state: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Google Calendar OAuth 콜백 처리"""
    from app.api.routes.auth import oauth_states
    from app.services.auth_service import GoogleOAuthService
    import json
    
    try:
        # State 검증
        if state not in oauth_states:
            raise HTTPException(
                status_code=400,
                detail="유효하지 않은 상태값(state)입니다"
            )
        
        del oauth_states[state]
        
        # 인증 코드를 토큰으로 교환
        token_data = await GoogleOAuthService.exchange_code_for_token(code)
        if not token_data or not token_data.get('access_token'):
            raise HTTPException(
                status_code=401,
                detail="토큰 교환에 실패했습니다"
            )
        
        # Google Calendar 토큰을 JSON으로 저장
        # refresh_token 확인 (필수 필드)
        refresh_token = token_data.get('refresh_token')
        if not refresh_token:
            logger.warning(f"[GOOGLE_CALLBACK] refresh_token이 없습니다. 재동의가 필요할 수 있습니다.")
            # 기존 토큰에서 refresh_token 가져오기 시도
            try:
                existing_token = json.loads(current_user.google_calendar_token) if current_user.google_calendar_token else None
                if existing_token and existing_token.get('refresh_token'):
                    refresh_token = existing_token.get('refresh_token')
                    logger.info(f"[GOOGLE_CALLBACK] 기존 refresh_token 사용")
            except:
                pass
        
        # expiry 처리 (expires_in이 초 단위로 오면 datetime으로 변환)
        expiry = token_data.get('expiry')
        if not expiry and token_data.get('expires_in'):
            from datetime import datetime, timedelta
            expiry = datetime.utcnow() + timedelta(seconds=token_data.get('expires_in'))
            logger.info(f"[GOOGLE_CALLBACK] expiry 계산: {expiry}")
        
        calendar_token = json.dumps({
            'access_token': token_data.get('access_token'),
            'refresh_token': refresh_token,  # 필수
            'token_uri': 'https://oauth2.googleapis.com/token',  # 고정값 사용
            'client_id': settings.google_client_id,
            'client_secret': settings.google_client_secret,
            'scopes': GoogleOAuthService.SCOPES,
            'expiry': expiry.isoformat() if expiry and hasattr(expiry, 'isoformat') else expiry,
        })
        
        logger.info(f"[GOOGLE_CALLBACK] 저장할 토큰 필드 확인:")
        logger.info(f"  - access_token: {bool(token_data.get('access_token'))}")
        logger.info(f"  - refresh_token: {bool(refresh_token)}")
        logger.info(f"  - token_uri: {'https://oauth2.googleapis.com/token'}")
        logger.info(f"  - client_id: {bool(settings.google_client_id)}")
        logger.info(f"  - client_secret: {bool(settings.google_client_secret)}")
        logger.info(f"  - expiry: {expiry}")
        
        # 사용자에 토큰 저장
        current_user.google_calendar_token = calendar_token
        current_user.google_calendar_enabled = "true"
        db.commit()
        
        logger.info(f"Google Calendar 연동 완료: {current_user.email}")
        
        return {
            "success": True,
            "message": "Google Calendar 연동이 완료되었습니다"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Google Calendar 콜백 처리 실패: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"연동 실패: {str(e)}"
        )


@router.get("/debug/calendars")
async def debug_list_calendars(
    current_user: User = Depends(get_current_user)
):
    """Google Calendar 목록 디버깅용"""
    if not current_user.google_calendar_token:
        raise HTTPException(status_code=400, detail="토큰이 없습니다")
    
    try:
        import json
        
        # 저장된 토큰 확인
        token_data = json.loads(current_user.google_calendar_token)
        logger.info(f"[DEBUG_CALENDARS] 저장된 토큰 필드:")
        logger.info(f"  - access_token: {bool(token_data.get('access_token'))}")
        logger.info(f"  - refresh_token: {bool(token_data.get('refresh_token'))}")
        logger.info(f"  - token_uri: {token_data.get('token_uri')}")
        logger.info(f"  - client_id: {bool(token_data.get('client_id'))}")
        logger.info(f"  - client_secret: {bool(token_data.get('client_secret'))}")
        logger.info(f"  - scopes: {token_data.get('scopes')}")
        logger.info(f"  - expiry: {token_data.get('expiry')}")
        
        # GoogleCalendarService 사용 (자동으로 토큰 검증 및 갱신)
        from app.services.calendar_service import GoogleCalendarService
        credentials = GoogleCalendarService.get_credentials_from_token(current_user.google_calendar_token)
        if not credentials:
            return {
                "success": False,
                "error": "Credentials 생성 실패",
                "token_fields": {
                    "access_token": bool(token_data.get('access_token')),
                    "refresh_token": bool(token_data.get('refresh_token')),
                    "token_uri": token_data.get('token_uri'),
                    "client_id": bool(token_data.get('client_id')),
                    "client_secret": bool(token_data.get('client_secret')),
                }
            }
        
        from google.auth.transport.requests import Request
        if credentials.expired:
            try:
                credentials.refresh(Request())
                logger.info("[DEBUG_CALENDARS] 토큰 갱신 성공")
            except Exception as refresh_error:
                logger.error(f"[DEBUG_CALENDARS] 토큰 갱신 실패: {refresh_error}", exc_info=True)
                return {
                    "success": False,
                    "error": f"토큰 갱신 실패: {str(refresh_error)}",
                    "token_fields": {
                        "access_token": bool(token_data.get('access_token')),
                        "refresh_token": bool(token_data.get('refresh_token')),
                        "token_uri": token_data.get('token_uri'),
                    }
                }
        
        from googleapiclient.discovery import build
        service = build('calendar', 'v3', credentials=credentials)
        calendar_list = service.calendarList().list().execute()
        
        calendars = []
        for calendar in calendar_list.get('items', []):
            calendars.append({
                'id': calendar.get('id'),
                'summary': calendar.get('summary'),
                'primary': calendar.get('primary', False),
                'accessRole': calendar.get('accessRole'),
            })
        
        return {
            "success": True,
            "calendars": calendars,
            "primary_id": next((c['id'] for c in calendars if c['primary']), None)
        }
    except Exception as e:
        logger.error(f"[DEBUG_CALENDARS] 캘린더 목록 가져오기 실패: {e}", exc_info=True)
        import traceback
        return {
            "success": False,
            "error": str(e),
            "traceback": traceback.format_exc()
        }


@router.get("/events")
async def get_google_calendar_events(
    time_min: Optional[str] = None,
    time_max: Optional[str] = None,
    max_results: int = 100,
    current_user: User = Depends(get_current_user)
):
    """Google Calendar에서 이벤트 목록 가져오기"""
    logger.info(f"[GET_GOOGLE_EVENTS] 요청 시작 - 사용자: {current_user.email}, token 존재: {bool(current_user.google_calendar_token)}")
    
    if not current_user.google_calendar_token:
        logger.warning(f"[GET_GOOGLE_EVENTS] 토큰 없음 - 사용자: {current_user.email}")
        raise HTTPException(
            status_code=400,
            detail="Google Calendar 연동이 필요합니다. 설정에서 연동해주세요."
        )
    
    try:
        # 시간 범위 파싱
        start_datetime = None
        end_datetime = None
        
        from datetime import timezone
        
        if time_min:
            # ISO 형식 파싱 (Z 또는 +00:00 모두 처리)
            if time_min.endswith('Z'):
                start_datetime = datetime.fromisoformat(time_min.replace('Z', '+00:00'))
            else:
                start_datetime = datetime.fromisoformat(time_min)
            # UTC로 명시적 변환
            if start_datetime.tzinfo is None:
                start_datetime = start_datetime.replace(tzinfo=timezone.utc)
            else:
                start_datetime = start_datetime.astimezone(timezone.utc)
        else:
            start_datetime = datetime.now(timezone.utc)
        
        if time_max:
            # ISO 형식 파싱
            if time_max.endswith('Z'):
                end_datetime = datetime.fromisoformat(time_max.replace('Z', '+00:00'))
            else:
                end_datetime = datetime.fromisoformat(time_max)
            # UTC로 명시적 변환
            if end_datetime.tzinfo is None:
                end_datetime = end_datetime.replace(tzinfo=timezone.utc)
            else:
                end_datetime = end_datetime.astimezone(timezone.utc)
        else:
            end_datetime = start_datetime + timedelta(days=30)
        
        # naive datetime으로 변환 (GoogleCalendarService에서 처리)
        start_datetime_naive = start_datetime.replace(tzinfo=None)
        end_datetime_naive = end_datetime.replace(tzinfo=None)
        
        logger.info(f"[GET_GOOGLE_EVENTS] 시간 범위: {start_datetime} (UTC) ~ {end_datetime} (UTC)")
        logger.info(f"[GET_GOOGLE_EVENTS] 시간 범위 (한국시간): {start_datetime + timedelta(hours=9)} ~ {end_datetime + timedelta(hours=9)}")
        
        # Google Calendar에서 이벤트 가져오기
        logger.info(f"[GET_GOOGLE_EVENTS] Google Calendar API 호출 시작...")
        logger.info(f"[GET_GOOGLE_EVENTS] 시간 변환 - naive: {start_datetime_naive} ~ {end_datetime_naive}")
        events = await GoogleCalendarService.list_events(
            token_json=current_user.google_calendar_token,
            time_min=start_datetime_naive,
            time_max=end_datetime_naive,
            max_results=max_results
        )
        
        logger.info(f"[GET_GOOGLE_EVENTS] Google Calendar 이벤트 {len(events)}개 가져옴 - 사용자: {current_user.email}")
        
        # 이벤트가 없을 경우 상세 정보 로깅
        if len(events) == 0:
            logger.warning(f"[GET_GOOGLE_EVENTS] 이벤트가 없습니다. Google Calendar에 해당 기간 내 이벤트가 있는지 확인하세요.")
            logger.info(f"[GET_GOOGLE_EVENTS] 요청한 시간 범위: {start_datetime} ~ {end_datetime} (UTC)")
        
        # 이벤트를 앱 형식으로 변환
        formatted_events = []
        for event in events:
            start = event.get('start', {})
            end = event.get('end', {})
            
            # 시작 시간 파싱
            start_date = None
            start_time = None
            all_day = False
            
            if 'date' in start:
                # 종일 이벤트
                all_day = True
                start_date_str = start['date']
                if 'T' in start_date_str:
                    start_date = datetime.fromisoformat(start_date_str.replace('Z', '+00:00')).date()
                else:
                    start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
            elif 'dateTime' in start:
                # 시간 지정 이벤트
                start_datetime_str = start['dateTime'].replace('Z', '+00:00')
                start_datetime_obj = datetime.fromisoformat(start_datetime_str)
                start_date = start_datetime_obj.date()
                start_time = start_datetime_obj.strftime('%H:%M')
            
            # 종료 시간 파싱
            end_time = None
            if 'dateTime' in end:
                end_datetime_obj = datetime.fromisoformat(end['dateTime'].replace('Z', '+00:00'))
                end_time = end_datetime_obj.strftime('%H:%M')
            
            formatted_events.append({
                'id': event.get('id'),
                'title': event.get('summary', '제목 없음'),
                'description': event.get('description', ''),
                'location': event.get('location', ''),
                'date': start_date.isoformat() if start_date else None,
                'start_time': start_time,
                'end_time': end_time,
                'all_day': all_day,
                'html_link': event.get('htmlLink'),
                'google_calendar_event_id': event.get('id'),
                'source': 'google_calendar'
            })
        
        return {
            "success": True,
            "events": formatted_events,
            "count": len(formatted_events),
            "debug": {
                "time_min": start_datetime.isoformat() + 'Z' if start_datetime else None,
                "time_max": end_datetime.isoformat() + 'Z' if end_datetime else None,
                "raw_events_count": len(events),
                "formatted_events_count": len(formatted_events),
                "time_min_iso": start_datetime.isoformat() + 'Z' if start_datetime else None,
                "time_max_iso": end_datetime.isoformat() + 'Z' if end_datetime else None,
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[GET_GOOGLE_EVENTS] Google Calendar 이벤트 가져오기 실패: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"이벤트 가져오기 실패: {str(e)}"
        )


@router.get("/test-connection")
async def test_google_calendar_connection(
    current_user: User = Depends(get_current_user)
):
    """Google Calendar 연결 테스트 (디버깅용)"""
    if not current_user.google_calendar_token:
        return {
            "success": False,
            "error": "Google Calendar 토큰이 없습니다"
        }
    
    try:
        import json
        token_data = json.loads(current_user.google_calendar_token)
        
        # Credentials 생성 테스트
        credentials = GoogleCalendarService.get_credentials_from_token(current_user.google_calendar_token)
        if not credentials:
            return {
                "success": False,
                "error": "Credentials 생성 실패"
            }
        
        # 서비스 생성 테스트
        service = GoogleCalendarService.get_calendar_service(credentials)
        if not service:
            return {
                "success": False,
                "error": "Calendar 서비스 생성 실패"
            }
        
        # 간단한 API 호출 테스트 (캘린더 목록 가져오기)
        try:
            calendar_list = service.calendarList().list().execute()
            calendars = calendar_list.get('items', [])
            
            return {
                "success": True,
                "credentials_valid": True,
                "service_created": True,
                "calendars_count": len(calendars),
                "primary_calendar": next((c for c in calendars if c.get('primary')), None),
                "token_info": {
                    "has_access_token": bool(token_data.get('access_token')),
                    "has_refresh_token": bool(token_data.get('refresh_token')),
                    "scopes": token_data.get('scopes', [])
                }
            }
        except HttpError as e:
            return {
                "success": False,
                "error": f"Google Calendar API 호출 실패: {e}",
                "status_code": e.resp.status if hasattr(e, 'resp') else None
            }
        except Exception as e:
            return {
                "success": False,
                "error": f"API 호출 중 오류: {str(e)}"
            }
            
    except Exception as e:
        logger.error(f"[TEST_CONNECTION] 연결 테스트 실패: {e}", exc_info=True)
        return {
            "success": False,
            "error": str(e)
        }

