"""
데이터베이스 마이그레이션 스크립트
누락된 컬럼들을 추가합니다.
"""
import sys
import os

# 프로젝트 루트를 Python 경로에 추가
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import init_db

if __name__ == "__main__":
    print("데이터베이스 마이그레이션 시작...")
    init_db()
    print("마이그레이션 완료!")

