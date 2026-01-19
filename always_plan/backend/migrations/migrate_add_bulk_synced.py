"""
데이터베이스 마이그레이션: todos 테이블에 bulk_synced 컬럼 추가
"""
from sqlalchemy import create_engine, text
import logging
import os

# 환경 변수에서 데이터베이스 URL 가져오기
database_url = os.getenv('DATABASE_URL', 'sqlite:///./momflow.db')

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def migrate_add_bulk_synced():
    """todos 테이블에 bulk_synced 컬럼 추가"""
    engine = create_engine(
        database_url,
        connect_args={"check_same_thread": False}
    )
    
    with engine.connect() as conn:
        try:
            # 컬럼이 이미 있는지 확인
            result = conn.execute(text("PRAGMA table_info(todos)"))
            columns = [row[1] for row in result.fetchall()]
            
            if 'bulk_synced' not in columns:
                logger.info("Adding bulk_synced column to todos table...")
                conn.execute(text("ALTER TABLE todos ADD COLUMN bulk_synced BOOLEAN DEFAULT 0"))
                conn.commit()
                logger.info("Successfully added bulk_synced to todos table")
            else:
                logger.info("todos table already has bulk_synced column")
        except Exception as e:
            logger.error(f"Error adding bulk_synced to todos: {e}")
            raise
    
    logger.info("Migration completed")

if __name__ == "__main__":
    migrate_add_bulk_synced()

