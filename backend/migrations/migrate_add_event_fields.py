"""
일정 기간, 알림, 반복 기능을 위한 필드 추가 마이그레이션
- end_date: 종료 날짜 (기간 일정)
- notification_reminders: 알림 리마인더 JSON
- repeat_pattern: 반복 패턴 JSON
"""
import sqlite3
import sys
import os

# 프로젝트 루트 경로 추가
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

DB_PATH = "momflow.db"

def migrate():
    """마이그레이션 실행"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # end_date 컬럼 추가 (종료 날짜)
        print("1. end_date 컬럼 추가 중...")
        try:
            cursor.execute("ALTER TABLE todos ADD COLUMN end_date DATE")
            print("   ✓ end_date 컬럼 추가 완료")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e).lower():
                print("   ⚠ end_date 컬럼이 이미 존재합니다.")
            else:
                raise
        
        # notification_reminders 컬럼 추가 (알림 리마인더 JSON)
        print("2. notification_reminders 컬럼 추가 중...")
        try:
            cursor.execute("ALTER TABLE todos ADD COLUMN notification_reminders TEXT")
            print("   ✓ notification_reminders 컬럼 추가 완료")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e).lower():
                print("   ⚠ notification_reminders 컬럼이 이미 존재합니다.")
            else:
                raise
        
        # repeat_pattern 컬럼 추가 (반복 패턴 JSON)
        print("3. repeat_pattern 컬럼 추가 중...")
        try:
            cursor.execute("ALTER TABLE todos ADD COLUMN repeat_pattern TEXT")
            print("   ✓ repeat_pattern 컬럼 추가 완료")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e).lower():
                print("   ⚠ repeat_pattern 컬럼이 이미 존재합니다.")
            else:
                raise
        
        # 인덱스 추가
        print("4. end_date 인덱스 추가 중...")
        try:
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_todos_end_date ON todos(end_date)")
            print("   ✓ end_date 인덱스 추가 완료")
        except sqlite3.OperationalError as e:
            if "already exists" in str(e).lower():
                print("   ⚠ end_date 인덱스가 이미 존재합니다.")
            else:
                raise
        
        conn.commit()
        print("\n✅ 마이그레이션 완료!")
        
        # 테이블 구조 확인
        cursor.execute("PRAGMA table_info(todos)")
        columns = cursor.fetchall()
        print("\n📋 todos 테이블 구조:")
        for col in columns:
            print(f"   - {col[1]} ({col[2]})")
            
    except Exception as e:
        conn.rollback()
        print(f"\n❌ 마이그레이션 실패: {e}")
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()

