"""
Other Models (FamilyMember, Todo, etc.)
"""
from sqlalchemy import Column, String, Date, Time, Text, Boolean, DateTime, ForeignKey, Integer, Numeric, Index
from sqlalchemy.orm import relationship
from datetime import datetime, date
from app.models.base import BaseModel


class FamilyMember(BaseModel):
    """가족 구성원"""
    __tablename__ = "family_members"
    
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    emoji = Column(String(10))
    color_code = Column(String(50))
    relation = Column(String(50))  # "self", "spouse", "child", "other"
    birth_date = Column(Date)
    phone_number = Column(String(20))
    notes = Column(Text)
    is_active = Column(Boolean, default=True)
    
    # 관계
    user = relationship("User", back_populates="family_members")


class Todo(BaseModel):
    """할일/일정"""
    __tablename__ = "todos"
    
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    family_member_ids = Column(Text)  # JSON 배열
    
    title = Column(String(255), nullable=False)
    description = Column(Text)
    memo = Column(Text)  # 메모
    location = Column(String(255))  # 장소
    
    date = Column(Date, nullable=False, index=True)  # 시작 날짜
    end_date = Column(Date, index=True)  # 종료 날짜 (기간 일정인 경우)
    start_time = Column(Time)
    end_time = Column(Time)
    all_day = Column(Boolean, default=False)
    
    category = Column(String(50))
    tags = Column(Text)  # JSON 배열
    rule_id = Column(String(36), ForeignKey("rules.id"))
    
    status = Column(String(20), default="pending", index=True)  # pending, completed, overdue, draft
    priority = Column(String(20), default="medium")
    completed_at = Column(DateTime)
    
    has_notification = Column(Boolean, default=False)
    notification_times = Column(Text)  # JSON 배열 (구버전 호환)
    notification_reminders = Column(Text)  # JSON 배열: [{"value": 30, "unit": "minutes"}, ...]
    
    repeat_type = Column(String(20), default="none")
    repeat_end_date = Column(Date)  # 반복 종료 날짜
    repeat_days = Column(String(20))
    repeat_pattern = Column(Text)  # JSON: {"frequency": "daily", "interval": 1, "count": null, "until": "2026-01-31", "byday": null, "bymonthday": null}
    
    source = Column(String(50))  # voice, text, camera, sync
    deleted_at = Column(DateTime, index=True)
    
    # Google Calendar 연동
    google_calendar_event_id = Column(String(255), index=True)  # Google Calendar 이벤트 ID 저장
    bulk_synced = Column(Boolean, default=False)  # 일괄 동기화로 생성된 일정인지 여부 (토글 꺼도 유지)
    
    # 일정 그룹화 (여러 날짜에 걸친 일정을 하나로 묶기)
    todo_group_id = Column(String(255), index=True)  # 같은 그룹의 일정들은 같은 todo_group_id를 가짐 (여러 날짜에 걸친 일정 묶기)
    
    # 관계
    user = relationship("User", back_populates="todos")
    checklist_items = relationship("ChecklistItem", back_populates="todo", cascade="all, delete-orphan")
    
    __table_args__ = (
        Index('idx_todos_user_date', 'user_id', 'date'),
        Index('idx_todos_user_status', 'user_id', 'status'),
    )


class ChecklistItem(BaseModel):
    """체크리스트 항목"""
    __tablename__ = "checklist_items"
    
    todo_id = Column(String(36), ForeignKey("todos.id", ondelete="CASCADE"), nullable=False, index=True)
    text = Column(String(255), nullable=False)
    completed = Column(Boolean, default=False)
    completed_at = Column(DateTime)
    order_index = Column(Integer)
    
    # 관계
    todo = relationship("Todo", back_populates="checklist_items")


class Rule(BaseModel):
    """자동화 규칙"""
    __tablename__ = "rules"
    
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    category = Column(String(50), nullable=False)
    icon = Column(String(10))
    description = Column(Text)
    
    enabled = Column(Boolean, default=True)
    trigger_event = Column(String(100))
    
    offset_type = Column(String(50))  # days_before, same_day, custom_time
    offset_value = Column(Integer)
    offset_time = Column(Time)
    
    # 관계
    user = relationship("User", back_populates="rules")
    rule_items = relationship("RuleItem", back_populates="rule", cascade="all, delete-orphan")
    
    __table_args__ = (
        Index('idx_rules_user', 'user_id'),
        Index('idx_rules_enabled', 'user_id', 'enabled'),
    )


class RuleItem(BaseModel):
    """규칙 항목"""
    __tablename__ = "rule_items"
    
    rule_id = Column(String(36), ForeignKey("rules.id", ondelete="CASCADE"), nullable=False, index=True)
    text = Column(String(255), nullable=False)
    template_type = Column(String(50))  # checklist_item, reminder, note
    order_index = Column(Integer)
    
    # 관계
    rule = relationship("Rule", back_populates="rule_items")


