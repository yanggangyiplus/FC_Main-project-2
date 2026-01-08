"""
Todo endpoints for CRUD operations and automation
"""
import json
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, date

from app.database import get_db
from app.models.models import Todo, ChecklistItem
from app.models.user import User
from app.schemas import (
    TodoCreate, TodoUpdate, TodoResponse, TodoStatsResponse
)
from app.api.routes.auth import get_current_user

router = APIRouter(
    prefix="/todos",
    tags=["todos"],
    dependencies=[Depends(get_current_user)]
)


@router.get("/", response_model=List[TodoResponse])
async def get_todos(
    skip: int = 0,
    limit: int = 100,
    status_filter: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all todos for current user with optional filtering"""
    from sqlalchemy.orm import joinedload
    
    query = db.query(Todo).options(joinedload(Todo.checklist_items)).filter(
        Todo.user_id == current_user.id,
        Todo.deleted_at.is_(None)
    )
    
    if status_filter:
        query = query.filter(Todo.status == status_filter)
    
    todos = query.offset(skip).limit(limit).all()
    
    # 응답 형식 변환
    result = []
    for todo in todos:
        todo_dict = {
            "id": todo.id,
            "user_id": todo.user_id,
            "title": todo.title,
            "description": todo.description,
            "memo": todo.memo,
            "location": todo.location,
            "date": todo.date.isoformat() if todo.date else None,
            "start_time": todo.start_time.strftime("%H:%M") if todo.start_time else None,
            "end_time": todo.end_time.strftime("%H:%M") if todo.end_time else None,
            "all_day": todo.all_day,
            "category": todo.category,
            "status": todo.status,
            "priority": todo.priority,
            "repeat_type": todo.repeat_type,
            "repeat_end_date": todo.repeat_end_date.isoformat() if todo.repeat_end_date else None,
            "repeat_days": todo.repeat_days,
            "has_notification": todo.has_notification,
            "notification_times": json.loads(todo.notification_times) if todo.notification_times else [],
            "family_member_ids": json.loads(todo.family_member_ids) if todo.family_member_ids else [],
            "checklist_items": [item.text for item in todo.checklist_items],  # 문자열 리스트로 변환
            "created_at": todo.created_at,
            "updated_at": todo.updated_at,
            "google_calendar_event_id": todo.google_calendar_event_id,  # Google Calendar 이벤트 ID 추가
            "bulk_synced": todo.bulk_synced if hasattr(todo, 'bulk_synced') else False  # 일괄 동기화 플래그
        }
        result.append(todo_dict)
    
    return result


@router.get("/today", response_model=List[TodoResponse])
async def get_today_todos(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get todos for today"""
    today = date.today()
    return db.query(Todo).filter(
        Todo.user_id == current_user.id,
        Todo.date == today,
        Todo.deleted_at.is_(None)
    ).all()


@router.get("/stats", response_model=TodoStatsResponse)
async def get_todo_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get todo statistics"""
    total = db.query(func.count(Todo.id)).filter(
        Todo.user_id == current_user.id,
        Todo.deleted_at.is_(None)
    ).scalar()
    
    completed = db.query(func.count(Todo.id)).filter(
        Todo.user_id == current_user.id,
        Todo.status == "completed",
        Todo.deleted_at.is_(None)
    ).scalar()
    
    overdue = db.query(func.count(Todo.id)).filter(
        Todo.user_id == current_user.id,
        Todo.status == "pending",
        Todo.date < date.today(),
        Todo.deleted_at.is_(None)
    ).scalar()
    
    return {
        "total": total or 0,
        "completed": completed or 0,
        "pending": (total or 0) - (completed or 0),
        "overdue": overdue or 0,
        "completion_rate": (completed or 0) / (total or 1) * 100
    }


@router.get("/{todo_id}", response_model=TodoResponse)
async def get_todo(
    todo_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get specific todo with checklist items"""
    from sqlalchemy.orm import joinedload
    
    todo = db.query(Todo).options(joinedload(Todo.checklist_items)).filter(
        Todo.id == todo_id,
        Todo.user_id == current_user.id,
        Todo.deleted_at.is_(None)
    ).first()
    
    if not todo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="할 일을 찾을 수 없습니다"
        )
    
    # 응답 형식 변환
    response_data = {
        "id": todo.id,
        "user_id": todo.user_id,
        "title": todo.title,
        "description": todo.description,
        "memo": todo.memo,
        "location": todo.location,
        "date": todo.date.isoformat() if todo.date else None,
        "start_time": todo.start_time.strftime("%H:%M") if todo.start_time else None,
        "end_time": todo.end_time.strftime("%H:%M") if todo.end_time else None,
        "all_day": todo.all_day,
        "category": todo.category,
        "status": todo.status,
        "priority": todo.priority,
        "repeat_type": todo.repeat_type,
        "repeat_end_date": todo.repeat_end_date.isoformat() if todo.repeat_end_date else None,
        "repeat_days": todo.repeat_days,
        "has_notification": todo.has_notification,
        "notification_times": json.loads(todo.notification_times) if todo.notification_times else [],
        "family_member_ids": json.loads(todo.family_member_ids) if todo.family_member_ids else [],
        "checklist_items": [item.text for item in todo.checklist_items],  # 문자열 리스트로 변환
        "created_at": todo.created_at,  # datetime 객체 그대로 사용
        "updated_at": todo.updated_at,   # datetime 객체 그대로 사용
        "google_calendar_event_id": todo.google_calendar_event_id,  # Google Calendar 이벤트 ID 추가
        "bulk_synced": todo.bulk_synced if hasattr(todo, 'bulk_synced') else False  # 일괄 동기화 플래그
    }
    
    return TodoResponse(**response_data)


