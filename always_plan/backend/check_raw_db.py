# -*- coding: utf-8 -*-
"""Check raw DB has_notification values"""
import sqlite3

conn = sqlite3.connect('always-plan.db')
cursor = conn.cursor()

# has_notification 값 분포 확인
print("has_notification 값 분포:")
cursor.execute('''
    SELECT has_notification, typeof(has_notification), COUNT(*) 
    FROM todos 
    WHERE deleted_at IS NULL 
    GROUP BY has_notification
''')
for row in cursor.fetchall():
    print(f"  값: {row[0]}, 타입: {row[1]}, 개수: {row[2]}")

# notification_reminders가 있지만 has_notification이 false/0인 것
print("\n" + "=" * 60)
print("notification_reminders가 있지만 has_notification=0인 todos:")
cursor.execute('''
    SELECT COUNT(*) FROM todos 
    WHERE deleted_at IS NULL 
    AND notification_reminders IS NOT NULL 
    AND notification_reminders != '[]' 
    AND notification_reminders != ''
    AND (has_notification = 0 OR has_notification IS NULL OR has_notification = 'false')
''')
count = cursor.fetchone()[0]
print(f"  개수: {count}")

# 샘플
print("\n샘플 (첫 5개):")
cursor.execute('''
    SELECT title, has_notification, typeof(has_notification), notification_reminders 
    FROM todos 
    WHERE deleted_at IS NULL 
    ORDER BY date DESC
    LIMIT 5
''')
for row in cursor.fetchall():
    print(f"  title: {row[0][:25] if row[0] else 'N/A'}")
    print(f"  has_notification: {row[1]} (DB type: {row[2]})")
    print(f"  notification_reminders: {row[3][:50] if row[3] else 'None'}...")
    print()

conn.close()
