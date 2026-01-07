"""
Family and member management endpoints
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime

from app.database import get_db
from app.models.models import FamilyMember
from app.models.user import User
from app.schemas import FamilyMemberCreate, FamilyMemberResponse
from app.api.routes.auth import get_current_user

router = APIRouter(
    prefix="/family",
    tags=["family"],
    dependencies=[Depends(get_current_user)]
)


@router.get("/members", response_model=List[FamilyMemberResponse])
async def get_family_members(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all family members for current user"""
    return db.query(FamilyMember).filter(
        FamilyMember.user_id == current_user.id,
        FamilyMember.deleted_at.is_(None)
    ).all()


@router.post("/members", response_model=FamilyMemberResponse, status_code=status.HTTP_201_CREATED)
async def add_family_member(
    member: FamilyMemberCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Add new family member"""
    db_member = FamilyMember(
        user_id=current_user.id,
        name=member.name,
        emoji=member.emoji,
        color_code=member.color or "#000000",
        relation=member.relation or "other",
        phone_number=getattr(member, 'phone_number', None),
        notes=getattr(member, 'notes', None)
    )
    
    db.add(db_member)
    db.commit()
    db.refresh(db_member)
    
    return db_member


@router.get("/members/{member_id}", response_model=FamilyMemberResponse)
async def get_family_member(
    member_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get specific family member"""
    member = db.query(FamilyMember).filter(
        FamilyMember.id == member_id,
        FamilyMember.user_id == current_user.id,
        FamilyMember.deleted_at.is_(None)
    ).first()
    
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="가족 구성원을 찾을 수 없습니다"
        )
    
    return member


@router.patch("/members/{member_id}", response_model=FamilyMemberResponse)
async def update_family_member(
    member_id: str,
    member_update: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update family member"""
    from app.schemas import FamilyMemberCreate
    
    member = db.query(FamilyMember).filter(
        FamilyMember.id == member_id,
        FamilyMember.user_id == current_user.id,
        FamilyMember.deleted_at.is_(None)
    ).first()
    
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="가족 구성원을 찾을 수 없습니다"
        )
    
    # 업데이트할 필드만 변경
    if 'name' in member_update:
        member.name = member_update['name']
    if 'emoji' in member_update:
        member.emoji = member_update['emoji']
    if 'color' in member_update:
        member.color_code = member_update['color']
    if 'relation' in member_update:
        member.relation = member_update['relation']
    if 'phone_number' in member_update:
        member.phone_number = member_update['phone_number']
    if 'notes' in member_update:
        member.notes = member_update['notes']
    
    member.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(member)
    
    return member


@router.delete("/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_family_member(
    member_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Soft delete family member"""
    member = db.query(FamilyMember).filter(
        FamilyMember.id == member_id,
        FamilyMember.user_id == current_user.id,
        FamilyMember.deleted_at.is_(None)
    ).first()
    
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="가족 구성원을 찾을 수 없습니다"
        )
    
    member.deleted_at = datetime.utcnow()
    db.commit()
