"""
Todo endpoints for CRUD operations and automation
"""
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
            "notification_times": todo.notification_times,
            "family_member_ids": todo.family_member_ids,
            "checklist_items": [item.text for item in todo.checklist_items],  # 문자열 리스트로 변환
            "created_at": todo.created_at,
            "updated_at": todo.updated_at
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
        "notification_times": todo.notification_times,
        "family_member_ids": todo.family_member_ids,
        "checklist_items": [item.text for item in todo.checklist_items],  # 문자열 리스트로 변환
        "created_at": todo.created_at,  # datetime 객체 그대로 사용
        "updated_at": todo.updated_at   # datetime 객체 그대로 사용
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
        "notification_times": db_todo_with_items.notification_times,
        "family_member_ids": db_todo_with_items.family_member_ids,
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
    if todo_update.date is not None:
        todo.date = todo_update.date
    if todo_update.start_time is not None:
        try:
            hours, minutes = map(int, todo_update.start_time.split(':'))
            todo.start_time = time_obj(hours, minutes)
        except:
            pass
    if todo_update.end_time is not None:
        try:
            hours, minutes = map(int, todo_update.end_time.split(':'))
            todo.end_time = time_obj(hours, minutes)
        except:
            pass
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
    if todo_update.repeat_end_date is not None:
        todo.repeat_end_date = todo_update.repeat_end_date
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
        "notification_times": updated_todo.notification_times,
        "family_member_ids": updated_todo.family_member_ids,
        "checklist_items": [item.text for item in updated_todo.checklist_items],  # 문자열 리스트로 변환
        "created_at": updated_todo.created_at,  # datetime 객체 그대로 사용
        "updated_at": updated_todo.updated_at   # datetime 객체 그대로 사용
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
        "notification_times": updated_todo.notification_times,
        "family_member_ids": updated_todo.family_member_ids,
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
