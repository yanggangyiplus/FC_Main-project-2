from datetime import date, time

from app.services.notification_email_service import compute_scheduled_time_utc


class DummyTodo:
    def __init__(self, *, todo_date, start_time=None, all_day=False, reminders=None):
        self.date = todo_date
        self.start_time = start_time
        self.all_day = all_day
        self.notification_reminders = reminders


def test_all_day_sends_at_8am_kst_in_utc_naive():
    # 08:00 KST == 23:00 UTC (previous day)
    todo = DummyTodo(todo_date=date(2026, 1, 12), all_day=True)
    scheduled = compute_scheduled_time_utc(todo)
    assert scheduled.year == 2026
    assert scheduled.month == 1
    assert scheduled.day == 11
    assert scheduled.hour == 23
    assert scheduled.minute == 0


def test_timed_todo_respects_first_reminder_only():
    todo = DummyTodo(
        todo_date=date(2026, 1, 12),
        start_time=time(9, 0),
        all_day=False,
        reminders=[{"value": 30, "unit": "minutes"}, {"value": 10, "unit": "minutes"}],
    )
    scheduled = compute_scheduled_time_utc(todo)
    # 09:00 KST - 30m = 08:30 KST == 23:30 UTC (previous day)
    assert scheduled.day == 11
    assert scheduled.hour == 23
    assert scheduled.minute == 30
