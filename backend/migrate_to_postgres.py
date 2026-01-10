#!/usr/bin/env python3
"""
SQLite to PostgreSQL Migration Script
기존 SQLite 데이터를 Supabase PostgreSQL로 마이그레이션

사용법:
    # 1. 환경변수 설정
    export SOURCE_DB="sqlite:///./always-plan.db"
    export TARGET_DB="postgresql://postgres:password@db.xxx.supabase.co:5432/postgres"

    # 2. 스크립트 실행
    python migrate_to_postgres.py
"""
import os
import sys
from datetime import datetime

# 프로젝트 루트를 path에 추가
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine, text, inspect, MetaData
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool


def get_source_engine():
    """SQLite 소스 데이터베이스 엔진"""
    source_url = os.getenv("SOURCE_DB", "sqlite:///./always-plan.db")
    return create_engine(
        source_url,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )


def get_target_engine():
    """PostgreSQL 타겟 데이터베이스 엔진"""
    target_url = os.getenv("TARGET_DB")
    if not target_url:
        raise ValueError("TARGET_DB 환경변수를 설정해주세요. (Supabase PostgreSQL URL)")

    return create_engine(
        target_url,
        pool_size=5,
        max_overflow=10,
        pool_pre_ping=True,
    )


def get_table_order():
    """테이블 마이그레이션 순서 (외래키 의존성 고려)"""
    return [
        'users',
        'family_members',
        'rules',
        'rule_items',
        'todos',
        'checklist_items',
        'receipts',
        'notifications',
        'memos',
        'routines',
        'audio_files',
        'image_files',
    ]


def migrate_table(source_conn, target_conn, table_name: str, source_inspector, target_inspector):
    """단일 테이블 데이터 마이그레이션"""

    # 소스 테이블이 존재하는지 확인
    if table_name not in source_inspector.get_table_names():
        print(f"  ⚠️  소스에 {table_name} 테이블 없음 - 건너뜀")
        return 0

    # 소스 데이터 조회
    result = source_conn.execute(text(f"SELECT * FROM {table_name}"))
    rows = result.fetchall()
    columns = result.keys()

    if not rows:
        print(f"  ℹ️  {table_name}: 데이터 없음")
        return 0

    # 타겟 테이블의 컬럼 확인
    target_columns = [col['name'] for col in target_inspector.get_columns(table_name)]

    # 공통 컬럼만 사용
    common_columns = [col for col in columns if col in target_columns]

    if not common_columns:
        print(f"  ⚠️  {table_name}: 공통 컬럼 없음 - 건너뜀")
        return 0

    # 기존 데이터 삭제 (CASCADE로 처리)
    try:
        target_conn.execute(text(f"TRUNCATE TABLE {table_name} CASCADE"))
        target_conn.commit()
    except Exception as e:
        print(f"  ⚠️  {table_name} TRUNCATE 실패: {e}")
        # TRUNCATE 실패 시 DELETE 시도
        try:
            target_conn.execute(text(f"DELETE FROM {table_name}"))
            target_conn.commit()
        except Exception as e2:
            print(f"  ❌ {table_name} DELETE도 실패: {e2}")
            return 0

    # 데이터 삽입
    inserted = 0
    for row in rows:
        row_dict = dict(zip(columns, row))

        # 공통 컬럼만 추출
        filtered_dict = {k: v for k, v in row_dict.items() if k in common_columns}

        # Boolean 값 변환 (SQLite는 0/1, PostgreSQL은 true/false)
        for key, value in filtered_dict.items():
            if isinstance(value, int) and value in (0, 1):
                # Boolean 컬럼인지 확인 (컬럼명으로 추정)
                bool_keywords = ['enabled', 'is_', 'has_', 'completed', 'verified', 'active', 'synced', 'all_day']
                if any(kw in key.lower() for kw in bool_keywords):
                    filtered_dict[key] = bool(value)

        # INSERT 문 생성
        cols = ', '.join(filtered_dict.keys())
        placeholders = ', '.join([f':{k}' for k in filtered_dict.keys()])

        try:
            target_conn.execute(
                text(f"INSERT INTO {table_name} ({cols}) VALUES ({placeholders})"),
                filtered_dict
            )
            inserted += 1
        except Exception as e:
            print(f"  ⚠️  {table_name} 행 삽입 실패: {e}")
            print(f"      데이터: {filtered_dict}")

    target_conn.commit()
    return inserted


def reset_sequences(target_conn, target_inspector):
    """PostgreSQL 시퀀스 리셋 (auto-increment 값 동기화)"""
    print("\n🔄 시퀀스 리셋 중...")

    for table_name in get_table_order():
        if table_name not in target_inspector.get_table_names():
            continue

        # id 컬럼이 있는지 확인
        columns = [col['name'] for col in target_inspector.get_columns(table_name)]

        if 'id' in columns:
            try:
                # 시퀀스 이름 확인 및 리셋
                target_conn.execute(text(f"""
                    SELECT setval(
                        pg_get_serial_sequence('{table_name}', 'id'),
                        COALESCE((SELECT MAX(id::bigint) FROM {table_name}), 1),
                        true
                    )
                """))
                target_conn.commit()
            except Exception as e:
                # UUID 등 시퀀스가 없는 경우 무시
                pass


def main():
    print("=" * 60)
    print("SQLite → PostgreSQL 마이그레이션")
    print("=" * 60)

    # 엔진 생성
    print("\n📦 데이터베이스 연결 중...")

    try:
        source_engine = get_source_engine()
        print(f"  ✅ 소스 DB 연결 성공: {source_engine.url}")
    except Exception as e:
        print(f"  ❌ 소스 DB 연결 실패: {e}")
        return 1

    try:
        target_engine = get_target_engine()
        print(f"  ✅ 타겟 DB 연결 성공: {target_engine.url.host}")
    except Exception as e:
        print(f"  ❌ 타겟 DB 연결 실패: {e}")
        return 1

    # 테이블 스키마 생성 (SQLAlchemy 모델 기반)
    print("\n📋 테이블 스키마 생성 중...")
    try:
        from app.models.base import Base
        from app.models import user, models  # 모든 모델 import

        Base.metadata.create_all(bind=target_engine)
        print("  ✅ 테이블 스키마 생성 완료")
    except Exception as e:
        print(f"  ❌ 테이블 스키마 생성 실패: {e}")
        return 1

    # Inspector 생성
    source_inspector = inspect(source_engine)
    target_inspector = inspect(target_engine)

    # 데이터 마이그레이션
    print("\n📊 데이터 마이그레이션 시작...")
    total_migrated = 0

    with source_engine.connect() as source_conn, target_engine.connect() as target_conn:
        for table_name in get_table_order():
            print(f"\n  🔄 {table_name} 마이그레이션 중...")
            count = migrate_table(source_conn, target_conn, table_name, source_inspector, target_inspector)
            print(f"     ✅ {count}개 행 마이그레이션 완료")
            total_migrated += count

        # 시퀀스 리셋
        reset_sequences(target_conn, target_inspector)

    print("\n" + "=" * 60)
    print(f"✅ 마이그레이션 완료! 총 {total_migrated}개 행 이전됨")
    print("=" * 60)

    return 0


if __name__ == "__main__":
    sys.exit(main())
