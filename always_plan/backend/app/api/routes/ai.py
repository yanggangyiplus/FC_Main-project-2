"""
STT and AI processing endpoints
"""
from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session
from datetime import datetime
import logging

from app.database import get_db
from app.models.user import User
from app.models.models import FamilyMember
from app.schemas import STTResponse, OCRResponse, OCRReceiptResponse
from app.services.ai_service import GeminiSTTService, GeminiOCRService, ClaudeOCRService, TesseractOCRService
from app.api.routes.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/ai",
    tags=["ai"],
    dependencies=[Depends(get_current_user)]
)

gemini_stt = GeminiSTTService()
gemini_ocr = GeminiOCRService()
claude_ocr = ClaudeOCRService()
tesseract_ocr = TesseractOCRService()


@router.post("/stt/transcribe", response_model=STTResponse)
async def transcribe_audio(
    file: UploadFile = File(...),
    language: str = "ko-KR",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Transcribe audio file to text using Google Gemini STT
    
    Supported formats: MP3, WAV, OGG, FLAC, AIFF, PCM
    """
    
    try:
        # Read file content
        content = await file.read()
        
        # Get MIME type
        mime_types = {
            "mp3": "audio/mpeg",
            "wav": "audio/wav",
            "ogg": "audio/ogg",
            "flac": "audio/flac",
            "aiff": "audio/aiff",
            "pcm": "audio/pcm"
        }
        
        file_ext = file.filename.split('.')[-1].lower()
        mime_type = mime_types.get(file_ext, "audio/mpeg")
        
        # Call Gemini API
        result = await gemini_stt.transcribe(
            audio_data=content,
            mime_type=mime_type,
            language=language
        )
        
        return {
            "text": result["text"],
            "language": language,
            "confidence": result.get("confidence", 0.95),
            "duration": result.get("duration", 0),
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"STT 처리 실패: {str(e)}"
        )


@router.post("/ocr/extract-text", response_model=OCRResponse)
async def extract_text_from_image(
    file: UploadFile = File(...),
    method: str = "gemini",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Extract text from image using Gemini Vision, Claude Vision, or Tesseract OCR
    
    Methods:
    - gemini: Google Gemini Vision (recommended, requires API key)
    - claude: Claude Vision (requires API key)
    - tesseract: Local fallback (60-70% accuracy)
    """
    
    try:
        content = await file.read()
        logger.info(f"[OCR] 이미지 수신: {len(content)} bytes, content_type: {file.content_type}, method: {method}")
        
        # MIME 타입 결정
        mime_type = file.content_type or 'image/jpeg'
        if not mime_type.startswith('image/'):
            mime_type = 'image/jpeg'
        
        logger.info(f"[OCR] MIME 타입: {mime_type}")
        
        if method == "gemini":
            logger.info("[OCR] Gemini Vision OCR 호출 시작...")
            result = await gemini_ocr.extract_text(content, mime_type)
            logger.info(f"[OCR] Gemini Vision OCR 호출 완료: success={result.get('success')}")
        elif method == "claude":
            logger.info("[OCR] Claude Vision OCR 호출 시작...")
            result = await claude_ocr.extract_text(content)
            logger.info(f"[OCR] Claude Vision OCR 호출 완료: success={result.get('success')}")
        else:
            logger.info("[OCR] Tesseract OCR 호출 시작...")
            result = await tesseract_ocr.extract_text(content)
            logger.info(f"[OCR] Tesseract OCR 호출 완료: success={result.get('success')}")
        
        logger.info(f"OCR 서비스 결과: {result}")
        logger.info(f"OCR 결과 타입: {type(result)}")
        logger.info(f"OCR 결과 keys: {result.keys() if isinstance(result, dict) else 'not dict'}")
        
        if not result.get('success', False):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"OCR 처리 실패: {result.get('error', 'Unknown error')}"
            )
        
        # result에서 text 추출
        extracted_text = result.get("text", "")
        logger.info(f"OCR 추출된 텍스트 (처음 100자): {extracted_text[:100] if extracted_text else 'empty'}")
        logger.info(f"OCR 추출된 텍스트 길이: {len(extracted_text) if extracted_text else 0}")
        
        response_data = {
            "text": extracted_text,
            "language": result.get("language", "unknown"),
            "confidence": result.get("confidence", 0.0),
            "method": method,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        logger.info(f"OCR 응답 데이터: {response_data}")
        
        return response_data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"OCR 처리 중 오류 발생: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"OCR 처리 실패: {str(e)}"
        )


