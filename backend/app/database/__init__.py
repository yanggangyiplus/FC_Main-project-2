"""
Database Configuration
SQLite + SQLAlchemy ORM (04_DATABASE_DESIGN.md 참고)
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool
from app.config import settings
import logging

logger = logging.getLogger(__name__)

# SQLite 데이터베이스 설정
engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
    echo=False,  # SQL 로그 출력 안함
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
    
    logger.info("Initializing database...")
    Base.metadata.create_all(bind=engine)
    
    # 마이그레이션: 누락된 컬럼 추가
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
        logger.warning(f"Migration warning: {e}")
    
    logger.info("Database initialized successfully")


def close_db():
    """데이터베이스 연결 종료"""
    engine.dispose()
