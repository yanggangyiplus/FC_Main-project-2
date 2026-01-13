"""
시간표 데이터 삭제 스크립트
"""
import sys
import os

# 프로젝트 루트를 Python 경로에 추가
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal
from app.models.models import Routine

def delete_all_routines():
    """모든 시간표 데이터 삭제"""
    db = SessionLocal()
    try:
        # 모든 시간표 조회
        routines = db.query(Routine).all()
        count = len(routines)
        
        if count == 0:
            print("삭제할 시간표가 없습니다.")
            return
        
        # 모든 시간표 삭제
        for routine in routines:
            db.delete(routine)
        
        db.commit()
        print(f"총 {count}개의 시간표가 삭제되었습니다.")
    except Exception as e:
        db.rollback()
        print(f"오류 발생: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    confirm = input("모든 시간표 데이터를 삭제하시겠습니까? (yes/no): ")
    if confirm.lower() == "yes":
        delete_all_routines()
    else:
        print("취소되었습니다.")




