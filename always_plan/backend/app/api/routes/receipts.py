"""
Receipt OCR endpoints for expense tracking
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime
import json

from app.database import get_db
from app.models.models import Receipt
from app.models.user import User
from app.schemas import ReceiptCreate, ReceiptResponse, ReceiptStatsResponse
from app.services.ai_service import ClaudeOCRService, TesseractOCRService
from app.api.routes.auth import get_current_user

router = APIRouter(
    prefix="/receipts",
    tags=["receipts"],
    dependencies=[Depends(get_current_user)]
)

claude_ocr = ClaudeOCRService()
tesseract_ocr = TesseractOCRService()


@router.get("/", response_model=List[ReceiptResponse])
async def get_receipts(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all receipts for current user"""
    return db.query(Receipt).filter(
        Receipt.user_id == current_user.id,
        Receipt.deleted_at.is_(None)
    ).offset(skip).limit(limit).all()


@router.get("/stats", response_model=ReceiptStatsResponse)
async def get_receipt_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get receipt statistics"""
    receipts = db.query(Receipt).filter(
        Receipt.user_id == current_user.id,
        Receipt.deleted_at.is_(None)
    ).all()
    
    total_amount = sum(r.amount for r in receipts) if receipts else 0.0
    total_count = len(receipts)
    
    payment_types = {}
    for r in receipts:
        payment_types[r.payment_type] = payment_types.get(r.payment_type, 0) + 1
    
    return {
        "total_amount": total_amount,
        "total_count": total_count,
        "average_amount": total_amount / total_count if total_count > 0 else 0,
        "payment_types": payment_types
    }


@router.get("/{receipt_id}", response_model=ReceiptResponse)
async def get_receipt(
    receipt_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get specific receipt"""
    receipt = db.query(Receipt).filter(
        Receipt.id == receipt_id,
        Receipt.user_id == current_user.id,
        Receipt.deleted_at.is_(None)
    ).first()
    
    if not receipt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="영수증을 찾을 수 없습니다"
        )
    
    return receipt


@router.post("/ocr", response_model=ReceiptResponse, status_code=status.HTTP_201_CREATED)
async def upload_and_process_receipt(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Upload receipt image and extract data via OCR"""
    
    # Read file content
    content = await file.read()
    
    # Try Claude first, fallback to Tesseract
    try:
        ocr_result = await claude_ocr.extract_receipt_data(content)
    except Exception as e:
        print(f"Claude OCR failed: {e}, falling back to Tesseract")
        try:
            ocr_result = await tesseract_ocr.extract_receipt_data(content)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"OCR 처리 실패: {str(e)}"
            )
    
    # Create receipt record
    db_receipt = Receipt(
        user_id=current_user.id,
        vendor=ocr_result.get("vendor", "Unknown"),
        amount=float(ocr_result.get("total_amount", 0)),
        payment_type=ocr_result.get("payment_type", "cash"),
        items=ocr_result.get("items", []),
        confidence_score=ocr_result.get("confidence_score", 0.0),
        original_filename=file.filename,
        ocr_metadata=ocr_result
    )
    
    db.add(db_receipt)
    db.commit()
    db.refresh(db_receipt)
    
    return db_receipt


@router.post("/", response_model=ReceiptResponse, status_code=status.HTTP_201_CREATED)
async def create_receipt(
    receipt: ReceiptCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create receipt manually"""
    db_receipt = Receipt(
        user_id=current_user.id,
        vendor=receipt.vendor,
        amount=receipt.amount,
        payment_type=receipt.payment_type,
        items=receipt.items or [],
        confidence_score=1.0
    )
    
    db.add(db_receipt)
    db.commit()
    db.refresh(db_receipt)
    
    return db_receipt


@router.put("/{receipt_id}", response_model=ReceiptResponse)
async def update_receipt(
    receipt_id: str,
    receipt_update: ReceiptCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update receipt"""
    receipt = db.query(Receipt).filter(
        Receipt.id == receipt_id,
        Receipt.user_id == current_user.id,
        Receipt.deleted_at.is_(None)
    ).first()
    
    if not receipt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="영수증을 찾을 수 없습니다"
        )
    
    receipt.vendor = receipt_update.vendor
    receipt.amount = receipt_update.amount
    receipt.payment_type = receipt_update.payment_type
    receipt.items = receipt_update.items or receipt.items
    receipt.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(receipt)
    
    return receipt


@router.delete("/{receipt_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_receipt(
    receipt_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Soft delete receipt"""
    receipt = db.query(Receipt).filter(
        Receipt.id == receipt_id,
        Receipt.user_id == current_user.id,
        Receipt.deleted_at.is_(None)
    ).first()
    
    if not receipt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="영수증을 찾을 수 없습니다"
        )
    
    receipt.deleted_at = datetime.utcnow()
    db.commit()
