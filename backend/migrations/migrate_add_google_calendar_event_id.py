"""
데이터베이스 마이그레이션: todos 테이블에 google_calendar_event_id 컬럼 추가
"""
from sqlalchemy import create_engine, text
import logging
import os

# 환경 변수에서 데이터베이스 URL 가져오기 (설정 파일 없이 직접)
database_url = os.getenv('DATABASE_URL', 'sqlite:///./momflow.db')

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def migrate_add_google_calendar_event_id():
    """todos 테이블에 google_calendar_event_id 컬럼 추가"""
    engine = create_engine(
        database_url,
        connect_args={"check_same_thread": False}
    )
    
    with engine.connect() as conn:
        try:
            # 컬럼이 이미 있는지 확인
            result = conn.execute(text("PRAGMA table_info(todos)"))
            columns = [row[1] for row in result.fetchall()]
            
            if 'google_calendar_event_id' not in columns:
                logger.info("Adding google_calendar_event_id column to todos table...")
                conn.execute(text("ALTER TABLE todos ADD COLUMN google_calendar_event_id VARCHAR(255)"))
                # 인덱스 추가
                conn.execute(text("CREATE INDEX IF NOT EXISTS idx_todos_google_calendar_event_id ON todos(google_calendar_event_id)"))
                conn.commit()
                logger.info("Successfully added google_calendar_event_id to todos table")
            else:
                logger.info("todos table already has google_calendar_event_id column")
        except Exception as e:
            logger.error(f"Error adding google_calendar_event_id to todos: {e}")
            raise
    
    logger.info("Migration completed")

if __name__ == "__main__":
    migrate_add_google_calendar_event_id()

