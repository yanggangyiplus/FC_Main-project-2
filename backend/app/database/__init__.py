"""
Database Configuration
SQLAlchemy ORM - SQLite/PostgreSQL 호환 (04_DATABASE_DESIGN.md 참고)
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool, QueuePool
from app.config import settings
import logging

logger = logging.getLogger(__name__)

# 데이터베이스 URL에 따라 엔진 설정 분기
def create_db_engine():
    """SQLite와 PostgreSQL을 모두 지원하는 엔진 생성"""
    db_url = settings.database_url

    if db_url.startswith("sqlite"):
        # SQLite 설정 (로컬 개발용)
        return create_engine(
            db_url,
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
            echo=False,
        )
    else:
        # PostgreSQL 설정 (Supabase 등 프로덕션용)
        return create_engine(
            db_url,
            poolclass=QueuePool,
            pool_size=5,
            max_overflow=10,
            pool_pre_ping=True,  # 연결 상태 확인
            echo=False,
        )

engine = create_db_engine()

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)


def get_db() -> Session:
    """데이터베이스 세션 반환 (의존성 주입용)"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_existing_columns(inspector, table_name: str) -> list:
    """테이블의 기존 컬럼 목록 조회 (SQLite/PostgreSQL 호환)"""
    try:
        columns = inspector.get_columns(table_name)
        return [col['name'] for col in columns]
    except Exception:
        return []


def add_column_if_not_exists(conn, table_name: str, column_name: str, column_type: str, default=None):
    """컬럼이 없으면 추가 (SQLite/PostgreSQL 호환)"""
    from sqlalchemy import text

    try:
        if default is not None:
            sql = f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_type} DEFAULT {default}"
        else:
            sql = f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_type}"
        conn.execute(text(sql))
        conn.commit()
        logger.info(f"✓ {table_name} 테이블에 {column_name} 컬럼 추가 완료")
        return True
    except Exception as e:
        # 컬럼이 이미 존재하면 에러 무시
        if "already exists" in str(e).lower() or "duplicate column" in str(e).lower():
            return False
        logger.warning(f"✗ {column_name} 컬럼 추가 실패: {e}")
        return False


def init_db():
    """데이터베이스 초기화 및 마이그레이션"""
    from app.models.base import Base
    from sqlalchemy import text, inspect

    logger.info("Initializing database...")
    Base.metadata.create_all(bind=engine)

    # 마이그레이션: 누락된 컬럼 추가
    try:
        inspector = inspect(engine)
        db_url = settings.database_url
        is_postgres = not db_url.startswith("sqlite")

        with engine.connect() as conn:
            # todos 테이블 마이그레이션
            if 'todos' in inspector.get_table_names():
                existing_columns = get_existing_columns(inspector, 'todos')
                logger.info(f"todos 테이블 기존 컬럼: {existing_columns}")

                # 필요한 컬럼 목록 (PostgreSQL 타입 사용)
                required_columns = {
                    'memo': 'TEXT',
                    'location': 'VARCHAR(255)',
                    'deleted_at': 'TIMESTAMP',
                    'repeat_type': 'VARCHAR(20)',
                    'repeat_end_date': 'DATE',
                    'repeat_days': 'VARCHAR(20)',
                    'has_notification': 'BOOLEAN',
                    'notification_times': 'TEXT',
                    'family_member_ids': 'TEXT',
                    'source': 'VARCHAR(50)',
                    'completed_at': 'TIMESTAMP',
                }

                # 누락된 컬럼 추가
                for column_name, column_type in required_columns.items():
                    if column_name not in existing_columns:
                        default = 'FALSE' if column_type == 'BOOLEAN' else None
                        add_column_if_not_exists(conn, 'todos', column_name, column_type, default)

            # users 테이블에 Google Calendar 필드 추가
            if 'users' in inspector.get_table_names():
                existing_columns = get_existing_columns(inspector, 'users')

                if 'google_calendar_token' not in existing_columns:
                    add_column_if_not_exists(conn, 'users', 'google_calendar_token', 'VARCHAR(2000)')

                if 'google_calendar_enabled' not in existing_columns:
                    add_column_if_not_exists(conn, 'users', 'google_calendar_enabled', "VARCHAR(10)", "'false'")

            # 다른 테이블에 deleted_at 컬럼 추가
            tables = [
                'family_members', 'checklist_items',
                'rules', 'rule_items', 'receipts', 'notifications',
                'memos', 'routines', 'audio_files', 'image_files'
            ]

            for table in tables:
                try:
                    if table in inspector.get_table_names():
                        columns = get_existing_columns(inspector, table)

                        if 'deleted_at' not in columns:
                            logger.info(f"Adding deleted_at column to {table}...")
                            add_column_if_not_exists(conn, table, 'deleted_at', 'TIMESTAMP')
                except Exception as e:
                    logger.debug(f"Could not add deleted_at to {table}: {e}")
    except Exception as e:
        logger.warning(f"Migration warning: {e}")

    logger.info("Database initialized successfully")


def close_db():
    """데이터베이스 연결 종료"""
    engine.dispose()
