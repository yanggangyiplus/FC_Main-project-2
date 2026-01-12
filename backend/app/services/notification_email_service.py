import json
import os
from dataclasses import dataclass
from datetime import datetime, timedelta, time as time_obj
from typing import Any, Optional

from zoneinfo import ZoneInfo
from sqlalchemy.orm import Session

from app.models.models import Notification
from app.models.user import User


DEFAULT_TZ = ZoneInfo(os.getenv("APP_TIMEZONE", "Asia/Seoul"))


@dataclass(frozen=True)
class ReminderSpec:
    value: int
    unit: str


def _parse_first_reminder(notification_reminders_raw: Any) -> Optional[ReminderSpec]:
    """Return the first reminder only (product decision: 1 reminder)."""
    if not notification_reminders_raw:
        return None

    reminders = notification_reminders_raw
    if isinstance(notification_reminders_raw, str):
        try:
            reminders = json.loads(notification_reminders_raw)
        except Exception:
            return None

    if not isinstance(reminders, list) or not reminders:
        return None

    first = reminders[0]
    if not isinstance(first, dict):
        return None

    try:
        value = int(first.get("value", 0))
    except Exception:
        value = 0
    unit = str(first.get("unit", "minutes"))
    if value < 0:
        value = 0
    return ReminderSpec(value=value, unit=unit)


def _reminder_delta(spec: ReminderSpec) -> timedelta:
    unit = spec.unit.lower()
    if unit in {"minute", "minutes", "min", "mins"}:
        return timedelta(minutes=spec.value)
    if unit in {"hour", "hours", "h"}:
        return timedelta(hours=spec.value)
    if unit in {"day", "days", "d"}:
        return timedelta(days=spec.value)
    if unit in {"week", "weeks", "w"}:
        return timedelta(weeks=spec.value)
    return timedelta(minutes=spec.value)


def _to_utc_naive(dt_local: datetime) -> datetime:
    if dt_local.tzinfo is None:
        dt_local = dt_local.replace(tzinfo=DEFAULT_TZ)
    dt_utc = dt_local.astimezone(ZoneInfo("UTC"))
    return dt_utc.replace(tzinfo=None)


def compute_scheduled_time_utc(todo: Any) -> Optional[datetime]:
    """Compute a single scheduled_time (UTC naive) for a todo email reminder.

    Rules:
    - If todo.all_day: always send at 08:00 (local timezone) on todo.date.
    - Otherwise: send at (todo.date + todo.start_time) minus the first reminder offset.
    - If start_time is missing for non-all-day: fall back to 08:00 local.
    """
    if not getattr(todo, "date", None):
        return None

    is_all_day = bool(getattr(todo, "all_day", False))
    start_time = getattr(todo, "start_time", None)
    if not start_time:
        start_time = time_obj(8, 0)

    if is_all_day:
        local_dt = datetime.combine(todo.date, time_obj(8, 0)).replace(tzinfo=DEFAULT_TZ)
        return _to_utc_naive(local_dt)

    local_dt = datetime.combine(todo.date, start_time).replace(tzinfo=DEFAULT_TZ)
    reminder = _parse_first_reminder(getattr(todo, "notification_reminders", None))
    if reminder:
        local_dt = local_dt - _reminder_delta(reminder)
    return _to_utc_naive(local_dt)


def sync_todo_email_reminder_notification(db: Session, todo: Any, user: User) -> None:
    """Upsert a single email reminder Notification row for a Todo.

    - Product decision: only one reminder is supported.
    - If todo.has_notification is false: remove any unsent email reminder notifications.
    """

    db.query(Notification).filter(
        Notification.todo_id == todo.id,
        Notification.type == "reminder",
        Notification.sent_at.is_(None),
        Notification.channels.like("%email%"),
    ).delete(synchronize_session=False)

    if not bool(getattr(todo, "has_notification", False)):
        return

    scheduled_time = compute_scheduled_time_utc(todo)
    if not scheduled_time:
        return

    title = f"일정 알림: {getattr(todo, 'title', '')}".strip()
    message = f"'{getattr(todo, 'title', '')}' 일정 알림입니다.".strip()

    notif = Notification(
        user_id=user.id,
        todo_id=todo.id,
        type="reminder",
        title=title,
        message=message,
        scheduled_time=scheduled_time,
        channels=json.dumps(["email"]),
    )
    db.add(notif)
