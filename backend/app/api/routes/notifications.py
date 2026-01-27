"""
알림 관련 엔드포인트
"""
import json
import logging
from typing import List, Optional
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import and_
from pydantic import BaseModel

from app.database import get_db
from app.models.models import Todo, Notification, FamilyMember
from app.models.user import User
from app.api.routes.auth import get_current_user
from app.services.email_service import EmailService

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/notifications",
    tags=["notifications"],
    dependencies=[Depends(get_current_user)]
)


def send_scheduled_emails(db: Session):
    """
    예정된 알림 이메일 발송 (백그라운드 작업)
    """
    try:
        # 현재 시간 (한국 시간대 사용)
        from zoneinfo import ZoneInfo
        kst = ZoneInfo("Asia/Seoul")
        now = datetime.now(kst).replace(tzinfo=None)  # naive datetime으로 변환하여 비교
        
        # 알림이 필요한 일정 조회 (알림 설정이 있고, 삭제되지 않은 일정)
        todos = db.query(Todo).filter(
            and_(
                Todo.has_notification == True,
                Todo.deleted_at.is_(None),
                Todo.status != "completed"
            )
        ).all()
        
        sent_count = 0
        for todo in todos:
            try:
                # 알림 리마인더 파싱
                notification_reminders = []
                if todo.notification_reminders:
                    try:
                        parsed = json.loads(todo.notification_reminders) if isinstance(todo.notification_reminders, str) else todo.notification_reminders
                        if isinstance(parsed, list):
                            notification_reminders = parsed
                    except:
                        pass
                
                if not notification_reminders:
                    continue
                
                # 일정 날짜/시간 계산
                todo_date = todo.date
                todo_datetime = None
                
                if todo.all_day:
                    # 하루종일 일정
                    todo_datetime = datetime.combine(todo_date, datetime.min.time())
                elif todo.start_time:
                    # 시간이 있는 일정
                    todo_datetime = datetime.combine(todo_date, todo.start_time)
                
                if not todo_datetime:
                    continue
                
                # 각 알림 리마인더에 대해 이메일 발송
                for reminder in notification_reminders:
                    value = reminder.get('value', 30)
                    unit = reminder.get('unit', 'minutes')
                    
                    # 알림 시간 계산
                    if unit == 'minutes':
                        reminder_datetime = todo_datetime - timedelta(minutes=value)
                    elif unit == 'hours':
                        reminder_datetime = todo_datetime - timedelta(hours=value)
                    elif unit == 'days':
                        reminder_datetime = todo_datetime - timedelta(days=value)
                    elif unit == 'weeks':
                        reminder_datetime = todo_datetime - timedelta(weeks=value)
                    else:
                        continue
                    
                    # 알림 시간이 현재 시간과 가까운지 확인 (1분 이내)
                    time_diff = abs((reminder_datetime - now).total_seconds())
                    if time_diff <= 60:  # 1분 이내
                        # 이미 발송된 알림인지 확인
                        existing_notification = db.query(Notification).filter(
                            and_(
                                Notification.user_id == todo.user_id,
                                Notification.todo_id == todo.id,
                                Notification.scheduled_time.between(
                                    reminder_datetime - timedelta(minutes=1),
                                    reminder_datetime + timedelta(minutes=1)
                                ),
                                Notification.channels.contains('email')
                            )
                        ).first()
                        
                        if not existing_notification:
                            # 사용자 정보 가져오기
                            user = db.query(User).filter(User.id == todo.user_id).first()
                            if not user or not user.email:
                                continue
                            
                            # 이메일 발송
                            time_str = todo.start_time.strftime("%H:%M") if todo.start_time else None
                            reminder_str = f"{value} {unit} 전" if unit != 'minutes' else f"{value}분 전"
                            
                            # 체크리스트 가져오기
                            checklist_items = []
                            if hasattr(todo, 'checklist_items'):
                                checklist_items = [item.text for item in todo.checklist_items if hasattr(item, 'text')]
                            
                            # 담당 프로필 정보 가져오기
                            assigned_members = []
                            if todo.family_member_ids:
                                try:
                                    member_ids = json.loads(todo.family_member_ids) if isinstance(todo.family_member_ids, str) else todo.family_member_ids
                                    if isinstance(member_ids, list) and len(member_ids) > 0:
                                        # "me"가 포함되어 있으면 사용자 정보 추가
                                        if "me" in member_ids:
                                            assigned_members.append({"emoji": user.avatar_emoji or "👤", "name": user.name})
                                        # FamilyMember 조회 (me 제외)
                                        filtered_member_ids = [mid for mid in member_ids if mid != "me"]
                                        if filtered_member_ids:
                                            members = db.query(FamilyMember).filter(FamilyMember.id.in_(filtered_member_ids)).all()
                                            for m in members:
                                                assigned_members.append({"emoji": m.emoji or "👤", "name": m.name})
                                except:
                                    pass
                            
                            # 하루종일 여부
                            is_all_day = todo.all_day if hasattr(todo, 'all_day') else False
                            
                            # 사용자 알림 설정 확인
                            notification_pref = getattr(user, 'notification_preference', 'email')
                            channels_sent = []

                            # 이메일 알림 발송 (email 또는 both)
                            if notification_pref in ['email', 'both']:
                                success = EmailService.send_notification_email(
                                    to_email=user.email,
                                    todo_title=todo.title,
                                    todo_date=todo_date.strftime("%Y년 %m월 %d일"),
                                    todo_time=time_str,
                                    todo_end_time=todo.end_time.strftime("%H:%M") if todo.end_time else None,
                                    is_all_day=is_all_day,
                                    reminder_time=reminder_str,
                                    todo_location=todo.location if hasattr(todo, 'location') else None,
                                    todo_category=todo.category if hasattr(todo, 'category') else None,
                                    todo_checklist=checklist_items if checklist_items else None,
                                    todo_memo=todo.memo if hasattr(todo, 'memo') and todo.memo else None,
                                    assigned_members=assigned_members if assigned_members else None
                                )
                                if success:
                                    channels_sent.append("email")
                                    logger.info(f"[EMAIL_NOTIFICATION] 이메일 발송 성공: {user.email}, 일정: {todo.title}")

                            # FCM 푸시 알림 발송 (push 또는 both)
                            if notification_pref in ['push', 'both']:
                                try:
                                    from app.services.fcm_service import FCMService
                                    import asyncio

                                    # FCM 토큰이 있는 경우에만 발송
                                    if user.fcm_token:
                                        loop = asyncio.get_event_loop()
                                        push_success = loop.run_until_complete(
                                            FCMService.send_todo_reminder(
                                                user=user,
                                                todo_title=todo.title,
                                                reminder_time=reminder_str,
                                                todo_id=str(todo.id)
                                            )
                                        )
                                        if push_success:
                                            channels_sent.append("push")
                                            logger.info(f"[FCM_NOTIFICATION] 푸시 알림 발송 성공: {user.email}, 일정: {todo.title}")
                                except Exception as fcm_error:
                                    logger.error(f"[FCM_NOTIFICATION] 푸시 알림 발송 실패: {fcm_error}")

                            if channels_sent:
                                # 알림 기록 저장
                                notification = Notification(
                                    user_id=todo.user_id,
                                    todo_id=todo.id,
                                    type="reminder",
                                    title=f"일정 알림: {todo.title}",
                                    message=f"{reminder_str} 알림",
                                    scheduled_time=reminder_datetime,
                                    sent_at=now,
                                    channels=json.dumps(channels_sent)
                                )
                                db.add(notification)
                                sent_count += 1
                            
            except Exception as e:
                logger.error(f"[EMAIL_NOTIFICATION] 일정 알림 발송 실패: {todo.id}, 오류: {e}", exc_info=True)
        
        db.commit()
        logger.info(f"[EMAIL_NOTIFICATION] 총 {sent_count}개의 이메일 알림 발송 완료")
        
    except Exception as e:
        logger.error(f"[EMAIL_NOTIFICATION] 알림 발송 프로세스 실패: {e}", exc_info=True)
        db.rollback()


