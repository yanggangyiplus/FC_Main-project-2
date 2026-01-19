import sqlite3

conn = sqlite3.connect('always-plan.db')
cursor = conn.cursor()

print("=" * 60)
print("Fixing has_notification flag for todos with reminders")
print("=" * 60)

# notification_reminders가 설정된 todos 개수 확인
cursor.execute("""
    SELECT COUNT(*) FROM todos 
    WHERE deleted_at IS NULL 
    AND notification_reminders IS NOT NULL 
    AND notification_reminders != '[]' 
    AND notification_reminders != ''
    AND has_notification = 0
""")
count = cursor.fetchone()[0]
print(f"\nTodos to update: {count}")

# has_notification 플래그 업데이트
cursor.execute("""
    UPDATE todos 
    SET has_notification = 1
    WHERE deleted_at IS NULL 
    AND notification_reminders IS NOT NULL 
    AND notification_reminders != '[]' 
    AND notification_reminders != ''
    AND has_notification = 0
""")
updated = cursor.rowcount
conn.commit()

print(f"Updated {updated} todos")

# 확인
cursor.execute('SELECT COUNT(*) FROM todos WHERE deleted_at IS NULL AND has_notification = 1')
with_notification = cursor.fetchone()[0]
print(f"\nTotal todos with has_notification=True now: {with_notification}")

# 샘플 확인
print("\nSample todos with notification settings:")
cursor.execute('''
    SELECT id, title, date, has_notification, notification_reminders
    FROM todos 
    WHERE deleted_at IS NULL AND has_notification = 1
    LIMIT 3
''')
for row in cursor.fetchall():
    print(f"  {row[1][:30] if row[1] else 'N/A'} | {row[2]} | reminders: {row[4][:50] if row[4] else 'None'}...")

conn.close()
print("\nDone!")
