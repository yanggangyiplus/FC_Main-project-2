"""
Google Calendar API 서비스
일정을 Google Calendar와 동기화
"""
import json
import logging
from typing import Optional, Dict, List, Any
from datetime import datetime, timedelta
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from google.auth.transport.requests import Request

from app.config import settings

logger = logging.getLogger(__name__)


class GoogleCalendarService:
    """Google Calendar API 서비스"""
    
    SCOPES = ['https://www.googleapis.com/auth/calendar']
    
    @staticmethod
    def is_token_expired(credentials: Credentials) -> bool:
        """토큰 만료 여부 안전하게 체크 (timezone 문제 방지)"""
        try:
            if not credentials.expiry:
                return False  # expiry가 없으면 만료되지 않은 것으로 간주
            
            # expiry가 timezone-aware인 경우 naive로 변환
            expiry = credentials.expiry
            if expiry.tzinfo is not None:
                expiry = expiry.replace(tzinfo=None)
            
            # 현재 시간과 비교 (UTC)
            now = datetime.utcnow()
            return now >= expiry
        except Exception as e:
            logger.warning(f"[IS_TOKEN_EXPIRED] 만료 체크 실패: {e}, 갱신 시도")
            return True  # 오류 시 만료된 것으로 간주하여 갱신 시도
    
    @staticmethod
    def get_credentials_from_token(token_json: str) -> Optional[Credentials]:
        """저장된 토큰 JSON으로 Credentials 객체 생성"""
        try:
            token_data = json.loads(token_json)
            
            # expiry 처리 (ISO 형식 문자열만 지원 - 표준화)
            # ⚠️ google.oauth2.credentials는 naive datetime을 사용하므로 timezone 제거 필요
            expiry = None
            expiry_str = token_data.get('expiry')
            if expiry_str:
                if isinstance(expiry_str, str):
                    # ISO 형식 문자열인 경우 (권장 형식: 'YYYY-MM-DDTHH:MM:SSZ')
                    try:
                        # Z를 +00:00으로 변환하여 파싱
                        expiry_str_normalized = expiry_str.replace('Z', '+00:00')
                        expiry_aware = datetime.fromisoformat(expiry_str_normalized)
                        # timezone 정보 제거 (naive datetime으로 변환) - UTC 시간 유지
                        expiry = expiry_aware.replace(tzinfo=None)
                        logger.info(f"[GET_CREDENTIALS] expiry 파싱 성공: {expiry_str} → {expiry} (naive)")
                    except Exception as parse_error:
                        logger.warning(f"[GET_CREDENTIALS] expiry 파싱 실패 ({expiry_str}): {parse_error}")
                        expiry = None
                else:
                    logger.warning(f"[GET_CREDENTIALS] expiry 타입이 잘못됨: {type(expiry_str)} (기대값: str)")
            
            # 필수 필드 확인
            access_token = token_data.get('access_token')
            refresh_token = token_data.get('refresh_token')
            token_uri = token_data.get('token_uri') or 'https://oauth2.googleapis.com/token'
            client_id = token_data.get('client_id') or settings.google_client_id
            client_secret = token_data.get('client_secret') or settings.google_client_secret
            
            # 필수 필드 검증
            if not access_token:
                logger.error("[GET_CREDENTIALS] access_token이 없습니다")
                return None
            if not refresh_token:
                logger.error("[GET_CREDENTIALS] refresh_token이 없습니다 (토큰 갱신 불가)")
                logger.error(f"[GET_CREDENTIALS] 토큰 데이터 필드: {list(token_data.keys())}")
                return None
            if not client_id:
                logger.error("[GET_CREDENTIALS] client_id가 없습니다")
                return None
            if not client_secret:
                logger.error("[GET_CREDENTIALS] client_secret이 없습니다")
                return None
            
            credentials = Credentials(
                token=access_token,
                refresh_token=refresh_token,
                token_uri=token_uri,
                client_id=client_id,
                client_secret=client_secret,
                scopes=token_data.get('scopes', GoogleCalendarService.SCOPES),
            )
            
            # expiry가 있으면 설정
            if expiry:
                credentials.expiry = expiry
                logger.info(f"[GET_CREDENTIALS] expiry 설정: {expiry}")
            else:
                logger.warning(f"[GET_CREDENTIALS] expiry가 없습니다 (토큰 만료 확인 불가)")
            
            logger.info(f"[GET_CREDENTIALS] Credentials 생성 성공 - token 존재: {bool(credentials.token)}, refresh_token 존재: {bool(credentials.refresh_token)}, expiry: {expiry}")
            
            return credentials
        except Exception as e:
            logger.error(f"[GET_CREDENTIALS] 토큰에서 Credentials 생성 실패: {e}", exc_info=True)
            return None
    
    @staticmethod
    def get_calendar_service(credentials: Credentials):
        """Google Calendar API 서비스 객체 생성"""
        try:
            service = build('calendar', 'v3', credentials=credentials)
            return service
        except Exception as e:
            logger.error(f"Calendar 서비스 생성 실패: {e}")
            return None
    
    @staticmethod
    async def create_event(
        token_json: str,
        title: str,
        description: str = "",
        start_datetime: datetime = None,
        end_datetime: datetime = None,
        location: str = "",
        all_day: bool = False
    ) -> Optional[Dict[str, Any]]:
        """Google Calendar에 이벤트 생성"""
        try:
            credentials = GoogleCalendarService.get_credentials_from_token(token_json)
            if not credentials:
                logger.error("Credentials 생성 실패")
                return None
            
            # 토큰 만료 시 갱신
            if GoogleCalendarService.is_token_expired(credentials):
                credentials.refresh(Request())
            
            service = GoogleCalendarService.get_calendar_service(credentials)
            if not service:
                return None
            
            # 이벤트 데이터 구성
            event = {
                'summary': title,
                'description': description,
                'location': location,
            }
            
            if all_day:
                # 종일 이벤트
                event['start'] = {
                    'date': start_datetime.strftime('%Y-%m-%d'),
                    'timeZone': 'Asia/Seoul',
                }
                event['end'] = {
                    'date': (end_datetime or start_datetime + timedelta(days=1)).strftime('%Y-%m-%d'),
                    'timeZone': 'Asia/Seoul',
                }
            else:
                # 시간 지정 이벤트
                # naive datetime에 타임존 정보 추가 (Asia/Seoul)
                from datetime import timezone, timedelta
                seoul_tz = timezone(timedelta(hours=9))  # UTC+9 (Asia/Seoul)
                
                # naive datetime을 Asia/Seoul 타임존으로 변환
                # naive datetime은 로컬 시간(Asia/Seoul)으로 간주
                if start_datetime.tzinfo is None:
                    # naive datetime을 Asia/Seoul로 간주하고 타임존 추가
                    # 예: 2025-01-08 09:00:00 (naive) -> 2025-01-08 09:00:00+09:00 (Asia/Seoul)
                    start_datetime_tz = start_datetime.replace(tzinfo=seoul_tz)
                    logger.info(f"[CREATE_EVENT] 시작 시간 변환 - 원본(naive): {start_datetime}, 변환 후(Asia/Seoul): {start_datetime_tz}, ISO: {start_datetime_tz.isoformat()}")
                else:
                    # 이미 타임존이 있으면 Asia/Seoul로 변환
                    start_datetime_tz = start_datetime.astimezone(seoul_tz)
                    logger.info(f"[CREATE_EVENT] 시작 시간 변환 - 원본: {start_datetime}, 변환 후(Asia/Seoul): {start_datetime_tz}, ISO: {start_datetime_tz.isoformat()}")
                
                if end_datetime.tzinfo is None:
                    end_datetime_tz = end_datetime.replace(tzinfo=seoul_tz)
                    logger.info(f"[CREATE_EVENT] 종료 시간 변환 - 원본(naive): {end_datetime}, 변환 후(Asia/Seoul): {end_datetime_tz}, ISO: {end_datetime_tz.isoformat()}")
                else:
                    end_datetime_tz = end_datetime.astimezone(seoul_tz)
                    logger.info(f"[CREATE_EVENT] 종료 시간 변환 - 원본: {end_datetime}, 변환 후(Asia/Seoul): {end_datetime_tz}, ISO: {end_datetime_tz.isoformat()}")
                
                # Google Calendar API는 timeZone 필드와 함께 dateTime을 보내면
                # dateTime의 타임존 정보를 무시하고 timeZone을 사용합니다.
                # 따라서 dateTime은 naive datetime의 ISO 형식(타임존 없음)으로 보내야 합니다.
                # timeZone 필드에 명시된 타임존으로 해석됩니다.
                start_iso = start_datetime.isoformat()  # naive datetime의 ISO 형식 (타임존 없음)
                end_iso = end_datetime.isoformat()  # naive datetime의 ISO 형식 (타임존 없음)
                
                logger.info(f"[CREATE_EVENT] Google Calendar API 전송 데이터 - start(naive): {start_iso}, end(naive): {end_iso}, timeZone: Asia/Seoul")
                logger.info(f"[CREATE_EVENT] 변환된 시간 - start(Asia/Seoul): {start_datetime_tz.isoformat()}, end(Asia/Seoul): {end_datetime_tz.isoformat()}")
                
                event['start'] = {
                    'dateTime': start_iso,  # 타임존 없는 ISO 형식 (예: 2025-01-08T09:00:00)
                    'timeZone': 'Asia/Seoul',  # 이 타임존으로 해석됨
                }
                event['end'] = {
                    'dateTime': end_iso,  # 타임존 없는 ISO 형식
                    'timeZone': 'Asia/Seoul',  # 이 타임존으로 해석됨
                }
            
            # 이벤트 생성
            created_event = service.events().insert(calendarId='primary', body=event).execute()
            logger.info(f"Google Calendar 이벤트 생성 성공: {created_event.get('id')}")
            return created_event
            
        except HttpError as e:
            logger.error(f"Google Calendar API 오류: {e}")
            return None
        except Exception as e:
            logger.error(f"이벤트 생성 실패: {e}", exc_info=True)
            return None
    
    @staticmethod
    async def update_event(
        token_json: str,
        event_id: str,
        title: str = None,
        description: str = None,
        start_datetime: datetime = None,
        end_datetime: datetime = None,
        location: str = None,
        all_day: bool = False
    ) -> Optional[Dict[str, Any]]:
        """Google Calendar 이벤트 업데이트"""
        try:
            credentials = GoogleCalendarService.get_credentials_from_token(token_json)
            if not credentials:
                return None
            
            if GoogleCalendarService.is_token_expired(credentials):
                credentials.refresh(Request())
            
            service = GoogleCalendarService.get_calendar_service(credentials)
            if not service:
                return None
            
            # 기존 이벤트 가져오기
            event = service.events().get(calendarId='primary', eventId=event_id).execute()
            
            # 업데이트할 필드만 업데이트
            if title:
                event['summary'] = title
            if description is not None:
                event['description'] = description
            if location is not None:
                event['location'] = location
            
            if start_datetime and end_datetime:
                if all_day:
                    event['start'] = {
                        'date': start_datetime.strftime('%Y-%m-%d'),
                        'timeZone': 'Asia/Seoul',
                    }
                    event['end'] = {
                        'date': end_datetime.strftime('%Y-%m-%d'),
                        'timeZone': 'Asia/Seoul',
                    }
                else:
                    # naive datetime에 타임존 정보 추가 (Asia/Seoul)
                    from datetime import timezone, timedelta
                    seoul_tz = timezone(timedelta(hours=9))  # UTC+9 (Asia/Seoul)
                    
                    # naive datetime을 Asia/Seoul 타임존으로 변환
                    if start_datetime.tzinfo is None:
                        start_datetime_tz = start_datetime.replace(tzinfo=seoul_tz)
                        logger.info(f"[UPDATE_EVENT] 시작 시간 변환 - 원본(naive): {start_datetime}, 변환 후(Asia/Seoul): {start_datetime_tz}")
                    else:
                        start_datetime_tz = start_datetime.astimezone(seoul_tz)
                        logger.info(f"[UPDATE_EVENT] 시작 시간 변환 - 원본: {start_datetime}, 변환 후(Asia/Seoul): {start_datetime_tz}")
                    
                    if end_datetime.tzinfo is None:
                        end_datetime_tz = end_datetime.replace(tzinfo=seoul_tz)
                        logger.info(f"[UPDATE_EVENT] 종료 시간 변환 - 원본(naive): {end_datetime}, 변환 후(Asia/Seoul): {end_datetime_tz}")
                    else:
                        end_datetime_tz = end_datetime.astimezone(seoul_tz)
                        logger.info(f"[UPDATE_EVENT] 종료 시간 변환 - 원본: {end_datetime}, 변환 후(Asia/Seoul): {end_datetime_tz}")
                    
                    # Google Calendar API는 timeZone 필드와 함께 dateTime을 보내면
                    # dateTime의 타임존 정보를 무시하고 timeZone을 사용합니다.
                    # 따라서 dateTime은 naive datetime의 ISO 형식(타임존 없음)으로 보내야 합니다.
                    start_iso = start_datetime.isoformat()  # naive datetime의 ISO 형식 (타임존 없음)
                    end_iso = end_datetime.isoformat()  # naive datetime의 ISO 형식 (타임존 없음)
                    
                    logger.info(f"[UPDATE_EVENT] Google Calendar API 전송 데이터 - start(naive): {start_iso}, end(naive): {end_iso}, timeZone: Asia/Seoul")
                    logger.info(f"[UPDATE_EVENT] 변환된 시간 - start(Asia/Seoul): {start_datetime_tz.isoformat()}, end(Asia/Seoul): {end_datetime_tz.isoformat()}")
                    
                    event['start'] = {
                        'dateTime': start_iso,  # 타임존 없는 ISO 형식 (예: 2025-01-08T09:00:00)
                        'timeZone': 'Asia/Seoul',  # 이 타임존으로 해석됨
                    }
                    event['end'] = {
                        'dateTime': end_iso,  # 타임존 없는 ISO 형식
                        'timeZone': 'Asia/Seoul',  # 이 타임존으로 해석됨
                    }
            
            # 이벤트 업데이트
            updated_event = service.events().update(
                calendarId='primary',
                eventId=event_id,
                body=event
            ).execute()
            
            logger.info(f"Google Calendar 이벤트 업데이트 성공: {updated_event.get('id')}")
            return updated_event
            
        except HttpError as e:
            logger.error(f"Google Calendar API 오류: {e}")
            return None
        except Exception as e:
            logger.error(f"이벤트 업데이트 실패: {e}", exc_info=True)
            return None
    
    @staticmethod
    async def delete_event(token_json: str, event_id: str) -> bool:
        """Google Calendar 이벤트 삭제"""
        try:
            credentials = GoogleCalendarService.get_credentials_from_token(token_json)
            if not credentials:
                return False
            
            if GoogleCalendarService.is_token_expired(credentials):
                credentials.refresh(Request())
            
            service = GoogleCalendarService.get_calendar_service(credentials)
            if not service:
                return False
            
            service.events().delete(calendarId='primary', eventId=event_id).execute()
            logger.info(f"Google Calendar 이벤트 삭제 성공: {event_id}")
            return True
            
        except HttpError as e:
            logger.error(f"Google Calendar API 오류: {e}")
            return False
        except Exception as e:
            logger.error(f"이벤트 삭제 실패: {e}", exc_info=True)
            return False
    
    @staticmethod
    async def list_events(
        token_json: str,
        time_min: datetime = None,
        time_max: datetime = None,
        max_results: int = 100
    ) -> List[Dict[str, Any]]:
        """Google Calendar에서 이벤트 목록 가져오기"""
        try:
            logger.info(f"[LIST_EVENTS] 시작 - time_min: {time_min}, time_max: {time_max}")
            
            credentials = GoogleCalendarService.get_credentials_from_token(token_json)
            if not credentials:
                logger.error("[LIST_EVENTS] Credentials 생성 실패")
                return []
            
            is_expired = GoogleCalendarService.is_token_expired(credentials)
            logger.info(f"[LIST_EVENTS] Credentials 생성 성공 - expired: {is_expired}")
            
            if is_expired:
                logger.info("[LIST_EVENTS] 토큰 만료, 갱신 시도...")
                try:
                    credentials.refresh(Request())
                    logger.info("[LIST_EVENTS] 토큰 갱신 성공")
                except Exception as refresh_error:
                    logger.error(f"[LIST_EVENTS] 토큰 갱신 실패: {refresh_error}", exc_info=True)
                    return []
            
            service = GoogleCalendarService.get_calendar_service(credentials)
            if not service:
                logger.error("[LIST_EVENTS] Calendar 서비스 생성 실패")
                return []
            
            logger.info("[LIST_EVENTS] Calendar 서비스 생성 성공")
            
            # 기본 시간 범위 설정
            if not time_min:
                time_min = datetime.utcnow()
            if not time_max:
                time_max = time_min + timedelta(days=30)
            
            # UTC 시간으로 변환 (naive datetime을 UTC로 취급)
            if time_min.tzinfo is None:
                from datetime import timezone
                time_min = time_min.replace(tzinfo=timezone.utc)
            if time_max.tzinfo is None:
                from datetime import timezone
                time_max = time_max.replace(tzinfo=timezone.utc)
            
            # RFC3339 형식으로 변환 (Google Calendar API 요구사항)
            # 형식: YYYY-MM-DDTHH:MM:SSZ (UTC)
            time_min_str = time_min.strftime('%Y-%m-%dT%H:%M:%SZ')
            time_max_str = time_max.strftime('%Y-%m-%dT%H:%M:%SZ')
            
            logger.info(f"[LIST_EVENTS] Google Calendar API 호출 - timeMin: {time_min_str}, timeMax: {time_max_str}, maxResults: {max_results}")
            logger.info(f"[LIST_EVENTS] 원본 시간 - time_min: {time_min}, time_max: {time_max}")
            
            # 이벤트 목록 가져오기
            try:
                # 캘린더 목록 먼저 확인
                calendar_list = service.calendarList().list().execute()
                primary_calendar_id = None
                for cal in calendar_list.get('items', []):
                    if cal.get('primary'):
                        primary_calendar_id = cal.get('id')
                        logger.info(f"[LIST_EVENTS] Primary 캘린더 ID: {primary_calendar_id}, 이름: {cal.get('summary')}")
                        break
                
                if not primary_calendar_id:
                    primary_calendar_id = 'primary'
                    logger.warning(f"[LIST_EVENTS] Primary 캘린더를 찾을 수 없어 'primary' 사용")
                
                events_result = service.events().list(
                    calendarId=primary_calendar_id,
                    timeMin=time_min_str,
                    timeMax=time_max_str,
                    maxResults=max_results,
                    singleEvents=True,
                    orderBy='startTime',
                    timeZone='UTC'  # 시간대 명시
                ).execute()
                
                logger.info(f"[LIST_EVENTS] Google Calendar API 응답 받음")
                logger.info(f"[LIST_EVENTS] 응답 키: {list(events_result.keys())}")
                
                events = events_result.get('items', [])
                logger.info(f"[LIST_EVENTS] Google Calendar 이벤트 {len(events)}개 가져오기 성공")
                
                # 응답 전체 구조 로깅 (디버깅용)
                if len(events) == 0:
                    logger.warning(f"[LIST_EVENTS] ⚠️ 이벤트가 0개입니다!")
                    logger.info(f"[LIST_EVENTS] 응답 summary: {events_result.get('summary', 'N/A')}")
                    logger.info(f"[LIST_EVENTS] 응답 timeZone: {events_result.get('timeZone', 'N/A')}")
                    logger.info(f"[LIST_EVENTS] 응답 nextPageToken: {events_result.get('nextPageToken', '없음')}")
                    
            except Exception as api_error:
                logger.error(f"[LIST_EVENTS] Google Calendar API 호출 중 예외 발생: {api_error}", exc_info=True)
                raise
            
            # 이벤트가 있을 경우 첫 번째 이벤트 정보 로깅
            if events and len(events) > 0:
                first_event = events[0]
                logger.info(f"[LIST_EVENTS] 첫 번째 이벤트 샘플:")
                logger.info(f"  - 제목: {first_event.get('summary', '제목 없음')}")
                logger.info(f"  - 시작: {first_event.get('start', {})}")
                logger.info(f"  - 종료: {first_event.get('end', {})}")
                logger.info(f"  - ID: {first_event.get('id', 'N/A')}")
            else:
                logger.warning(f"[LIST_EVENTS] 이벤트가 없습니다. Google Calendar에 해당 기간 내 이벤트가 있는지 확인하세요.")
                logger.info(f"[LIST_EVENTS] 요청 시간 범위: {time_min_str} ~ {time_max_str} (UTC)")
                logger.info(f"[LIST_EVENTS] 요청 시간 범위 (한국시간): {time_min + timedelta(hours=9)} ~ {time_max + timedelta(hours=9)}")
            
            return events
            
        except HttpError as e:
            logger.error(f"[LIST_EVENTS] Google Calendar API HttpError: {e}", exc_info=True)
            logger.error(f"[LIST_EVENTS] 에러 상세: status={e.resp.status if hasattr(e, 'resp') else 'N/A'}, content={e.content if hasattr(e, 'content') else 'N/A'}")
            return []
        except Exception as e:
            logger.error(f"[LIST_EVENTS] 이벤트 목록 가져오기 실패: {e}", exc_info=True)
            return []