class Receipt(BaseModel):
    """영수증 OCR"""
    __tablename__ = "receipts"
    
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    image_path = Column(String(500))
    image_url = Column(String(500))
    
    vendor = Column(String(255))
    purchase_date = Column(Date, index=True)
    amount = Column(Numeric(10, 2))
    currency = Column(String(10), default="KRW")
    
    payment_type = Column(String(50))  # cash, card, mobile
    card_brand = Column(String(100))
    
    category = Column(String(50), index=True)
    purpose = Column(String(255))
    tags = Column(Text)  # JSON 배열
    
    raw_ocr_text = Column(Text)
    processing_backend = Column(String(50))  # tesseract, claude, google
    confidence_score = Column(Numeric(3, 2))
    
    items = Column(Text)  # JSON
    notes = Column(Text)
    
    is_verified = Column(Boolean, default=False)
    
    # 관계
    user = relationship("User", back_populates="receipts")
    
    __table_args__ = (
        Index('idx_receipts_user_date', 'user_id', 'purchase_date'),
        Index('idx_receipts_category', 'user_id', 'category'),
    )


class Notification(BaseModel):
    """알림"""
    __tablename__ = "notifications"
    
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    todo_id = Column(String(36), ForeignKey("todos.id", ondelete="SET NULL"))
    family_member_id = Column(String(36), ForeignKey("family_members.id"))
    
    type = Column(String(50), nullable=False)  # reminder, milestone, shared, community
    title = Column(String(255), nullable=False)
    message = Column(Text)
    action_url = Column(String(500))
    
    scheduled_time = Column(DateTime)
    sent_at = Column(DateTime)
    read_at = Column(DateTime, index=True)
    
    channels = Column(Text)  # JSON: ["push", "email", "in-app"]
    
    # 관계
    user = relationship("User", back_populates="notifications")
    
    __table_args__ = (
        Index('idx_notifications_user', 'user_id'),
        Index('idx_notifications_user_read', 'user_id', 'read_at'),
    )


class Memo(BaseModel):
    """메모 (OCR 텍스트)"""
    __tablename__ = "memos"
    
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    content = Column(Text, nullable=False)
    image_path = Column(String(500))
    image_url = Column(String(500))
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # 관계
    user = relationship("User", back_populates="memos")
    
    __table_args__ = (
        Index('idx_memos_user', 'user_id'),
        Index('idx_memos_created_at', 'created_at'),
    )


class Routine(BaseModel):
    """시간표/루틴"""
    __tablename__ = "routines"
    
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    member_id = Column(String(36), ForeignKey("family_members.id", ondelete="SET NULL"), index=True)
    
    name = Column(String(255), nullable=False)
    color = Column(String(50))
    category = Column(String(50))
    memo = Column(Text)
    
    # 시간표 슬롯 (JSON 형식으로 저장)
    # 예: [{"day": 1, "startTime": "09:00", "duration": 60}, ...]
    time_slots = Column(Text, nullable=False)  # JSON 배열
    
    # 캘린더 연동 여부
    add_to_calendar = Column(Boolean, default=False)
    
    # 관계
    user = relationship("User", back_populates="routines")
    member = relationship("FamilyMember")
    
    __table_args__ = (
        Index('idx_routines_user', 'user_id'),
        Index('idx_routines_member', 'member_id'),
    )


class AudioFile(BaseModel):
    """녹음 파일"""
    __tablename__ = "audio_files"
    
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    todo_id = Column(String(36), ForeignKey("todos.id", ondelete="SET NULL"), index=True)
    
    file_path = Column(String(500), nullable=False)
    file_url = Column(String(500))
    file_name = Column(String(255))
    file_size = Column(Integer)  # bytes
    mime_type = Column(String(100))
    
    transcribed_text = Column(Text)  # STT로 변환된 텍스트
    
    # 관계
    user = relationship("User", back_populates="audio_files")
    todo = relationship("Todo")
    
    __table_args__ = (
        Index('idx_audio_files_user', 'user_id'),
        Index('idx_audio_files_todo', 'todo_id'),
    )


class ImageFile(BaseModel):
    """이미지 파일 (사진)"""
    __tablename__ = "image_files"
    
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    todo_id = Column(String(36), ForeignKey("todos.id", ondelete="SET NULL"), index=True)
    memo_id = Column(String(36), ForeignKey("memos.id", ondelete="SET NULL"), index=True)
    
    file_path = Column(String(500), nullable=False)
    file_url = Column(String(500))
    file_name = Column(String(255))
    file_size = Column(Integer)  # bytes
    mime_type = Column(String(100))
    
    extracted_text = Column(Text)  # OCR로 추출된 텍스트
    
    # 관계
    user = relationship("User", back_populates="image_files")
    todo = relationship("Todo")
    memo = relationship("Memo")
    
    __table_args__ = (
        Index('idx_image_files_user', 'user_id'),
        Index('idx_image_files_todo', 'todo_id'),
    )
