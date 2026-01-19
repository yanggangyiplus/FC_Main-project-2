import sqlite3

conn = sqlite3.connect('always-plan.db')
cursor = conn.cursor()

print("=" * 60)
print("Checking Notification Settings in Todos")
print("=" * 60)

# 전체 todos 수
cursor.execute('SELECT COUNT(*) FROM todos WHERE deleted_at IS NULL')
total = cursor.fetchone()[0]
print(f"\nTotal active todos: {total}")

# has_notification이 True인 todos
cursor.execute('SELECT COUNT(*) FROM todos WHERE deleted_at IS NULL AND has_notification = 1')
with_notification = cursor.fetchone()[0]
print(f"Todos with has_notification=True: {with_notification}")

# notification_reminders가 있는 todos
cursor.execute("SELECT COUNT(*) FROM todos WHERE deleted_at IS NULL AND notification_reminders IS NOT NULL AND notification_reminders != '[]' AND notification_reminders != ''")
with_reminders = cursor.fetchone()[0]
print(f"Todos with notification_reminders set: {with_reminders}")

# 샘플 확인
print("\nSample todos with notification settings:")
cursor.execute('''
    SELECT id, title, date, has_notification, notification_reminders, notification_times
    FROM todos 
    WHERE deleted_at IS NULL AND has_notification = 1
    LIMIT 5
''')
rows = cursor.fetchall()
if rows:
    for row in rows:
        print(f"  ID: {row[0][:8]}...")
        print(f"  Title: {row[1][:30] if row[1] else 'N/A'}")
        print(f"  Date: {row[2]}")
        print(f"  has_notification: {row[3]}")
        print(f"  notification_reminders: {row[4]}")
        print(f"  notification_times: {row[5]}")
        print()
else:
    print("  No todos found with has_notification=True")

# 모든 todos의 has_notification 값 분포
print("\nhas_notification distribution:")
cursor.execute('SELECT has_notification, COUNT(*) FROM todos WHERE deleted_at IS NULL GROUP BY has_notification')
for row in cursor.fetchall():
    print(f"  has_notification={row[0]}: {row[1]} todos")

conn.close()
