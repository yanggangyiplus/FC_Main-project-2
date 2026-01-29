"""
Google Calendar 연동 엔드포인트
"""
import json
import logging
import secrets
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, date
from pydantic import BaseModel

from app.database import get_db
from app.models.user import User
from app.models.models import Todo
from app.services.calendar_service import GoogleCalendarService
from app.api.routes.auth import get_current_user, oauth_states
from app.config import settings
from googleapiclient.errors import HttpError
from google.auth.transport.requests import Request as GoogleAuthRequest


logger = logging.getLogger(__name__)

class GoogleCallbackRequest(BaseModel):
    code: str
    state: str

router = APIRouter(
    prefix="/calendar",
    tags=["calendar"],
)


@router.delete("/event/{event_id}")
async def delete_google_calendar_event(
    event_id: str,
    current_user: User = Depends(get_current_user)
):
    """Google Calendar 이벤트 삭제"""
    try:
        # 사용자의 Google Calendar 토큰 확인
        if not current_user.google_calendar_token:
            raise HTTPException(
                status_code=400,
                detail="Google Calendar 연동이 필요합니다. 설정에서 연동해주세요."
            )
        
        # Google Calendar에서 이벤트 삭제
        deleted = await GoogleCalendarService.delete_event(
            token_json=current_user.google_calendar_token,
            event_id=event_id
        )
        
        if not deleted:
            raise HTTPException(
                status_code=500,
                detail="Google Calendar 이벤트 삭제에 실패했습니다"
            )
        
        return {
            "success": True,
            "message": "Google Calendar 이벤트가 삭제되었습니다"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Google Calendar 이벤트 삭제 실패: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"이벤트 삭제 실패: {str(e)}"
        )


