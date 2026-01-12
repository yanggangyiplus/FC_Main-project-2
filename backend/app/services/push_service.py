"""
웹 푸시 알림 서비스
"""
import json
import logging
from typing import Dict, Optional
from pywebpush import webpush, WebPushException
from app.config import settings

logger = logging.getLogger(__name__)


class PushService:
    """웹 푸시 알림 서비스"""
    
    def __init__(self):
        """VAPID 키 초기화"""
        self.vapid_private_key = settings.vapid_private_key if hasattr(settings, 'vapid_private_key') else None
        self.vapid_public_key = settings.vapid_public_key if hasattr(settings, 'vapid_public_key') else None
        self.vapid_email = settings.vapid_email if hasattr(settings, 'vapid_email') else None
    
    def send_notification(
        self,
        subscription_info: Dict,
        title: str,
        body: str,
        data: Optional[Dict] = None
    ) -> bool:
        """
        푸시 알림 발송
        
        Args:
            subscription_info: 구독 정보 (endpoint, keys: {p256dh, auth})
            title: 알림 제목
            body: 알림 본문
            data: 추가 데이터 (선택사항)
        
        Returns:
            발송 성공 여부
        """
        if not self.vapid_private_key or not self.vapid_public_key:
            logger.warning("[PUSH] VAPID 키가 설정되지 않았습니다.")
            return False
        
        try:
            subscription = {
                "endpoint": subscription_info["endpoint"],
                "keys": {
                    "p256dh": subscription_info["p256dh"],
                    "auth": subscription_info["auth"]
                }
            }
            
            payload = {
                "title": title,
                "body": body,
                "icon": "/icon-192x192.png",  # 기본 아이콘
                "badge": "/icon-192x192.png",
                "data": data or {}
            }
            
            webpush(
                subscription_info=subscription,
                data=json.dumps(payload),
                vapid_private_key=self.vapid_private_key,
                vapid_claims={
                    "sub": f"mailto:{self.vapid_email}" if self.vapid_email else "mailto:admin@always-plan.com"
                }
            )
            
            logger.info(f"[PUSH] 푸시 알림 발송 성공: {title}")
            return True
            
        except WebPushException as e:
            logger.error(f"[PUSH] 푸시 알림 발송 실패: {e}")
            # 구독이 만료되었거나 유효하지 않은 경우
            if e.response and e.response.status_code == 410:
                logger.warning("[PUSH] 구독이 만료되었습니다.")
            return False
        except Exception as e:
            logger.error(f"[PUSH] 푸시 알림 발송 중 오류: {e}", exc_info=True)
            return False


# 전역 푸시 서비스 인스턴스
push_service = PushService()

