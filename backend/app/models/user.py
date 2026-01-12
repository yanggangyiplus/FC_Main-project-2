"""
User Model
04_DATABASE_DESIGN.md - Users 테이블
"""
from sqlalchemy import Column, String, DateTime, Index
from sqlalchemy.orm import relationship
from datetime import datetime
from app.models.base import BaseModel


class User(BaseModel):
    """사용자 모델"""
    __tablename__ = "users"
    
    email = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    avatar_emoji = Column(String(10), default="🐼")
    
    # Google OAuth
    google_id = Column(String(255), unique=True, index=True)
    picture_url = Column(String(500))  # Google 프로필 이미지 URL
    
    # Google Calendar 연동
    google_calendar_token = Column(String(2000))  # Google Calendar OAuth 토큰 (JSON 문자열)
    google_calendar_enabled = Column(String(10), default="false")  # "true" 또는 "false"
    google_calendar_import_enabled = Column(String(10), default="false")  # Google Calendar에서 가져오기 활성화
    google_calendar_export_enabled = Column(String(10), default="false")  # Google Calendar로 내보내기 활성화
    
    # 로그인 관련
    last_login = Column(DateTime)
    deleted_at = Column(DateTime, index=True)  # 소프트 삭제
    
    # 관계
    todos = relationship("Todo", back_populates="user", cascade="all, delete-orphan")
    family_members = relationship("FamilyMember", back_populates="user", cascade="all, delete-orphan")
    rules = relationship("Rule", back_populates="user", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
    receipts = relationship("Receipt", back_populates="user", cascade="all, delete-orphan")
    memos = relationship("Memo", back_populates="user", cascade="all, delete-orphan")
    routines = relationship("Routine", back_populates="user", cascade="all, delete-orphan")
    audio_files = relationship("AudioFile", back_populates="user", cascade="all, delete-orphan")
    image_files = relationship("ImageFile", back_populates="user", cascade="all, delete-orphan") relationship("ImageFile", back_populates="user", cascade="all, delete-orphan")
    
    # 인덱스
    __table_args__ = (
        Index('idx_users_email', 'email'),
        Index('idx_users_google_id', 'google_id'),
    )
    
    def to_dict(self):
        return {
            'id': self.id,
            'email': self.email,
            'name': self.name,
            'avatar_emoji': self.avatar_emoji,
            'last_login': self.last_login.isoformat() if self.last_login else None,
        }
