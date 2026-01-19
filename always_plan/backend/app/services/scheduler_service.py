"""
알림 스케줄러 서비스
주기적으로 알림 이메일을 발송합니다.
"""
import asyncio
import logging
from datetime import datetime
from sqlalchemy.orm import Session
from app.database import get_db
from app.api.routes.notifications import send_scheduled_emails

logger = logging.getLogger(__name__)


class NotificationScheduler:
    """알림 스케줄러"""
    
    def __init__(self, interval_minutes: int = 5):
        """
        Args:
            interval_minutes: 알림 확인 간격 (분)
        """
        self.interval_minutes = interval_minutes
        self.is_running = False
        self.task = None
    
    async def start(self):
        """스케줄러 시작"""
        if self.is_running:
            logger.warning("[SCHEDULER] 스케줄러가 이미 실행 중입니다.")
            return
        
        self.is_running = True
        logger.info(f"[SCHEDULER] 알림 스케줄러 시작 (간격: {self.interval_minutes}분)")
        
        # 백그라운드 태스크로 실행
        self.task = asyncio.create_task(self._run_loop())
    
    async def stop(self):
        """스케줄러 중지"""
        if not self.is_running:
            return
        
        self.is_running = False
        if self.task:
            self.task.cancel()
            try:
                await self.task
            except asyncio.CancelledError:
                pass
        
        logger.info("[SCHEDULER] 알림 스케줄러 중지")
    
    async def _run_loop(self):
        """스케줄러 루프"""
        while self.is_running:
            try:
                # 데이터베이스 세션 생성
                db = next(get_db())
                try:
                    # 예정된 알림 이메일 발송
                    send_scheduled_emails(db)
                finally:
                    db.close()
                
                # 다음 실행까지 대기
                await asyncio.sleep(self.interval_minutes * 60)
                
            except asyncio.CancelledError:
                logger.info("[SCHEDULER] 스케줄러 취소됨")
                break
            except Exception as e:
                logger.error(f"[SCHEDULER] 스케줄러 오류: {e}", exc_info=True)
                # 오류 발생 시에도 계속 실행 (다음 주기에서 재시도)
                await asyncio.sleep(self.interval_minutes * 60)


# 전역 스케줄러 인스턴스
scheduler = NotificationScheduler(interval_minutes=1)

