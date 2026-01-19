"""
Base Models - SQLAlchemy ORM
04_DATABASE_DESIGN.md 참고
"""
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import Column, String, DateTime, func
from datetime import datetime
import uuid

Base = declarative_base()


class BaseModel(Base):
    """모든 모델의 기본 클래스"""
    __abstract__ = True
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    deleted_at = Column(DateTime, index=True)  # 소프트 삭제용
