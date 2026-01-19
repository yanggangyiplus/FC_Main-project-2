"""Direct API test to check todos endpoint"""
import sqlite3
import os

# DB 연결
db_path = 'always-plan.db'
print(f"DB Path: {os.path.abspath(db_path)}")
print(f"DB Exists: {os.path.exists(db_path)}")
print(f"DB Size: {os.path.getsize(db_path)} bytes")

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# 사용자 확인
cursor.execute('SELECT id, email, google_id FROM users')
users = cursor.fetchall()
print(f"\nUsers in DB: {len(users)}")
for u in users:
    print(f"  ID: {u[0]}")
    print(f"  Email: {u[1]}")
    print(f"  Google ID: {u[2]}")

if users:
    user_id = users[0][0]
    
    # 해당 사용자의 todos 확인
    cursor.execute('SELECT COUNT(*) FROM todos WHERE user_id = ? AND deleted_at IS NULL', (user_id,))
    count = cursor.fetchone()[0]
    print(f"\nTodos for user {user_id}: {count}")
    
    # 샘플 todos
    cursor.execute('''
        SELECT id, title, date, source 
        FROM todos 
        WHERE user_id = ? AND deleted_at IS NULL 
        ORDER BY date DESC 
        LIMIT 5
    ''', (user_id,))
    todos = cursor.fetchall()
    print(f"\nSample todos:")
    for t in todos:
        title = t[1][:30] if t[1] else 'No title'
        print(f"  {t[0][:8]}... | {title} | {t[2]} | {t[3]}")

conn.close()
