"""
User Repository
04_DATABASE_DESIGN.md - User 모델 참고
"""
from sqlalchemy.orm import Session
from app.models.user import User
from app.models.models import FamilyMember, Todo, Rule, Receipt, Notification
from typing import Optional, List
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class UserRepository:
    """사용자 저장소"""
    
    @staticmethod
    def get_by_id(db: Session, user_id: str) -> Optional[User]:
        """ID로 사용자 조회"""
        return db.query(User).filter(
            User.id == user_id,
            User.deleted_at.is_(None)
        ).first()
    
    @staticmethod
    def get_by_email(db: Session, email: str) -> Optional[User]:
        """이메일로 사용자 조회"""
        return db.query(User).filter(
            User.email == email,
            User.deleted_at.is_(None)
        ).first()
    
    @staticmethod
    def get_by_google_id(db: Session, google_id: str) -> Optional[User]:
        """Google ID로 사용자 조회"""
        return db.query(User).filter(
            User.google_id == google_id,
            User.deleted_at.is_(None)
        ).first()
    
    @staticmethod
    def create(db: Session, user_data: dict) -> User:
        """사용자 생성"""
        user = User(**user_data)
        db.add(user)
        db.commit()
        db.refresh(user)
        logger.info(f"User created: {user.email}")
        return user
    
    @staticmethod
    def update(db: Session, user_id: str, updates: dict) -> Optional[User]:
        """사용자 정보 수정"""
        user = UserRepository.get_by_id(db, user_id)
        if not user:
            return None
        
        for key, value in updates.items():
            if hasattr(user, key):
                setattr(user, key, value)
        
        user.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(user)
        logger.info(f"User updated: {user_id}")
        return user
    
    @staticmethod
    def delete(db: Session, user_id: str) -> bool:
        """사용자 소프트 삭제"""
        user = UserRepository.get_by_id(db, user_id)
        if not user:
            return False
        
        user.deleted_at = datetime.utcnow()
        db.commit()
        logger.info(f"User deleted (soft): {user_id}")
        return True
    
    @staticmethod
    def update_last_login(db: Session, user_id: str) -> Optional[User]:
        """마지막 로그인 시간 업데이트"""
        return UserRepository.update(
            db,
            user_id,
            {'last_login': datetime.utcnow()}
        )
