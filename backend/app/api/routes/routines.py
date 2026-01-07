"""
Routine (시간표) endpoints
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import json

from app.database import get_db
from app.models.models import Routine
from app.models.user import User
from app.schemas import RoutineCreate, RoutineUpdate, RoutineResponse, RoutineTimeSlot
from app.api.routes.auth import get_current_user

router = APIRouter(
    prefix="/routines",
    tags=["routines"],
    dependencies=[Depends(get_current_user)]
)


@router.get("/", response_model=List[RoutineResponse])
async def get_routines(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """사용자의 모든 시간표 조회"""
    query = db.query(Routine).filter(
        Routine.user_id == current_user.id
    )
    if hasattr(Routine, 'deleted_at'):
        query = query.filter(Routine.deleted_at.is_(None))
    routines = query.all()
    
    # time_slots를 JSON에서 파싱
    result = []
    for routine in routines:
        routine_dict = {
            "id": routine.id,
            "user_id": routine.user_id,
            "member_id": routine.member_id,
            "name": routine.name,
            "color": routine.color,
            "category": routine.category,
            "memo": routine.memo,
            "add_to_calendar": routine.add_to_calendar,
            "created_at": routine.created_at,
            "updated_at": routine.updated_at,
            "time_slots": json.loads(routine.time_slots) if routine.time_slots else []
        }
        result.append(routine_dict)
    
    return result


@router.get("/{routine_id}", response_model=RoutineResponse)
async def get_routine(
    routine_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """특정 시간표 조회"""
    query = db.query(Routine).filter(
        Routine.id == routine_id,
        Routine.user_id == current_user.id
    )
    if hasattr(Routine, 'deleted_at'):
        query = query.filter(Routine.deleted_at.is_(None))
    routine = query.first()
    
    if not routine:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="시간표를 찾을 수 없습니다"
        )
    
    return {
        "id": routine.id,
        "user_id": routine.user_id,
        "member_id": routine.member_id,
        "name": routine.name,
        "color": routine.color,
        "category": routine.category,
        "memo": routine.memo,
        "add_to_calendar": routine.add_to_calendar,
        "created_at": routine.created_at,
        "updated_at": routine.updated_at,
        "time_slots": json.loads(routine.time_slots) if routine.time_slots else []
    }


@router.post("/", response_model=RoutineResponse, status_code=status.HTTP_201_CREATED)
async def create_routine(
    routine: RoutineCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """새 시간표 생성"""
    db_routine = Routine(
        user_id=current_user.id,
        member_id=routine.member_id,
        name=routine.name,
        color=routine.color,
        category=routine.category,
        memo=routine.memo,
        time_slots=json.dumps([slot.dict() for slot in routine.time_slots]),
        add_to_calendar=routine.add_to_calendar
    )
    
    db.add(db_routine)
    db.commit()
    db.refresh(db_routine)
    
    return {
        "id": db_routine.id,
        "user_id": db_routine.user_id,
        "member_id": db_routine.member_id,
        "name": db_routine.name,
        "color": db_routine.color,
        "category": db_routine.category,
        "memo": db_routine.memo,
        "add_to_calendar": db_routine.add_to_calendar,
        "created_at": db_routine.created_at,
        "updated_at": db_routine.updated_at,
        "time_slots": json.loads(db_routine.time_slots) if db_routine.time_slots else []
    }


@router.patch("/{routine_id}", response_model=RoutineResponse)
async def update_routine(
    routine_id: str,
    routine_update: RoutineUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """시간표 수정"""
    query = db.query(Routine).filter(
        Routine.id == routine_id,
        Routine.user_id == current_user.id
    )
    if hasattr(Routine, 'deleted_at'):
        query = query.filter(Routine.deleted_at.is_(None))
    db_routine = query.first()
    
    if not db_routine:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="시간표를 찾을 수 없습니다"
        )
    
    # 업데이트할 필드만 변경
    if routine_update.name is not None:
        db_routine.name = routine_update.name
    if routine_update.member_id is not None:
        db_routine.member_id = routine_update.member_id
    if routine_update.color is not None:
        db_routine.color = routine_update.color
    if routine_update.category is not None:
        db_routine.category = routine_update.category
    if routine_update.memo is not None:
        db_routine.memo = routine_update.memo
    if routine_update.time_slots is not None:
        db_routine.time_slots = json.dumps([slot.dict() for slot in routine_update.time_slots])
    if routine_update.add_to_calendar is not None:
        db_routine.add_to_calendar = routine_update.add_to_calendar
    
    db.commit()
    db.refresh(db_routine)
    
    return {
        "id": db_routine.id,
        "user_id": db_routine.user_id,
        "member_id": db_routine.member_id,
        "name": db_routine.name,
        "color": db_routine.color,
        "category": db_routine.category,
        "memo": db_routine.memo,
        "add_to_calendar": db_routine.add_to_calendar,
        "created_at": db_routine.created_at,
        "updated_at": db_routine.updated_at,
        "time_slots": json.loads(db_routine.time_slots) if db_routine.time_slots else []
    }


@router.delete("/{routine_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_routine(
    routine_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """시간표 삭제 (소프트 삭제)"""
    query = db.query(Routine).filter(
        Routine.id == routine_id,
        Routine.user_id == current_user.id
    )
    if hasattr(Routine, 'deleted_at'):
        query = query.filter(Routine.deleted_at.is_(None))
    db_routine = query.first()
    
    if not db_routine:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="시간표를 찾을 수 없습니다"
        )
    
    # 소프트 삭제가 가능한 경우에만 deleted_at 설정
    if hasattr(Routine, 'deleted_at'):
        from datetime import datetime
        db_routine.deleted_at = datetime.utcnow()
    else:
        # 하드 삭제
        db.delete(db_routine)
    db.commit()
    
    return None