@router.post("/sync/all")
async def sync_all_todos_to_google_calendar(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """모든 기존 일정을 Google Calendar에 일괄 동기화 (중복 방지)"""
    logger.info(f"[SYNC_ALL] ========== 동기화 시작 ========== 사용자: {current_user.email} (ID: {current_user.id})")
    try:
        # 사용자의 Google Calendar 토큰 확인
        if not current_user.google_calendar_token:
            raise HTTPException(
                status_code=400,
                detail="Google Calendar 연동이 필요합니다. 설정에서 연동해주세요."
            )
        
        # 일괄 동기화는 토글 상태와 관계없이 동작 (문제 3 해결)
        # 토글을 꺼도 일괄 동기화한 일정은 Google Calendar에 남아있어야 함
        
        from app.models.models import Todo
        
        # 1단계: Google Calendar에서 현재 이벤트 목록 가져오기 (중복 체크용)
        logger.info("[SYNC_ALL] Google Calendar 이벤트 목록 가져오기 시작...")
        existing_events = []
        try:
            # 최근 5년 전부터 5년 후까지의 이벤트 가져오기 (과거 일정도 포함)
            time_min = datetime.utcnow() - timedelta(days=5*365)
            time_max = datetime.utcnow() + timedelta(days=5*365)
            # max_results는 페이지당 개수이므로, 페이지네이션으로 모든 이벤트를 가져옴
            existing_events = await GoogleCalendarService.list_events(
                token_json=current_user.google_calendar_token,
                time_min=time_min,
                time_max=time_max,
                max_results=2500  # Google Calendar API 최대값 (2500)
            )
            logger.info(f"[SYNC_ALL] Google Calendar에서 {len(existing_events)}개 이벤트 가져옴 (5년 범위)")
        except Exception as e:
            logger.warning(f"[SYNC_ALL] Google Calendar 이벤트 목록 가져오기 실패 (계속 진행): {e}")
        
        # 기존 이벤트를 제목+날짜+시간으로 매칭하기 위한 맵 생성
        existing_events_map = {}
        for event in existing_events:
            title = event.get('summary', '').strip()
            start = event.get('start', {})
            
            # 날짜/시간 추출
            event_date = None
            event_time = None
            if 'date' in start:
                # 종일 이벤트
                event_date = start['date']
                event_time = None
            elif 'dateTime' in start:
                # 시간 지정 이벤트
                dt = datetime.fromisoformat(start['dateTime'].replace('Z', '+00:00'))
                event_date = dt.date().isoformat()
                event_time = dt.strftime('%H:%M')
            
            if event_date and title:
                # 키: 제목_날짜_시간 (시간이 없으면 종일 이벤트)
                key = f"{title}_{event_date}_{event_time or 'all_day'}"
                existing_events_map[key] = event.get('id')
        
        logger.info(f"[SYNC_ALL] 기존 이벤트 맵 생성 완료: {len(existing_events_map)}개")
        
        # export_enabled 토글 확인
        export_enabled_raw = getattr(current_user, 'google_calendar_export_enabled', 'false')
        export_enabled = str(export_enabled_raw).lower() == 'true'
        logger.info(f"[SYNC_ALL] Google Calendar 내보내기 토글 상태 확인 - raw: {export_enabled_raw}, enabled: {export_enabled}")
        
        # 2단계: Google Calendar에 동기화되지 않은 모든 일정 조회 (export_enabled가 활성화되어 있을 때만)
        todos_to_sync = []
        if export_enabled:
            todos_to_sync = db.query(Todo).filter(
                Todo.user_id == current_user.id,
                Todo.deleted_at.is_(None),
                Todo.google_calendar_event_id.is_(None)  # 아직 동기화되지 않은 일정만
            ).all()
            logger.info(f"[SYNC_ALL] 동기화할 일정: {len(todos_to_sync)}개")
        else:
            logger.info("[SYNC_ALL] Google Calendar 내보내기가 비활성화되어 있어 일정을 내보내지 않습니다.")
        
        # 3단계: 이미 동기화되었지만 bulk_synced=False인 일정도 bulk_synced=True로 설정
        # (토글을 꺼도 Google Calendar에 남아있도록 하기 위함)
        already_synced_todos = db.query(Todo).filter(
            Todo.user_id == current_user.id,
            Todo.deleted_at.is_(None),
            Todo.google_calendar_event_id.isnot(None),  # 이미 동기화된 일정
            Todo.bulk_synced == False  # 아직 bulk_synced가 False인 일정
        ).all()
        
        bulk_synced_count = 0
        for todo in already_synced_todos:
            todo.bulk_synced = True
            bulk_synced_count += 1
            logger.info(f"[SYNC_ALL] 이미 동기화된 일정을 bulk_synced=True로 설정: todo_id={todo.id}, event_id={todo.google_calendar_event_id}")
        
        if bulk_synced_count > 0:
            db.commit()
            logger.info(f"[SYNC_ALL] {bulk_synced_count}개 이미 동기화된 일정을 bulk_synced=True로 설정 완료")
        
        synced_count = 0
        matched_count = 0  # 기존 이벤트와 매칭된 일정 수
        failed_count = 0
        failed_todos = []
        
        if not todos_to_sync:
            logger.info("[SYNC_ALL] 동기화할 일정이 없습니다 (내보내기 토글이 비활성화되었거나 모든 일정이 이미 동기화됨)")
        else:
            for todo in todos_to_sync:
                try:
                    # 날짜가 없는 일정은 건너뜀
                    if not todo.date:
                        continue
                    
                    # 일정 키 생성 (제목_날짜_시간)
                    todo_date_str = todo.date.isoformat() if hasattr(todo.date, 'isoformat') else str(todo.date)
                    todo_time_str = None
                    if not todo.all_day and todo.start_time:
                        if hasattr(todo.start_time, 'strftime'):
                            todo_time_str = todo.start_time.strftime('%H:%M')
                        else:
                            todo_time_str = str(todo.start_time)
                    
                    key = f"{todo.title.strip()}_{todo_date_str}_{todo_time_str or 'all_day'}"
                    
                    # 기존 이벤트와 매칭 확인
                    if key in existing_events_map:
                        # 이미 Google Calendar에 있는 이벤트와 매칭
                        existing_event_id = existing_events_map[key]
                        todo.google_calendar_event_id = existing_event_id
                        todo.bulk_synced = True  # 일괄 동기화로 매칭된 일정도 표시
                        db.commit()  # 변경사항 저장
                        matched_count += 1
                        logger.info(f"[SYNC_ALL] 기존 이벤트와 매칭: todo_id={todo.id}, event_id={existing_event_id}, bulk_synced=True")
                        continue
                    
                    # Google Calendar에 이벤트 생성
                    start_datetime = None
                    end_datetime = None
                    
                    if todo.all_day:
                        # 종일 이벤트
                        start_datetime = datetime.combine(todo.date, datetime.min.time())
                        # end_date가 있으면 그 날짜까지, 없으면 하루만
                        if todo.end_date:
                            # end_date는 inclusive이므로, Google Calendar의 exclusive 형식으로 변환하려면 +1일
                            end_datetime = datetime.combine(todo.end_date, datetime.min.time()) + timedelta(days=1)
                            logger.info(f"[SYNC_ALL] 종일 이벤트 기간: {todo.date} ~ {todo.end_date} ({(todo.end_date - todo.date).days + 1}일)")
                        else:
                            end_datetime = start_datetime + timedelta(days=1)
                            logger.info(f"[SYNC_ALL] 종일 이벤트 (하루): {todo.date}")
                    else:
                        # 시간 지정 이벤트
                        if todo.start_time:
                            start_datetime = datetime.combine(todo.date, todo.start_time)
                        else:
                            start_datetime = datetime.combine(todo.date, datetime.min.time())
                        
                        # end_date가 있으면 그 날짜의 end_time 사용, 없으면 같은 날의 end_time 사용
                        if todo.end_date:
                            # 여러 날짜에 걸친 일정
                            if todo.end_time:
                                end_datetime = datetime.combine(todo.end_date, todo.end_time)
                            else:
                                # end_time이 없으면 end_date의 23:59:59로 설정
                                end_datetime = datetime.combine(todo.end_date, datetime.max.time())
                            logger.info(f"[SYNC_ALL] 시간 지정 이벤트 기간: {todo.date} {todo.start_time} ~ {todo.end_date} {todo.end_time or '23:59'} ({(todo.end_date - todo.date).days + 1}일)")
                        else:
                            # 하루 일정
                            if todo.end_time:
                                end_datetime = datetime.combine(todo.date, todo.end_time)
                            else:
                                end_datetime = start_datetime + timedelta(hours=1)
                            logger.info(f"[SYNC_ALL] 시간 지정 이벤트 (하루): {todo.date} {todo.start_time} ~ {todo.end_time or '1시간 후'}")
                    
                    if not start_datetime:
                        continue
                    
                    # 알림 및 반복 정보 파싱
                    notification_reminders = []
                    if todo.notification_reminders:
                        try:
                            parsed = json.loads(todo.notification_reminders) if isinstance(todo.notification_reminders, str) else todo.notification_reminders
                            if isinstance(parsed, list):
                                notification_reminders = parsed
                        except:
                            pass
                    
                    # 반복 정보는 Google Calendar로 전달하지 않음 (중복 일정 생성 방지)
                    # 반복 정보는 웹앱 내에서만 관리하고, Google Calendar에는 단일 이벤트로만 내보냄
                    
                    # Google Calendar에 이벤트 생성
                    logger.info(f"[SYNC_ALL] Google Calendar 이벤트 생성 - start={start_datetime}, end={end_datetime}, all_day={todo.all_day}")
                    event = await GoogleCalendarService.create_event(
                        token_json=current_user.google_calendar_token,
                        title=todo.title,
                        description=todo.memo or todo.description or "",
                        start_datetime=start_datetime,
                        end_datetime=end_datetime,
                        location=todo.location or "",
                        all_day=todo.all_day,
                        notification_reminders=notification_reminders if notification_reminders else None,
                        repeat_type=None,  # 반복 정보는 전달하지 않음
                        repeat_pattern=None,
                        repeat_end_date=None,
                        source_id=todo.id  # Always Plan의 Todo ID 저장 (중복 제거용)
                    )
                    
                    if event and event.get('id'):
                        # Todo에 Google Calendar 이벤트 ID 저장 및 일괄 동기화 플래그 설정
                        todo.google_calendar_event_id = event.get('id')
                        todo.bulk_synced = True  # 일괄 동기화로 생성된 일정 표시
                        db.commit()  # 변경사항 저장
                        synced_count += 1
                        logger.info(f"[SYNC_ALL] 새 이벤트 생성: todo_id={todo.id}, event_id={event.get('id')}, bulk_synced=True")
                    else:
                        failed_count += 1
                        failed_todos.append(todo.id)
                except Exception as e:
                    logger.error(f"일정 동기화 실패 (todo_id={todo.id}): {e}", exc_info=True)
                    failed_count += 1
                    failed_todos.append(todo.id)
        
        # 변경사항 커밋
        db.commit()
        
        # 4단계: Google Calendar 이벤트를 웹앱에 Todo로 저장 (양방향 동기화)
        # import_enabled가 활성화되어 있을 때만 실행
        import_enabled_raw = getattr(current_user, 'google_calendar_import_enabled', 'false')
        import_enabled = str(import_enabled_raw).lower() == 'true'
        logger.info(f"[SYNC_ALL] Google Calendar 가져오기 토글 상태 확인 - raw: {import_enabled_raw}, enabled: {import_enabled}, existing_events_count: {len(existing_events)}")
        
        imported_count = 0
        imported_matched_count = 0
        imported_failed_count = 0
        
        # 변수 초기화 (import_enabled 블록 밖에서도 사용하기 위해)
        new_events_count = 0
        skipped_events_count = 0
        skipped_already_saved_count = 0
        skipped_always_plan_count = 0
        failed_events_info = []  # 실패한 이벤트 정보 저장
        
        if not import_enabled:
            logger.info("[SYNC_ALL] Google Calendar 가져오기가 비활성화되어 있어 이벤트를 가져오지 않습니다.")
        else:
            logger.info("[SYNC_ALL] Google Calendar 이벤트를 웹앱에 저장 시작...")
            
            from datetime import time as time_obj
            from datetime import timezone
            
            # 이미 저장된 Google Calendar 이벤트 ID 목록 (중복 방지)
            existing_google_event_ids = set(
                db.query(Todo.google_calendar_event_id).filter(
                    Todo.user_id == current_user.id,
                    Todo.deleted_at.is_(None),
                    Todo.google_calendar_event_id.isnot(None)
                ).all()
            )
            existing_google_event_ids = {str(id[0]) for id in existing_google_event_ids if id[0]}
            
            logger.info(f"[SYNC_ALL] 이미 저장된 Google Calendar 이벤트: {len(existing_google_event_ids)}개")
            logger.info(f"[SYNC_ALL] 처리할 전체 이벤트 수: {len(existing_events)}개")
            
            for event in existing_events:
                try:
                    event_id = event.get('id')
                    if not event_id:
                        logger.warning(f"[SYNC_ALL] 이벤트 ID가 없음: {event.get('summary', '제목 없음')}")
                        skipped_events_count += 1
                        continue
                    
                    # 1차 체크: 이미 저장된 이벤트 ID인지 확인
                    if event_id in existing_google_event_ids:
                        # 이미 저장된 이벤트는 건너뜀
                        skipped_already_saved_count += 1
                        logger.debug(f"[SYNC_ALL] 이미 저장된 이벤트 건너뜀: event_id={event_id}, title={event.get('summary', '제목 없음')}")
                        continue
                    
                    # 2차 체크: Always Plan에서 만든 이벤트인지 확인 (source_id 체크)
                    # Always Plan에서 만든 이벤트는 extendedProperties 또는 description에 AlwaysPlanID가 있음
                    source_id = None
                    extended_props = event.get('extendedProperties', {})
                    private_props = extended_props.get('private', {})
                    if private_props.get('alwaysPlanSourceId'):
                        source_id = private_props.get('alwaysPlanSourceId')
                    else:
                        # description에서도 추출 시도 (fallback)
                        description = event.get('description', '')
                        if description and 'AlwaysPlanID:' in description:
                            import re
                            match = re.search(r'AlwaysPlanID:([^\s\n]+)', description)
                            if match:
                                source_id = match.group(1)
                    
                    if source_id:
                        # Always Plan에서 만든 이벤트는 건너뜀 (웹앱의 Todo를 Google Calendar에 동기화한 것)
                        skipped_always_plan_count += 1
                        logger.debug(f"[SYNC_ALL] Always Plan에서 만든 이벤트 건너뜀: event_id={event_id}, source_id={source_id}, title={event.get('summary', '제목 없음')}")
                        continue
                    
                    # 구글 캘린더에서 직접 만든 이벤트만 저장
                    new_events_count += 1
                    logger.info(f"[SYNC_ALL] 새 이벤트 처리 시작 (구글 캘린더에서 직접 만든 이벤트): event_id={event_id}, title={event.get('summary', '제목 없음')}")
                    
                    # 이벤트 정보 파싱
                    start = event.get('start', {})
                    end = event.get('end', {})
                    
                    # 시작 시간 파싱
                    start_date = None
                    end_date = None
                    start_time_obj = None
                    end_time_obj = None
                    all_day = False
                    
                    if 'date' in start:
                        # 종일 이벤트
                        all_day = True
                        start_date_str = start['date']
                        if 'T' in start_date_str:
                            start_date = datetime.fromisoformat(start_date_str.replace('Z', '+00:00')).date()
                        else:
                            start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
                        
                        # 종료 날짜 파싱 (종일 이벤트의 경우)
                        if 'date' in end:
                            end_date_str = end['date']
                            if 'T' in end_date_str:
                                end_date_obj = datetime.fromisoformat(end_date_str.replace('Z', '+00:00'))
                            else:
                                end_date_obj = datetime.strptime(end_date_str, '%Y-%m-%d')
                            # Google Calendar는 종료 날짜를 exclusive로 저장하므로 하루 빼야 함
                            end_date = (end_date_obj - timedelta(days=1)).date()
                            # 시작 날짜와 종료 날짜가 같으면 종료 날짜를 None으로 설정
                            if end_date <= start_date:
                                end_date = None
                    elif 'dateTime' in start:
                        # 시간 지정 이벤트
                        start_datetime_str = start['dateTime']
                        
                        # ISO 형식 파싱
                        if start_datetime_str.endswith('Z'):
                            start_datetime_obj = datetime.fromisoformat(start_datetime_str.replace('Z', '+00:00'))
                        else:
                            start_datetime_obj = datetime.fromisoformat(start_datetime_str)
                        
                        # 타임존이 없으면 UTC로 간주
                        if start_datetime_obj.tzinfo is None:
                            start_datetime_obj = start_datetime_obj.replace(tzinfo=timezone.utc)
                        
                        # Asia/Seoul 타임존으로 변환
                        seoul_tz = timezone(timedelta(hours=9))
                        start_datetime_seoul = start_datetime_obj.astimezone(seoul_tz)
                        
                        start_date = start_datetime_seoul.date()
                        start_time_str = start_datetime_seoul.strftime('%H:%M')
                        start_time_obj = time_obj(*map(int, start_time_str.split(':')))
                        
                        # 종료 시간 파싱
                        if 'dateTime' in end:
                            end_datetime_str = end['dateTime']
                            if end_datetime_str.endswith('Z'):
                                end_datetime_obj = datetime.fromisoformat(end_datetime_str.replace('Z', '+00:00'))
                            else:
                                end_datetime_obj = datetime.fromisoformat(end_datetime_str)
                            
                            if end_datetime_obj.tzinfo is None:
                                end_datetime_obj = end_datetime_obj.replace(tzinfo=timezone.utc)
                            
                            end_datetime_seoul = end_datetime_obj.astimezone(seoul_tz)
                            end_date = end_datetime_seoul.date()
                            end_time_str = end_datetime_seoul.strftime('%H:%M')
                            end_time_obj = time_obj(*map(int, end_time_str.split(':')))
                            
                            # 시작 날짜와 종료 날짜가 같으면 종료 날짜를 None으로 설정
                            if end_date <= start_date:
                                end_date = None
                    
                    if not start_date:
                        continue
                    
                    # 알림 정보 파싱
                    notification_reminders = None
                    reminders = event.get('reminders', {})
                    if reminders:
                        reminders_list = []
                        if reminders.get('useDefault'):
                            # 기본 알림 사용 (30분 전)
                            reminders_list = [{'value': 30, 'unit': 'minutes'}]
                        else:
                            # 커스텀 알림
                            overrides = reminders.get('overrides', [])
                            for override in overrides:
                                minutes = override.get('minutes', 30)
                                # 분을 단위로 변환
                                if minutes < 60:
                                    reminders_list.append({'value': minutes, 'unit': 'minutes'})
                                elif minutes < 24 * 60:
                                    hours = minutes // 60
                                    remaining_minutes = minutes % 60
                                    if remaining_minutes == 0:
                                        reminders_list.append({'value': hours, 'unit': 'hours'})
                                    else:
                                        reminders_list.append({'value': minutes, 'unit': 'minutes'})
                                elif minutes < 7 * 24 * 60:
                                    days = minutes // (24 * 60)
                                    remaining_minutes = minutes % (24 * 60)
                                    if remaining_minutes == 0:
                                        reminders_list.append({'value': days, 'unit': 'days'})
                                    else:
                                        reminders_list.append({'value': minutes, 'unit': 'minutes'})
                                else:
                                    weeks = minutes // (7 * 24 * 60)
                                    remaining_minutes = minutes % (7 * 24 * 60)
                                    if remaining_minutes == 0:
                                        reminders_list.append({'value': weeks, 'unit': 'weeks'})
                                    else:
                                        reminders_list.append({'value': minutes, 'unit': 'minutes'})
                        if reminders_list:
                            try:
                                notification_reminders = json.dumps(reminders_list)
                            except Exception as json_err:
                                logger.error(f"[SYNC_ALL] 알림 정보 JSON 변환 실패: {json_err}")
                                notification_reminders = None
                    
                    # 반복 정보 파싱
                    repeat_type = None
                    repeat_pattern = None
                    repeat_end_date = None
                    recurrence = event.get('recurrence', [])
                    if recurrence and len(recurrence) > 0:
                        rrule = recurrence[0]
                        if rrule.startswith('RRULE:'):
                            rrule_str = rrule[6:]
                            parts = rrule_str.split(';')
                            freq = None
                            until = None
                            count = None
                            byday = None
                            interval = None
                            
                            for part in parts:
                                if '=' in part:
                                    key, value = part.split('=', 1)
                                    if key == 'FREQ':
                                        freq = value
                                    elif key == 'UNTIL':
                                        until = value
                                    elif key == 'COUNT':
                                        count = int(value)
                                    elif key == 'BYDAY':
                                        byday = value
                                    elif key == 'INTERVAL':
                                        interval = int(value)
                            
                            if freq == 'DAILY':
                                repeat_type = 'daily'
                            elif freq == 'WEEKLY':
                                if byday:
                                    if byday == 'MO,TU,WE,TH,FR':
                                        repeat_type = 'weekdays'
                                    elif byday == 'SA,SU':
                                        repeat_type = 'weekends'
                                    else:
                                        repeat_type = 'custom'
                                        # 요일 목록을 배열로 변환 (예: 'MO,TU' -> [0, 1])
                                        day_map = {'MO': 0, 'TU': 1, 'WE': 2, 'TH': 3, 'FR': 4, 'SA': 5, 'SU': 6}
                                        days_list = [day_map.get(day, 0) for day in byday.split(',') if day in day_map]
                                        repeat_pattern = json.dumps({
                                            'freq': 'weeks',
                                            'interval': interval or 1,
                                            'days': days_list,
                                            'endType': 'count' if count else ('date' if until else 'never'),
                                            'count': count,
                                            'endDate': until if until and not count else None
                                        })
                                else:
                                    if interval and interval > 1:
                                        # INTERVAL이 1보다 크면 custom으로 처리
                                        repeat_type = 'custom'
                                        repeat_pattern = json.dumps({
                                            'freq': 'weeks',
                                            'interval': interval,
                                            'days': [],
                                            'endType': 'count' if count else ('date' if until else 'never'),
                                            'count': count,
                                            'endDate': until if until and not count else None
                                        })
                                    else:
                                        repeat_type = 'weekly'
                            elif freq == 'MONTHLY':
                                if interval and interval > 1:
                                    repeat_type = 'custom'
                                    repeat_pattern = json.dumps({
                                        'freq': 'months',
                                        'interval': interval,
                                        'days': [],
                                        'endType': 'count' if count else ('date' if until else 'never'),
                                        'count': count,
                                        'endDate': until if until and not count else None
                                    })
                                else:
                                    repeat_type = 'monthly'
                            elif freq == 'YEARLY':
                                if interval and interval > 1:
                                    repeat_type = 'custom'
                                    repeat_pattern = json.dumps({
                                        'freq': 'years',
                                        'interval': interval,
                                        'days': [],
                                        'endType': 'count' if count else ('date' if until else 'never'),
                                        'count': count,
                                        'endDate': until if until and not count else None
                                    })
                                else:
                                    repeat_type = 'yearly'
                            
                            if until:
                                if len(until) == 8:
                                    repeat_end_date = datetime.strptime(until, '%Y%m%d').date()
                            
                            # custom 반복 패턴이 아닌 경우에도 repeat_end_date 설정
                            if repeat_type != 'custom':
                                if until:
                                    if len(until) == 8:
                                        repeat_end_date = datetime.strptime(until, '%Y%m%d').date()
                                elif count:
                                    # COUNT가 있으면 종료일 계산 필요 (현재는 처리하지 않음)
                                    pass
                    
                    # Todo 생성 (Google Calendar에서 가져온 일정)
                    new_todo = Todo(
                        user_id=current_user.id,
                        title=event.get('summary', '제목 없음'),
                        description=event.get('description', ''),
                        memo=event.get('description', ''),
                        location=event.get('location', ''),
                        date=start_date,
                        end_date=end_date,  # 종료 날짜 추가 (기간 일정인 경우)
                        start_time=start_time_obj,
                        end_time=end_time_obj,
                        all_day=all_day,
                        category="구글",
                        status="pending",
                        priority="medium",
                        source="google_calendar",  # Google Calendar에서 가져온 일정임을 명시
                        google_calendar_event_id=event_id,
                        bulk_synced=True,  # 동기화 후 저장으로 영구 저장
                        deleted_at=None,  # 명시적으로 None 설정 (새로고침 후에도 유지되도록)
                        notification_reminders=notification_reminders,
                        repeat_type=repeat_type,
                        repeat_pattern=repeat_pattern,
                        repeat_end_date=repeat_end_date
                    )
                    
                    db.add(new_todo)
                    db.commit()
                    db.refresh(new_todo)  # 저장 후 새로고침하여 ID 확인
                    
                    # 저장 확인
                    if new_todo.deleted_at is not None:
                        logger.error(f"[SYNC_ALL] Todo 저장 실패: deleted_at이 None이 아님. todo_id={new_todo.id}")
                        # 재시도
                        new_todo.deleted_at = None
                        db.commit()
                        db.refresh(new_todo)
                    
                    imported_count += 1
                    logger.info(f"[SYNC_ALL] ✅ Google Calendar 이벤트를 Todo로 저장 완료: event_id={event_id}, todo_id={new_todo.id}, title={new_todo.title}, date={new_todo.date}, deleted_at={new_todo.deleted_at}, bulk_synced={new_todo.bulk_synced}")
                    
                except Exception as e:
                    # 상세한 에러 정보 로깅
                    error_type = type(e).__name__
                    error_message = str(e)
                    event_title = event.get('summary', '제목 없음')
                    event_start = event.get('start', {})
                    
                    logger.error(f"[SYNC_ALL] ❌ Google Calendar 이벤트 저장 실패:")
                    logger.error(f"  - event_id: {event_id}")
                    logger.error(f"  - title: {event_title}")
                    logger.error(f"  - start: {event_start}")
                    logger.error(f"  - error_type: {error_type}")
                    logger.error(f"  - error_message: {error_message}")
                    logger.error(f"  - 상세 에러:", exc_info=True)
                    
                    # 파싱된 데이터 정보도 로깅
                    try:
                        logger.error(f"  - 파싱된 데이터: start_date={start_date}, end_date={end_date}, all_day={all_day}, start_time_obj={start_time_obj}, end_time_obj={end_time_obj}")
                    except:
                        logger.error(f"  - 파싱된 데이터 정보 없음 (파싱 단계에서 실패)")
                    
                    # 실패한 이벤트 정보 저장
                    failed_events_info.append({
                        "event_id": event_id,
                        "title": event_title,
                        "error_type": error_type,
                        "error_message": error_message,
                        "start": str(event_start) if event_start else None
                    })
                    
                    imported_failed_count += 1
                    
                    # 데이터베이스 롤백 (다음 이벤트 처리를 위해)
                    try:
                        db.rollback()
                    except:
                        pass
            
        logger.info(f"[SYNC_ALL] Google Calendar 이벤트 저장 완료:")
        logger.info(f"  - 새 이벤트 {new_events_count}개 중 {imported_count}개 저장 성공, {imported_failed_count}개 실패")
        logger.info(f"  - 건너뛴 이벤트: 이미 저장됨 {skipped_already_saved_count}개, Always Plan 이벤트 {skipped_always_plan_count}개, 기타 {skipped_events_count}개")
        
        logger.info(f"[SYNC_ALL] ========== 동기화 완료 ==========")
        logger.info(f"[SYNC_ALL] 웹앱 → Google Calendar:")
        logger.info(f"  - 매칭: {matched_count}개")
        logger.info(f"  - 새로 생성: {synced_count}개")
        logger.info(f"  - 실패: {failed_count}개")
        logger.info(f"  - 이미 동기화된 일정 (bulk_synced=True 설정): {bulk_synced_count}개")
        logger.info(f"[SYNC_ALL] Google Calendar → 웹앱:")
        logger.info(f"  - 새로 저장: {imported_count}개")
        logger.info(f"  - 실패: {imported_failed_count}개")
        logger.info(f"  - 건너뛴 이벤트: 이미 저장됨 {skipped_already_saved_count}개, Always Plan 이벤트 {skipped_always_plan_count}개, 기타 {skipped_events_count}개")
        
        total_saved = synced_count + matched_count + bulk_synced_count
        
        message = ""
        message_parts = []
        
        if synced_count > 0:
            message_parts.append(f"웹앱 일정 {synced_count}개가 Google Calendar에 저장됨")
        if matched_count > 0:
            message_parts.append(f"웹앱 일정 {matched_count}개가 기존 Google Calendar 이벤트와 매칭됨")
        if bulk_synced_count > 0:
            message_parts.append(f"웹앱 일정 {bulk_synced_count}개가 영구 저장됨")
        if imported_count > 0:
            message_parts.append(f"Google Calendar 일정 {imported_count}개가 웹앱에 저장됨")
        
        if message_parts:
            message = ", ".join(message_parts) + ". 동기화 해제해도 양쪽에 일정이 남아있습니다."
        else:
            # 저장할 일정이 없을 때 더 자세한 메시지 제공
            if not import_enabled:
                message = "Google Calendar 가져오기가 비활성화되어 있습니다. 설정에서 활성화해주세요."
            elif len(existing_events) == 0:
                message = "Google Calendar에서 가져온 이벤트가 없습니다. Google Calendar에 일정이 있는지 확인해주세요."
            elif new_events_count == 0:
                message = f"모든 Google Calendar 이벤트가 이미 저장되어 있거나 Always Plan에서 만든 이벤트입니다. (전체 {len(existing_events)}개 이벤트 중 건너뜀: 이미 저장됨 {skipped_already_saved_count}개, Always Plan 이벤트 {skipped_always_plan_count}개)"
            else:
                message = "저장할 일정이 없습니다."
        
        return {
            "success": True,
            "synced_count": synced_count,
            "matched_count": matched_count,
            "bulk_synced_count": bulk_synced_count,  # 이미 동기화된 일정 중 bulk_synced=True로 설정된 수
            "imported_count": imported_count,  # Google Calendar 이벤트를 웹앱에 저장한 수
            "failed_count": failed_count,
            "imported_failed_count": imported_failed_count,  # Google Calendar 이벤트 저장 실패 수
            "total_count": len(todos_to_sync),
            "total_saved": total_saved,  # 총 저장된 일정 수 (웹앱 → Google Calendar)
            "failed_todo_ids": failed_todos,
            "message": message,
            "import_enabled": import_enabled,  # import_enabled 토글 상태
            "total_events_from_google": len(existing_events),  # Google Calendar에서 가져온 전체 이벤트 수
            "new_events_count": new_events_count,  # 새로 처리해야 할 이벤트 수 (건너뛴 것 제외)
            "skipped_counts": {  # 건너뛴 이벤트 통계
                "already_saved": skipped_already_saved_count,
                "always_plan_events": skipped_always_plan_count,
                "other": skipped_events_count
            },
            "failed_events_info": failed_events_info  # 실패한 이벤트 상세 정보 (디버깅용)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"일괄 동기화 실패: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"일괄 동기화 실패: {str(e)}"
        )


@router.post("/export")
async def export_todos_to_google_calendar(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """웹앱의 모든 기존 일정을 Google Calendar로 내보내기 (토글 상태와 무관)"""
    try:
        # 사용자의 Google Calendar 토큰 확인
        if not current_user.google_calendar_token:
            raise HTTPException(
                status_code=400,
                detail="Google Calendar 연동이 필요합니다. 설정에서 연동해주세요."
            )
        
        from app.models.models import Todo
        
        logger.info(f"[EXPORT] ========== 웹앱 일정 내보내기 시작 ========== 사용자: {current_user.email} (ID: {current_user.id})")
        
        # 1단계: Google Calendar에서 현재 이벤트 목록 가져오기 (중복 체크용)
        logger.info("[EXPORT] Google Calendar 이벤트 목록 가져오기 시작...")
        existing_events = []
        try:
            # 최근 5년 전부터 5년 후까지의 이벤트 가져오기
            time_min = datetime.utcnow() - timedelta(days=5*365)
            time_max = datetime.utcnow() + timedelta(days=5*365)
            existing_events = await GoogleCalendarService.list_events(
                token_json=current_user.google_calendar_token,
                time_min=time_min,
                time_max=time_max,
                max_results=2500  # Google Calendar API 최대값 (2500)
            )
            logger.info(f"[EXPORT] Google Calendar에서 {len(existing_events)}개 이벤트 가져옴 (5년 범위)")
        except Exception as e:
            logger.warning(f"[EXPORT] Google Calendar 이벤트 목록 가져오기 실패 (계속 진행): {e}")
        
        # 기존 이벤트를 제목+날짜+시간으로 매칭하기 위한 맵 생성
        existing_events_map = {}
        for event in existing_events:
            title = event.get('summary', '').strip()
            start = event.get('start', {})
            
            # 날짜/시간 추출
            event_date = None
            event_time = None
            if 'date' in start:
                # 종일 이벤트
                event_date = start['date']
                event_time = None
            elif 'dateTime' in start:
                # 시간 지정 이벤트
                dt = datetime.fromisoformat(start['dateTime'].replace('Z', '+00:00'))
                event_date = dt.date().isoformat()
                event_time = dt.strftime('%H:%M')
            
            if event_date and title:
                # 키: 제목_날짜_시간 (시간이 없으면 종일 이벤트)
                key = f"{title}_{event_date}_{event_time or 'all_day'}"
                existing_events_map[key] = event.get('id')
        
        logger.info(f"[EXPORT] 기존 이벤트 맵 생성 완료: {len(existing_events_map)}개")
        
        # 2단계: Google Calendar에 동기화되지 않은 모든 일정 조회 (토글 상태와 무관하게 모두 내보내기)
        todos_to_export = db.query(Todo).filter(
            Todo.user_id == current_user.id,
            Todo.deleted_at.is_(None),
            Todo.google_calendar_event_id.is_(None)  # 아직 동기화되지 않은 일정만
        ).all()
        
        logger.info(f"[EXPORT] 내보낼 일정: {len(todos_to_export)}개")
        
        synced_count = 0
        matched_count = 0  # 기존 이벤트와 매칭된 일정 수
        failed_count = 0
        failed_todos = []
        
        if not todos_to_export:
            logger.info("[EXPORT] 내보낼 일정이 없습니다 (모든 일정이 이미 동기화됨)")
        else:
            for todo in todos_to_export:
                try:
                    # 날짜가 없는 일정은 건너뜀
                    if not todo.date:
                        continue
                    
                    # 일정 키 생성 (제목_날짜_시간)
                    todo_date_str = todo.date.isoformat() if hasattr(todo.date, 'isoformat') else str(todo.date)
                    todo_time_str = None
                    if not todo.all_day and todo.start_time:
                        if hasattr(todo.start_time, 'strftime'):
                            todo_time_str = todo.start_time.strftime('%H:%M')
                        else:
                            todo_time_str = str(todo.start_time)
                    
                    key = f"{todo.title.strip()}_{todo_date_str}_{todo_time_str or 'all_day'}"
                    
                    # 기존 이벤트와 매칭 확인
                    if key in existing_events_map:
                        # 이미 Google Calendar에 있는 이벤트와 매칭
                        existing_event_id = existing_events_map[key]
                        todo.google_calendar_event_id = existing_event_id
                        todo.bulk_synced = True  # 일괄 내보내기로 매칭된 일정도 표시
                        db.commit()  # 변경사항 저장
                        matched_count += 1
                        logger.info(f"[EXPORT] 기존 이벤트와 매칭: todo_id={todo.id}, event_id={existing_event_id}, bulk_synced=True")
                        continue
                    
                    # Google Calendar에 이벤트 생성
                    start_datetime = None
                    end_datetime = None
                    
                    if todo.all_day:
                        # 종일 이벤트
                        start_datetime = datetime.combine(todo.date, datetime.min.time())
                        # end_date가 있으면 그 날짜까지, 없으면 하루만
                        if todo.end_date:
                            # end_date는 inclusive이므로, Google Calendar의 exclusive 형식으로 변환하려면 +1일
                            end_datetime = datetime.combine(todo.end_date, datetime.min.time()) + timedelta(days=1)
                        else:
                            end_datetime = start_datetime + timedelta(days=1)
                    else:
                        # 시간 지정 이벤트
                        if todo.start_time:
                            start_datetime = datetime.combine(todo.date, todo.start_time)
                        else:
                            start_datetime = datetime.combine(todo.date, datetime.min.time())
                        
                        # end_date가 있으면 그 날짜의 end_time 사용, 없으면 같은 날의 end_time 사용
                        if todo.end_date:
                            # 여러 날짜에 걸친 일정
                            if todo.end_time:
                                end_datetime = datetime.combine(todo.end_date, todo.end_time)
                            else:
                                # end_time이 없으면 end_date의 23:59:59로 설정
                                end_datetime = datetime.combine(todo.end_date, datetime.max.time())
                        else:
                            # 하루 일정
                            if todo.end_time:
                                end_datetime = datetime.combine(todo.date, todo.end_time)
                            else:
                                end_datetime = start_datetime + timedelta(hours=1)
                    
                    if not start_datetime:
                        continue
                    
                    # 알림 및 반복 정보 파싱
                    notification_reminders = []
                    if todo.notification_reminders:
                        try:
                            parsed = json.loads(todo.notification_reminders) if isinstance(todo.notification_reminders, str) else todo.notification_reminders
                            if isinstance(parsed, list):
                                notification_reminders = parsed
                        except:
                            pass
                    
                    # 반복 정보는 Google Calendar로 전달하지 않음 (중복 일정 생성 방지)
                    
                    # Google Calendar에 이벤트 생성
                    logger.info(f"[EXPORT] Google Calendar 이벤트 생성 - start={start_datetime}, end={end_datetime}, all_day={todo.all_day}")
                    event = await GoogleCalendarService.create_event(
                        token_json=current_user.google_calendar_token,
                        title=todo.title,
                        description=todo.memo or todo.description or "",
                        start_datetime=start_datetime,
                        end_datetime=end_datetime,
                        location=todo.location or "",
                        all_day=todo.all_day,
                        notification_reminders=notification_reminders if notification_reminders else None,
                        repeat_type=None,  # 반복 정보는 전달하지 않음
                        repeat_pattern=None,
                        repeat_end_date=None,
                        source_id=todo.id  # Always Plan의 Todo ID 저장 (중복 제거용)
                    )
                    
                    if event and event.get('id'):
                        # Todo에 Google Calendar 이벤트 ID 저장 및 일괄 내보내기 플래그 설정
                        todo.google_calendar_event_id = event.get('id')
                        todo.bulk_synced = True  # 일괄 내보내기로 생성된 일정 표시
                        db.commit()  # 변경사항 저장
                        synced_count += 1
                        logger.info(f"[EXPORT] 새 이벤트 생성: todo_id={todo.id}, event_id={event.get('id')}, bulk_synced=True")
                    else:
                        failed_count += 1
                        failed_todos.append(todo.id)
                except Exception as e:
                    logger.error(f"일정 내보내기 실패 (todo_id={todo.id}): {e}", exc_info=True)
                    failed_count += 1
                    failed_todos.append(todo.id)
        
        # 변경사항 커밋
        db.commit()
        
        logger.info(f"[EXPORT] ========== 내보내기 완료 ==========")
        logger.info(f"[EXPORT] 매칭: {matched_count}개")
        logger.info(f"[EXPORT] 새로 생성: {synced_count}개")
        logger.info(f"[EXPORT] 실패: {failed_count}개")
        
        total_exported = synced_count + matched_count
        
        message = ""
        if synced_count > 0:
            message += f"웹앱 일정 {synced_count}개가 Google Calendar에 저장되었습니다. "
        if matched_count > 0:
            message += f"웹앱 일정 {matched_count}개가 기존 Google Calendar 이벤트와 매칭되었습니다. "
        if failed_count > 0:
            message += f"일정 {failed_count}개 내보내기 실패. "
        if total_exported == 0:
            message = "내보낼 일정이 없습니다 (모든 일정이 이미 동기화되었거나 날짜가 없음)."
        else:
            message += "내보낸 일정은 Google Calendar에 저장되어 있습니다."
        
        return {
            "success": True,
            "synced_count": synced_count,
            "matched_count": matched_count,
            "failed_count": failed_count,
            "total_count": len(todos_to_export),
            "total_exported": total_exported,
            "failed_todo_ids": failed_todos,
            "message": message
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"일정 내보내기 실패: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"일정 내보내기 실패: {str(e)}"
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
        
        # 이미 동기화된 일정인 경우 업데이트
        if todo.google_calendar_event_id:
            # 기존 이벤트 업데이트
            start_datetime = None
            end_datetime = None
            
            if todo.date:
                if todo.all_day:
                    # 종일 이벤트
                    start_datetime = datetime.combine(todo.date, datetime.min.time())
                    # end_date가 있으면 그 날짜까지, 없으면 하루만
                    if todo.end_date:
                        # end_date는 inclusive이므로, Google Calendar의 exclusive 형식으로 변환하려면 +1일
                        end_datetime = datetime.combine(todo.end_date, datetime.min.time()) + timedelta(days=1)
                    else:
                        end_datetime = start_datetime + timedelta(days=1)
                else:
                    # 시간 지정 이벤트
                    if todo.start_time:
                        start_datetime = datetime.combine(todo.date, todo.start_time)
                    else:
                        start_datetime = datetime.combine(todo.date, datetime.min.time())
                    
                    # end_date가 있으면 그 날짜의 end_time 사용, 없으면 같은 날의 end_time 사용
                    if todo.end_date:
                        # 여러 날짜에 걸친 일정
                        if todo.end_time:
                            end_datetime = datetime.combine(todo.end_date, todo.end_time)
                        else:
                            # end_time이 없으면 end_date의 23:59:59로 설정
                            end_datetime = datetime.combine(todo.end_date, datetime.max.time())
                    else:
                        # 하루 일정
                        if todo.end_time:
                            end_datetime = datetime.combine(todo.date, todo.end_time)
                        else:
                            end_datetime = start_datetime + timedelta(hours=1)
            
            if start_datetime:
                # 알림 및 반복 정보 파싱
                notification_reminders = []
                if todo.notification_reminders:
                    try:
                        parsed = json.loads(todo.notification_reminders) if isinstance(todo.notification_reminders, str) else todo.notification_reminders
                        if isinstance(parsed, list):
                            notification_reminders = parsed
                    except:
                        pass
                
                # 반복 정보는 Google Calendar로 전달하지 않음 (중복 일정 생성 방지)
                # 반복 정보는 웹앱 내에서만 관리하고, Google Calendar에는 단일 이벤트로만 내보냄
                
                logger.info(f"[SYNC_TODO] Google Calendar 이벤트 업데이트 - start={start_datetime}, end={end_datetime}, all_day={todo.all_day}")
                updated_event = await GoogleCalendarService.update_event(
                    token_json=current_user.google_calendar_token,
                    event_id=todo.google_calendar_event_id,
                    title=todo.title,
                    description=todo.memo or todo.description or "",
                    start_datetime=start_datetime,
                    end_datetime=end_datetime,
                    location=todo.location or "",
                    all_day=todo.all_day,
                    notification_reminders=notification_reminders if notification_reminders else None,
                    repeat_type=None,  # 반복 정보는 전달하지 않음
                    repeat_pattern=None,
                    repeat_end_date=None
                )
                
                if updated_event:
                    db.commit()
                    return {
                        "success": True,
                        "event_id": updated_event.get('id'),
                        "event_url": updated_event.get('htmlLink'),
                        "message": "Google Calendar 이벤트가 업데이트되었습니다"
                    }
        
        # Google Calendar에 이벤트 생성
        start_datetime = None
        end_datetime = None
        
        if todo.date:
            if todo.all_day:
                # 종일 이벤트
                start_datetime = datetime.combine(todo.date, datetime.min.time())
                # end_date가 있으면 그 날짜까지, 없으면 하루만
                if todo.end_date:
                    # end_date는 inclusive이므로, Google Calendar의 exclusive 형식으로 변환하려면 +1일
                    end_datetime = datetime.combine(todo.end_date, datetime.min.time()) + timedelta(days=1)
                else:
                    end_datetime = start_datetime + timedelta(days=1)
            else:
                # 시간 지정 이벤트
                if todo.start_time:
                    start_datetime = datetime.combine(todo.date, todo.start_time)
                else:
                    start_datetime = datetime.combine(todo.date, datetime.min.time())
                
                # end_date가 있으면 그 날짜의 end_time 사용, 없으면 같은 날의 end_time 사용
                if todo.end_date:
                    # 여러 날짜에 걸친 일정
                    if todo.end_time:
                        end_datetime = datetime.combine(todo.end_date, todo.end_time)
                    else:
                        # end_time이 없으면 end_date의 23:59:59로 설정
                        end_datetime = datetime.combine(todo.end_date, datetime.max.time())
                else:
                    # 하루 일정
                    if todo.end_time:
                        end_datetime = datetime.combine(todo.date, todo.end_time)
                    else:
                        end_datetime = start_datetime + timedelta(hours=1)
        
        if not start_datetime:
            raise HTTPException(
                status_code=400,
                detail="일정 날짜가 필요합니다"
            )
        
        # 알림 및 반복 정보 파싱
        notification_reminders = []
        if todo.notification_reminders:
            try:
                parsed = json.loads(todo.notification_reminders) if isinstance(todo.notification_reminders, str) else todo.notification_reminders
                if isinstance(parsed, list):
                    notification_reminders = parsed
            except:
                pass
        
        # 반복 정보는 Google Calendar로 전달하지 않음 (중복 일정 생성 방지)
        # 반복 정보는 웹앱 내에서만 관리하고, Google Calendar에는 단일 이벤트로만 내보냄
        
        logger.info(f"[SYNC_TODO] Google Calendar 이벤트 생성 - start={start_datetime}, end={end_datetime}, all_day={todo.all_day}")
        # Google Calendar에 이벤트 생성
        event = await GoogleCalendarService.create_event(
            token_json=current_user.google_calendar_token,
            title=todo.title,
            description=todo.memo or todo.description or "",
            start_datetime=start_datetime,
            end_datetime=end_datetime,
            location=todo.location or "",
            all_day=todo.all_day,
            notification_reminders=notification_reminders if notification_reminders else None,
            repeat_type=None,  # 반복 정보는 전달하지 않음
            repeat_pattern=None,
            repeat_end_date=None,
            source_id=todo.id  # Always Plan의 Todo ID 저장 (중복 제거용)
        )
        
        if not event:
            raise HTTPException(
                status_code=500,
                detail="Google Calendar 동기화에 실패했습니다"
            )
        
        # Todo에 Google Calendar 이벤트 ID 저장
        todo.google_calendar_event_id = event.get('id')
        db.commit()
        
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
        'calendar': True,  # 캘린더 전용 플래그
    }
    
    # 캘린더 전용 OAuth URL 생성
    auth_url = GoogleOAuthService.get_authorization_url(state, calendar=True)
    
    logger.info(f"[GOOGLE_CALENDAR_AUTH_URL] Calendar OAuth URL 생성 - state: {state[:20]}..., calendar_mode: true")
    
    return {
        "auth_url": auth_url,
        "state": state
    }


@router.get("/status")
async def get_calendar_status(
    current_user: User = Depends(get_current_user)
):
    """Google Calendar 연동 상태 확인"""
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
        "token_valid": token_valid,
        "import_enabled": current_user.google_calendar_import_enabled == "true" if hasattr(current_user, 'google_calendar_import_enabled') else False,
        "export_enabled": current_user.google_calendar_export_enabled == "true" if hasattr(current_user, 'google_calendar_export_enabled') else False
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
    # 기본값으로 가져오기와 내보내기는 비활성화 (사용자가 직접 활성화해야 함)
    if not hasattr(current_user, 'google_calendar_import_enabled') or current_user.google_calendar_import_enabled is None:
        current_user.google_calendar_import_enabled = "false"
    if not hasattr(current_user, 'google_calendar_export_enabled') or current_user.google_calendar_export_enabled is None:
        current_user.google_calendar_export_enabled = "false"
    db.commit()
    
    return {
        "success": True,
        "message": "Google Calendar 연동이 활성화되었습니다"
    }


@router.post("/toggle-import")
async def toggle_calendar_import(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Google Calendar 가져오기 토글"""
    if not current_user.google_calendar_token:
        raise HTTPException(
            status_code=400,
            detail="Google Calendar 토큰이 없습니다. 먼저 Google 로그인을 해주세요."
        )
    
    from app.models.models import Todo
    
    current_import_enabled = getattr(current_user, 'google_calendar_import_enabled', 'false')
    new_state = "false" if current_import_enabled == "true" else "true"
    current_user.google_calendar_import_enabled = new_state
    
    deleted_count = 0
    
    if new_state == "false":
        # 토글을 끌 때: 웹앱에서만 Google Calendar에서 가져온 일정들을 숨김 (소프트 삭제)
        # 중요: Google Calendar의 실제 이벤트는 삭제하지 않음 (Google Calendar에 그대로 남아있어야 함)
        logger.info("[TOGGLE_IMPORT] 토글 꺼짐 - 웹앱에서 Google Calendar 일정 숨김 시작 (Google Calendar의 실제 이벤트는 삭제하지 않음)")
        
        # source='google_calendar'인 일정들만 조회 (웹앱에서만 숨김 처리)
        todos_to_delete = db.query(Todo).filter(
            Todo.user_id == current_user.id,
            Todo.deleted_at.is_(None),
            Todo.source == 'google_calendar'  # Google Calendar에서 가져온 일정만
        ).all()
        
        logger.info(f"[TOGGLE_IMPORT] 웹앱에서 숨길 일정: {len(todos_to_delete)}개 (Google Calendar의 실제 이벤트는 삭제하지 않음)")
        
        for todo in todos_to_delete:
            try:
                # 웹앱에서만 소프트 삭제 (deleted_at 설정)
                # 중요: Google Calendar API를 호출하지 않으므로 Google Calendar의 실제 이벤트는 절대 삭제되지 않음
                # Google Calendar의 실제 이벤트는 그대로 유지되고, 웹앱에서만 표시되지 않도록 함
                # GoogleCalendarService.delete_event()를 호출하지 않음
                todo.deleted_at = datetime.utcnow()
                # google_calendar_event_id는 그대로 유지 (Google Calendar 이벤트 참조 유지)
                deleted_count += 1
                logger.info(f"[TOGGLE_IMPORT] 웹앱에서 일정 숨김 (Google Calendar 이벤트는 유지, API 호출 없음): todo_id={todo.id}, title={todo.title}, google_calendar_event_id={todo.google_calendar_event_id}")
            except Exception as e:
                logger.error(f"[TOGGLE_IMPORT] 일정 숨김 실패: todo_id={todo.id}, error={e}")
        
        logger.info(f"[TOGGLE_IMPORT] 총 {deleted_count}개 일정을 웹앱에서 숨김 완료 (Google Calendar의 실제 이벤트는 삭제하지 않았음)")
    
    db.commit()
    
    logger.info(f"[TOGGLE_IMPORT] 토글 변경 - user_id={current_user.id}, email={current_user.email}, 현재 상태={current_import_enabled}, 새 상태={new_state}")
    
    message = f"Google Calendar 가져오기가 {'활성화' if new_state == 'true' else '비활성화'}되었습니다"
    if new_state == "false":
        if deleted_count > 0:
            message += f". {deleted_count}개 Google Calendar 일정이 앱에서 제거되었습니다."
        else:
            message += ". Google Calendar 일정이 앱에서 제거됩니다."
    
    return {
        "success": True,
        "import_enabled": new_state == "true",
        "deleted_count": deleted_count,
        "message": message
    }


@router.post("/toggle-export")
async def toggle_calendar_export(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Google Calendar 내보내기 토글"""
    from app.models.models import Todo
    from app.services.calendar_service import GoogleCalendarService
    from datetime import timedelta
    
    try:
        if not current_user.google_calendar_token:
            raise HTTPException(
                status_code=400,
                detail="Google Calendar 토큰이 없습니다. 먼저 Google 로그인을 해주세요."
            )
        
        current_export_enabled = getattr(current_user, 'google_calendar_export_enabled', 'false')
        new_state = "false" if current_export_enabled == "true" else "true"
        
        # 변수 초기화 (토글 켜기/끄기 모두에서 사용)
        synced_count = 0
        matched_count = 0
        deleted_count = 0
        all_todos = []
        
        logger.info(f"[TOGGLE_EXPORT] 토글 변경 - user_id={current_user.id}, email={current_user.email}, 현재 상태={current_export_enabled}, 새 상태={new_state}")
        
        if new_state == "true":
            # 토글을 켤 때: 기존 일정들을 Google Calendar에 동기화 (sync/all과 동일한 로직)
            logger.info("[TOGGLE_EXPORT] 토글 켜짐 - 기존 일정 동기화 시작 (sync/all 로직 사용)")
            
            # 1단계: Google Calendar에서 현재 이벤트 목록 가져오기 (중복 체크용)
            existing_events = []
            try:
                # 최근 5년 전부터 5년 후까지의 이벤트 가져오기 (과거 일정도 포함)
                time_min = datetime.utcnow() - timedelta(days=5*365)
                time_max = datetime.utcnow() + timedelta(days=5*365)
                existing_events = await GoogleCalendarService.list_events(
                    token_json=current_user.google_calendar_token,
                    time_min=time_min,
                    time_max=time_max,
                    max_results=2500  # Google Calendar API 최대값
                )
                logger.info(f"[TOGGLE_EXPORT] Google Calendar에서 {len(existing_events)}개 이벤트 가져옴 (5년 범위)")
            except Exception as e:
                logger.warning(f"[TOGGLE_EXPORT] Google Calendar 이벤트 목록 가져오기 실패 (계속 진행): {e}")
            
            # 기존 이벤트를 제목+날짜+시간으로 매칭하기 위한 맵 생성
            existing_events_map = {}
            for event in existing_events:
                title = event.get('summary', '').strip()
                start = event.get('start', {})
                
                event_date = None
                event_time = None
                if 'date' in start:
                    event_date = start['date']
                    event_time = None
                elif 'dateTime' in start:
                    dt = datetime.fromisoformat(start['dateTime'].replace('Z', '+00:00'))
                    event_date = dt.date().isoformat()
                    event_time = dt.strftime('%H:%M')
                
                if event_date and title:
                    key = f"{title}_{event_date}_{event_time or 'all_day'}"
                    existing_events_map[key] = event.get('id')
            
            logger.info(f"[TOGGLE_EXPORT] 기존 이벤트 맵 생성 완료: {len(existing_events_map)}개")
            
            # 2단계: 모든 일정 조회 (날짜가 있는 것만)
            # 토글을 켤 때는 모든 기존 일정을 확인하여 누락된 것들을 내보냄
            all_todos = db.query(Todo).filter(
                Todo.user_id == current_user.id,
                Todo.deleted_at.is_(None),
                Todo.date.isnot(None)  # 날짜가 있는 일정만
            ).all()
            
            logger.info(f"[TOGGLE_EXPORT] 전체 일정: {len(all_todos)}개 (날짜가 있는 일정만)")
            
            # 모든 일정을 처리 (google_calendar_event_id 유무와 관계없이)
            # 이미 google_calendar_event_id가 있어도 Google Calendar에 실제로 존재하는지 확인해야 함
            todos_to_sync = all_todos  # 모든 일정 처리
            
            # 이미 동기화된 것으로 보이는 일정 수 (google_calendar_event_id가 있는 일정)
            already_synced_count = len([todo for todo in all_todos if todo.google_calendar_event_id])
            
            logger.info(f"[TOGGLE_EXPORT] 동기화할 일정: {len(todos_to_sync)}개 (모든 일정 확인)")
            logger.info(f"[TOGGLE_EXPORT] google_calendar_event_id가 있는 일정: {already_synced_count}개 (재확인 필요)")
            
            # synced_count, matched_count는 이미 함수 시작 부분에서 초기화됨
            skipped_already_synced_count = 0  # 이미 Google Calendar에 실제로 존재하는 일정 수
            
            for todo in todos_to_sync:
                try:
                    if not todo.date:
                        continue
                
                    # 일정 키 생성 (제목_날짜_시간)
                    todo_date_str = todo.date.isoformat() if hasattr(todo.date, 'isoformat') else str(todo.date)
                    todo_time_str = None
                    if not todo.all_day and todo.start_time:
                        if hasattr(todo.start_time, 'strftime'):
                            todo_time_str = todo.start_time.strftime('%H:%M')
                        else:
                            todo_time_str = str(todo.start_time)
                    
                    key = f"{todo.title.strip()}_{todo_date_str}_{todo_time_str or 'all_day'}"
                    
                    # 기존 이벤트와 매칭 확인
                    if key in existing_events_map:
                        existing_event_id = existing_events_map[key]
                        
                        # google_calendar_event_id가 이미 있고, 그것이 실제 Google Calendar의 이벤트 ID와 같으면 스킵
                        if todo.google_calendar_event_id == existing_event_id:
                            skipped_already_synced_count += 1
                            logger.info(f"[TOGGLE_EXPORT] 이미 동기화됨 (스킵): todo_id={todo.id}, event_id={existing_event_id}")
                            continue
                        
                        # 매칭된 이벤트가 있으면 google_calendar_event_id 업데이트
                        todo.google_calendar_event_id = existing_event_id
                        # 토글을 켤 때 동기화하는 일정은 bulk_synced=False로 설정 (토글을 끄면 삭제되도록)
                        # "동기화 후 저장" 버튼을 누르면 bulk_synced=True로 변경됨
                        if todo.bulk_synced is None:
                            todo.bulk_synced = False
                        db.commit()
                        matched_count += 1
                        logger.info(f"[TOGGLE_EXPORT] 기존 이벤트와 매칭: todo_id={todo.id}, event_id={existing_event_id}, bulk_synced={todo.bulk_synced}")
                        continue
                    
                    # google_calendar_event_id가 있지만 실제 Google Calendar에 없는 경우
                    # (이전에 동기화되었지만 Google Calendar에서 삭제된 경우)
                    if todo.google_calendar_event_id:
                        # 기존 이벤트 맵에 없으므로 Google Calendar에 실제로 없는 것으로 간주
                        # google_calendar_event_id를 None으로 설정하고 새로 생성
                        logger.warning(f"[TOGGLE_EXPORT] google_calendar_event_id가 있지만 Google Calendar에 없음. 새로 생성: todo_id={todo.id}, 기존 event_id={todo.google_calendar_event_id}")
                        todo.google_calendar_event_id = None
                        db.commit()  # 기존 event_id 제거
                    
                    # 날짜/시간 정보 구성
                    start_datetime = None
                    end_datetime = None
                    
                    if todo.all_day:
                        start_datetime = datetime.combine(todo.date, datetime.min.time())
                        end_datetime = start_datetime + timedelta(days=1)
                    else:
                        if todo.start_time:
                            start_datetime = datetime.combine(todo.date, todo.start_time)
                        else:
                            start_datetime = datetime.combine(todo.date, datetime.min.time())
                        
                        if todo.end_time:
                            end_datetime = datetime.combine(todo.date, todo.end_time)
                        else:
                            end_datetime = start_datetime + timedelta(hours=1)
                    
                    if start_datetime:
                        # 알림 및 반복 정보 파싱
                        notification_reminders = []
                        if todo.notification_reminders:
                            try:
                                parsed = json.loads(todo.notification_reminders) if isinstance(todo.notification_reminders, str) else todo.notification_reminders
                                if isinstance(parsed, list):
                                    notification_reminders = parsed
                            except:
                                pass
                        
                        repeat_type = todo.repeat_type or 'none'
                        repeat_pattern = None
                        repeat_end_date = None
                        if todo.repeat_pattern:
                            try:
                                repeat_pattern = json.loads(todo.repeat_pattern) if isinstance(todo.repeat_pattern, str) else todo.repeat_pattern
                            except:
                                pass
                        if todo.repeat_end_date:
                            repeat_end_date = todo.repeat_end_date
                        
                        # Google Calendar에 이벤트 생성
                        event = await GoogleCalendarService.create_event(
                            token_json=current_user.google_calendar_token,
                            title=todo.title,
                            description=todo.memo or todo.description or "",
                            start_datetime=start_datetime,
                            end_datetime=end_datetime,
                            location=todo.location or "",
                            all_day=todo.all_day,
                            notification_reminders=notification_reminders if notification_reminders else None,
                            repeat_type=repeat_type if repeat_type != 'none' else None,
                            repeat_pattern=repeat_pattern,
                            repeat_end_date=repeat_end_date,
                            source_id=todo.id  # Always Plan의 Todo ID 저장 (중복 제거용)
                        )
                        
                        if event and event.get('id'):
                            todo.google_calendar_event_id = event.get('id')
                            # 토글을 켤 때 동기화하는 일정은 bulk_synced=False로 설정 (토글을 끄면 삭제되도록)
                            # "동기화 후 저장" 버튼을 누르면 bulk_synced=True로 변경됨
                            if todo.bulk_synced is None:
                                todo.bulk_synced = False
                            db.commit()
                            synced_count += 1
                            logger.info(f"[TOGGLE_EXPORT] 일정 동기화 성공: todo_id={todo.id}, event_id={event.get('id')}, bulk_synced={todo.bulk_synced}")
                except Exception as e:
                    logger.error(f"[TOGGLE_EXPORT] 일정 동기화 실패: todo_id={todo.id}, error={e}")
        
            logger.info(f"[TOGGLE_EXPORT] ========== 동기화 결과 ==========")
            logger.info(f"[TOGGLE_EXPORT] 새로 생성된 일정: {synced_count}개")
            logger.info(f"[TOGGLE_EXPORT] 기존 이벤트와 매칭된 일정: {matched_count}개")
            logger.info(f"[TOGGLE_EXPORT] 이미 동기화되어 스킵된 일정: {skipped_already_synced_count}개")
            logger.info(f"[TOGGLE_EXPORT] 총 {synced_count + matched_count}개 일정 처리 완료")
            deleted_count = 0  # 토글 켤 때는 삭제 없음
            
        else:
            # 토글을 끌 때: Always Plan에서 생성한 일정만 Google Calendar에서 삭제
            # 중요: Google Calendar에서 가져온 일정(source='google_calendar')은 삭제하지 않음
            logger.info("[TOGGLE_EXPORT] 토글 꺼짐 - Always Plan 일정만 Google Calendar에서 삭제 시작 (Google Calendar에서 가져온 일정은 제외)")
            
            # Always Plan에서 생성한 일정만 조회 (Google Calendar에서 가져온 일정 제외)
            # source != 'google_calendar'이고 google_calendar_event_id가 있는 일정만 삭제
            todos_to_unsync = db.query(Todo).filter(
                Todo.user_id == current_user.id,
                Todo.deleted_at.is_(None),
                Todo.google_calendar_event_id.isnot(None),
                Todo.source != 'google_calendar'  # Google Calendar에서 가져온 일정은 제외
            ).all()
            
            logger.info(f"[TOGGLE_EXPORT] 삭제할 일정: {len(todos_to_unsync)}개 (Always Plan에서 생성한 일정만, Google Calendar에서 가져온 일정은 제외)")
            
            # 삭제할 일정의 상세 정보 로깅
            if todos_to_unsync:
                logger.info(f"[TOGGLE_EXPORT] 삭제할 일정 상세 (Always Plan에서 생성한 일정만):")
                for todo in todos_to_unsync:
                    logger.info(f"  - todo_id={todo.id}, title={todo.title}, event_id={todo.google_calendar_event_id}, source={todo.source}, bulk_synced={todo.bulk_synced}")
            
            deleted_count = 0
            failed_delete_count = 0
            for todo in todos_to_unsync:
                try:
                    event_id_before_delete = todo.google_calendar_event_id
                    logger.info(f"[TOGGLE_EXPORT] 이벤트 삭제 시도: todo_id={todo.id}, event_id={event_id_before_delete}")
                    
                    # Google Calendar에서 이벤트 삭제
                    deleted = await GoogleCalendarService.delete_event(
                        token_json=current_user.google_calendar_token,
                        event_id=event_id_before_delete
                    )
                    
                    if deleted:
                        todo.google_calendar_event_id = None
                        deleted_count += 1
                        logger.info(f"[TOGGLE_EXPORT] 이벤트 삭제 성공: todo_id={todo.id}, event_id={event_id_before_delete}")
                    else:
                        failed_delete_count += 1
                        logger.warning(f"[TOGGLE_EXPORT] 이벤트 삭제 실패 (Google Calendar 응답 False): todo_id={todo.id}, event_id={event_id_before_delete}")
                except Exception as e:
                    failed_delete_count += 1
                    logger.error(f"[TOGGLE_EXPORT] 이벤트 삭제 실패 (예외 발생): todo_id={todo.id}, event_id={todo.google_calendar_event_id}, error={e}", exc_info=True)
            
            # 변경사항 한 번에 커밋
            if deleted_count > 0:
                try:
                    db.commit()
                    logger.info(f"[TOGGLE_EXPORT] {deleted_count}개 일정의 google_calendar_event_id 제거 완료")
                except Exception as e:
                    logger.error(f"[TOGGLE_EXPORT] DB 커밋 실패: {e}", exc_info=True)
                    db.rollback()
            
            logger.info(f"[TOGGLE_EXPORT] 총 {deleted_count}개 이벤트 삭제 성공, {failed_delete_count}개 실패")
    
        # 토글 상태 저장 (반드시 저장되어야 함)
        # 먼저 토글 상태를 저장 (이벤트 삭제와 별도로 처리)
        try:
            # 사용자 객체 새로고침
            db.refresh(current_user)
            
            # 이전 상태 확인
            old_state = getattr(current_user, 'google_calendar_export_enabled', 'false')
            logger.info(f"[TOGGLE_EXPORT] 토글 상태 변경 시작 - user_id={current_user.id}, 현재 상태={old_state}, 새 상태={new_state}")
            
            # 토글 상태 저장
            current_user.google_calendar_export_enabled = new_state
            db.commit()
            db.refresh(current_user)
            
            # 저장 확인
            saved_value = getattr(current_user, 'google_calendar_export_enabled', 'false')
            logger.info(f"[TOGGLE_EXPORT] 토글 상태 저장 - user_id={current_user.id}, 저장된 값={saved_value}, 예상 값={new_state}")
            
            if saved_value != new_state:
                logger.error(f"[TOGGLE_EXPORT] 저장 실패! 예상={new_state}, 실제={saved_value}")
                # 롤백 후 재시도
                db.rollback()
                db.refresh(current_user)
                current_user.google_calendar_export_enabled = new_state
                db.commit()
                db.refresh(current_user)
                saved_value = getattr(current_user, 'google_calendar_export_enabled', 'false')
                logger.info(f"[TOGGLE_EXPORT] 롤백 후 재시도 저장된 값={saved_value}")
                
                if saved_value != new_state:
                    logger.error(f"[TOGGLE_EXPORT] 재시도 후에도 저장 실패! 예상={new_state}, 실제={saved_value}")
                    # 마지막 시도: 새로운 세션 사용
                    from sqlalchemy.orm import sessionmaker
                    from app.database import engine
                    SessionLocal = sessionmaker(bind=engine)
                    fresh_session = SessionLocal()
                    try:
                        fresh_user = fresh_session.query(User).filter(User.id == current_user.id).first()
                        if fresh_user:
                            fresh_user.google_calendar_export_enabled = new_state
                            fresh_session.commit()
                            fresh_session.refresh(fresh_user)
                            saved_value = getattr(fresh_user, 'google_calendar_export_enabled', 'false')
                            logger.info(f"[TOGGLE_EXPORT] 새 세션으로 저장 후 값={saved_value}")
                            
                            if saved_value != new_state:
                                logger.error(f"[TOGGLE_EXPORT] 새 세션으로도 저장 실패! 예상={new_state}, 실제={saved_value}")
                            else:
                                logger.info(f"[TOGGLE_EXPORT] 새 세션으로 저장 성공!")
                    finally:
                        fresh_session.close()
                else:
                    logger.info(f"[TOGGLE_EXPORT] 롤백 후 재시도로 저장 성공!")
            else:
                logger.info(f"[TOGGLE_EXPORT] 토글 상태 저장 성공!")
        except Exception as e:
            logger.error(f"[TOGGLE_EXPORT] 토글 상태 저장 중 오류: {e}", exc_info=True)
            # 롤백 후 재시도
            try:
                db.rollback()
                db.refresh(current_user)
                current_user.google_calendar_export_enabled = new_state
                db.commit()
                db.refresh(current_user)
                saved_value = getattr(current_user, 'google_calendar_export_enabled', 'false')
                logger.info(f"[TOGGLE_EXPORT] 예외 처리 후 저장 완료: {saved_value}")
                
                if saved_value != new_state:
                    # 최후의 수단: 새로운 세션 사용
                    from sqlalchemy.orm import sessionmaker
                    from app.database import engine
                    SessionLocal = sessionmaker(bind=engine)
                    fresh_session = SessionLocal()
                    try:
                        fresh_user = fresh_session.query(User).filter(User.id == current_user.id).first()
                        if fresh_user:
                            fresh_user.google_calendar_export_enabled = new_state
                            fresh_session.commit()
                            logger.info(f"[TOGGLE_EXPORT] 예외 처리 후 새 세션으로 저장 완료")
                    finally:
                        fresh_session.close()
            except Exception as e2:
                logger.error(f"[TOGGLE_EXPORT] 예외 처리 후 저장도 실패: {e2}", exc_info=True)
        
        message = f"Google Calendar 내보내기가 {'활성화' if new_state == 'true' else '비활성화'}되었습니다"
        if new_state == "true":
            if synced_count > 0 and matched_count > 0:
                message += f" ({synced_count}개 일정 동기화, {matched_count}개 일정 매칭됨)"
            elif synced_count > 0:
                message += f" ({synced_count}개 일정 동기화됨)"
            elif matched_count > 0:
                message += f" ({matched_count}개 일정 매칭됨)"
            elif len(all_todos) == 0:
                message += " (내보낼 일정이 없습니다 - 날짜가 있는 일정이 없음)"
            else:
                message += " (이미 모든 일정이 동기화되어 있습니다)"
        elif new_state == "false" and deleted_count > 0:
            message += f" ({deleted_count}개 이벤트 삭제됨, 동기화 후 저장한 일정은 유지됨)"
        
        logger.info(f"[TOGGLE_EXPORT] ========== 토글 변경 완료 ==========")
        logger.info(f"[TOGGLE_EXPORT] 전체 일정 수: {len(all_todos) if new_state == 'true' else 0}개")
        logger.info(f"[TOGGLE_EXPORT] 동기화된 일정: {synced_count}개")
        logger.info(f"[TOGGLE_EXPORT] 매칭된 일정: {matched_count}개")
        
        return {
            "success": True,
            "export_enabled": new_state == "true",
            "message": message,
            "synced_count": synced_count if new_state == "true" else 0,
            "matched_count": matched_count if new_state == "true" else 0,
            "deleted_count": deleted_count if new_state == "false" else 0,
            "total_todos": len(all_todos) if new_state == "true" else 0  # 전체 일정 수 추가
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[TOGGLE_EXPORT] 토글 변경 중 오류 발생: {e}", exc_info=True)
        # 롤백 시도
        try:
            db.rollback()
        except:
            pass
        raise HTTPException(
            status_code=500,
            detail=f"토글 변경 실패: {str(e)}"
        )


@router.post("/disable")
async def disable_calendar_sync(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Google Calendar 연동 비활성화 및 모든 동기화된 이벤트 삭제"""
    from app.models.models import Todo
    
    # 가져오기와 내보내기 토글도 자동으로 비활성화
    current_user.google_calendar_import_enabled = "false"
    current_user.google_calendar_export_enabled = "false"
    logger.info(f"[DISABLE_SYNC] 가져오기와 내보내기 토글도 비활성화됨")
    
    deleted_count = 0
    failed_count = 0
    
    # 비활성화 전에 bulk_synced=False인 Todo의 Google Calendar 이벤트만 삭제
    # bulk_synced=True인 일정은 "동기화 후 저장"으로 영구 저장된 것이므로 Google Calendar에 남겨둠
    # Always Plan의 일정은 삭제하지 않음 (양쪽에 모두 유지)
    if current_user.google_calendar_token:
        try:
            # bulk_synced=False인 일정만 조회 (동기화 후 저장된 일정은 제외)
            todos_to_delete = db.query(Todo).filter(
                Todo.user_id == current_user.id,
                Todo.google_calendar_event_id.isnot(None),
                Todo.deleted_at.is_(None),
                Todo.bulk_synced == False  # 동기화 후 저장된 일정은 제외
            ).all()
            
            # bulk_synced=True인 일정 수 확인 (Always Plan과 Google Calendar 양쪽에 유지됨)
            todos_preserved = db.query(Todo).filter(
                Todo.user_id == current_user.id,
                Todo.google_calendar_event_id.isnot(None),
                Todo.deleted_at.is_(None),
                Todo.bulk_synced == True  # 동기화 후 저장된 일정
            ).all()
            
            preserved_count = len(todos_preserved)
            
            logger.info(f"[DISABLE] Google Calendar 이벤트 삭제 시작: {len(todos_to_delete)}개 일정 삭제, {preserved_count}개 일정 유지 (동기화 후 저장 - Always Plan과 Google Calendar 양쪽에 유지)")
            
            # bulk_synced=True인 일정의 google_calendar_event_id는 유지 (Google Calendar에 남아있도록)
            for todo in todos_preserved:
                logger.info(f"[DISABLE] 일정 유지: todo_id={todo.id}, event_id={todo.google_calendar_event_id}, bulk_synced={todo.bulk_synced}")
            
            for todo in todos_to_delete:
                try:
                    # Google Calendar에서 이벤트 삭제
                    deleted = await GoogleCalendarService.delete_event(
                        token_json=current_user.google_calendar_token,
                        event_id=todo.google_calendar_event_id
                    )
                    
                    if deleted:
                        # 이벤트 ID 제거 (Always Plan의 일정은 유지, Google Calendar 이벤트만 삭제)
                        todo.google_calendar_event_id = None
                        deleted_count += 1
                        logger.info(f"[DISABLE] 이벤트 삭제: todo_id={todo.id}, event_id={todo.google_calendar_event_id} (Always Plan 일정은 유지됨)")
                    else:
                        failed_count += 1
                except Exception as e:
                    logger.warning(f"Google Calendar 이벤트 삭제 실패 (todo_id={todo.id}, event_id={todo.google_calendar_event_id}): {e}")
                    failed_count += 1
                    # 실패해도 이벤트 ID는 제거 (동기화 상태 초기화)
                    todo.google_calendar_event_id = None
            
            # 변경사항 커밋
            if deleted_count > 0 or failed_count > 0:
                db.commit()
            
            logger.info(f"[DISABLE] Google Calendar 비활성화: {deleted_count}개 이벤트 삭제 성공, {failed_count}개 실패, {preserved_count}개 일정 유지 (동기화 후 저장 - Always Plan과 Google Calendar 양쪽에 유지)")
        except Exception as e:
            logger.error(f"[DISABLE] Google Calendar 이벤트 삭제 중 오류: {e}", exc_info=True)
            # 오류가 발생해도 비활성화는 진행
    
    # 연동 비활성화
    current_user.google_calendar_enabled = "false"
    db.commit()
    
    logger.info(f"[DISABLE] Google Calendar 연동 비활성화 완료: 사용자={current_user.email}")
    
    # 유지된 일정 수 재계산 (응답용)
    final_preserved_count = db.query(Todo).filter(
        Todo.user_id == current_user.id,
        Todo.google_calendar_event_id.isnot(None),
        Todo.deleted_at.is_(None),
        Todo.bulk_synced == True
    ).count()
    
    message = f"Google Calendar 연동이 비활성화되었습니다."
    if deleted_count > 0:
        message += f" {deleted_count}개 이벤트가 삭제되었습니다."
    if final_preserved_count > 0:
        message += f" 동기화 후 저장된 {final_preserved_count}개 일정은 Always Plan과 Google Calendar 양쪽에 남아있습니다."
    
    return {
        "success": True,
        "deleted_count": deleted_count,
        "failed_count": failed_count,
        "preserved_count": final_preserved_count,  # 동기화 후 저장된 일정 수 (Always Plan과 Google Calendar 양쪽에 유지)
        "message": message
    }


@router.delete("/imported-todos")
async def delete_imported_google_calendar_todos(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    date_from: str = None,  # Optional: 특정 날짜 이후의 일정만 삭제 (YYYY-MM-DD)
    delete_all: bool = False  # True면 모든 가져온 일정 삭제
):
    """
    Google Calendar에서 가져온 일정 삭제 (잘못된 날짜로 가져온 일정 정리용)

    - source가 'google_calendar'인 일정만 삭제
    - date_from: 특정 날짜 이후의 일정만 삭제 (예: '2027-01-01')
    - delete_all: True면 모든 가져온 일정 삭제
    """
    from app.models.models import Todo

    try:
        logger.info(f"[DELETE_IMPORTED] 가져온 일정 삭제 시작 - user: {current_user.email}, date_from: {date_from}, delete_all: {delete_all}")

        # 기본 쿼리: Google Calendar에서 가져온 일정 (source='google_calendar')
        query = db.query(Todo).filter(
            Todo.user_id == current_user.id,
            Todo.deleted_at.is_(None),
            Todo.source == "google_calendar"  # Google Calendar에서 가져온 일정만
        )

        # 날짜 필터 적용
        if date_from and not delete_all:
            try:
                from_date = datetime.strptime(date_from, '%Y-%m-%d').date()
                query = query.filter(Todo.date >= from_date)
                logger.info(f"[DELETE_IMPORTED] 날짜 필터 적용: {from_date} 이후")
            except ValueError:
                raise HTTPException(
                    status_code=400,
                    detail="날짜 형식이 올바르지 않습니다. YYYY-MM-DD 형식으로 입력해주세요."
                )
        elif not delete_all:
            # date_from도 없고 delete_all도 아니면 2027년 이후만 삭제 (기본값)
            default_date = datetime.strptime('2027-01-01', '%Y-%m-%d').date()
            query = query.filter(Todo.date >= default_date)
            logger.info(f"[DELETE_IMPORTED] 기본 날짜 필터 적용: 2027-01-01 이후")

        # 삭제할 일정 조회
        todos_to_delete = query.all()
        deleted_count = len(todos_to_delete)

        logger.info(f"[DELETE_IMPORTED] 삭제할 일정 수: {deleted_count}개")

        # 일정 삭제 (soft delete가 아닌 실제 삭제)
        for todo in todos_to_delete:
            logger.info(f"[DELETE_IMPORTED] 삭제: todo_id={todo.id}, title={todo.title}, date={todo.date}")
            db.delete(todo)

        db.commit()

        logger.info(f"[DELETE_IMPORTED] 가져온 일정 삭제 완료: {deleted_count}개 삭제됨")

        return {
            "success": True,
            "deleted_count": deleted_count,
            "message": f"Google Calendar에서 가져온 일정 {deleted_count}개가 삭제되었습니다. 다시 동기화하여 올바른 날짜로 가져올 수 있습니다."
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[DELETE_IMPORTED] 일정 삭제 중 오류: {e}", exc_info=True)
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"일정 삭제 실패: {str(e)}"
        )


@router.post("/google-callback")
async def google_calendar_callback(
    request: GoogleCallbackRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    
    """Google Calendar OAuth 콜백 처리"""
    from app.api.routes.auth import oauth_states
    from app.services.auth_service import GoogleOAuthService
    
    try:
        # State 검증
        if request.state not in oauth_states:
            raise HTTPException(
                status_code=400,
                detail="유효하지 않은 상태값(state)입니다"
            )
        
        state_data = oauth_states[request.state]
        del oauth_states[request.state]
        
        # 캘린더 전용 토큰으로 교환
        token_data = await GoogleOAuthService.exchange_code_for_token(request.code, calendar=True)
        if not token_data or not token_data.get('access_token'):
            raise HTTPException(
                status_code=401,
                detail="토큰 교환에 실패했습니다"
            )
        
        # refresh_token 필수 검증
        refresh_token = token_data.get('refresh_token')
        if not refresh_token:
            logger.error(f"[GOOGLE_CALLBACK] refresh_token이 없습니다. OAuth 재동의 필요")
            raise HTTPException(
                status_code=400,
                detail="Google 재동의가 필요합니다. 다시 시도해주세요."
            )
        
        # 토큰 저장 (표준화된 형식)
        calendar_token_dict = {
            'access_token': token_data.get('access_token'),
            'refresh_token': refresh_token,
            'token_uri': token_data.get('token_uri', 'https://oauth2.googleapis.com/token'),
            'client_id': token_data.get('client_id', settings.google_client_id),
            'client_secret': token_data.get('client_secret', settings.google_client_secret),
            'scopes': token_data.get('scopes', ['https://www.googleapis.com/auth/calendar']),
            'expiry': token_data.get('expiry'),  # ISO 형식
        }
        
        calendar_token = json.dumps(calendar_token_dict)
        
        logger.info(f"[GOOGLE_CALLBACK] 저장할 토큰 필드 확인:")
        logger.info(f"  - access_token: {bool(token_data.get('access_token'))}")
        logger.info(f"  - refresh_token: {bool(refresh_token)}")
        logger.info(f"  - token_uri: {token_data.get('token_uri', 'https://oauth2.googleapis.com/token')}")
        logger.info(f"  - client_id: {bool(token_data.get('client_id', settings.google_client_id))}")
        logger.info(f"  - client_secret: {bool(token_data.get('client_secret', settings.google_client_secret))}")
        logger.info(f"  - scopes: {token_data.get('scopes', ['https://www.googleapis.com/auth/calendar'])}")
        logger.info(f"  - expiry: {token_data.get('expiry')}")
        
        # 사용자에 토큰 저장
        current_user.google_calendar_token = calendar_token
        current_user.google_calendar_enabled = "true"
        db.commit()

        logger.info(f"Google Calendar 연동 완료: {current_user.email}")

        # Watch 자동 등록 (Push Notifications)
        watch_result = None
        try:
            import uuid
            import os

            channel_id = str(uuid.uuid4())
            base_url = os.getenv('WEBHOOK_BASE_URL') or os.getenv('API_BASE_URL') or "https://alwaysplan-backend-509998441771.asia-northeast3.run.app"
            webhook_url = f"{base_url}/calendar/webhook"

            watch_result = await GoogleCalendarService.register_watch(
                token_json=calendar_token,
                webhook_url=webhook_url,
                channel_id=channel_id
            )

            if watch_result:
                current_user.google_calendar_watch_channel_id = watch_result['channel_id']
                current_user.google_calendar_watch_resource_id = watch_result['resource_id']
                current_user.google_calendar_watch_expiration = watch_result['expiration']
                db.commit()
                logger.info(f"[GOOGLE_CALLBACK] Watch 자동 등록 완료: {watch_result['channel_id']}")
            else:
                logger.warning("[GOOGLE_CALLBACK] Watch 등록 실패 (도메인 인증 필요할 수 있음)")
        except Exception as watch_error:
            logger.warning(f"[GOOGLE_CALLBACK] Watch 등록 중 오류 (무시): {watch_error}")

        return {
            "success": True,
            "message": "Google Calendar 연동이 완료되었습니다",
            "watch_enabled": watch_result is not None
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
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Google Calendar에서 이벤트 목록 가져오기 (삭제된 일정 제외)"""
    logger.info(f"[GET_GOOGLE_EVENTS] 요청 시작 - 사용자: {current_user.email}, token 존재: {bool(current_user.google_calendar_token)}")
    
    if not current_user.google_calendar_token:
        logger.warning(f"[GET_GOOGLE_EVENTS] 토큰 없음 - 사용자: {current_user.email}")
        raise HTTPException(
            status_code=400,
            detail="Google Calendar 연동이 필요합니다. 설정에서 연동해주세요."
        )
    
    # 삭제된 일정의 google_calendar_event_id 목록 가져오기 (필터링용)
    deleted_event_ids = set()
    try:
        deleted_todos = db.query(Todo).filter(
            Todo.user_id == current_user.id,
            Todo.deleted_at.isnot(None),  # 삭제된 일정만
            Todo.google_calendar_event_id.isnot(None)  # google_calendar_event_id가 있는 일정만
        ).all()
        deleted_event_ids = {todo.google_calendar_event_id for todo in deleted_todos if todo.google_calendar_event_id}
        logger.info(f"[GET_GOOGLE_EVENTS] 삭제된 일정의 Google Calendar 이벤트 ID: {len(deleted_event_ids)}개")
    except Exception as e:
        logger.warning(f"[GET_GOOGLE_EVENTS] 삭제된 일정 조회 실패 (계속 진행): {e}")
    
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
            end_date = None
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
                
                # 종료 날짜 파싱 (종일 이벤트의 경우)
                if 'date' in end:
                    end_date_str = end['date']
                    if 'T' in end_date_str:
                        end_date_obj = datetime.fromisoformat(end_date_str.replace('Z', '+00:00'))
                    else:
                        end_date_obj = datetime.strptime(end_date_str, '%Y-%m-%d')
                    # Google Calendar는 종료 날짜를 exclusive로 저장하므로 하루 빼야 함
                    end_date = (end_date_obj - timedelta(days=1)).date()
                    # 시작 날짜와 종료 날짜가 같거나 작으면 종료 날짜를 None으로 설정 (하루 일정)
                    if end_date <= start_date:
                        end_date = None
                    else:
                        logger.info(f"[GET_GOOGLE_EVENTS] 종일 이벤트 기간: {start_date} ~ {end_date} ({(end_date - start_date).days + 1}일)")
            elif 'dateTime' in start:
                # 시간 지정 이벤트
                # Google Calendar API는 timeZone 정보를 포함할 수 있음
                start_datetime_str = start['dateTime']
                start_timezone = start.get('timeZone', 'UTC')
                
                # ISO 형식 파싱 (Z 또는 타임존 정보 포함)
                if start_datetime_str.endswith('Z'):
                    start_datetime_obj = datetime.fromisoformat(start_datetime_str.replace('Z', '+00:00'))
                else:
                    start_datetime_obj = datetime.fromisoformat(start_datetime_str)
                
                # 타임존이 없으면 UTC로 간주
                if start_datetime_obj.tzinfo is None:
                    start_datetime_obj = start_datetime_obj.replace(tzinfo=timezone.utc)
                
                # Asia/Seoul 타임존으로 변환 (앱에서 사용하는 시간대)
                seoul_tz = timezone(timedelta(hours=9))  # UTC+9
                start_datetime_seoul = start_datetime_obj.astimezone(seoul_tz)
                
                start_date = start_datetime_seoul.date()
                start_time = start_datetime_seoul.strftime('%H:%M')
                
                logger.info(f"[GET_GOOGLE_EVENTS] 시간 파싱 - 원본: {start_datetime_str} ({start_timezone}), 변환 후: {start_datetime_seoul} (Asia/Seoul), 시간: {start_time}")
            
            # 종료 시간 파싱
            end_time = None
            if 'dateTime' in end:
                end_datetime_str = end['dateTime']
                end_timezone = end.get('timeZone', 'UTC')
                
                # ISO 형식 파싱
                if end_datetime_str.endswith('Z'):
                    end_datetime_obj = datetime.fromisoformat(end_datetime_str.replace('Z', '+00:00'))
                else:
                    end_datetime_obj = datetime.fromisoformat(end_datetime_str)
                
                # 타임존이 없으면 UTC로 간주
                if end_datetime_obj.tzinfo is None:
                    end_datetime_obj = end_datetime_obj.replace(tzinfo=timezone.utc)
                
                # Asia/Seoul 타임존으로 변환
                seoul_tz = timezone(timedelta(hours=9))  # UTC+9
                end_datetime_seoul = end_datetime_obj.astimezone(seoul_tz)
                
                end_date = end_datetime_seoul.date()
                end_time = end_datetime_seoul.strftime('%H:%M')
                
                # 시작 날짜와 종료 날짜가 같으면 종료 날짜를 None으로 설정 (하루 일정)
                if end_date <= start_date:
                    end_date = None
                else:
                    logger.info(f"[GET_GOOGLE_EVENTS] 시간 지정 이벤트 기간: {start_date} ~ {end_date} ({(end_date - start_date).days + 1}일)")
                
                logger.info(f"[GET_GOOGLE_EVENTS] 종료 시간 파싱 - 원본: {end_datetime_str} ({end_timezone}), 변환 후: {end_datetime_seoul} (Asia/Seoul), 날짜: {end_date}, 시간: {end_time}")
            
            # 알림 정보 파싱
            notification_reminders = []
            reminders = event.get('reminders', {})
            if reminders:
                if reminders.get('useDefault'):
                    # 기본 알림 사용 (30분 전)
                    notification_reminders = [{'value': 30, 'unit': 'minutes'}]
                else:
                    # 커스텀 알림
                    overrides = reminders.get('overrides', [])
                    for override in overrides:
                        minutes = override.get('minutes', 30)
                        # 분을 단위로 변환 (가장 적절한 단위 선택)
                        if minutes < 60:
                            notification_reminders.append({'value': minutes, 'unit': 'minutes'})
                        elif minutes < 24 * 60:
                            hours = minutes // 60
                            remaining_minutes = minutes % 60
                            if remaining_minutes == 0:
                                notification_reminders.append({'value': hours, 'unit': 'hours'})
                            else:
                                # 시간과 분으로 분리 불가능하므로 분으로 저장
                                notification_reminders.append({'value': minutes, 'unit': 'minutes'})
                        elif minutes < 7 * 24 * 60:
                            days = minutes // (24 * 60)
                            remaining_minutes = minutes % (24 * 60)
                            if remaining_minutes == 0:
                                notification_reminders.append({'value': days, 'unit': 'days'})
                            else:
                                # 일과 시간/분으로 분리 불가능하므로 분으로 저장
                                notification_reminders.append({'value': minutes, 'unit': 'minutes'})
                        else:
                            weeks = minutes // (7 * 24 * 60)
                            remaining_minutes = minutes % (7 * 24 * 60)
                            if remaining_minutes == 0:
                                notification_reminders.append({'value': weeks, 'unit': 'weeks'})
                            else:
                                # 주와 일/시간/분으로 분리 불가능하므로 분으로 저장
                                notification_reminders.append({'value': minutes, 'unit': 'minutes'})
            
            # 반복 정보 파싱
            repeat_type = 'none'
            repeat_pattern = None
            repeat_end_date = None
            recurrence = event.get('recurrence', [])
            if recurrence and len(recurrence) > 0:
                # 첫 번째 RRULE 파싱
                rrule = recurrence[0]  # 'RRULE:FREQ=DAILY;COUNT=10' 형식
                if rrule.startswith('RRULE:'):
                    rrule_str = rrule[6:]  # 'RRULE:' 제거
                    parts = rrule_str.split(';')
                    freq = None
                    until = None
                    count = None
                    byday = None
                    interval = None
                    
                    for part in parts:
                        if '=' in part:
                            key, value = part.split('=', 1)
                            if key == 'FREQ':
                                freq = value
                            elif key == 'UNTIL':
                                until = value
                            elif key == 'COUNT':
                                count = int(value)
                            elif key == 'BYDAY':
                                byday = value
                            elif key == 'INTERVAL':
                                interval = int(value)
                    
                    # 반복 타입 결정
                    if freq == 'DAILY':
                        repeat_type = 'daily'
                    elif freq == 'WEEKLY':
                        if byday:
                            if byday == 'MO,TU,WE,TH,FR':
                                repeat_type = 'weekdays'
                            elif byday == 'SA,SU':
                                repeat_type = 'weekends'
                            else:
                                repeat_type = 'custom'
                                repeat_pattern = {'freq': 'weekly', 'byday': byday}
                        else:
                            repeat_type = 'weekly'
                    elif freq == 'MONTHLY':
                        repeat_type = 'monthly'
                    elif freq == 'YEARLY':
                        repeat_type = 'yearly'
                    
                    # 종료일 파싱
                    if until:
                        # YYYYMMDD 형식
                        if len(until) == 8:
                            repeat_end_date = datetime.strptime(until, '%Y%m%d').date()
                        # TZID 또는 다른 형식 처리 가능
                    
                    # 커스텀 패턴 저장
                    if repeat_type == 'custom' or (interval and interval > 1):
                        repeat_pattern = {
                            'freq': freq.lower() if freq else 'daily',
                            'interval': interval or 1,
                            'byday': byday,
                            'count': count
                        }
            
            # extendedProperties에서 sourceId 추출 (중복 제거용)
            source_id = None
            extended_props = event.get('extendedProperties', {})
            private_props = extended_props.get('private', {})
            if private_props.get('alwaysPlanSourceId'):
                source_id = private_props.get('alwaysPlanSourceId')
            else:
                # description에서도 추출 시도 (fallback)
                description = event.get('description', '')
                if description and 'AlwaysPlanID:' in description:
                    import re
                    match = re.search(r'AlwaysPlanID:([^\s\n]+)', description)
                    if match:
                        source_id = match.group(1)
            
            # 삭제된 일정인지 확인 (삭제된 일정은 제외)
            event_id = event.get('id')
            if event_id in deleted_event_ids:
                logger.info(f"[GET_GOOGLE_EVENTS] 삭제된 일정 제외: event_id={event_id}")
                continue  # 삭제된 일정은 제외
            
            formatted_events.append({
                'id': event.get('id'),
                'title': event.get('summary', '제목 없음'),
                'description': event.get('description', ''),
                'location': event.get('location', ''),
                'date': start_date.isoformat() if start_date else None,
                'end_date': end_date.isoformat() if end_date else None,  # 종료 날짜 추가
                'start_time': start_time,
                'end_time': end_time,
                'all_day': all_day,
                'html_link': event.get('htmlLink'),
                'google_calendar_event_id': event.get('id'),
                'source_id': source_id,  # Always Plan의 Todo ID (중복 제거용)
                'source': 'google_calendar',
                'notification_reminders': notification_reminders,
                'repeat_type': repeat_type,
                'repeat_pattern': repeat_pattern,
                'repeat_end_date': repeat_end_date.isoformat() if repeat_end_date else None
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


# ============================================================
# Google Calendar Webhook (Push Notifications)
# ============================================================

@router.post("/webhook")
async def calendar_webhook(
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Google Calendar Push Notification 수신 엔드포인트

    Google이 캘린더 변경 시 이 엔드포인트로 POST 요청을 보냄.
    인증 없이 접근 가능해야 함 (Google 서버에서 호출).
    """
    try:
        # Google이 보내는 헤더 확인
        channel_id = request.headers.get('X-Goog-Channel-ID')
        resource_id = request.headers.get('X-Goog-Resource-ID')
        resource_state = request.headers.get('X-Goog-Resource-State')
        message_number = request.headers.get('X-Goog-Message-Number')

        logger.info(f"[WEBHOOK] 알림 수신:")
        logger.info(f"  - Channel ID: {channel_id}")
        logger.info(f"  - Resource ID: {resource_id}")
        logger.info(f"  - Resource State: {resource_state}")
        logger.info(f"  - Message Number: {message_number}")

        # sync 메시지는 watch 등록 확인용 (무시)
        if resource_state == 'sync':
            logger.info("[WEBHOOK] sync 메시지 - Watch 등록 확인됨")
            return {"status": "ok", "message": "sync received"}

        # channel_id로 사용자 찾기
        if not channel_id:
            logger.warning("[WEBHOOK] Channel ID가 없음")
            return {"status": "error", "message": "no channel id"}

        user = db.query(User).filter(
            User.google_calendar_watch_channel_id == channel_id,
            User.deleted_at.is_(None)
        ).first()

        if not user:
            logger.warning(f"[WEBHOOK] 사용자를 찾을 수 없음 - channel_id: {channel_id}")
            return {"status": "error", "message": "user not found"}

        logger.info(f"[WEBHOOK] 사용자 확인됨: {user.email}")

        # 변경 알림 처리 (exists, update, delete 등)
        if resource_state in ['exists', 'update']:
            logger.info(f"[WEBHOOK] 캘린더 변경 감지 - 동기화 시작 (user: {user.email})")

            # 비동기로 동기화 실행 (백그라운드)
            # 여기서는 간단히 플래그를 설정하고, 다음 요청에서 동기화
            # 또는 직접 동기화 실행
            try:
                # Google Calendar 가져오기가 활성화된 경우에만 동기화
                import_enabled = str(getattr(user, 'google_calendar_import_enabled', 'false')).lower() == 'true'

                if import_enabled and user.google_calendar_token:
                    # 동기화 실행 (간소화된 버전)
                    from app.models.models import Todo

                    time_min = datetime.utcnow() - timedelta(days=30)
                    time_max = datetime.utcnow() + timedelta(days=365)

                    events = await GoogleCalendarService.list_events(
                        token_json=user.google_calendar_token,
                        time_min=time_min,
                        time_max=time_max,
                        max_results=500
                    )

                    if events:
                        # 이미 저장된 이벤트 ID 목록
                        existing_event_ids = set(
                            db.query(Todo.google_calendar_event_id).filter(
                                Todo.user_id == user.id,
                                Todo.deleted_at.is_(None),
                                Todo.google_calendar_event_id.isnot(None)
                            ).all()
                        )
                        existing_event_ids = {str(id[0]) for id in existing_event_ids if id[0]}

                        new_count = 0
                        for event in events:
                            event_id = event.get('id')
                            if event_id and event_id not in existing_event_ids:
                                # 새 이벤트 처리 로직은 sync_all과 동일
                                # 여기서는 로그만 남김 (전체 동기화는 별도 처리)
                                new_count += 1

                        logger.info(f"[WEBHOOK] 동기화 완료 - 새 이벤트: {new_count}개")
                else:
                    logger.info(f"[WEBHOOK] 가져오기 비활성화 또는 토큰 없음 - 동기화 건너뜀")

            except Exception as sync_error:
                logger.error(f"[WEBHOOK] 동기화 중 오류: {sync_error}", exc_info=True)

        return {"status": "ok", "message": f"processed {resource_state}"}

    except Exception as e:
        logger.error(f"[WEBHOOK] 처리 중 오류: {e}", exc_info=True)
        # Google은 200 OK를 받아야 재시도하지 않음
        return {"status": "error", "message": str(e)}


@router.post("/watch/register")
async def register_calendar_watch(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    현재 사용자의 Google Calendar Watch 등록

    캘린더 변경 시 웹훅으로 알림을 받기 위해 Watch를 등록합니다.
    Watch는 최대 7일간 유효하며, 만료 전 갱신이 필요합니다.
    """
    import uuid
    import os

    try:
        logger.info(f"[WATCH_REGISTER] Watch 등록 시작 - user: {current_user.email}")

        if not current_user.google_calendar_token:
            raise HTTPException(
                status_code=400,
                detail="Google Calendar 연동이 필요합니다"
            )

        # 기존 watch가 있으면 중지
        if current_user.google_calendar_watch_channel_id and current_user.google_calendar_watch_resource_id:
            logger.info(f"[WATCH_REGISTER] 기존 Watch 중지 시도")
            await GoogleCalendarService.stop_watch(
                token_json=current_user.google_calendar_token,
                channel_id=current_user.google_calendar_watch_channel_id,
                resource_id=current_user.google_calendar_watch_resource_id
            )

        # 새 채널 ID 생성
        channel_id = str(uuid.uuid4())

        # 웹훅 URL 구성
        # Cloud Run URL 또는 환경변수에서 가져옴
        base_url = os.getenv('WEBHOOK_BASE_URL') or os.getenv('API_BASE_URL')
        if not base_url:
            # Cloud Run 기본 URL 패턴
            base_url = "https://alwaysplan-backend-509998441771.asia-northeast3.run.app"

        webhook_url = f"{base_url}/calendar/webhook"

        logger.info(f"[WATCH_REGISTER] Webhook URL: {webhook_url}")

        # Watch 등록
        result = await GoogleCalendarService.register_watch(
            token_json=current_user.google_calendar_token,
            webhook_url=webhook_url,
            channel_id=channel_id
        )

        if not result:
            raise HTTPException(
                status_code=500,
                detail="Watch 등록에 실패했습니다. 도메인 인증이 필요할 수 있습니다."
            )

        # DB 업데이트
        current_user.google_calendar_watch_channel_id = result['channel_id']
        current_user.google_calendar_watch_resource_id = result['resource_id']
        current_user.google_calendar_watch_expiration = result['expiration']
        db.commit()

        logger.info(f"[WATCH_REGISTER] Watch 등록 완료 - channel_id: {result['channel_id']}, expiration: {result['expiration']}")

        return {
            "success": True,
            "channel_id": result['channel_id'],
            "expiration": result['expiration'].isoformat(),
            "message": "Watch 등록 완료. 캘린더 변경 시 자동으로 동기화됩니다."
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[WATCH_REGISTER] 등록 실패: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Watch 등록 실패: {str(e)}"
        )


@router.post("/watch/stop")
async def stop_calendar_watch(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """현재 사용자의 Google Calendar Watch 중지"""
    try:
        logger.info(f"[WATCH_STOP] Watch 중지 시작 - user: {current_user.email}")

        if not current_user.google_calendar_watch_channel_id:
            return {
                "success": True,
                "message": "등록된 Watch가 없습니다"
            }

        # Watch 중지
        if current_user.google_calendar_token and current_user.google_calendar_watch_resource_id:
            await GoogleCalendarService.stop_watch(
                token_json=current_user.google_calendar_token,
                channel_id=current_user.google_calendar_watch_channel_id,
                resource_id=current_user.google_calendar_watch_resource_id
            )

        # DB 초기화
        current_user.google_calendar_watch_channel_id = None
        current_user.google_calendar_watch_resource_id = None
        current_user.google_calendar_watch_expiration = None
        db.commit()

        logger.info(f"[WATCH_STOP] Watch 중지 완료")

        return {
            "success": True,
            "message": "Watch가 중지되었습니다"
        }

    except Exception as e:
        logger.error(f"[WATCH_STOP] 중지 실패: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Watch 중지 실패: {str(e)}"
        )


@router.get("/watch/status")
async def get_watch_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """현재 사용자의 Watch 상태 확인"""
    try:
        has_watch = bool(current_user.google_calendar_watch_channel_id)
        is_expired = False

        if has_watch and current_user.google_calendar_watch_expiration:
            is_expired = datetime.utcnow() > current_user.google_calendar_watch_expiration

        return {
            "has_watch": has_watch,
            "is_expired": is_expired,
            "channel_id": current_user.google_calendar_watch_channel_id,
            "expiration": current_user.google_calendar_watch_expiration.isoformat() if current_user.google_calendar_watch_expiration else None,
            "needs_renewal": is_expired or (
                current_user.google_calendar_watch_expiration and
                datetime.utcnow() + timedelta(days=1) > current_user.google_calendar_watch_expiration
            )
        }

    except Exception as e:
        logger.error(f"[WATCH_STATUS] 상태 확인 실패: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Watch 상태 확인 실패: {str(e)}"
        )

