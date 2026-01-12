"""
Todo endpoints for CRUD operations and automation
"""
import json
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
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
from app.api.routes.notifications import send_scheduled_emails

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
            "end_date": todo.end_date.isoformat() if todo.end_date else None,
            "start_time": todo.start_time.strftime("%H:%M") if todo.start_time else None,
            "end_time": todo.end_time.strftime("%H:%M") if todo.end_time else None,
            "all_day": todo.all_day,
            "category": todo.category,
            "status": todo.status,
            "priority": todo.priority,
            "repeat_type": todo.repeat_type,
            "repeat_end_date": todo.repeat_end_date.isoformat() if todo.repeat_end_date else None,
            "repeat_days": todo.repeat_days,
            "repeat_pattern": json.loads(todo.repeat_pattern) if todo.repeat_pattern else None,
            "has_notification": todo.has_notification,
            "notification_times": json.loads(todo.notification_times) if todo.notification_times else [],
            "notification_reminders": json.loads(todo.notification_reminders) if todo.notification_reminders else [],
            "family_member_ids": json.loads(todo.family_member_ids) if todo.family_member_ids else [],
            "checklist_items": [item.text for item in todo.checklist_items],  # 문자열 리스트로 변환
            "created_at": todo.created_at,
            "updated_at": todo.updated_at,
            "google_calendar_event_id": todo.google_calendar_event_id,  # Google Calendar 이벤트 ID 추가
            "bulk_synced": todo.bulk_synced if hasattr(todo, 'bulk_synced') else False,  # 일괄 동기화 플래그
            "todo_group_id": todo.todo_group_id if hasattr(todo, 'todo_group_id') else None  # 일정 그룹 ID
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
        "end_date": todo.end_date.isoformat() if todo.end_date else None,
        "start_time": todo.start_time.strftime("%H:%M") if todo.start_time else None,
        "end_time": todo.end_time.strftime("%H:%M") if todo.end_time else None,
        "all_day": todo.all_day,
        "category": todo.category,
        "status": todo.status,
        "priority": todo.priority,
        "repeat_type": todo.repeat_type,
        "repeat_end_date": todo.repeat_end_date.isoformat() if todo.repeat_end_date else None,
        "repeat_days": todo.repeat_days,
        "repeat_pattern": json.loads(todo.repeat_pattern) if todo.repeat_pattern else None,
        "has_notification": todo.has_notification,
        "notification_times": json.loads(todo.notification_times) if todo.notification_times else [],
        "notification_reminders": json.loads(todo.notification_reminders) if todo.notification_reminders else [],
        "family_member_ids": json.loads(todo.family_member_ids) if todo.family_member_ids else [],
        "checklist_items": [item.text for item in todo.checklist_items],  # 문자열 리스트로 변환
        "created_at": todo.created_at,  # datetime 객체 그대로 사용
        "updated_at": todo.updated_at,   # datetime 객체 그대로 사용
        "google_calendar_event_id": todo.google_calendar_event_id,  # Google Calendar 이벤트 ID 추가
        "bulk_synced": todo.bulk_synced if hasattr(todo, 'bulk_synced') else False,  # 일괄 동기화 플래그
        "todo_group_id": todo.todo_group_id if hasattr(todo, 'todo_group_id') else None  # 일정 그룹 ID
    }
    
    return TodoResponse(**response_data)


