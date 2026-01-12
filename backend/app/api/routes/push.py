"""
웹 푸시 구독 관련 엔드포인트
"""
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from app.database import get_db
from app.models.models import PushSubscription
from app.models.user import User
from app.api.routes.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/push",
    tags=["push"],
    dependencies=[Depends(get_current_user)]
)


class PushSubscriptionCreate(BaseModel):
    """푸시 구독 생성 요청"""
    endpoint: str
    p256dh: str
    auth: str


class PushSubscriptionResponse(BaseModel):
    """푸시 구독 응답"""
    id: str
    endpoint: str
    
    class Config:
        from_attributes = True


@router.post("/subscribe", response_model=PushSubscriptionResponse)
async def subscribe_push(
    subscription: PushSubscriptionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    웹 푸시 구독 등록
    """
    try:
        # 기존 구독 확인 (같은 endpoint가 있으면 업데이트)
        existing = db.query(PushSubscription).filter(
            PushSubscription.user_id == current_user.id,
            PushSubscription.endpoint == subscription.endpoint
        ).first()
        
        if existing:
            # 기존 구독 업데이트
            existing.p256dh = subscription.p256dh
            existing.auth = subscription.auth
            db.commit()
            db.refresh(existing)
            logger.info(f"[PUSH] 구독 업데이트: user_id={current_user.id}, endpoint={subscription.endpoint[:50]}...")
            return PushSubscriptionResponse(id=existing.id, endpoint=existing.endpoint)
        else:
            # 새 구독 생성
            push_subscription = PushSubscription(
                user_id=current_user.id,
                endpoint=subscription.endpoint,
                p256dh=subscription.p256dh,
                auth=subscription.auth
            )
            db.add(push_subscription)
            db.commit()
            db.refresh(push_subscription)
            logger.info(f"[PUSH] 구독 생성: user_id={current_user.id}, endpoint={subscription.endpoint[:50]}...")
            return PushSubscriptionResponse(id=push_subscription.id, endpoint=push_subscription.endpoint)
            
    except Exception as e:
        logger.error(f"[PUSH] 구독 등록 실패: {e}", exc_info=True)
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"구독 등록 실패: {str(e)}"
        )


@router.delete("/unsubscribe")
async def unsubscribe_push(
    endpoint: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    웹 푸시 구독 해제
    """
    try:
        subscription = db.query(PushSubscription).filter(
            PushSubscription.user_id == current_user.id,
            PushSubscription.endpoint == endpoint
        ).first()
        
        if subscription:
            db.delete(subscription)
            db.commit()
            logger.info(f"[PUSH] 구독 해제: user_id={current_user.id}, endpoint={endpoint[:50]}...")
            return {"success": True, "message": "구독이 해제되었습니다."}
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="구독을 찾을 수 없습니다."
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[PUSH] 구독 해제 실패: {e}", exc_info=True)
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"구독 해제 실패: {str(e)}"
        )


@router.get("/public-key")
async def get_public_key():
    """
    VAPID 공개 키 조회 (프론트엔드에서 사용)
    """
    from app.config import settings
    public_key = settings.vapid_public_key if hasattr(settings, 'vapid_public_key') else ""
    
    if not public_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="푸시 알림이 설정되지 않았습니다."
        )
    
    return {"publicKey": public_key}

