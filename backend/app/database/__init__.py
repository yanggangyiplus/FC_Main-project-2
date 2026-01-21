"""
Database Configuration
SQLite + SQLAlchemy ORM (04_DATABASE_DESIGN.md 참고)
PostgreSQL 지원 (Cloud SQL)
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool, NullPool
from app.config import settings
import logging

logger = logging.getLogger(__name__)

# 데이터베이스 타입 확인
is_sqlite = settings.database_url.startswith('sqlite:///')
is_postgresql = settings.database_url.startswith('postgresql://')

# 데이터베이스별 설정
if is_sqlite:
    # SQLite 전용 설정
    engine = create_engine(
        settings.database_url,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        echo=False,  # SQL 로그 출력 안함
    )
elif is_postgresql:
    # PostgreSQL 설정 (Cloud SQL)
    engine = create_engine(
        settings.database_url,
        poolclass=NullPool,  # Cloud Run에서는 연결 풀링 비활성화
        pool_pre_ping=True,  # 연결 유효성 검사
        echo=False,
        connect_args={
            "connect_timeout": 10,  # 연결 타임아웃 10초
        }
    )
else:
    # 기본 설정 (기타 데이터베이스)
    engine = create_engine(
        settings.database_url,
        echo=False,
    )

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


def init_db():
    """데이터베이스 초기화 및 마이그레이션"""
    from app.models.base import Base
    from sqlalchemy import text, inspect
    
    logger.info(f"Initializing database... (URL: {settings.database_url[:50]}...)")
    logger.info(f"Database type: SQLite={is_sqlite}, PostgreSQL={is_postgresql}")
    
    try:
        # 연결 테스트
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
            logger.info("✓ Database connection successful")
    except Exception as e:
        logger.error(f"✗ Database connection failed: {e}")
        logger.error(f"Database URL: {settings.database_url}")
        # 연결 실패해도 계속 진행 (에러만 로깅)
        logger.warning("Continuing despite connection error...")
    
    try:
        # 테이블 생성 (SQLAlchemy ORM 사용)
        Base.metadata.create_all(bind=engine)
        logger.info("✓ Tables created/verified")
    except Exception as e:
        logger.error(f"✗ Table creation failed: {e}")
        # 테이블 생성 실패는 치명적이지 않을 수 있으므로 경고만
        logger.warning("Table creation warning, continuing...")
    
    # SQLite 전용 마이그레이션 (PRAGMA 명령 사용)
    if is_sqlite:
        try:
            inspector = inspect(engine)
            with engine.connect() as conn:
                # todos 테이블 마이그레이션
                if 'todos' in inspector.get_table_names():
                    result = conn.execute(text("PRAGMA table_info(todos)"))
                    existing_columns = [row[1] for row in result.fetchall()]
                    logger.info(f"todos 테이블 기존 컬럼: {existing_columns}")
                    
                    # 필요한 컬럼 목록
                    required_columns = {
                        'memo': 'TEXT',
                        'location': 'VARCHAR(255)',
                        'deleted_at': 'DATETIME',
                        'repeat_type': 'VARCHAR(20)',
                        'repeat_end_date': 'DATE',
                        'repeat_days': 'VARCHAR(20)',
                        'has_notification': 'INTEGER',  # SQLite는 BOOLEAN을 INTEGER로 저장
                        'notification_times': 'TEXT',
                        'family_member_ids': 'TEXT',
                        'source': 'VARCHAR(50)',
                        'completed_at': 'DATETIME',
                    }
                    
                    # 누락된 컬럼 추가
                    for column_name, column_type in required_columns.items():
                        if column_name not in existing_columns:
                            try:
                                if column_type == 'INTEGER':
                                    sql = f"ALTER TABLE todos ADD COLUMN {column_name} {column_type} DEFAULT 0"
                                else:
                                    sql = f"ALTER TABLE todos ADD COLUMN {column_name} {column_type}"
                                conn.execute(text(sql))
                                conn.commit()
                                logger.info(f"✓ todos 테이블에 {column_name} 컬럼 추가 완료")
                            except Exception as e:
                                logger.warning(f"✗ {column_name} 컬럼 추가 실패: {e}")
                
                # users 테이블에 Google Calendar 필드 추가
                if 'users' in inspector.get_table_names():
                    result = conn.execute(text("PRAGMA table_info(users)"))
                    existing_columns = [row[1] for row in result.fetchall()]
                    
                    if 'google_calendar_token' not in existing_columns:
                        try:
                            conn.execute(text("ALTER TABLE users ADD COLUMN google_calendar_token VARCHAR(2000)"))
                            conn.commit()
                            logger.info("✓ users 테이블에 google_calendar_token 컬럼 추가 완료")
                        except Exception as e:
                            logger.warning(f"✗ google_calendar_token 컬럼 추가 실패: {e}")
                    
                    if 'google_calendar_enabled' not in existing_columns:
                        try:
                            conn.execute(text("ALTER TABLE users ADD COLUMN google_calendar_enabled VARCHAR(10) DEFAULT 'false'"))
                            conn.commit()
                            logger.info("✓ users 테이블에 google_calendar_enabled 컬럼 추가 완료")
                        except Exception as e:
                            logger.warning(f"✗ google_calendar_enabled 컬럼 추가 실패: {e}")
                
                # 다른 테이블에 deleted_at 컬럼 추가
                tables = [
                    'family_members', 'checklist_items',
                    'rules', 'rule_items', 'receipts', 'notifications',
                    'memos', 'routines', 'audio_files', 'image_files'
                ]
                
                for table in tables:
                    try:
                        if table in inspector.get_table_names():
                            result = conn.execute(text(f"PRAGMA table_info({table})"))
                            columns = [row[1] for row in result.fetchall()]
                            
                            if 'deleted_at' not in columns:
                                logger.info(f"Adding deleted_at column to {table}...")
                                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN deleted_at DATETIME"))
                                conn.commit()
                                logger.info(f"Successfully added deleted_at to {table}")
                    except Exception as e:
                        logger.debug(f"Could not add deleted_at to {table}: {e}")
        except Exception as e:
            logger.warning(f"SQLite migration warning: {e}")
    elif is_postgresql:
        # PostgreSQL에서는 SQLAlchemy ORM으로 테이블이 자동 생성되므로
        # 추가 마이그레이션은 필요 없습니다.
        logger.info("✓ PostgreSQL database initialized (ORM handles schema)")
    
    logger.info("Database initialized successfully")


def close_db():
    """데이터베이스 연결 종료"""
    engine.dispose()
