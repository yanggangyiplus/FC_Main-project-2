"""Check what the API would return for notifications"""
import sqlite3
import json

conn = sqlite3.connect('always-plan.db')
cursor = conn.cursor()

print("=" * 60)
print("Simulating API Response for Notifications")
print("=" * 60)

# 알림이 설정된 todos 확인 (API가 반환하는 것처럼)
cursor.execute('''
    SELECT id, title, date, start_time, has_notification, notification_reminders
    FROM todos 
    WHERE deleted_at IS NULL AND has_notification = 1
    ORDER BY date DESC
    LIMIT 10
''')

print("\nTodos with notifications (as API would return):")
for row in cursor.fetchall():
    todo_id = row[0]
    title = row[1][:30] if row[1] else 'No title'
    date = row[2]
    start_time = row[3]
    has_notification = row[4]
    notification_reminders_raw = row[5]
    
    # JSON 파싱
    try:
        notification_reminders = json.loads(notification_reminders_raw) if notification_reminders_raw else []
    except:
        notification_reminders = []
    
    print(f"\n  Title: {title}")
    print(f"  Date: {date}")
    print(f"  Start Time: {start_time}")
    print(f"  has_notification: {has_notification} (type: {type(has_notification).__name__})")
    print(f"  notification_reminders: {notification_reminders}")
    
    # 알림 시간 계산 예시
    if notification_reminders and date:
        from datetime import datetime, timedelta
        for reminder in notification_reminders:
            value = reminder.get('value', 30)
            unit = reminder.get('unit', 'minutes')
            print(f"    -> Reminder: {value} {unit} before")

# 오늘 이후 일정 중 알림 있는 것
print("\n" + "=" * 60)
print("Upcoming todos with notifications (after today):")
cursor.execute('''
    SELECT id, title, date, start_time, has_notification, notification_reminders
    FROM todos 
    WHERE deleted_at IS NULL 
    AND has_notification = 1
    AND date >= date('now')
    ORDER BY date ASC
    LIMIT 5
''')

for row in cursor.fetchall():
    title = row[1][:30] if row[1] else 'No title'
    date = row[2]
    print(f"  {title} | {date}")

conn.close()
