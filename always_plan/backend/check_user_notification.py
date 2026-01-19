# -*- coding: utf-8 -*-
"""Check has_notification for specific user"""
import sqlite3
import json

conn = sqlite3.connect('always-plan.db')
cursor = conn.cursor()

user_id = 'f1cb713c-b8db-402e-a3d1-6ce229f41b7c'

print(f"User ID: {user_id}")
print("=" * 60)

# 이 user_id에 대한 전체 todos 수
cursor.execute('SELECT COUNT(*) FROM todos WHERE user_id = ? AND deleted_at IS NULL', (user_id,))
total = cursor.fetchone()[0]
print(f"Total todos for this user: {total}")

# has_notification=1인 todos 수
cursor.execute('SELECT COUNT(*) FROM todos WHERE user_id = ? AND deleted_at IS NULL AND has_notification = 1', (user_id,))
with_notif = cursor.fetchone()[0]
print(f"Todos with has_notification=1: {with_notif}")

# notification_reminders가 있는 todos 수
cursor.execute("""
    SELECT COUNT(*) FROM todos 
    WHERE user_id = ? AND deleted_at IS NULL 
    AND notification_reminders IS NOT NULL 
    AND notification_reminders != '[]' 
    AND notification_reminders != ''
""", (user_id,))
with_reminders = cursor.fetchone()[0]
print(f"Todos with notification_reminders: {with_reminders}")

# 샘플 출력
print("\n" + "=" * 60)
print("Sample todos with has_notification=1:")
cursor.execute('''
    SELECT id, title, has_notification, notification_reminders
    FROM todos 
    WHERE user_id = ? AND deleted_at IS NULL AND has_notification = 1
    LIMIT 5
''', (user_id,))

for row in cursor.fetchall():
    print(f"  Title: {row[1][:30] if row[1] else 'N/A'}")
    print(f"  has_notification: {row[2]} (type: {type(row[2]).__name__})")
    print(f"  notification_reminders: {row[3][:50] if row[3] else 'None'}...")
    print()

conn.close()