@router.post("/", response_model=TodoResponse, status_code=status.HTTP_201_CREATED)
async def create_todo(
    todo: TodoCreate,  # FastAPI가 자동으로 JSON 파싱 및 검증
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create new todo"""
    import json
    from datetime import time as time_obj
    
    # 스키마에서 이미 date 객체로 변환됨
    # 시간 문자열을 Time 객체로 변환
    start_time_obj = None
    if todo.start_time:
        try:
            hours, minutes = map(int, todo.start_time.split(':'))
            start_time_obj = time_obj(hours, minutes)
        except:
            pass
    
    end_time_obj = None
    if todo.end_time:
        try:
            hours, minutes = map(int, todo.end_time.split(':'))
            end_time_obj = time_obj(hours, minutes)
        except:
            pass
    
    # 스키마에서 이미 date 객체로 변환됨
    db_todo = Todo(
        user_id=current_user.id,
        title=todo.title,
        description=todo.description,
        memo=todo.memo,
        location=todo.location,
        date=todo.date,  # 스키마에서 이미 date 객체로 변환됨
        start_time=start_time_obj,
        end_time=end_time_obj,
        all_day=todo.all_day,
        category=todo.category,
        status=todo.status or "pending",
        priority=todo.priority or "medium",
        repeat_type=todo.repeat_type or "none",
        repeat_end_date=todo.repeat_end_date,  # 스키마에서 이미 date 객체로 변환됨
        repeat_days=todo.repeat_days,
        has_notification=todo.has_notification or False,
        notification_times=json.dumps(todo.notification_times) if todo.notification_times else None,
        family_member_ids=json.dumps(todo.family_member_ids) if todo.family_member_ids else None,
        tags=json.dumps([]),
        source="text"
    )
    
    db.add(db_todo)
    db.commit()
    db.refresh(db_todo)
    
    # 체크리스트 항목 추가
    if todo.checklist_items:
        from app.models.models import ChecklistItem
        for idx, item_text in enumerate(todo.checklist_items):
            if item_text.strip():
                checklist_item = ChecklistItem(
                    todo_id=db_todo.id,
                    text=item_text,
                    completed=False,
                    order_index=idx
                )
                db.add(checklist_item)
        db.commit()
    
    # Google Calendar 자동 동기화 (연동 활성화 및 내보내기 활성화 시)
    # 사용자 정보를 다시 로드하여 최신 토글 상태 확인
    db.refresh(current_user)
    export_enabled = getattr(current_user, 'google_calendar_export_enabled', 'false')
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"[CREATE_TODO] Google Calendar 동기화 체크 - enabled={current_user.google_calendar_enabled}, token_exists={bool(current_user.google_calendar_token)}, export_enabled={export_enabled}")
    logger.info(f"[CREATE_TODO] 사용자 정보 - user_id={current_user.id}, email={current_user.email}")
    
    if current_user.google_calendar_enabled == "true" and current_user.google_calendar_token and export_enabled == "true":
        try:
            logger.info(f"[CREATE_TODO] Google Calendar 동기화 시작 - todo_id={db_todo.id}, title={db_todo.title}")
            
            from app.services.calendar_service import GoogleCalendarService
            from datetime import timedelta
            
            # 날짜/시간 정보 구성
            start_datetime = None
            end_datetime = None
            
            if db_todo.date:
                if db_todo.all_day:
                    # 종일 이벤트
                    start_datetime = datetime.combine(db_todo.date, datetime.min.time())
                    end_datetime = start_datetime + timedelta(days=1)
                else:
                    # 시간 지정 이벤트
                    if db_todo.start_time:
                        start_datetime = datetime.combine(db_todo.date, db_todo.start_time)
                    else:
                        start_datetime = datetime.combine(db_todo.date, datetime.min.time())
                    
                    if db_todo.end_time:
                        end_datetime = datetime.combine(db_todo.date, db_todo.end_time)
                    else:
                        end_datetime = start_datetime + timedelta(hours=1)
            
            if start_datetime:
                logger.info(f"[CREATE_TODO] Google Calendar 이벤트 생성 시도 - start={start_datetime}, end={end_datetime}")
                # Google Calendar에 이벤트 생성
                event = await GoogleCalendarService.create_event(
                    token_json=current_user.google_calendar_token,
                    title=db_todo.title,
                    description=db_todo.memo or db_todo.description or "",
                    start_datetime=start_datetime,
                    end_datetime=end_datetime,
                    location=db_todo.location or "",
                    all_day=db_todo.all_day
                )
                
                if event and event.get('id'):
                    # Google Calendar 이벤트 ID 저장
                    db_todo.google_calendar_event_id = event.get('id')
                    # 토글을 켤 때 실시간으로 동기화하는 일정은 bulk_synced=False로 설정 (토글을 끄면 삭제되도록)
                    # "동기화 후 저장" 버튼을 누르면 bulk_synced=True로 변경됨
                    if db_todo.bulk_synced is None:
                        db_todo.bulk_synced = False
                    db.commit()
                    db.refresh(db_todo)
                    logger.info(f"[CREATE_TODO] Google Calendar 동기화 성공 - todo_id={db_todo.id}, event_id={event.get('id')}, bulk_synced={db_todo.bulk_synced}")
                else:
                    logger.warning(f"[CREATE_TODO] Google Calendar 이벤트 생성 실패 - event가 None이거나 ID가 없음")
            else:
                logger.warning(f"[CREATE_TODO] Google Calendar 동기화 건너뜀 - start_datetime이 None")
        except Exception as e:
            # Google Calendar 동기화 실패해도 Todo 생성은 성공으로 처리
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"[CREATE_TODO] Google Calendar 동기화 실패 (Todo는 생성됨): {e}", exc_info=True)
    
    # 체크리스트 항목을 포함하여 다시 로드
    from sqlalchemy.orm import joinedload
    db_todo_with_items = db.query(Todo).options(joinedload(Todo.checklist_items)).filter(Todo.id == db_todo.id).first()
    
    # 응답 형식 변환 (get_todos와 동일한 형식)
    # FastAPI가 자동으로 JSON으로 변환하므로 딕셔너리 반환 가능
    response_data = {
        "id": db_todo_with_items.id,
        "user_id": db_todo_with_items.user_id,
        "title": db_todo_with_items.title,
        "description": db_todo_with_items.description,
        "memo": db_todo_with_items.memo,
        "location": db_todo_with_items.location,
        "date": db_todo_with_items.date.isoformat() if db_todo_with_items.date else None,
        "start_time": db_todo_with_items.start_time.strftime("%H:%M") if db_todo_with_items.start_time else None,
        "end_time": db_todo_with_items.end_time.strftime("%H:%M") if db_todo_with_items.end_time else None,
        "all_day": db_todo_with_items.all_day,
        "category": db_todo_with_items.category,
        "status": db_todo_with_items.status,
        "priority": db_todo_with_items.priority,
        "repeat_type": db_todo_with_items.repeat_type,
        "repeat_end_date": db_todo_with_items.repeat_end_date.isoformat() if db_todo_with_items.repeat_end_date else None,
        "repeat_days": db_todo_with_items.repeat_days,
        "has_notification": db_todo_with_items.has_notification,
        "notification_times": json.loads(db_todo_with_items.notification_times) if db_todo_with_items.notification_times else [],
        "family_member_ids": json.loads(db_todo_with_items.family_member_ids) if db_todo_with_items.family_member_ids else [],
        "checklist_items": [item.text for item in db_todo_with_items.checklist_items],  # 문자열 리스트로 변환
        "created_at": db_todo_with_items.created_at,  # datetime 객체 그대로 사용
        "updated_at": db_todo_with_items.updated_at   # datetime 객체 그대로 사용
    }
    
    # Pydantic 모델로 변환하여 반환 (response_model과 일치)
    return TodoResponse(**response_data)


@router.patch("/{todo_id}", response_model=TodoResponse)
async def update_todo(
    todo_id: str,
    todo_update: TodoUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update todo"""
    import json
    from datetime import time as time_obj
    
    todo = db.query(Todo).filter(
        Todo.id == todo_id,
        Todo.user_id == current_user.id,
        Todo.deleted_at.is_(None)
    ).first()
    
    if not todo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="할 일을 찾을 수 없습니다"
        )
    
    # 업데이트할 필드 처리
    if todo_update.title is not None:
        todo.title = todo_update.title
    if todo_update.description is not None:
        todo.description = todo_update.description
    if todo_update.memo is not None:
        todo.memo = todo_update.memo
    if todo_update.location is not None:
        todo.location = todo_update.location
    if todo_update.date is not None and todo_update.date.strip():
        # 문자열 날짜를 date 객체로 변환
        try:
            todo.date = datetime.strptime(todo_update.date.strip(), '%Y-%m-%d').date()
        except (ValueError, AttributeError):
            # 날짜 형식이 잘못된 경우 무시
            pass
    if todo_update.start_time is not None:
        # 빈 문자열이거나 None이면 null로 설정
        if todo_update.start_time == "" or todo_update.start_time is None:
            todo.start_time = None
        else:
            try:
                hours, minutes = map(int, todo_update.start_time.split(':'))
                todo.start_time = time_obj(hours, minutes)
            except:
                todo.start_time = None
    if todo_update.end_time is not None:
        # 빈 문자열이거나 None이면 null로 설정
        if todo_update.end_time == "" or todo_update.end_time is None:
            todo.end_time = None
        else:
            try:
                hours, minutes = map(int, todo_update.end_time.split(':'))
                todo.end_time = time_obj(hours, minutes)
            except:
                todo.end_time = None
    if todo_update.all_day is not None:
        todo.all_day = todo_update.all_day
    if todo_update.category is not None:
        todo.category = todo_update.category
    if todo_update.status is not None:
        todo.status = todo_update.status
    if todo_update.priority is not None:
        todo.priority = todo_update.priority
    if todo_update.repeat_type is not None:
        todo.repeat_type = todo_update.repeat_type
    if todo_update.repeat_end_date is not None and todo_update.repeat_end_date.strip():
        # 문자열 날짜를 date 객체로 변환
        try:
            todo.repeat_end_date = datetime.strptime(todo_update.repeat_end_date.strip(), '%Y-%m-%d').date()
        except (ValueError, AttributeError):
            # 날짜 형식이 잘못된 경우 무시
            pass
    if todo_update.repeat_days is not None:
        todo.repeat_days = todo_update.repeat_days
    if todo_update.has_notification is not None:
        todo.has_notification = todo_update.has_notification
    if todo_update.notification_times is not None:
        todo.notification_times = json.dumps(todo_update.notification_times)
    if todo_update.family_member_ids is not None:
        todo.family_member_ids = json.dumps(todo_update.family_member_ids)
    
    # 체크리스트 항목 업데이트
    if todo_update.checklist_items is not None:
        # 기존 체크리스트 삭제
        db.query(ChecklistItem).filter(ChecklistItem.todo_id == todo_id).delete()
        # 새 체크리스트 추가
        for idx, item_text in enumerate(todo_update.checklist_items):
            if item_text.strip():
                checklist_item = ChecklistItem(
                    todo_id=todo.id,
                    text=item_text,
                    completed=False,
                    order_index=idx
                )
                db.add(checklist_item)
    
    todo.updated_at = datetime.utcnow()
    db.commit()
    
    # Google Calendar 자동 업데이트 (연동 활성화 및 내보내기 활성화 시)
    # 사용자 정보를 다시 로드하여 최신 토글 상태 확인
    db.refresh(current_user)
    export_enabled = getattr(current_user, 'google_calendar_export_enabled', 'false')
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"[UPDATE_TODO] Google Calendar 동기화 체크 - enabled={current_user.google_calendar_enabled}, token_exists={bool(current_user.google_calendar_token)}, export_enabled={export_enabled}")
    logger.info(f"[UPDATE_TODO] 사용자 정보 - user_id={current_user.id}, email={current_user.email}")
    
    if current_user.google_calendar_enabled == "true" and current_user.google_calendar_token and export_enabled == "true":
        try:
            from app.services.calendar_service import GoogleCalendarService
            from datetime import timedelta
            logger.info(f"[UPDATE_TODO] Google Calendar 동기화 시작 - todo_id={todo.id}, title={todo.title}")
            
            # 기존 Google Calendar 이벤트가 있는 경우 업데이트
            if todo.google_calendar_event_id:
                # 날짜/시간 정보 구성
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
                
                if start_datetime:
                    # Google Calendar 이벤트 업데이트
                    updated_event = await GoogleCalendarService.update_event(
                        token_json=current_user.google_calendar_token,
                        event_id=todo.google_calendar_event_id,
                        title=todo.title,
                        description=todo.memo or todo.description or "",
                        start_datetime=start_datetime,
                        end_datetime=end_datetime,
                        location=todo.location or "",
                        all_day=todo.all_day
                    )
                    
                    if not updated_event:
                        # 업데이트 실패 시 이벤트 ID 제거 (다음 동기화 시 재생성)
                        todo.google_calendar_event_id = None
                        db.commit()
            else:
                # Google Calendar 이벤트가 없는 경우 새로 생성
                start_datetime = None
                end_datetime = None
                
                if todo.date:
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
                    event = await GoogleCalendarService.create_event(
                        token_json=current_user.google_calendar_token,
                        title=todo.title,
                        description=todo.memo or todo.description or "",
                        start_datetime=start_datetime,
                        end_datetime=end_datetime,
                        location=todo.location or "",
                        all_day=todo.all_day
                    )
                    
                    if event and event.get('id'):
                        todo.google_calendar_event_id = event.get('id')
                        # 토글을 켤 때 실시간으로 동기화하는 일정은 bulk_synced=False로 설정 (토글을 끄면 삭제되도록)
                        # "동기화 후 저장" 버튼을 누르면 bulk_synced=True로 변경됨
                        # 단, 이미 bulk_synced=True인 일정은 유지 (동기화 후 저장된 일정)
                        if todo.bulk_synced is None:
                            todo.bulk_synced = False
                        db.commit()
                        logger.info(f"[UPDATE_TODO] Google Calendar 이벤트 생성 성공 - todo_id={todo.id}, event_id={event.get('id')}, bulk_synced={todo.bulk_synced}")
        except Exception as e:
            # Google Calendar 동기화 실패해도 Todo 수정은 성공으로 처리
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Google Calendar 동기화 실패 (Todo는 수정됨): {e}")
    
    # 체크리스트 항목 다시 로드
    from sqlalchemy.orm import joinedload
    updated_todo = db.query(Todo).options(joinedload(Todo.checklist_items)).filter(
        Todo.id == todo_id,
        Todo.deleted_at.is_(None)
    ).first()
    
    # 응답 형식 변환
    response_data = {
        "id": updated_todo.id,
        "user_id": updated_todo.user_id,
        "title": updated_todo.title,
        "description": updated_todo.description,
        "memo": updated_todo.memo,
        "location": updated_todo.location,
        "date": updated_todo.date.isoformat() if updated_todo.date else None,
        "start_time": updated_todo.start_time.strftime("%H:%M") if updated_todo.start_time else None,
        "end_time": updated_todo.end_time.strftime("%H:%M") if updated_todo.end_time else None,
        "all_day": updated_todo.all_day,
        "category": updated_todo.category,
        "status": updated_todo.status,
        "priority": updated_todo.priority,
        "repeat_type": updated_todo.repeat_type,
        "repeat_end_date": updated_todo.repeat_end_date.isoformat() if updated_todo.repeat_end_date else None,
        "repeat_days": updated_todo.repeat_days,
        "has_notification": updated_todo.has_notification,
        "notification_times": json.loads(updated_todo.notification_times) if updated_todo.notification_times else [],
        "family_member_ids": json.loads(updated_todo.family_member_ids) if updated_todo.family_member_ids else [],
        "checklist_items": [item.text for item in updated_todo.checklist_items],  # 문자열 리스트로 변환
        "created_at": updated_todo.created_at,  # datetime 객체 그대로 사용
        "updated_at": updated_todo.updated_at,   # datetime 객체 그대로 사용
        "google_calendar_event_id": updated_todo.google_calendar_event_id,  # Google Calendar 이벤트 ID 추가
        "bulk_synced": updated_todo.bulk_synced if hasattr(updated_todo, 'bulk_synced') else False  # 일괄 동기화 플래그
    }
    
    return TodoResponse(**response_data)


