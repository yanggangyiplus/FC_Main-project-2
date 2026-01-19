"""Check has_notification in API response simulation"""
import sqlite3
import json

conn = sqlite3.connect('always-plan.db')
cursor = conn.cursor()

# API가 반환하는 것처럼 has_notification 값 확인
cursor.execute('''
    SELECT id, title, has_notification, notification_reminders
    FROM todos 
    WHERE deleted_at IS NULL
    ORDER BY date DESC
    LIMIT 10
''')

print("DB에서 직접 조회한 has_notification 값:")
for row in cursor.fetchall():
    todo_id = row[0][:8]
    title = row[1][:25] if row[1] else 'No title'
    has_notification = row[2]
    reminders = row[3]
    
    print(f"  {title} | has_notification={has_notification} (type: {type(has_notification).__name__}) | reminders: {reminders[:50] if reminders else 'None'}...")

# has_notification=1인 것만
print("\n\nhas_notification=1인 todos:")
cursor.execute('SELECT COUNT(*) FROM todos WHERE has_notification = 1 AND deleted_at IS NULL')
count = cursor.fetchone()[0]
print(f"  Count: {count}")

# has_notification=True로 확인
cursor.execute('SELECT COUNT(*) FROM todos WHERE has_notification = TRUE AND deleted_at IS NULL')
count_true = cursor.fetchone()[0]
print(f"  Count (TRUE): {count_true}")

# has_notification이 0이 아닌 것
cursor.execute('SELECT COUNT(*) FROM todos WHERE has_notification != 0 AND deleted_at IS NULL')
count_not_zero = cursor.fetchone()[0]
print(f"  Count (!=0): {count_not_zero}")

conn.close()
