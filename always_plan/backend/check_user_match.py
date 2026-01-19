import sqlite3

conn = sqlite3.connect('always-plan.db')
cursor = conn.cursor()

print("=" * 60)
print("Checking User and Todo Matching")
print("=" * 60)

# 모든 사용자 확인
print("\nAll users in DB:")
cursor.execute('SELECT id, email, google_id FROM users')
users = cursor.fetchall()
for u in users:
    print(f'  ID: {u[0]}')
    print(f'  Email: {u[1]}')
    print(f'  Google ID: {u[2]}')

# todos의 user_id 확인
print("\nUnique user_ids in todos:")
cursor.execute('SELECT DISTINCT user_id FROM todos')
todo_user_ids = cursor.fetchall()
for uid in todo_user_ids:
    print(f'  {uid[0]}')

# user_id로 연결 확인
print("\nTodos per user:")
for user in users:
    user_id = user[0]
    cursor.execute('SELECT COUNT(*) FROM todos WHERE user_id = ?', (user_id,))
    count = cursor.fetchone()[0]
    print(f'  User {user[1]}: {count} todos')

# 오늘 날짜 범위 todos
print("\nTodos by date range:")
cursor.execute('''
    SELECT date, COUNT(*) as cnt 
    FROM todos 
    WHERE deleted_at IS NULL 
    GROUP BY date 
    ORDER BY date DESC 
    LIMIT 20
''')
for row in cursor.fetchall():
    print(f'  {row[0]}: {row[1]} todos')

conn.close()