@router.delete("/{todo_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_todo(
    todo_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Soft delete todo"""
    todo = db.query(Todo).filter(
        Todo.id == todo_id,
        Todo.user_id == current_user.id,
        Todo.deleted_at.is_(None)
    ).first()
    
    if not todo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="할 일을 찾을 수 없습니다"
        )
    
    try:
        import logging
        logger = logging.getLogger(__name__)
        
        # 삭제 전 상태 로깅
        logger.info(f"[DELETE-TODO] 삭제 시작: todo_id={todo_id}, user_id={current_user.id}, 현재 deleted_at={todo.deleted_at}")
        
        # Google Calendar 자동 삭제 (연동 활성화 및 내보내기 활성화 시)
        # 사용자 정보를 다시 로드하여 최신 토글 상태 확인
        db.refresh(current_user)
        export_enabled = getattr(current_user, 'google_calendar_export_enabled', 'false')
        logger.info(f"[DELETE_TODO] Google Calendar 삭제 체크 - enabled={current_user.google_calendar_enabled}, token_exists={bool(current_user.google_calendar_token)}, export_enabled={export_enabled}, event_id={todo.google_calendar_event_id}")
        logger.info(f"[DELETE_TODO] 사용자 정보 - user_id={current_user.id}, email={current_user.email}")
        
        if current_user.google_calendar_enabled == "true" and current_user.google_calendar_token and export_enabled == "true" and todo.google_calendar_event_id:
            try:
                from app.services.calendar_service import GoogleCalendarService
                
                # Google Calendar에서 이벤트 삭제
                deleted = await GoogleCalendarService.delete_event(
                    token_json=current_user.google_calendar_token,
                    event_id=todo.google_calendar_event_id
                )
                
                if deleted:
                    logger.info(f"[DELETE-TODO] Google Calendar 이벤트 삭제 성공: {todo.google_calendar_event_id}")
                else:
                    logger.warning(f"[DELETE-TODO] Google Calendar 이벤트 삭제 실패: {todo.google_calendar_event_id}")
            except Exception as e:
                # Google Calendar 삭제 실패해도 Todo 삭제는 진행
                logger.warning(f"[DELETE-TODO] Google Calendar 삭제 중 오류 (Todo는 삭제됨): {e}")
        
        # deleted_at 설정
        deleted_at_value = datetime.utcnow()
        todo.deleted_at = deleted_at_value
        
        # 커밋
        db.commit()
        db.refresh(todo)
        
        # 삭제 확인: deleted_at이 제대로 설정되었는지 확인
        if todo.deleted_at is None:
            logger.error(f"[DELETE-TODO] 삭제 실패: deleted_at이 None입니다. todo_id={todo_id}")
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="일정 삭제에 실패했습니다"
            )
        
        # 삭제 후 확인 쿼리
        deleted_check = db.query(Todo).filter(
            Todo.id == todo_id,
            Todo.deleted_at.is_(None)
        ).first()
        
        if deleted_check is not None:
            logger.error(f"[DELETE-TODO] 삭제 확인 실패: 여전히 deleted_at이 None입니다. todo_id={todo_id}")
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="일정 삭제 확인에 실패했습니다"
            )
        
        logger.info(f"[DELETE-TODO] 삭제 성공: todo_id={todo_id}, deleted_at={todo.deleted_at}")
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"[DELETE-TODO] 일정 삭제 중 오류 발생: todo_id={todo_id}, user_id={current_user.id}, error={e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"일정 삭제에 실패했습니다: {str(e)}"
        )


@router.patch("/{todo_id}/status", response_model=TodoResponse)
async def update_todo_status(
    todo_id: str,
    status: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update todo status (pending, completed, overdue)"""
    if status not in ["pending", "completed", "overdue"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="유효하지 않은 상태입니다"
        )
    
    todo = db.query(Todo).filter(
        Todo.id == todo_id,
        Todo.user_id == current_user.id,
        Todo.deleted_at.is_(None)
    ).first()
    
    if not todo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="할 일을 찾을 수 없습니다"
        )
    
    todo.status = status
    todo.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(todo)
    
    # 응답 형식 변환
    from sqlalchemy.orm import joinedload
    updated_todo = db.query(Todo).options(joinedload(Todo.checklist_items)).filter(
        Todo.id == todo_id,
        Todo.deleted_at.is_(None)
    ).first()
    
    response_data = {
        "id": updated_todo.id,
        "user_id": updated_todo.user_id,
        "title": updated_todo.title,
        "description": updated_todo.description,
        "memo": updated_todo.memo,
        "location": updated_todo.location,
        "date": updated_todo.date.isoformat() if updated_todo.date else None,
        "start_time": updated_todo.start_time.strftime("%H:%M") if updated_todo.start_time else None,
        "end_time": updated_todo.end_time.strftime("%H:%M") if updated_todo.end_time else None,
        "all_day": updated_todo.all_day,
        "category": updated_todo.category,
        "status": updated_todo.status,
        "priority": updated_todo.priority,
        "repeat_type": updated_todo.repeat_type,
        "repeat_end_date": updated_todo.repeat_end_date.isoformat() if updated_todo.repeat_end_date else None,
        "repeat_days": updated_todo.repeat_days,
        "has_notification": updated_todo.has_notification,
        "notification_times": json.loads(updated_todo.notification_times) if updated_todo.notification_times else [],
        "family_member_ids": json.loads(updated_todo.family_member_ids) if updated_todo.family_member_ids else [],
        "checklist_items": [item.text for item in updated_todo.checklist_items],  # 문자열 리스트로 변환
        "created_at": updated_todo.created_at,  # datetime 객체 그대로 사용
        "updated_at": updated_todo.updated_at   # datetime 객체 그대로 사용
    }
    
    return TodoResponse(**response_data)


@router.post("/{todo_id}/checklist", status_code=status.HTTP_201_CREATED)
async def add_checklist_item(
    todo_id: str,
    title: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Add checklist item to todo"""
    todo = db.query(Todo).filter(
        Todo.id == todo_id,
        Todo.user_id == current_user.id,
        Todo.deleted_at.is_(None)
    ).first()
    
    if not todo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="할 일을 찾을 수 없습니다"
        )
    
    item = ChecklistItem(
        todo_id=todo_id,
        title=title,
        completed=False
    )
    
    db.add(item)
    db.commit()
    db.refresh(item)
    
    return {"id": item.id, "title": item.title, "completed": item.completed}
