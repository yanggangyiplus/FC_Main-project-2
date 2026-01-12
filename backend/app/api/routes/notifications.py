import os
from datetime import datetime

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import Notification
from app.services.email_service import send_email


router = APIRouter(prefix="/notifications", tags=["notifications"])


def _require_cron_secret(x_cron_secret: str | None) -> None:
    expected = os.getenv("CRON_SECRET")
    if not expected:
        return
    if not x_cron_secret or x_cron_secret != expected:
        raise HTTPException(status_code=401, detail="Invalid cron secret")


@router.post("/dispatch-email")
async def dispatch_due_email_notifications(
    limit: int = 50,
    dry_run: bool = False,
    x_cron_secret: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    """Dispatch due email notifications.

    Intended to be called by Cloud Scheduler every minute.
    """
    _require_cron_secret(x_cron_secret)

    now_utc = datetime.utcnow()
    due = (
        db.query(Notification)
        .filter(
            Notification.sent_at.is_(None),
            Notification.scheduled_time.is_not(None),
            Notification.scheduled_time <= now_utc,
            Notification.channels.like("%email%"),
        )
        .order_by(Notification.scheduled_time.asc())
        .limit(limit)
        .all()
    )

    sent_count = 0
    smtp_sent_count = 0
    console_sent_count = 0
    errors: list[dict] = []
    for notif in due:
        user = notif.user
        if not user or not user.email:
            continue

        if not dry_run:
            try:
                result = send_email(
                    to_email=user.email,
                    subject=notif.title or "Always Plan 알림",
                    body=notif.message or "알림이 도착했습니다.",
                )
                mode = (result or {}).get("mode")
                if mode == "smtp":
                    smtp_sent_count += 1
                elif mode == "console":
                    console_sent_count += 1
                notif.sent_at = now_utc
            except Exception as e:
                errors.append({"notification_id": notif.id, "error": str(e)})
                continue
        sent_count += 1

    if not dry_run:
        db.commit()

    return {
        "now_utc": now_utc.isoformat(),
        "due_count": len(due),
        "sent_count": sent_count,
        "smtp_sent_count": smtp_sent_count,
        "console_sent_count": console_sent_count,
        "error_count": len(errors),
        "errors": errors[:5],
        "dry_run": dry_run,
    }


@router.post("/test-email")
async def test_email(
    to_email: str,
    subject: str = "MomFlow SMTP 테스트",
    body: str = "SMTP 테스트 이메일입니다.",
    x_cron_secret: str | None = Header(default=None),
):
    """Send a single test email.

    Useful to validate SMTP credentials independent of scheduling.
    """
    _require_cron_secret(x_cron_secret)
    result = send_email(to_email=to_email, subject=subject, body=body)
    return {"ok": True, "result": result}
