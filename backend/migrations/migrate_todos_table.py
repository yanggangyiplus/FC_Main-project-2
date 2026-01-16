"""
todos 테이블 마이그레이션 스크립트
누락된 컬럼들을 추가합니다.
"""
import sqlite3
import os
from app.config import settings

def migrate_todos_table():
    """todos 테이블에 누락된 컬럼 추가"""
    # 데이터베이스 파일 경로
    db_path = settings.database_url.replace('sqlite:///', '')
    
    if not os.path.exists(db_path):
        print(f"데이터베이스 파일이 없습니다: {db_path}")
        return
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # 현재 컬럼 확인
        cursor.execute("PRAGMA table_info(todos)")
        existing_columns = [row[1] for row in cursor.fetchall()]
        print(f"기존 컬럼: {existing_columns}")
        
        # 필요한 컬럼 목록
        required_columns = {
            'memo': 'TEXT',
            'location': 'VARCHAR(255)',
            'deleted_at': 'DATETIME',
            'repeat_type': 'VARCHAR(20)',
            'repeat_end_date': 'DATE',
            'repeat_days': 'VARCHAR(20)',
            'has_notification': 'BOOLEAN',
            'notification_times': 'TEXT',
            'family_member_ids': 'TEXT',
            'source': 'VARCHAR(50)',
            'completed_at': 'DATETIME',
        }
        
        # 누락된 컬럼 추가
        for column_name, column_type in required_columns.items():
            if column_name not in existing_columns:
                try:
                    if column_type == 'BOOLEAN':
                        sql = f"ALTER TABLE todos ADD COLUMN {column_name} INTEGER DEFAULT 0"
                    else:
                        sql = f"ALTER TABLE todos ADD COLUMN {column_name} {column_type}"
                    cursor.execute(sql)
                    print(f"✓ {column_name} 컬럼 추가 완료")
                except sqlite3.OperationalError as e:
                    print(f"✗ {column_name} 컬럼 추가 실패: {e}")
        
        conn.commit()
        print("\n마이그레이션 완료!")
        
        # 최종 컬럼 확인
        cursor.execute("PRAGMA table_info(todos)")
        final_columns = [row[1] for row in cursor.fetchall()]
        print(f"\n최종 컬럼: {final_columns}")
        
    except Exception as e:
        print(f"마이그레이션 중 오류 발생: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate_todos_table()

