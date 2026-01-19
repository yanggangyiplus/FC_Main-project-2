"""
모든 일정 데이터 삭제 스크립트
데이터베이스의 모든 일정과 관련 데이터를 삭제합니다.
"""
import sqlite3
import sys
import os

# 프로젝트 루트 경로 추가
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

DB_PATH = "momflow.db"

def clear_all_todos():
    """모든 일정 데이터 삭제"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        print("🗑️  모든 일정 데이터 삭제 시작...")
        
        # 체크리스트 항목 삭제
        print("1. 체크리스트 항목 삭제 중...")
        cursor.execute("DELETE FROM checklist_items")
        checklist_count = cursor.rowcount
        print(f"   ✓ 체크리스트 항목 {checklist_count}개 삭제 완료")
        
        # 일정 삭제 (soft delete가 아닌 완전 삭제)
        print("2. 일정 삭제 중...")
        cursor.execute("DELETE FROM todos")
        todos_count = cursor.rowcount
        print(f"   ✓ 일정 {todos_count}개 삭제 완료")
        
        conn.commit()
        print("\n✅ 모든 일정 데이터 삭제 완료!")
        print(f"   - 삭제된 일정: {todos_count}개")
        print(f"   - 삭제된 체크리스트 항목: {checklist_count}개")
        
        # 테이블 확인
        cursor.execute("SELECT COUNT(*) FROM todos")
        remaining_todos = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM checklist_items")
        remaining_checklist = cursor.fetchone()[0]
        
        print(f"\n📊 현재 남은 데이터:")
        print(f"   - 일정: {remaining_todos}개")
        print(f"   - 체크리스트 항목: {remaining_checklist}개")
            
    except Exception as e:
        conn.rollback()
        print(f"\n❌ 삭제 실패: {e}")
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    import sys
    # 명령줄 인자로 --yes가 있으면 확인 없이 실행
    if len(sys.argv) > 1 and sys.argv[1] == '--yes':
        clear_all_todos()
    else:
        confirm = input("⚠️  모든 일정 데이터를 삭제하시겠습니까? (yes/no): ")
        if confirm.lower() == 'yes':
            clear_all_todos()
        else:
            print("❌ 삭제가 취소되었습니다.")