@router.post("/", response_model=TodoResponse, status_code=status.HTTP_201_CREATED)
async def create_todo(
    todo: TodoCreate,  # FastAPI가 자동으로 JSON 파싱 및 검증
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create new todo"""
    import json
    import logging
    from datetime import time as time_obj
    logger = logging.getLogger(__name__)
    
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
        date=todo.date,  # 시작 날짜 (스키마에서 이미 date 객체로 변환됨)
        end_date=todo.end_date,  # 종료 날짜 (기간 일정인 경우)
        start_time=start_time_obj,
        end_time=end_time_obj,
        all_day=todo.all_day,
        category=todo.category,
        status=todo.status or "pending",
        priority=todo.priority or "medium",
        repeat_type=todo.repeat_type or "none",
        repeat_end_date=todo.repeat_end_date,  # 반복 종료 날짜 (스키마에서 이미 date 객체로 변환됨)
        repeat_days=todo.repeat_days,
        repeat_pattern=json.dumps(todo.repeat_pattern) if todo.repeat_pattern else None,
        has_notification=todo.has_notification or False,
        notification_times=json.dumps(todo.notification_times) if todo.notification_times else None,
        notification_reminders=json.dumps(todo.notification_reminders) if todo.notification_reminders else None,
        family_member_ids=json.dumps(todo.family_member_ids) if todo.family_member_ids else None,
        tags=json.dumps([]),
        source="text",
        todo_group_id=todo.todo_group_id  # 일정 그룹 ID (여러 날짜에 걸친 일정 묶기)
    )
    
    # 반복 일정인 경우 그룹 ID 생성 (없으면 생성)
    import uuid
    if todo.repeat_type and todo.repeat_type != "none" and not todo.todo_group_id:
        todo.todo_group_id = f"repeat_{uuid.uuid4().hex[:12]}"
        logger.info(f"[CREATE_TODO] 반복 그룹 ID 생성: {todo.todo_group_id}")
    
    db_todo.todo_group_id = todo.todo_group_id  # 그룹 ID 설정
    db.add(db_todo)
    db.commit()
    db.refresh(db_todo)
    
    # end_date 저장 확인
    logger.info(f"[CREATE_TODO] Todo 저장 완료 - id: {db_todo.id}, date: {db_todo.date}, end_date: {db_todo.end_date}, all_day: {db_todo.all_day}")
    logger.info(f"[CREATE_TODO] 첫 번째 일정 생성 완료: ID={db_todo.id}, repeat_type={db_todo.repeat_type}, todo_group_id={db_todo.todo_group_id}")
    
    # 알림은 스케줄러에서 주기적으로 확인하여 발송하므로 여기서는 호출하지 않음
    
    # 체크리스트 항목 추가
    if todo.checklist_items:
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
    
    # 반복 일정 생성 (반복 타입이 있는 경우)
    # repeat_end_date가 없으면 기본값으로 1년 후까지 반복
    repeated_todos = []
    
    logger.info(f"[CREATE_TODO] 반복 타입 확인: todo.repeat_type={todo.repeat_type}, db_todo.repeat_type={db_todo.repeat_type}, repeat_end_date: {todo.repeat_end_date}")
    
    # db_todo의 repeat_type을 확인 (실제 DB에 저장된 값)
    actual_repeat_type = db_todo.repeat_type or "none"
    
    if actual_repeat_type and actual_repeat_type != "none":
        logger.info(f"[CREATE_TODO] 반복 일정 생성 시작: 타입={actual_repeat_type}, 시작 날짜={db_todo.date}")
        
        repeat_end_date = db_todo.repeat_end_date
        if not repeat_end_date:
            # 기본값: 시작 날짜로부터 1년 후
            from datetime import timedelta
            repeat_end_date = db_todo.date + timedelta(days=365)
            logger.info(f"[CREATE_TODO] 반복 종료 날짜 기본값 설정: {repeat_end_date}")
        else:
            logger.info(f"[CREATE_TODO] 반복 종료 날짜: {repeat_end_date}")
        
        from datetime import timedelta
        
        # 반복 그룹 ID (첫 번째 일정과 동일한 그룹 ID 사용)
        repeat_group_id = db_todo.todo_group_id
        if not repeat_group_id:
            import uuid
            repeat_group_id = f"repeat_{uuid.uuid4().hex[:12]}"
            db_todo.todo_group_id = repeat_group_id
            db.commit()
            db.refresh(db_todo)
        logger.info(f"[CREATE_TODO] 반복 그룹 ID: {repeat_group_id}")
        
        # 시작 날짜와 종료 날짜
        start_date = db_todo.date
        end_date = repeat_end_date
        
        logger.info(f"[CREATE_TODO] 반복 일정 날짜 계산 시작: 시작={start_date}, 종료={end_date}, 타입={actual_repeat_type}")
        
        # 반복 주기에 따라 날짜 계산
        current_date = start_date + timedelta(days=1)  # 다음 날짜부터 시작
        
        if actual_repeat_type == "daily":
            # 매일: 다음 날부터 반복 종료일까지 매일 생성
            while current_date <= end_date:
                repeated_todos.append(current_date)
                current_date += timedelta(days=1)
        elif actual_repeat_type == "weekly":
            # 매주: 같은 요일마다 생성
            start_weekday = start_date.weekday()
            while current_date <= end_date:
                if current_date.weekday() == start_weekday:
                    repeated_todos.append(current_date)
                current_date += timedelta(days=1)
        elif actual_repeat_type == "monthly":
            # 매월: 같은 날짜마다 생성
            from calendar import monthrange
            start_day = start_date.day
            # 첫 번째 반복 날짜: 다음 달 같은 날짜
            if start_date.month == 12:
                next_month_date = date(start_date.year + 1, 1, start_day)
            else:
                try:
                    next_month_date = date(start_date.year, start_date.month + 1, start_day)
                except ValueError:
                    # 날짜가 유효하지 않은 경우 (예: 31일이 없는 달), 마지막 날로 설정
                    if start_date.month == 12:
                        next_month = date(start_date.year + 1, 1, 1)
                    else:
                        next_month = date(start_date.year, start_date.month + 1, 1)
                    last_day = monthrange(next_month.year, next_month.month)[1]
                    next_month_date = date(next_month.year, next_month.month, min(start_day, last_day))
            
            current_date = next_month_date
            while current_date <= end_date:
                repeated_todos.append(current_date)
                # 다음 달로 이동
                if current_date.month == 12:
                    next_year = current_date.year + 1
                    next_month = 1
                else:
                    next_year = current_date.year
                    next_month = current_date.month + 1
                
                try:
                    current_date = date(next_year, next_month, start_day)
                except ValueError:
                    # 날짜가 유효하지 않은 경우, 마지막 날로 설정
                    next_month_start = date(next_year, next_month, 1)
                    last_day = monthrange(next_month_start.year, next_month_start.month)[1]
                    current_date = date(next_year, next_month, min(start_day, last_day))
        elif actual_repeat_type == "yearly":
            # 매년: 같은 월일마다 생성
            start_month = start_date.month
            start_day = start_date.day
            # 첫 번째 반복 날짜: 다음 년도 같은 날짜
            next_year_date = date(start_date.year + 1, start_month, start_day)
            current_date = next_year_date
            while current_date <= end_date:
                repeated_todos.append(current_date)
                # 다음 년도로 이동
                current_date = date(current_date.year + 1, start_month, start_day)
        elif actual_repeat_type == "weekdays":
            # 매주 주중 (월~금)
            while current_date <= end_date:
                weekday = current_date.weekday()
                if weekday < 5:  # 0(월)~4(금)
                    repeated_todos.append(current_date)
                current_date += timedelta(days=1)
        elif actual_repeat_type == "weekends":
            # 매주 주말 (토~일)
            while current_date <= end_date:
                weekday = current_date.weekday()
                if weekday >= 5:  # 5(토)~6(일)
                    repeated_todos.append(current_date)
                current_date += timedelta(days=1)
        elif actual_repeat_type == "custom" and db_todo.repeat_pattern:
            # 맞춤 반복 패턴 처리
            try:
                pattern = db_todo.repeat_pattern
                if isinstance(pattern, str):
                    pattern = json.loads(pattern)
                
                freq = pattern.get('freq', 'days')  # days, weeks, months, years
                interval = pattern.get('interval', 1)  # 반복 주기
                custom_days = pattern.get('days', [])  # 반복 요일 (주 단위인 경우)
                end_type = pattern.get('endType', 'never')  # never, date, count
                
                # 종료 날짜 계산
                if end_type == 'date':
                    end_date_str = pattern.get('endDate')
                    if end_date_str:
                        if isinstance(end_date_str, str):
                            end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
                        else:
                            end_date = end_date_str
                    else:
                        # 기본값: 시작 날짜로부터 1년 후
                        end_date = start_date + timedelta(days=365)
                elif end_type == 'count':
                    count = pattern.get('count', 10)
                    # 시작 날짜부터 count번 반복
                    if freq == 'days':
                        end_date = start_date + timedelta(days=interval * (count - 1))
                    elif freq == 'weeks':
                        end_date = start_date + timedelta(weeks=interval * (count - 1))
                    elif freq == 'months':
                        # 매 N개월마다 count번 반복
                        end_date = start_date
                        from calendar import monthrange
                        start_day = start_date.day
                        for i in range(count - 1):
                            months_to_add = interval
                            if end_date.month + months_to_add > 12:
                                next_year = end_date.year + 1
                                next_month = (end_date.month + months_to_add) % 12
                                if next_month == 0:
                                    next_month = 12
                                    next_year -= 1
                            else:
                                next_year = end_date.year
                                next_month = end_date.month + months_to_add
                            
                            try:
                                end_date = date(next_year, next_month, start_day)
                            except ValueError:
                                last_day = monthrange(next_year, next_month)[1]
                                end_date = date(next_year, next_month, min(start_day, last_day))
                    elif freq == 'years':
                        # 매 N년마다 count번 반복
                        end_date = date(start_date.year + interval * (count - 1), start_date.month, start_date.day)
                    else:
                        end_date = start_date + timedelta(days=interval * (count - 1))
                else:
                    # end_type == 'never'인 경우 기본값 사용 (1년 후)
                    end_date = start_date + timedelta(days=365)
                
                # 반복 일정 생성
                if freq == 'days':
                    # 매 N일마다
                    current_date = start_date + timedelta(days=interval)
                    while current_date <= end_date:
                        repeated_todos.append(current_date)
                        current_date += timedelta(days=interval)
                elif freq == 'weeks':
                    # 매 N주마다
                    if custom_days:
                        # 특정 요일만
                        # N주 주기로 반복
                        current_date = start_date
                        week_count = 0
                        while current_date <= end_date:
                            weekday = current_date.weekday()
                            # 현재 주가 interval 주기의 배수인 경우에만 해당 요일 추가
                            weeks_from_start = (current_date - start_date).days // 7
                            if weeks_from_start % interval == 0 and weekday in custom_days:
                                if current_date > start_date:  # 시작일은 제외
                                    repeated_todos.append(current_date)
                            current_date += timedelta(days=1)
                    else:
                        # 같은 요일마다 N주마다
                        start_weekday = start_date.weekday()
                        current_date = start_date + timedelta(weeks=interval)
                        while current_date <= end_date:
                            if current_date.weekday() == start_weekday:
                                repeated_todos.append(current_date)
                                current_date += timedelta(weeks=interval)
                            else:
                                current_date += timedelta(days=1)
                elif freq == 'months':
                    # 매 N개월마다
                    current_date = start_date
                    from calendar import monthrange
                    start_day = start_date.day
                    # 첫 번째 반복 날짜: N개월 후
                    months_to_add = interval
                    if current_date.month + months_to_add > 12:
                        next_year = current_date.year + 1
                        next_month = (current_date.month + months_to_add) % 12
                        if next_month == 0:
                            next_month = 12
                            next_year -= 1
                    else:
                        next_year = current_date.year
                        next_month = current_date.month + months_to_add
                    
                    try:
                        current_date = date(next_year, next_month, start_day)
                    except ValueError:
                        last_day = monthrange(next_year, next_month)[1]
                        current_date = date(next_year, next_month, min(start_day, last_day))
                    
                    while current_date <= end_date:
                        repeated_todos.append(current_date)
                        # 다음 N개월로 이동
                        months_to_add = interval
                        if current_date.month + months_to_add > 12:
                            next_year = current_date.year + 1
                            next_month = (current_date.month + months_to_add) % 12
                            if next_month == 0:
                                next_month = 12
                                next_year -= 1
                        else:
                            next_year = current_date.year
                            next_month = current_date.month + months_to_add
                        
                        try:
                            current_date = date(next_year, next_month, start_day)
                        except ValueError:
                            last_day = monthrange(next_year, next_month)[1]
                            current_date = date(next_year, next_month, min(start_day, last_day))
                elif freq == 'years':
                    # 매 N년마다
                    current_date = date(start_date.year + interval, start_date.month, start_date.day)
                    while current_date <= end_date:
                        repeated_todos.append(current_date)
                        current_date = date(current_date.year + interval, start_date.month, start_date.day)
            except Exception as e:
                logger.error(f"[CREATE_TODO] 맞춤 반복 패턴 처리 실패: {e}", exc_info=True)
        
        logger.info(f"[CREATE_TODO] 반복 일정 생성 예정: {len(repeated_todos)}개 (타입: {actual_repeat_type}, 그룹 ID: {repeat_group_id}, 시작 날짜: {start_date}, 종료 날짜: {end_date})")
        
        if len(repeated_todos) == 0:
            logger.warning(f"[CREATE_TODO] 반복 일정 생성 실패: 반복 날짜 목록이 비어있음 (타입: {actual_repeat_type}, 시작 날짜: {start_date}, 종료 날짜: {end_date})")
        
        # 반복 일정 생성
        created_count = 0
        repeated_todo_objects = []  # 체크리스트 항목 추가를 위해 저장
        
        # 원본 일정의 기간 계산 (여러 날짜에 걸친 일정인 경우)
        original_duration_days = 0
        if db_todo.end_date and db_todo.date:
            original_duration_days = (db_todo.end_date - db_todo.date).days
            logger.info(f"[CREATE_TODO] 원본 일정 기간: {db_todo.date} ~ {db_todo.end_date} ({original_duration_days}일)")
        
        for repeat_date in repeated_todos:
            # 반복 일정의 종료 날짜 계산 (원본 일정과 동일한 기간 유지)
            repeated_end_date = None
            if original_duration_days > 0:
                repeated_end_date = repeat_date + timedelta(days=original_duration_days)
                logger.info(f"[CREATE_TODO] 반복 일정 기간: {repeat_date} ~ {repeated_end_date} ({original_duration_days}일)")
            
            repeated_todo = Todo(
                user_id=current_user.id,
                title=db_todo.title,
                description=db_todo.description,
                memo=db_todo.memo,
                location=db_todo.location,
                date=repeat_date,  # 반복 시작 날짜
                end_date=repeated_end_date,  # 원본 일정과 동일한 기간 유지
                start_time=db_todo.start_time,
                end_time=db_todo.end_time,
                all_day=db_todo.all_day,
                category=db_todo.category,
                status=db_todo.status,
                priority=db_todo.priority,
                repeat_type=db_todo.repeat_type,
                repeat_end_date=db_todo.repeat_end_date,
                repeat_days=db_todo.repeat_days,
                repeat_pattern=db_todo.repeat_pattern,
                has_notification=db_todo.has_notification,
                notification_times=db_todo.notification_times,
                notification_reminders=db_todo.notification_reminders,
                family_member_ids=db_todo.family_member_ids,
                tags=db_todo.tags,
                source=db_todo.source,
                todo_group_id=repeat_group_id  # 같은 그룹 ID로 묶기
            )
            db.add(repeated_todo)
            repeated_todo_objects.append((repeated_todo, repeat_date))
            created_count += 1
        
        # 반복 일정을 먼저 커밋하여 ID 생성
        if repeated_todos:
            db.flush()  # ID를 생성하기 위해 flush
            logger.info(f"[CREATE_TODO] 반복 일정 flush 완료: {created_count}개")
            
            # 이제 각 반복 일정에 체크리스트 항목 추가
            for repeated_todo, repeat_date in repeated_todo_objects:
                if todo.checklist_items:
                    for idx, item_text in enumerate(todo.checklist_items):
                        if item_text.strip():
                            checklist_item = ChecklistItem(
                                todo_id=repeated_todo.id,  # 이제 ID가 생성됨
                                text=item_text,
                                completed=False,
                                order_index=idx
                            )
                            db.add(checklist_item)
                logger.info(f"[CREATE_TODO] 반복 일정 생성: 날짜={repeat_date}, ID={repeated_todo.id}")
            
            # 체크리스트 항목과 함께 최종 커밋
            db.commit()
            logger.info(f"[CREATE_TODO] 반복 일정 생성 완료: {created_count}개 (총 {len(repeated_todos)}개 중)")
        else:
            logger.warning(f"[CREATE_TODO] 반복 일정 생성 실패: 반복 날짜 목록이 비어있음")
    
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
                    # end_date가 있으면 그 날짜까지, 없으면 하루만
                    logger.info(f"[CREATE_TODO] 종일 이벤트 - date: {db_todo.date}, end_date: {db_todo.end_date}")
                    if db_todo.end_date:
                        # end_date는 inclusive이므로, Google Calendar의 exclusive 형식으로 변환하려면 +1일
                        end_datetime = datetime.combine(db_todo.end_date, datetime.min.time()) + timedelta(days=1)
                        logger.info(f"[CREATE_TODO] 종일 이벤트 기간: {db_todo.date} ~ {db_todo.end_date} ({(db_todo.end_date - db_todo.date).days + 1}일), end_datetime: {end_datetime}")
                    else:
                        end_datetime = start_datetime + timedelta(days=1)
                        logger.info(f"[CREATE_TODO] 종일 이벤트 (하루): {db_todo.date}, end_datetime: {end_datetime}")
                else:
                    # 시간 지정 이벤트
                    if db_todo.start_time:
                        start_datetime = datetime.combine(db_todo.date, db_todo.start_time)
                    else:
                        start_datetime = datetime.combine(db_todo.date, datetime.min.time())
                    
                    # end_date가 있으면 그 날짜의 end_time 사용, 없으면 같은 날의 end_time 사용
                    if db_todo.end_date:
                        # 여러 날짜에 걸친 일정
                        if db_todo.end_time:
                            end_datetime = datetime.combine(db_todo.end_date, db_todo.end_time)
                        else:
                            # end_time이 없으면 end_date의 23:59:59로 설정
                            end_datetime = datetime.combine(db_todo.end_date, datetime.max.time())
                        logger.info(f"[CREATE_TODO] 시간 지정 이벤트 기간: {db_todo.date} {db_todo.start_time} ~ {db_todo.end_date} {db_todo.end_time or '23:59'} ({(db_todo.end_date - db_todo.date).days + 1}일)")
                    else:
                        # 하루 일정
                        if db_todo.end_time:
                            end_datetime = datetime.combine(db_todo.date, db_todo.end_time)
                        else:
                            end_datetime = start_datetime + timedelta(hours=1)
                        logger.info(f"[CREATE_TODO] 시간 지정 이벤트 (하루): {db_todo.date} {db_todo.start_time} ~ {db_todo.end_time or '1시간 후'}")
            
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
        "end_date": db_todo_with_items.end_date.isoformat() if db_todo_with_items.end_date else None,
        "start_time": db_todo_with_items.start_time.strftime("%H:%M") if db_todo_with_items.start_time else None,
        "end_time": db_todo_with_items.end_time.strftime("%H:%M") if db_todo_with_items.end_time else None,
        "all_day": db_todo_with_items.all_day,
        "category": db_todo_with_items.category,
        "status": db_todo_with_items.status,
        "priority": db_todo_with_items.priority,
        "repeat_type": db_todo_with_items.repeat_type,
        "repeat_end_date": db_todo_with_items.repeat_end_date.isoformat() if db_todo_with_items.repeat_end_date else None,
        "repeat_days": db_todo_with_items.repeat_days,
        "repeat_pattern": json.loads(db_todo_with_items.repeat_pattern) if db_todo_with_items.repeat_pattern else None,
        "has_notification": db_todo_with_items.has_notification,
        "notification_times": json.loads(db_todo_with_items.notification_times) if db_todo_with_items.notification_times else [],
        "notification_reminders": json.loads(db_todo_with_items.notification_reminders) if db_todo_with_items.notification_reminders else [],
        "family_member_ids": json.loads(db_todo_with_items.family_member_ids) if db_todo_with_items.family_member_ids else [],
        "checklist_items": [item.text for item in db_todo_with_items.checklist_items],  # 문자열 리스트로 변환
        "created_at": db_todo_with_items.created_at,  # datetime 객체 그대로 사용
        "updated_at": db_todo_with_items.updated_at,   # datetime 객체 그대로 사용
        "google_calendar_event_id": db_todo_with_items.google_calendar_event_id if hasattr(db_todo_with_items, 'google_calendar_event_id') else None,
        "bulk_synced": db_todo_with_items.bulk_synced if hasattr(db_todo_with_items, 'bulk_synced') else False,
        "todo_group_id": db_todo_with_items.todo_group_id if hasattr(db_todo_with_items, 'todo_group_id') else None  # 일정 그룹 ID
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
    import logging
    from datetime import time as time_obj
    logger = logging.getLogger(__name__)
    
    # 요청 데이터 로깅
    logger.info(f"[UPDATE_TODO] 요청 받음: todo_id={todo_id}, start_time={todo_update.start_time}, end_time={todo_update.end_time}")
    
    todo = db.query(Todo).filter(
        Todo.id == todo_id,
        Todo.user_id == current_user.id,
        Todo.deleted_at.is_(None)
    ).first()
    
    if not todo:
        logger.error(f"[UPDATE_TODO] Todo를 찾을 수 없음: todo_id={todo_id}, user_id={current_user.id}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="할 일을 찾을 수 없습니다"
        )
    
    logger.info(f"[UPDATE_TODO] 기존 Todo 발견: id={todo.id}, 현재 start_time={todo.start_time}, end_time={todo.end_time}")
    
    # 반복 설정이 변경되었는지 확인 (필드 업데이트 이전에 확인)
    old_repeat_type = todo.repeat_type or "none"
    old_repeat_end_date = todo.repeat_end_date
    old_repeat_pattern = todo.repeat_pattern
    
    new_repeat_type = todo_update.repeat_type if todo_update.repeat_type is not None else old_repeat_type
    new_repeat_end_date = None
    if todo_update.repeat_end_date is not None and todo_update.repeat_end_date.strip():
        try:
            new_repeat_end_date = datetime.strptime(todo_update.repeat_end_date.strip(), '%Y-%m-%d').date()
        except (ValueError, AttributeError):
            pass
    elif todo_update.repeat_end_date is None and old_repeat_end_date:
        new_repeat_end_date = old_repeat_end_date
    
    # repeat_pattern 비교를 위해 두 값을 동일한 형식으로 변환
    if todo_update.repeat_pattern is not None:
        if isinstance(todo_update.repeat_pattern, str):
            new_repeat_pattern = todo_update.repeat_pattern
        else:
            new_repeat_pattern = json.dumps(todo_update.repeat_pattern)
    else:
        new_repeat_pattern = old_repeat_pattern
    
    # old_repeat_pattern도 문자열로 변환하여 비교
    if old_repeat_pattern and isinstance(old_repeat_pattern, str):
        old_repeat_pattern_str = old_repeat_pattern
    else:
        old_repeat_pattern_str = json.dumps(old_repeat_pattern) if old_repeat_pattern else None
    
    # 반복 설정이 변경되었는지 확인
    repeat_changed = False
    repeat_needs_recreate = False
    
    # 반복 설정이 처음 추가되는 경우 (none -> 다른 값) 또는 변경된 경우
    if (new_repeat_type != old_repeat_type or 
        new_repeat_end_date != old_repeat_end_date or 
        new_repeat_pattern != old_repeat_pattern_str):
        repeat_changed = True
        # 반복 설정이 추가되거나 변경된 경우 (none -> 다른 값 또는 다른 값 -> 다른 값)
        if new_repeat_type and new_repeat_type != "none":
            repeat_needs_recreate = True  # 반복 설정 추가/변경 시 재생성 필요
    
    # 시작 날짜가 변경되었는지 확인 (반복 설정이 있는 경우에만 재생성 필요)
    date_changed = False
    if todo_update.date is not None and todo_update.date.strip():
        try:
            new_date = datetime.strptime(todo_update.date.strip(), '%Y-%m-%d').date()
            if todo.date != new_date:
                date_changed = True
                # 반복 설정이 있는 경우에만 시작 날짜 변경 시 반복 일정 재생성
                if new_repeat_type and new_repeat_type != "none":
                    repeat_needs_recreate = True
        except (ValueError, AttributeError):
            pass
    
    # 기존 반복 일정 삭제 (반복 설정이 변경되거나 시작 날짜가 변경된 경우)
    # 단, 반복 설정이 "none"으로 변경되는 경우는 제외 (반복 설정이 있는 경우에만)
    if (repeat_needs_recreate or (repeat_changed and old_repeat_type != "none" and new_repeat_type == "none")) and hasattr(todo, 'todo_group_id') and todo.todo_group_id:
        # 같은 그룹의 모든 반복 일정 조회 (현재 일정 제외)
        existing_repeated_todos = db.query(Todo).filter(
            Todo.todo_group_id == todo.todo_group_id,
            Todo.user_id == current_user.id,
            Todo.id != todo.id,  # 현재 일정 제외
            Todo.deleted_at.is_(None)
        ).all()
        
        if existing_repeated_todos:
            import logging
            logger = logging.getLogger(__name__)
            logger.info(f"[UPDATE_TODO] 기존 반복 일정 삭제: {len(existing_repeated_todos)}개 (todo_group_id={todo.todo_group_id})")
            
            # Google Calendar 이벤트 삭제
            db.refresh(current_user)
            export_enabled = getattr(current_user, 'google_calendar_export_enabled', 'false')
            for repeated_todo in existing_repeated_todos:
                if (current_user.google_calendar_enabled == "true" and 
                    current_user.google_calendar_token and 
                    export_enabled == "true" and 
                    repeated_todo.google_calendar_event_id):
                    try:
                        from app.services.calendar_service import GoogleCalendarService
                        await GoogleCalendarService.delete_event(
                            token_json=current_user.google_calendar_token,
                            event_id=repeated_todo.google_calendar_event_id
                        )
                    except Exception as e:
                        logger.warning(f"[UPDATE_TODO] Google Calendar 이벤트 삭제 실패: {e}")
            
            # 기존 반복 일정 삭제 (soft delete)
            deleted_at_value = datetime.utcnow()
            for repeated_todo in existing_repeated_todos:
                repeated_todo.deleted_at = deleted_at_value
            
            db.commit()
            logger.info(f"[UPDATE_TODO] 기존 반복 일정 삭제 완료: {len(existing_repeated_todos)}개")
    
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
    if todo_update.end_date is not None:
        # 문자열 날짜를 date 객체로 변환 (빈 문자열이면 None)
        if todo_update.end_date.strip():
            try:
                todo.end_date = datetime.strptime(todo_update.end_date.strip(), '%Y-%m-%d').date()
            except (ValueError, AttributeError):
                # 날짜 형식이 잘못된 경우 무시
                pass
        else:
            todo.end_date = None
    if todo_update.start_time is not None:
        # 빈 문자열이거나 None이면 null로 설정
        if todo_update.start_time == "" or todo_update.start_time is None:
            todo.start_time = None
            logger.info(f"[UPDATE_TODO] start_time을 None으로 설정")
        else:
            try:
                hours, minutes = map(int, todo_update.start_time.split(':'))
                todo.start_time = time_obj(hours, minutes)
                logger.info(f"[UPDATE_TODO] start_time 업데이트: {todo_update.start_time} -> {todo.start_time}")
            except Exception as e:
                logger.error(f"[UPDATE_TODO] start_time 파싱 실패: {todo_update.start_time}, 에러: {e}")
                todo.start_time = None
    if todo_update.end_time is not None:
        # 빈 문자열이거나 None이면 null로 설정
        if todo_update.end_time == "" or todo_update.end_time is None:
            todo.end_time = None
            logger.info(f"[UPDATE_TODO] end_time을 None으로 설정")
        else:
            try:
                hours, minutes = map(int, todo_update.end_time.split(':'))
                todo.end_time = time_obj(hours, minutes)
                logger.info(f"[UPDATE_TODO] end_time 업데이트: {todo_update.end_time} -> {todo.end_time}")
            except Exception as e:
                logger.error(f"[UPDATE_TODO] end_time 파싱 실패: {todo_update.end_time}, 에러: {e}")
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
    if todo_update.repeat_pattern is not None:
        todo.repeat_pattern = json.dumps(todo_update.repeat_pattern)
    if todo_update.has_notification is not None:
        todo.has_notification = todo_update.has_notification
    if todo_update.notification_times is not None:
        todo.notification_times = json.dumps(todo_update.notification_times)
    if todo_update.notification_reminders is not None:
        todo.notification_reminders = json.dumps(todo_update.notification_reminders)
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
    
    # 업데이트된 시간 값 확인
    logger.info(f"[UPDATE_TODO] 저장 전 확인: todo_id={todo.id}, start_time={todo.start_time}, end_time={todo.end_time}, updated_at={todo.updated_at}")
    
    db.commit()
    db.refresh(todo)
    
    # 저장 후 확인
    logger.info(f"[UPDATE_TODO] 저장 후 확인: todo_id={todo.id}, start_time={todo.start_time}, end_time={todo.end_time}")
    
    # 반복 설정이 변경되었고 새로운 반복 타입이 있는 경우 반복 일정 생성
    # 또는 반복 타입이 "none"으로 변경된 경우 기존 반복 일정이 이미 삭제되었으므로 생성 불필요
    # todo 객체가 업데이트되었으므로 todo.repeat_type과 todo.repeat_pattern을 사용
    logger.info(f"[UPDATE_TODO] 반복 설정 체크: repeat_needs_recreate={repeat_needs_recreate}, old_repeat_type={old_repeat_type}, new_repeat_type={new_repeat_type}, todo.repeat_type={todo.repeat_type}, repeat_changed={repeat_changed}")
    
    # todo 객체가 업데이트되었으므로 todo.repeat_type을 사용
    final_repeat_type = todo.repeat_type or "none"
    
    logger.info(f"[UPDATE_TODO] 최종 반복 타입 확인: final_repeat_type={final_repeat_type}, repeat_needs_recreate={repeat_needs_recreate}")
    
    if repeat_needs_recreate and final_repeat_type and final_repeat_type != "none":
        logger.info(f"[UPDATE_TODO] 반복 설정 변경됨: {old_repeat_type} -> {final_repeat_type}, 반복 일정 생성 시작")
        
        # 반복 그룹 ID 설정 (없으면 생성)
        import uuid
        if not todo.todo_group_id:
            todo.todo_group_id = f"repeat_{uuid.uuid4().hex[:12]}"
            db.commit()
            db.refresh(todo)
        
        # 반복 종료 날짜 설정 (없으면 기본값으로 1년 후)
        repeat_end_date = todo.repeat_end_date
        if not repeat_end_date:
            from datetime import timedelta
            repeat_end_date = todo.date + timedelta(days=365)
            logger.info(f"[UPDATE_TODO] 반복 종료 날짜 기본값 설정: {repeat_end_date}")
        
        # 반복 일정 생성 로직 (create_todo와 동일)
        from datetime import timedelta
        repeated_todos = []
        start_date = todo.date
        end_date = repeat_end_date
        
        logger.info(f"[UPDATE_TODO] 반복 일정 생성 준비: 타입={final_repeat_type}, 시작 날짜={start_date}, 종료 날짜={end_date}, repeat_pattern={todo.repeat_pattern}")
        
        # 반복 주기에 따라 날짜 계산
        current_date = start_date + timedelta(days=1)  # 다음 날짜부터 시작
        
        if final_repeat_type == "daily":
            # 매일: 다음 날부터 반복 종료일까지 매일 생성
            while current_date <= end_date:
                repeated_todos.append(current_date)
                current_date += timedelta(days=1)
        elif final_repeat_type == "weekly":
            # 매주: 같은 요일마다 생성
            start_weekday = start_date.weekday()
            while current_date <= end_date:
                if current_date.weekday() == start_weekday:
                    repeated_todos.append(current_date)
                current_date += timedelta(days=1)
        elif final_repeat_type == "monthly":
            # 매월: 같은 날짜마다 생성
            from calendar import monthrange
            start_day = start_date.day
            # 첫 번째 반복 날짜: 다음 달 같은 날짜
            if start_date.month == 12:
                next_month_date = date(start_date.year + 1, 1, start_day)
            else:
                try:
                    next_month_date = date(start_date.year, start_date.month + 1, start_day)
                except ValueError:
                    # 날짜가 유효하지 않은 경우 (예: 31일이 없는 달), 마지막 날로 설정
                    if start_date.month == 12:
                        next_month = date(start_date.year + 1, 1, 1)
                    else:
                        next_month = date(start_date.year, start_date.month + 1, 1)
                    last_day = monthrange(next_month.year, next_month.month)[1]
                    next_month_date = date(next_month.year, next_month.month, min(start_day, last_day))
            
            current_date = next_month_date
            while current_date <= end_date:
                repeated_todos.append(current_date)
                # 다음 달로 이동
                if current_date.month == 12:
                    next_year = current_date.year + 1
                    next_month = 1
                else:
                    next_year = current_date.year
                    next_month = current_date.month + 1
                
                try:
                    current_date = date(next_year, next_month, start_day)
                except ValueError:
                    # 날짜가 유효하지 않은 경우, 마지막 날로 설정
                    next_month_start = date(next_year, next_month, 1)
                    last_day = monthrange(next_month_start.year, next_month_start.month)[1]
                    current_date = date(next_year, next_month, min(start_day, last_day))
        elif final_repeat_type == "yearly":
            # 매년: 같은 월일마다 생성
            start_month = start_date.month
            start_day = start_date.day
            # 첫 번째 반복 날짜: 다음 년도 같은 날짜
            next_year_date = date(start_date.year + 1, start_month, start_day)
            current_date = next_year_date
            while current_date <= end_date:
                repeated_todos.append(current_date)
                # 다음 년도로 이동
                current_date = date(current_date.year + 1, start_month, start_day)
        elif final_repeat_type == "weekdays":
            # 매주 주중 (월~금)
            while current_date <= end_date:
                weekday = current_date.weekday()
                if weekday < 5:  # 0(월)~4(금)
                    repeated_todos.append(current_date)
                current_date += timedelta(days=1)
        elif final_repeat_type == "weekends":
            # 매주 주말 (토~일)
            while current_date <= end_date:
                weekday = current_date.weekday()
                if weekday >= 5:  # 5(토)~6(일)
                    repeated_todos.append(current_date)
                current_date += timedelta(days=1)
        elif final_repeat_type == "custom" and todo.repeat_pattern:
            # 맞춤 반복 패턴 처리 (create_todo와 동일한 로직)
            try:
                pattern = todo.repeat_pattern
                if isinstance(pattern, str):
                    pattern = json.loads(pattern)
                
                freq = pattern.get('freq', 'days')
                interval = pattern.get('interval', 1)
                custom_days = pattern.get('days', [])
                end_type = pattern.get('endType', 'never')
                
                # 종료 날짜 계산
                if end_type == 'date':
                    end_date_str = pattern.get('endDate')
                    if end_date_str:
                        if isinstance(end_date_str, str):
                            end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
                        else:
                            end_date = end_date_str
                elif end_type == 'count':
                    count = pattern.get('count', 10)
                    if freq == 'days':
                        end_date = start_date + timedelta(days=interval * (count - 1))
                    elif freq == 'weeks':
                        end_date = start_date + timedelta(weeks=interval * (count - 1))
                    elif freq == 'months':
                        from calendar import monthrange
                        end_date = start_date
                        start_day = start_date.day
                        for i in range(count - 1):
                            months_to_add = interval
                            if end_date.month + months_to_add > 12:
                                next_year = end_date.year + 1
                                next_month = (end_date.month + months_to_add) % 12
                                if next_month == 0:
                                    next_month = 12
                                    next_year -= 1
                            else:
                                next_year = end_date.year
                                next_month = end_date.month + months_to_add
                            
                            try:
                                end_date = date(next_year, next_month, start_day)
                            except ValueError:
                                last_day = monthrange(next_year, next_month)[1]
                                end_date = date(next_year, next_month, min(start_day, last_day))
                    elif freq == 'years':
                        end_date = date(start_date.year + interval * (count - 1), start_date.month, start_date.day)
                    else:
                        end_date = start_date + timedelta(days=interval * (count - 1))
                else:
                    # end_type == 'never'인 경우 기본값 사용 (1년 후)
                    end_date = start_date + timedelta(days=365)
                
                # 반복 일정 생성
                if freq == 'days':
                    current_date = start_date + timedelta(days=interval)
                    while current_date <= end_date:
                        repeated_todos.append(current_date)
                        current_date += timedelta(days=interval)
                elif freq == 'weeks':
                    if custom_days:
                        # 특정 요일만
                        current_date = start_date
                        week_count = 0
                        while current_date <= end_date:
                            weekday = current_date.weekday()
                            weeks_from_start = (current_date - start_date).days // 7
                            if weeks_from_start % interval == 0 and weekday in custom_days:
                                if current_date > start_date:
                                    repeated_todos.append(current_date)
                            current_date += timedelta(days=1)
                    else:
                        # 같은 요일마다 N주마다
                        start_weekday = start_date.weekday()
                        current_date = start_date + timedelta(weeks=interval)
                        while current_date <= end_date:
                            if current_date.weekday() == start_weekday:
                                repeated_todos.append(current_date)
                                current_date += timedelta(weeks=interval)
                            else:
                                current_date += timedelta(days=1)
                elif freq == 'months':
                    # 매 N개월마다 (create_todo와 동일한 로직)
                    current_date = start_date
                    from calendar import monthrange
                    start_day = start_date.day
                    months_to_add = interval
                    if current_date.month + months_to_add > 12:
                        next_year = current_date.year + 1
                        next_month = (current_date.month + months_to_add) % 12
                        if next_month == 0:
                            next_month = 12
                            next_year -= 1
                    else:
                        next_year = current_date.year
                        next_month = current_date.month + months_to_add
                    
                    try:
                        current_date = date(next_year, next_month, start_day)
                    except ValueError:
                        last_day = monthrange(next_year, next_month)[1]
                        current_date = date(next_year, next_month, min(start_day, last_day))
                    
                    while current_date <= end_date:
                        repeated_todos.append(current_date)
                        months_to_add = interval
                        if current_date.month + months_to_add > 12:
                            next_year = current_date.year + 1
                            next_month = (current_date.month + months_to_add) % 12
                            if next_month == 0:
                                next_month = 12
                                next_year -= 1
                        else:
                            next_year = current_date.year
                            next_month = current_date.month + months_to_add
                        
                        try:
                            current_date = date(next_year, next_month, start_day)
                        except ValueError:
                            last_day = monthrange(next_year, next_month)[1]
                            current_date = date(next_year, next_month, min(start_day, last_day))
                elif freq == 'years':
                    current_date = date(start_date.year + interval, start_date.month, start_date.day)
                    while current_date <= end_date:
                        repeated_todos.append(current_date)
                        current_date = date(current_date.year + interval, start_date.month, start_date.day)
            except Exception as e:
                logger.error(f"[UPDATE_TODO] 맞춤 반복 패턴 처리 실패: {e}", exc_info=True)
        
        logger.info(f"[UPDATE_TODO] 반복 일정 생성 예정: {len(repeated_todos)}개 (타입: {final_repeat_type}, 그룹 ID: {todo.todo_group_id}, 시작 날짜: {start_date}, 종료 날짜: {end_date})")
        
        if len(repeated_todos) == 0:
            logger.warning(f"[UPDATE_TODO] 반복 일정 생성 실패: 반복 날짜 목록이 비어있음 (타입: {final_repeat_type}, 시작 날짜: {start_date}, 종료 날짜: {end_date})")
        
        # 반복 일정 생성
        created_count = 0
        repeated_todo_objects = []  # 체크리스트 항목 추가를 위해 저장
        
        # 원본 일정의 기간 계산 (여러 날짜에 걸친 일정인 경우)
        original_duration_days = 0
        if todo.end_date and todo.date:
            original_duration_days = (todo.end_date - todo.date).days
            logger.info(f"[UPDATE_TODO] 원본 일정 기간: {todo.date} ~ {todo.end_date} ({original_duration_days}일)")
        
        for repeat_date in repeated_todos:
            # 반복 일정의 종료 날짜 계산 (원본 일정과 동일한 기간 유지)
            repeated_end_date = None
            if original_duration_days > 0:
                repeated_end_date = repeat_date + timedelta(days=original_duration_days)
                logger.info(f"[UPDATE_TODO] 반복 일정 기간: {repeat_date} ~ {repeated_end_date} ({original_duration_days}일)")
            
            repeated_todo = Todo(
                user_id=current_user.id,
                title=todo.title,
                description=todo.description,
                memo=todo.memo,
                location=todo.location,
                date=repeat_date,  # 반복 시작 날짜
                end_date=repeated_end_date,  # 원본 일정과 동일한 기간 유지
                start_time=todo.start_time,
                end_time=todo.end_time,
                all_day=todo.all_day,
                category=todo.category,
                status=todo.status,
                priority=todo.priority,
                repeat_type=todo.repeat_type,
                repeat_end_date=todo.repeat_end_date,
                repeat_days=todo.repeat_days,
                repeat_pattern=todo.repeat_pattern,
                has_notification=todo.has_notification,
                notification_times=todo.notification_times,
                notification_reminders=todo.notification_reminders,
                family_member_ids=todo.family_member_ids,
                tags=todo.tags,
                source=todo.source,
                todo_group_id=todo.todo_group_id  # 같은 그룹 ID로 묶기
            )
            db.add(repeated_todo)
            repeated_todo_objects.append((repeated_todo, repeat_date))
            created_count += 1
        
        # 반복 일정을 먼저 flush하여 ID 생성
        if repeated_todos:
            db.flush()  # ID를 생성하기 위해 flush
            logger.info(f"[UPDATE_TODO] 반복 일정 flush 완료: {created_count}개")
            
            # 이제 각 반복 일정에 체크리스트 항목 추가
            for repeated_todo, repeat_date in repeated_todo_objects:
                if todo_update.checklist_items:
                    for idx, item_text in enumerate(todo_update.checklist_items):
                        if item_text.strip():
                            checklist_item = ChecklistItem(
                                todo_id=repeated_todo.id,  # 이제 ID가 생성됨
                                text=item_text,
                                completed=False,
                                order_index=idx
                            )
                            db.add(checklist_item)
                logger.info(f"[UPDATE_TODO] 반복 일정 생성: 날짜={repeat_date}, ID={repeated_todo.id}")
            
            # 체크리스트 항목과 함께 최종 커밋
            db.commit()
            logger.info(f"[UPDATE_TODO] 반복 일정 생성 완료: {created_count}개 (총 {len(repeated_todos)}개 중)")
        else:
            logger.warning(f"[UPDATE_TODO] 반복 일정 생성 실패: 반복 날짜 목록이 비어있음")
    else:
        if not repeat_needs_recreate:
            logger.info(f"[UPDATE_TODO] 반복 일정 생성 스킵: repeat_needs_recreate={repeat_needs_recreate}")
        elif not new_repeat_type or new_repeat_type == "none":
            logger.info(f"[UPDATE_TODO] 반복 일정 생성 스킵: new_repeat_type={new_repeat_type}")
    
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
                        # end_date가 있으면 그 날짜까지, 없으면 하루만
                        logger.info(f"[UPDATE_TODO] 종일 이벤트 - date: {todo.date}, end_date: {todo.end_date}")
                        if todo.end_date:
                            # end_date는 inclusive이므로, Google Calendar의 exclusive 형식으로 변환하려면 +1일
                            end_datetime = datetime.combine(todo.end_date, datetime.min.time()) + timedelta(days=1)
                            logger.info(f"[UPDATE_TODO] 종일 이벤트 기간: {todo.date} ~ {todo.end_date} ({(todo.end_date - todo.date).days + 1}일), end_datetime: {end_datetime}")
                        else:
                            end_datetime = start_datetime + timedelta(days=1)
                            logger.info(f"[UPDATE_TODO] 종일 이벤트 (하루): {todo.date}, end_datetime: {end_datetime}")
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
                            logger.info(f"[UPDATE_TODO] 시간 지정 이벤트 기간: {todo.date} {todo.start_time} ~ {todo.end_date} {todo.end_time or '23:59'} ({(todo.end_date - todo.date).days + 1}일)")
                        else:
                            # 하루 일정
                            if todo.end_time:
                                end_datetime = datetime.combine(todo.date, todo.end_time)
                            else:
                                end_datetime = start_datetime + timedelta(hours=1)
                            logger.info(f"[UPDATE_TODO] 시간 지정 이벤트 (하루): {todo.date} {todo.start_time} ~ {todo.end_time or '1시간 후'}")
                
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
        "end_date": updated_todo.end_date.isoformat() if updated_todo.end_date else None,
        "start_time": updated_todo.start_time.strftime("%H:%M") if updated_todo.start_time else None,
        "end_time": updated_todo.end_time.strftime("%H:%M") if updated_todo.end_time else None,
        "all_day": updated_todo.all_day,
        "category": updated_todo.category,
        "status": updated_todo.status,
        "priority": updated_todo.priority,
        "repeat_type": updated_todo.repeat_type,
        "repeat_end_date": updated_todo.repeat_end_date.isoformat() if updated_todo.repeat_end_date else None,
        "repeat_days": updated_todo.repeat_days,
        "repeat_pattern": json.loads(updated_todo.repeat_pattern) if updated_todo.repeat_pattern else None,
        "has_notification": updated_todo.has_notification,
        "notification_times": json.loads(updated_todo.notification_times) if updated_todo.notification_times else [],
        "notification_reminders": json.loads(updated_todo.notification_reminders) if updated_todo.notification_reminders else [],
        "family_member_ids": json.loads(updated_todo.family_member_ids) if updated_todo.family_member_ids else [],
        "checklist_items": [item.text for item in updated_todo.checklist_items],  # 문자열 리스트로 변환
        "created_at": updated_todo.created_at,  # datetime 객체 그대로 사용
        "updated_at": updated_todo.updated_at,   # datetime 객체 그대로 사용
        "google_calendar_event_id": updated_todo.google_calendar_event_id,  # Google Calendar 이벤트 ID 추가
        "bulk_synced": updated_todo.bulk_synced if hasattr(updated_todo, 'bulk_synced') else False,  # 일괄 동기화 플래그
        "todo_group_id": updated_todo.todo_group_id if hasattr(updated_todo, 'todo_group_id') else None  # 일정 그룹 ID
    }
    
    return TodoResponse(**response_data)


@router.delete("/{todo_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_todo(
    todo_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Soft delete todo - 같은 그룹의 모든 일정도 함께 삭제"""
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
        logger.info(f"[DELETE-TODO] 삭제 시작: todo_id={todo_id}, user_id={current_user.id}, todo_group_id={todo.todo_group_id if hasattr(todo, 'todo_group_id') else None}")
        
        # 같은 그룹의 모든 일정 찾기 (todo_group_id가 있는 경우)
        todos_to_delete = []
        if hasattr(todo, 'todo_group_id') and todo.todo_group_id:
            # 같은 그룹의 모든 일정 조회
            todos_to_delete = db.query(Todo).filter(
                Todo.todo_group_id == todo.todo_group_id,
                Todo.user_id == current_user.id,
                Todo.deleted_at.is_(None)
            ).all()
            logger.info(f"[DELETE-TODO] 같은 그룹의 일정 {len(todos_to_delete)}개 발견: todo_group_id={todo.todo_group_id}")
        else:
            # 그룹 ID가 없으면 현재 일정만 삭제
            todos_to_delete = [todo]
        
        # Google Calendar 자동 삭제 (연동 활성화 및 내보내기 활성화 시)
        # 사용자 정보를 다시 로드하여 최신 토글 상태 확인
        db.refresh(current_user)
        export_enabled = getattr(current_user, 'google_calendar_export_enabled', 'false')
        logger.info(f"[DELETE_TODO] Google Calendar 삭제 체크 - enabled={current_user.google_calendar_enabled}, token_exists={bool(current_user.google_calendar_token)}, export_enabled={export_enabled}")
        
        # 각 일정에 대해 Google Calendar 삭제 처리
        for todo_item in todos_to_delete:
            if current_user.google_calendar_enabled == "true" and current_user.google_calendar_token and export_enabled == "true" and todo_item.google_calendar_event_id:
                try:
                    from app.services.calendar_service import GoogleCalendarService
                    
                    # Google Calendar에서 이벤트 삭제
                    deleted = await GoogleCalendarService.delete_event(
                        token_json=current_user.google_calendar_token,
                        event_id=todo_item.google_calendar_event_id
                    )
                    
                    if deleted:
                        logger.info(f"[DELETE-TODO] Google Calendar 이벤트 삭제 성공: {todo_item.google_calendar_event_id}")
                    else:
                        logger.warning(f"[DELETE-TODO] Google Calendar 이벤트 삭제 실패: {todo_item.google_calendar_event_id}")
                except Exception as e:
                    # Google Calendar 삭제 실패해도 Todo 삭제는 진행
                    logger.warning(f"[DELETE-TODO] Google Calendar 삭제 중 오류 (Todo는 삭제됨): {e}")
        
        # 같은 그룹의 모든 일정 삭제 (soft delete)
        deleted_at_value = datetime.utcnow()
        for todo_item in todos_to_delete:
            todo_item.deleted_at = deleted_at_value
        
        # 커밋
        db.commit()
        
        # 삭제된 일정 ID 목록 저장 (로깅용)
        deleted_ids = [t.id for t in todos_to_delete]
        
        # 삭제된 일정 수 로깅
        logger.info(f"[DELETE-TODO] 삭제 완료: {len(todos_to_delete)}개 일정 삭제됨 (todo_group_id={todo.todo_group_id if hasattr(todo, 'todo_group_id') else None}, ids={deleted_ids})")
        
        logger.info(f"[DELETE-TODO] 삭제 성공: todo_id={todo_id}, deleted_at={deleted_at_value}")
        
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
        "updated_at": updated_todo.updated_at,   # datetime 객체 그대로 사용
        "google_calendar_event_id": updated_todo.google_calendar_event_id if hasattr(updated_todo, 'google_calendar_event_id') else None,
        "bulk_synced": updated_todo.bulk_synced if hasattr(updated_todo, 'bulk_synced') else False,
        "todo_group_id": updated_todo.todo_group_id if hasattr(updated_todo, 'todo_group_id') else None  # 일정 그룹 ID
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
