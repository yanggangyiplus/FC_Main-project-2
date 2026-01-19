import sqlite3

conn = sqlite3.connect('always-plan.db')
cursor = conn.cursor()

# 테이블 목록 확인
cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = cursor.fetchall()
print('Tables:', [t[0] for t in tables])

# todos 테이블 데이터 개수
cursor.execute('SELECT COUNT(*) FROM todos')
count = cursor.fetchone()[0]
print(f'Total todos in DB: {count}')

# deleted_at이 NULL인 (삭제되지 않은) todo 개수
cursor.execute('SELECT COUNT(*) FROM todos WHERE deleted_at IS NULL')
active_count = cursor.fetchone()[0]
print(f'Active todos (not deleted): {active_count}')

# 오늘 날짜 기준 todo 확인
cursor.execute("SELECT COUNT(*) FROM todos WHERE date = '2026-01-18' AND deleted_at IS NULL")
today_count = cursor.fetchone()[0]
print(f'Todos for today (2026-01-18): {today_count}')

# 최근 todo 샘플 확인
print('\nRecent 10 todos:')
cursor.execute('SELECT id, title, date, source, deleted_at, user_id FROM todos ORDER BY created_at DESC LIMIT 10')
rows = cursor.fetchall()
for row in rows:
    title = str(row[1])[:30] if row[1] else 'No title'
    print(f'  ID: {row[0][:8]}... | Title: {title} | Date: {row[2]} | Source: {row[3]} | Deleted: {row[4]} | UserID: {row[5][:8] if row[5] else "None"}...')

# user_id 확인
print('\nUser IDs in todos:')
cursor.execute('SELECT DISTINCT user_id FROM todos LIMIT 5')
user_ids = cursor.fetchall()
for uid in user_ids:
    print(f'  {uid[0]}')

# users 테이블 확인
print('\nUsers in DB:')
cursor.execute('SELECT id, email FROM users')
users = cursor.fetchall()
for u in users:
    print(f'  ID: {u[0]} | Email: {u[1]}')

conn.close()
