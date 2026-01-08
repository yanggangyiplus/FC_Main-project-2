"""
데이터베이스 마이그레이션: users 테이블에 google_calendar_import_enabled, google_calendar_export_enabled 컬럼 추가
"""
from sqlalchemy import create_engine, text
import logging
import os

# 환경 변수에서 데이터베이스 URL 가져오기
database_url = os.getenv('DATABASE_URL', 'sqlite:///./momflow.db')

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def migrate_add_google_calendar_import_export():
    """users 테이블에 google_calendar_import_enabled, google_calendar_export_enabled 컬럼 추가"""
    engine = create_engine(
        database_url,
        connect_args={"check_same_thread": False}
    )
    
    with engine.connect() as conn:
        try:
            # 컬럼이 이미 있는지 확인
            result = conn.execute(text("PRAGMA table_info(users)"))
            columns = [row[1] for row in result.fetchall()]
            
            if 'google_calendar_import_enabled' not in columns:
                logger.info("Adding google_calendar_import_enabled column to users table...")
                conn.execute(text("ALTER TABLE users ADD COLUMN google_calendar_import_enabled VARCHAR(10) DEFAULT 'false'"))
                conn.commit()
                logger.info("Successfully added google_calendar_import_enabled to users table")
            else:
                logger.info("users table already has google_calendar_import_enabled column")
            
            if 'google_calendar_export_enabled' not in columns:
                logger.info("Adding google_calendar_export_enabled column to users table...")
                conn.execute(text("ALTER TABLE users ADD COLUMN google_calendar_export_enabled VARCHAR(10) DEFAULT 'false'"))
                conn.commit()
                logger.info("Successfully added google_calendar_export_enabled to users table")
            else:
                logger.info("users table already has google_calendar_export_enabled column")
        except Exception as e:
            logger.error(f"Error adding columns to users: {e}")
            raise
    
    logger.info("Migration completed")

if __name__ == "__main__":
    migrate_add_google_calendar_import_export()

