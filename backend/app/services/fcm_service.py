"""
FCM (Firebase Cloud Messaging) 웹 푸시 알림 서비스
"""
import json
import logging
import os
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)

# Firebase Admin SDK 초기화 상태
_firebase_initialized = False


def initialize_firebase():
    """Firebase Admin SDK 초기화"""
    global _firebase_initialized

    if _firebase_initialized:
        return True

    try:
        import firebase_admin
        from firebase_admin import credentials

        # 이미 초기화되어 있는지 확인
        try:
            firebase_admin.get_app()
            _firebase_initialized = True
            return True
        except ValueError:
            pass  # 앱이 없음, 초기화 필요

        # 서비스 계정 키 경로 또는 환경변수
        service_account_path = os.getenv('FIREBASE_SERVICE_ACCOUNT_PATH')
        service_account_json = os.getenv('FIREBASE_SERVICE_ACCOUNT_JSON')

        if service_account_json:
            # 환경변수에서 JSON 문자열로 제공된 경우
            cred_dict = json.loads(service_account_json)
            cred = credentials.Certificate(cred_dict)
        elif service_account_path and os.path.exists(service_account_path):
            # 파일 경로로 제공된 경우
            cred = credentials.Certificate(service_account_path)
        else:
            # 기본 경로 시도
            default_paths = [
                '/app/firebase-service-account.json',
                './firebase-service-account.json',
                '../firebase-service-account.json'
            ]
            cred = None
            for path in default_paths:
                if os.path.exists(path):
                    cred = credentials.Certificate(path)
                    break

            if not cred:
                logger.warning("[FCM] Firebase 서비스 계정 키를 찾을 수 없습니다. 웹 푸시 알림이 비활성화됩니다.")
                return False

        firebase_admin.initialize_app(cred)
        _firebase_initialized = True
        logger.info("[FCM] Firebase Admin SDK 초기화 완료")
        return True

    except Exception as e:
        logger.error(f"[FCM] Firebase 초기화 실패: {e}", exc_info=True)
        return False


class FCMService:
    """Firebase Cloud Messaging 서비스"""

    @staticmethod
    async def send_push_notification(
        token: str,
        title: str,
        body: str,
        data: Optional[Dict[str, str]] = None,
        icon: Optional[str] = None,
        click_action: Optional[str] = None
    ) -> bool:
        """
        웹 푸시 알림 발송

        Args:
            token: FCM 토큰 (프론트엔드에서 받은 토큰)
            title: 알림 제목
            body: 알림 내용
            data: 추가 데이터 (선택)
            icon: 알림 아이콘 URL (선택)
            click_action: 클릭 시 이동할 URL (선택)

        Returns:
            성공 시 True, 실패 시 False
        """
        if not initialize_firebase():
            logger.warning("[FCM] Firebase가 초기화되지 않아 푸시 알림을 보낼 수 없습니다.")
            return False

        try:
            from firebase_admin import messaging

            # 웹 푸시 설정
            webpush_config = messaging.WebpushConfig(
                notification=messaging.WebpushNotification(
                    title=title,
                    body=body,
                    icon=icon or '/icons/icon-192x192.png',
                ),
                fcm_options=messaging.WebpushFCMOptions(
                    link=click_action or '/'
                )
            )

            # 메시지 생성
            message = messaging.Message(
                notification=messaging.Notification(
                    title=title,
                    body=body
                ),
                data=data or {},
                token=token,
                webpush=webpush_config
            )

            # 메시지 발송
            response = messaging.send(message)
            logger.info(f"[FCM] 푸시 알림 발송 성공: {response}")
            return True

        except Exception as e:
            error_str = str(e)
            # 유효하지 않은 토큰 에러 처리
            if 'Requested entity was not found' in error_str or 'registration-token-not-registered' in error_str:
                logger.warning(f"[FCM] 유효하지 않은 토큰: {token[:20]}...")
            else:
                logger.error(f"[FCM] 푸시 알림 발송 실패: {e}", exc_info=True)
            return False

    @staticmethod
    async def send_push_to_user(
        user,
        title: str,
        body: str,
        data: Optional[Dict[str, str]] = None
    ) -> bool:
        """
        사용자에게 푸시 알림 발송

        Args:
            user: User 모델 객체
            title: 알림 제목
            body: 알림 내용
            data: 추가 데이터 (선택)

        Returns:
            성공 시 True, 실패 시 False
        """
        # 알림 설정 확인
        preference = getattr(user, 'notification_preference', 'email')
        if preference == 'none':
            logger.info(f"[FCM] 사용자가 알림을 끔: {user.email}")
            return False

        if preference == 'email':
            logger.info(f"[FCM] 사용자가 이메일 알림만 설정: {user.email}")
            return False

        # FCM 토큰 확인
        fcm_token = getattr(user, 'fcm_token', None)
        if not fcm_token:
            logger.info(f"[FCM] FCM 토큰 없음: {user.email}")
            return False

        # 푸시 알림 발송
        return await FCMService.send_push_notification(
            token=fcm_token,
            title=title,
            body=body,
            data=data
        )

    @staticmethod
    async def send_todo_reminder(
        user,
        todo_title: str,
        reminder_time: str,
        todo_id: str = None
    ) -> bool:
        """
        일정 알림 푸시 발송

        Args:
            user: User 모델 객체
            todo_title: 일정 제목
            reminder_time: 알림 시간 설명 (예: "10분 전", "1시간 전")
            todo_id: 일정 ID (선택)

        Returns:
            성공 시 True, 실패 시 False
        """
        title = "일정 알림"
        body = f"{todo_title} - {reminder_time}"

        data = {}
        if todo_id:
            data['todo_id'] = str(todo_id)
            data['type'] = 'todo_reminder'

        return await FCMService.send_push_to_user(
            user=user,
            title=title,
            body=body,
            data=data
        )
