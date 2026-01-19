import sqlite3

print("=" * 50)
print("Checking always-plan.db")
print("=" * 50)
try:
    conn = sqlite3.connect('always-plan.db')
    cursor = conn.cursor()
    
    cursor.execute('SELECT COUNT(*) FROM todos')
    count = cursor.fetchone()[0]
    print(f'Total todos: {count}')
    
    cursor.execute('SELECT COUNT(*) FROM users')
    user_count = cursor.fetchone()[0]
    print(f'Total users: {user_count}')
    
    if user_count > 0:
        cursor.execute('SELECT id, email FROM users')
        for row in cursor.fetchall():
            print(f'  User: {row[1]}')
    
    conn.close()
except Exception as e:
    print(f'Error: {e}')

print()
print("=" * 50)
print("Checking momflow.db")
print("=" * 50)
try:
    conn = sqlite3.connect('momflow.db')
    cursor = conn.cursor()
    
    # 테이블 목록
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = cursor.fetchall()
    print(f'Tables: {[t[0] for t in tables]}')
    
    if ('todos',) in tables:
        cursor.execute('SELECT COUNT(*) FROM todos')
        count = cursor.fetchone()[0]
        print(f'Total todos: {count}')
        
        cursor.execute('SELECT COUNT(*) FROM todos WHERE deleted_at IS NULL')
        active = cursor.fetchone()[0]
        print(f'Active todos (not deleted): {active}')
    
    if ('users',) in tables:
        cursor.execute('SELECT COUNT(*) FROM users')
        user_count = cursor.fetchone()[0]
        print(f'Total users: {user_count}')
        
        if user_count > 0:
            cursor.execute('SELECT id, email FROM users')
            for row in cursor.fetchall():
                print(f'  User: {row[1]}')
    
    conn.close()
except Exception as e:
    print(f'Error: {e}')