@router.post("/send-scheduled")
async def send_scheduled_notifications(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    예정된 알림 이메일 발송 (수동 트리거)
    주기적으로 호출하여 알림 시간이 된 일정의 이메일을 발송합니다.
    """
    try:
        # 백그라운드 작업으로 이메일 발송
        background_tasks.add_task(send_scheduled_emails, db)
        
        return {
            "success": True,
            "message": "알림 발송 작업이 시작되었습니다."
        }
    except Exception as e:
        logger.error(f"[EMAIL_NOTIFICATION] 알림 발송 시작 실패: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"알림 발송 실패: {str(e)}"
        )


@router.get("/")
async def get_notifications(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    사용자의 알림 목록 조회
    """
    notifications = db.query(Notification).filter(
        Notification.user_id == current_user.id
    ).order_by(
        Notification.scheduled_time.desc()
    ).offset(skip).limit(limit).all()
    
    result = []
    for notification in notifications:
        channels = []
        if notification.channels:
            try:
                channels = json.loads(notification.channels) if isinstance(notification.channels, str) else notification.channels
            except:
                pass
        
        result.append({
            "id": notification.id,
            "type": notification.type,
            "title": notification.title,
            "message": notification.message,
            "scheduled_time": notification.scheduled_time.isoformat() if notification.scheduled_time else None,
            "sent_at": notification.sent_at.isoformat() if notification.sent_at else None,
            "read_at": notification.read_at.isoformat() if notification.read_at else None,
            "channels": channels
        })

    return result


# ============================================================
# FCM (Firebase Cloud Messaging) 웹 푸시 알림
# ============================================================

class FcmTokenRequest(BaseModel):
    token: str

class NotificationPreferenceRequest(BaseModel):
    preference: str  # email, push, both, none


@router.post("/fcm-token")
async def save_fcm_token(
    request: FcmTokenRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    FCM 토큰 저장

    프론트엔드에서 Firebase Cloud Messaging 토큰을 받아 저장합니다.
    웹 푸시 알림 발송 시 이 토큰을 사용합니다.
    """
    try:
        logger.info(f"[FCM_TOKEN] FCM 토큰 저장 - user: {current_user.email}")

        current_user.fcm_token = request.token
        db.commit()

        logger.info(f"[FCM_TOKEN] FCM 토큰 저장 완료")

        return {
            "success": True,
            "message": "FCM 토큰이 저장되었습니다."
        }

    except Exception as e:
        logger.error(f"[FCM_TOKEN] FCM 토큰 저장 실패: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"FCM 토큰 저장 실패: {str(e)}"
        )


@router.delete("/fcm-token")
async def delete_fcm_token(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """FCM 토큰 삭제 (로그아웃 시 호출)"""
    try:
        current_user.fcm_token = None
        db.commit()

        return {
            "success": True,
            "message": "FCM 토큰이 삭제되었습니다."
        }

    except Exception as e:
        logger.error(f"[FCM_TOKEN] FCM 토큰 삭제 실패: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"FCM 토큰 삭제 실패: {str(e)}"
        )


@router.post("/preference")
async def update_notification_preference(
    request: NotificationPreferenceRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    알림 설정 변경

    - email: 이메일 알림만
    - push: 웹 푸시 알림만
    - both: 이메일 + 웹 푸시 모두
    - none: 알림 끄기
    """
    try:
        if request.preference not in ['email', 'push', 'both', 'none']:
            raise HTTPException(
                status_code=400,
                detail="유효하지 않은 알림 설정입니다. (email, push, both, none 중 선택)"
            )

        logger.info(f"[NOTIFICATION_PREF] 알림 설정 변경 - user: {current_user.email}, preference: {request.preference}")

        current_user.notification_preference = request.preference
        db.commit()

        return {
            "success": True,
            "preference": request.preference,
            "message": f"알림 설정이 '{request.preference}'(으)로 변경되었습니다."
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[NOTIFICATION_PREF] 알림 설정 변경 실패: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"알림 설정 변경 실패: {str(e)}"
        )


@router.get("/preference")
async def get_notification_preference(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """현재 알림 설정 조회"""
    return {
        "preference": current_user.notification_preference or "email",
        "has_fcm_token": bool(current_user.fcm_token)
    }

