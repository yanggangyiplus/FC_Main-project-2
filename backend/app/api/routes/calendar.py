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
from pydantic import BaseModel

from app.database import get_db
from app.models.user import User
from app.models.models import Todo
from app.services.calendar_service import GoogleCalendarService
from app.api.routes.auth import get_current_user, oauth_states
from app.config import settings
from googleapiclient.errors import HttpError
from google.auth.transport.requests import Request


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
            # 최근 1년 전부터 1년 후까지의 이벤트 가져오기
            time_min = datetime.utcnow() - timedelta(days=365)
            time_max = datetime.utcnow() + timedelta(days=365)
            existing_events = await GoogleCalendarService.list_events(
                token_json=current_user.google_calendar_token,
                time_min=time_min,
                time_max=time_max,
                max_results=1000
            )
            logger.info(f"[SYNC_ALL] Google Calendar에서 {len(existing_events)}개 이벤트 가져옴")
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
        export_enabled = getattr(current_user, 'google_calendar_export_enabled', 'false') == 'true'
        logger.info(f"[SYNC_ALL] Google Calendar 내보내기 토글 상태: {export_enabled}")
        
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
                            import json
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
        import_enabled = getattr(current_user, 'google_calendar_import_enabled', 'false') == 'true'
        logger.info(f"[SYNC_ALL] Google Calendar 가져오기 토글 상태: {import_enabled}")
        
        imported_count = 0
        imported_matched_count = 0
        imported_failed_count = 0
        
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
            
            for event in existing_events:
                try:
                    event_id = event.get('id')
                    if not event_id or event_id in existing_google_event_ids:
                        # 이미 저장된 이벤트는 건너뜀
                        continue
                    
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
                            notification_reminders = json.dumps(reminders_list)
                    
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
                        category="기타",
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
                    logger.info(f"[SYNC_ALL] Google Calendar 이벤트를 Todo로 저장: event_id={event_id}, todo_id={new_todo.id}, title={new_todo.title}, deleted_at={new_todo.deleted_at}, bulk_synced={new_todo.bulk_synced}")
                    
                except Exception as e:
                    logger.error(f"[SYNC_ALL] Google Calendar 이벤트 저장 실패 (event_id={event.get('id')}): {e}", exc_info=True)
                    imported_failed_count += 1
        
        logger.info(f"[SYNC_ALL] Google Calendar 이벤트 저장 완료: {imported_count}개 저장, {imported_failed_count}개 실패")
        
        logger.info(f"[SYNC_ALL] 동기화 완료: 매칭={matched_count}개, 새로 생성={synced_count}개, 실패={failed_count}개, 이미 동기화된 일정={bulk_synced_count}개, Google Calendar 이벤트 저장={imported_count}개")
        
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
            "message": message
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"일괄 동기화 실패: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"일괄 동기화 실패: {str(e)}"
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
                        import json
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
                import json
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
        # 토글을 끌 때: Google Calendar에서 가져온 일정들(source='google_calendar')을 삭제
        logger.info("[TOGGLE_IMPORT] 토글 꺼짐 - Google Calendar에서 가져온 일정 삭제 시작")
        
        # source='google_calendar'인 일정들만 조회 (bulk_synced와 관계없이 모두 삭제)
        todos_to_delete = db.query(Todo).filter(
            Todo.user_id == current_user.id,
            Todo.deleted_at.is_(None),
            Todo.source == 'google_calendar'  # Google Calendar에서 가져온 일정만
        ).all()
        
        logger.info(f"[TOGGLE_IMPORT] 삭제할 일정: {len(todos_to_delete)}개")
        
        for todo in todos_to_delete:
            try:
                # 소프트 삭제 (deleted_at 설정)
                todo.deleted_at = datetime.utcnow()
                deleted_count += 1
                logger.info(f"[TOGGLE_IMPORT] 일정 삭제: todo_id={todo.id}, title={todo.title}")
            except Exception as e:
                logger.error(f"[TOGGLE_IMPORT] 일정 삭제 실패: todo_id={todo.id}, error={e}")
        
        logger.info(f"[TOGGLE_IMPORT] 총 {deleted_count}개 일정 삭제 완료")
    
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
    if not current_user.google_calendar_token:
        raise HTTPException(
            status_code=400,
            detail="Google Calendar 토큰이 없습니다. 먼저 Google 로그인을 해주세요."
        )
    
    from app.models.models import Todo
    from app.services.calendar_service import GoogleCalendarService
    from datetime import timedelta
    
    current_export_enabled = getattr(current_user, 'google_calendar_export_enabled', 'false')
    new_state = "false" if current_export_enabled == "true" else "true"
    
    logger.info(f"[TOGGLE_EXPORT] 토글 변경 - user_id={current_user.id}, email={current_user.email}, 현재 상태={current_export_enabled}, 새 상태={new_state}")
    
    if new_state == "true":
        # 토글을 켤 때: 기존 일정들을 Google Calendar에 동기화 (sync/all과 동일한 로직)
        logger.info("[TOGGLE_EXPORT] 토글 켜짐 - 기존 일정 동기화 시작 (sync/all 로직 사용)")
        
        # 1단계: Google Calendar에서 현재 이벤트 목록 가져오기 (중복 체크용)
        existing_events = []
        try:
            time_min = datetime.utcnow() - timedelta(days=365)
            time_max = datetime.utcnow() + timedelta(days=365)
            existing_events = await GoogleCalendarService.list_events(
                token_json=current_user.google_calendar_token,
                time_min=time_min,
                time_max=time_max,
                max_results=1000
            )
            logger.info(f"[TOGGLE_EXPORT] Google Calendar에서 {len(existing_events)}개 이벤트 가져옴")
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
        
        # 2단계: Google Calendar에 동기화되지 않은 모든 일정 조회
        todos_to_sync = db.query(Todo).filter(
            Todo.user_id == current_user.id,
            Todo.deleted_at.is_(None),
            Todo.google_calendar_event_id.is_(None)  # 아직 동기화되지 않은 일정만
        ).all()
        
        logger.info(f"[TOGGLE_EXPORT] 동기화할 일정: {len(todos_to_sync)}개")
        
        synced_count = 0
        matched_count = 0
        
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
                    todo.google_calendar_event_id = existing_event_id
                    # 토글을 켤 때 동기화하는 일정은 bulk_synced=False로 설정 (토글을 끄면 삭제되도록)
                    # "동기화 후 저장" 버튼을 누르면 bulk_synced=True로 변경됨
                    if todo.bulk_synced is None:
                        todo.bulk_synced = False
                    db.commit()
                    matched_count += 1
                    logger.info(f"[TOGGLE_EXPORT] 기존 이벤트와 매칭: todo_id={todo.id}, event_id={existing_event_id}, bulk_synced={todo.bulk_synced}")
                    continue
                
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
                            import json
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
                            import json
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
        
        logger.info(f"[TOGGLE_EXPORT] 총 {synced_count}개 일정 동기화, {matched_count}개 일정 매칭 완료")
        deleted_count = 0  # 토글 켤 때는 삭제 없음
        
    else:
        # 토글을 끌 때: bulk_synced가 아닌 일정들의 Google Calendar 이벤트만 삭제
        logger.info("[TOGGLE_EXPORT] 토글 꺼짐 - Google Calendar 이벤트 삭제 시작 (일괄 동기화 제외)")
        
        # bulk_synced가 False인 일정들만 조회
        todos_to_unsync = db.query(Todo).filter(
            Todo.user_id == current_user.id,
            Todo.deleted_at.is_(None),
            Todo.google_calendar_event_id.isnot(None),
            Todo.bulk_synced == False  # 일괄 동기화가 아닌 일정만
        ).all()
        
        logger.info(f"[TOGGLE_EXPORT] 삭제할 일정: {len(todos_to_unsync)}개")
        
        deleted_count = 0
        for todo in todos_to_unsync:
            try:
                # Google Calendar에서 이벤트 삭제
                deleted = await GoogleCalendarService.delete_event(
                    token_json=current_user.google_calendar_token,
                    event_id=todo.google_calendar_event_id
                )
                
                if deleted:
                    todo.google_calendar_event_id = None
                    db.commit()  # 변경사항 저장
                    deleted_count += 1
                    logger.info(f"[TOGGLE_EXPORT] 이벤트 삭제 성공: todo_id={todo.id}")
            except Exception as e:
                logger.error(f"[TOGGLE_EXPORT] 이벤트 삭제 실패: todo_id={todo.id}, error={e}")
        
        logger.info(f"[TOGGLE_EXPORT] 총 {deleted_count}개 이벤트 삭제 완료")
    
    # 토글 상태 저장 (반드시 저장되어야 함)
    try:
        current_user.google_calendar_export_enabled = new_state
        db.commit()
        db.refresh(current_user)
        
        # 저장 확인
        saved_value = getattr(current_user, 'google_calendar_export_enabled', 'false')
        logger.info(f"[TOGGLE_EXPORT] 토글 상태 저장 - user_id={current_user.id}, 저장된 값={saved_value}, 예상 값={new_state}")
        
        if saved_value != new_state:
            logger.error(f"[TOGGLE_EXPORT] 저장 실패! 예상={new_state}, 실제={saved_value}")
            # 재시도
            current_user.google_calendar_export_enabled = new_state
            db.commit()
            db.refresh(current_user)
            saved_value = getattr(current_user, 'google_calendar_export_enabled', 'false')
            logger.info(f"[TOGGLE_EXPORT] 재시도 후 저장된 값={saved_value}")
    except Exception as e:
        logger.error(f"[TOGGLE_EXPORT] 토글 상태 저장 중 오류: {e}", exc_info=True)
        # 오류가 발생해도 상태는 저장 시도
        try:
            db.rollback()
            current_user.google_calendar_export_enabled = new_state
            db.commit()
        except:
            pass
    
    message = f"Google Calendar 내보내기가 {'활성화' if new_state == 'true' else '비활성화'}되었습니다"
    if new_state == "true":
        if synced_count > 0 and matched_count > 0:
            message += f" ({synced_count}개 일정 동기화, {matched_count}개 일정 매칭됨)"
        elif synced_count > 0:
            message += f" ({synced_count}개 일정 동기화됨)"
        elif matched_count > 0:
            message += f" ({matched_count}개 일정 매칭됨)"
    elif new_state == "false" and deleted_count > 0:
        message += f" ({deleted_count}개 이벤트 삭제됨, 동기화 후 저장한 일정은 유지됨)"
    
    return {
        "success": True,
        "export_enabled": new_state == "true",
        "message": message,
        "synced_count": synced_count if new_state == "true" else 0,
        "matched_count": matched_count if new_state == "true" else 0,
        "deleted_count": deleted_count if new_state == "false" else 0
    }


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


@router.post("/google-callback")
async def google_calendar_callback(
    request: GoogleCallbackRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    
    """Google Calendar OAuth 콜백 처리"""
    from app.api.routes.auth import oauth_states
    from app.services.auth_service import GoogleOAuthService
    import json
    
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