@router.post("/ocr/extract-receipt")
async def extract_receipt_data(
    file: UploadFile = File(...),
    method: str = "claude",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Extract receipt data (vendor, amount, items) from image
    
    Returns:
    - vendor: Store/restaurant name
    - total_amount: Total cost
    - items: List of purchased items with prices
    - payment_type: cash, card, etc
    - confidence_score: 0.0 to 1.0
    """
    
    try:
        content = await file.read()
        
        if method == "claude":
            result = await claude_ocr.extract_receipt_data(content)
        else:
            result = await tesseract_ocr.extract_receipt_data(content)
        
        return {
            "vendor": result.get("vendor", "Unknown"),
            "total_amount": result.get("total_amount", 0.0),
            "items": result.get("items", []),
            "payment_type": result.get("payment_type", "cash"),
            "confidence_score": result.get("confidence_score", 0.0),
            "method": method,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"영수증 OCR 처리 실패: {str(e)}"
        )


@router.post("/ocr/extract-contact")
async def extract_contact_data(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Extract contact information (name, phone, email) from business card or document
    """
    
    try:
        content = await file.read()
        
        result = await claude_ocr.extract_contact_data(content)
        
        return {
            "name": result.get("name"),
            "phone": result.get("phone"),
            "email": result.get("email"),
            "company": result.get("company"),
            "position": result.get("position"),
            "confidence_score": result.get("confidence_score", 0.0),
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"연락처 추출 실패: {str(e)}"
        )


class TodoExtractionRequest(BaseModel):
    """일정 정보 추출 요청"""
    text: str


@router.post("/todo/extract")
async def extract_todo_info(
    request: TodoExtractionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    텍스트에서 일정 정보를 추출 (LLM 사용)
    
    추출 항목:
    - title: 일정 제목
    - date: 날짜 (YYYY-MM-DD, 언급 없으면 오늘)
    - start_time: 시작 시간 (HH:MM, 없으면 null)
    - end_time: 종료 시간 (HH:MM, 없으면 null)
    - all_day: 하루종일 여부
    - category: 카테고리 (언급 없으면 자동 분류)
    - checklist: 체크리스트 항목 (2-5개)
    - location: 장소
    - memo: 원본 텍스트
    - repeat_type: 반복 설정
    - has_notification: 알림 설정
    - notification_times: 알림 시간 배열
    """
    try:
        # 가족 구성원 정보 조회 (담당 프로필 이름 매칭용)
        family_members = db.query(FamilyMember).filter(
            FamilyMember.user_id == current_user.id,
            FamilyMember.deleted_at.is_(None)
        ).all()
        
        # 가족 구성원 이름 목록 생성 (나, 사용자 이름 포함)
        member_names = []
        if current_user.name:
            member_names.append(current_user.name)
        member_names.append("나")
        for member in family_members:
            if member.name:
                member_names.append(member.name)
        
        # AI 서비스에 가족 구성원 이름 목록 전달
        result = await gemini_stt.extract_todo_info(request.text, member_names=member_names, family_members=[{"id": member.id, "name": member.name} for member in family_members])
        
        if not result.get('success'):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=result.get('error', '일정 정보 추출 실패')
            )
        
        return {
            "title": result.get("title", ""),
            "date": result.get("date"),
            "end_date": result.get("end_date", result.get("date")),  # 종료 날짜 (없으면 시작 날짜와 동일)
            "start_time": result.get("start_time"),
            "end_time": result.get("end_time"),
            "all_day": result.get("all_day", False),
            "category": result.get("category", "기타"),
            "checklist": result.get("checklist", []),
            "location": result.get("location", ""),
            "memo": result.get("memo", request.text),
            "repeat_type": result.get("repeat_type", "none"),
            "repeat_end_date": result.get("repeat_end_date"),
            "repeat_pattern": result.get("repeat_pattern"),
            "has_notification": result.get("has_notification", False),
            "notification_times": result.get("notification_times", []),
            "notification_reminders": result.get("notification_reminders", []),  # 새로운 알림 형식
            "assigned_member_ids": result.get("assigned_member_ids", []),  # 담당 프로필 ID 목록
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"일정 정보 추출 실패: {str(e)}"
        )


@router.get("/health")
async def ai_health_check(
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Check AI services health status"""
    
    return {
        "stt": {
            "service": "Gemini STT",
            "status": "available",
            "languages": ["ko-KR", "en-US", "ja-JP", "zh-CN"]
        },
        "ocr": {
            "primary": {
                "service": "Claude Vision",
                "status": "available"
            },
            "fallback": {
                "service": "Tesseract",
                "status": "available",
                "accuracy": "60-70%"
            }
        },
        "timestamp": datetime.utcnow().isoformat()
    }
