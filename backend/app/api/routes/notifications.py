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
        # 현재 시간
        now = datetime.now()
        
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
                                        members = db.query(FamilyMember).filter(FamilyMember.id.in_(member_ids)).all()
                                        assigned_members = [{"emoji": m.emoji or "👤", "name": m.name} for m in members]
                                except:
                                    pass
                            
                            # 하루종일 여부
                            is_all_day = todo.all_day if hasattr(todo, 'all_day') else False
                            
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
                                # 알림 기록 저장
                                notification = Notification(
                                    user_id=todo.user_id,
                                    todo_id=todo.id,
                                    type="reminder",
                                    title=f"일정 알림: {todo.title}",
                                    message=f"{reminder_str} 알림",
                                    scheduled_time=reminder_datetime,
                                    sent_at=now,
                                    channels=json.dumps(["email"])
                                )
                                db.add(notification)
                                sent_count += 1
                                logger.info(f"[EMAIL_NOTIFICATION] 이메일 발송 성공: {user.email}, 일정: {todo.title}")
                            
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

