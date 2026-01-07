"""
Pydantic 스키마 (데이터 검증)
"""
from pydantic import BaseModel, EmailStr, field_validator, model_validator
from typing import Optional, List, Union, Any
from datetime import datetime, date
from decimal import Decimal


# ==================== User ==================== 

class UserBase(BaseModel):
    """사용자 기본 스키마"""
    email: EmailStr
    name: str
    avatar_emoji: str = "🐼"


class UserCreate(UserBase):
    """사용자 생성"""
    google_id: Optional[str] = None


class UserUpdate(BaseModel):
    """사용자 수정"""
    name: Optional[str] = None
    avatar_emoji: Optional[str] = None


class UserResponse(UserBase):
    """사용자 응답"""
    id: str
    google_id: Optional[str] = None
    last_login: Optional[datetime] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


# ==================== Todo ==================== 

class TodoBase(BaseModel):
    """할일 기본 스키마"""
    title: str
    description: Optional[str] = None
    date: date  # Pydantic v2가 자동으로 문자열을 date로 변환
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    all_day: bool = False
    category: Optional[str] = None
    priority: str = "medium"
    status: str = "pending"
    location: Optional[str] = None
    memo: Optional[str] = None
    repeat_type: Optional[str] = "none"  # none, daily, weekly, monthly, yearly
    repeat_end_date: Optional[date] = None
    repeat_days: Optional[str] = None
    has_notification: bool = False
    notification_times: Optional[List[str]] = None
    family_member_ids: Optional[List[str]] = None
    checklist_items: Optional[List[str]] = None
    
    # Pydantic v2 설정
    model_config = {
        "json_encoders": {
            date: lambda v: v.isoformat() if v else None
        },
        "json_schema_extra": {
            "examples": [
                {
                    "title": "새 일정",
                    "date": "2024-01-15",
                    "start_time": "09:00",
                    "end_time": "10:00"
                }
            ]
        }
    }


class TodoCreate(TodoBase):
    """할일 생성"""
    pass


class TodoUpdate(BaseModel):
    """할일 수정"""
    title: Optional[str] = None
    description: Optional[str] = None
    date: Optional[str] = None  # 문자열로 받아서 엔드포인트에서 변환
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    all_day: Optional[bool] = None
    category: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    location: Optional[str] = None
    memo: Optional[str] = None
    repeat_type: Optional[str] = None
    repeat_end_date: Optional[str] = None  # 문자열로 받아서 엔드포인트에서 변환
    repeat_days: Optional[str] = None
    has_notification: Optional[bool] = None
    notification_times: Optional[List[str]] = None
    family_member_ids: Optional[List[str]] = None
    checklist_items: Optional[List[str]] = None


class TodoResponse(TodoBase):
    """할일 응답"""
    id: str
    user_id: str
    created_at: datetime
    
    class Config:
        from_attributes = True


# ==================== Receipt ==================== 

class ReceiptBase(BaseModel):
    """영수증 기본 스키마"""
    vendor: str
    purchase_date: date
    amount: Decimal
    payment_type: str  # cash, card, mobile
    card_brand: Optional[str] = None
    category: Optional[str] = None


class ReceiptCreate(ReceiptBase):
    """영수증 생성"""
    image_path: Optional[str] = None
    raw_ocr_text: Optional[str] = None
    confidence_score: Optional[float] = None


class ReceiptResponse(ReceiptBase):
    """영수증 응답"""
    id: str
    user_id: str
    created_at: datetime
    is_verified: bool = False
    
    class Config:
        from_attributes = True


# ==================== Auth ==================== 

class GoogleLoginRequest(BaseModel):
    """
    Google 로그인 요청 (Main_PJ2 패턴 적용)
    
    두 가지 방식 지원:
    1. Authorization Code Flow (권장):
       - code: 인증 서버에서 받은 인증 코드
       - state: CSRF 방지 토큰
    
    2. Implicit Flow (테스트):
       - id_token: 직접 Google ID 토큰
       - state: CSRF 방지 토큰
    """
    code: Optional[str] = None  # Authorization Code Flow
    id_token: Optional[str] = None  # Implicit Flow
    state: str  # CSRF 방지


class AuthTokenResponse(BaseModel):
    """인증 토큰 응답"""
    access_token: str
    refresh_token: str
    token_type: str = "Bearer"
    expires_in: int


class RefreshTokenRequest(BaseModel):
    """토큰 갱신 요청"""
    refresh_token: str


# ==================== STT ==================== 

class STTRequest(BaseModel):
    """STT 요청"""
    context: str = "todo"  # todo, event, memo


class STTResponse(BaseModel):
    """STT 응답"""
    text: str
    date: Optional[date] = None
    time: Optional[str] = None
    amount: Optional[float] = None
    category: Optional[str] = None
    confidence: float = 0.95


# ==================== OCR ==================== 

class OCRRequest(BaseModel):
    """OCR 요청"""
    context: str = "receipt"


class OCRResponse(BaseModel):
    """OCR 텍스트 추출 응답"""
    text: str
    language: Optional[str] = "unknown"
    confidence: float = 0.0
    method: Optional[str] = None
    timestamp: Optional[str] = None


class OCRReceiptResponse(BaseModel):
    """OCR 영수증 추출 응답"""
    vendor: Optional[str] = None
    amount: Optional[float] = None
    date: Optional[date] = None
    payment_type: Optional[str] = None
    card_brand: Optional[str] = None
    confidence: float = 0.95

# ==================== Family ==================== 

class FamilyMemberCreate(BaseModel):
    """가족 구성원 생성"""
    name: str
    emoji: str
    color: Optional[str] = None
    relation: Optional[str] = None  # self, spouse, child, parent, other


class FamilyMemberResponse(FamilyMemberCreate):
    """가족 구성원 응답"""
    id: str
    user_id: str
    created_at: datetime
    
    class Config:
        from_attributes = True


# ==================== Statistics ==================== 

class TodoStatsResponse(BaseModel):
    """할일 통계"""
    total: int
    completed: int
    pending: int
    overdue: int
    completion_rate: float


class ReceiptStatsResponse(BaseModel):
    """영수증 통계"""
    total_amount: float
    total_count: int
    average_amount: float
    payment_types: dict


# ==================== Routine ==================== 

class RoutineTimeSlot(BaseModel):
    """시간표 시간 슬롯"""
    day: int  # 0(일) ~ 6(토)
    startTime: str  # "HH:MM"
    duration: int  # 분 단위


class RoutineBase(BaseModel):
    """시간표 기본 스키마"""
    name: str
    member_id: str
    color: Optional[str] = None
    category: Optional[str] = None
    memo: Optional[str] = None
    time_slots: List[RoutineTimeSlot]
    add_to_calendar: bool = False


class RoutineCreate(RoutineBase):
    """시간표 생성"""
    pass


class RoutineUpdate(BaseModel):
    """시간표 수정"""
    name: Optional[str] = None
    member_id: Optional[str] = None
    color: Optional[str] = None
    category: Optional[str] = None
    memo: Optional[str] = None
    time_slots: Optional[List[RoutineTimeSlot]] = None
    add_to_calendar: Optional[bool] = None


class RoutineResponse(RoutineBase):
    """시간표 응답"""
    id: str
    user_id: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True