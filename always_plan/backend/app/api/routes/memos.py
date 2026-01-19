from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile
from sqlalchemy.orm import Session
from datetime import datetime
import shutil
import os
import uuid

from app.database import get_db
from app.models.models import Memo
from app.models.user import User
from app.api.routes.auth import get_current_user
from app.services.ai_service import ClaudeOCRService, TesseractOCRService

router = APIRouter(
    prefix="/memos",
    tags=["memos"],
    dependencies=[Depends(get_current_user)]
)

claude_ocr = ClaudeOCRService()
tesseract_ocr = TesseractOCRService()

UPLOAD_DIR = "uploads/memos"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_memo_from_image(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    이미지를 업로드하여 OCR로 텍스트를 추출하고 메모로 저장합니다.
    """
    try:
        # 1. 이미지 파일 저장
        file_ext = file.filename.split('.')[-1]
        filename = f"{datetime.now().strftime('%Y%m%d%H%M%S')}_{uuid.uuid4().hex[:8]}.{file_ext}"
        file_path = os.path.join(UPLOAD_DIR, filename)
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # 2. OCR 실행 (기본적으로 Tesseract 사용, 필요시 Claude로 변경 가능)
        # 이미지 파일을 다시 읽기 위해 open
        with open(file_path, "rb") as image_file:
            content = image_file.read()
            
        # 비용 절감을 위해 기본은 Tesseract 사용 (정확도 필요시 Claude 사용 고려)
        # 사용자의 요청: "촬영 후 이미지는 바로 저장" -> 속도가 중요할 수 있음
        try:
            ocr_result = await tesseract_ocr.extract_text(content)
            extracted_text = ocr_result["text"]
            if not extracted_text.strip():
                extracted_text = "(텍스트를 추출할 수 없습니다)"
        except Exception as e:
            print(f"OCR Error: {e}")
            extracted_text = "(OCR 처리 중 오류 발생)"

        # 3. DB 저장
        new_memo = Memo(
            user_id=current_user.id,
            content=extracted_text,
            image_path=file_path,
            image_url=f"/static/memos/{filename}" # 정적 파일 서빙 필요 시 설정
        )
        
        db.add(new_memo)
        db.commit()
        db.refresh(new_memo)
        
        return new_memo

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"메모 저장 실패: {str(e)}"
        )

@router.get("/", response_model=List[dict])
def get_memos(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """사용자의 메모 목록 조회"""
    memos = db.query(Memo).filter(Memo.user_id == current_user.id)\
        .order_by(Memo.created_at.desc())\
        .offset(skip).limit(limit).all()
        
    return [
        {
            "id": memo.id,
            "content": memo.content,
            "image_url": memo.image_path, # 임시로 로컬 경로 반환 (실제로는 URL 변환 필요)
            "created_at": memo.created_at
        }
        for memo in memos
    ]
