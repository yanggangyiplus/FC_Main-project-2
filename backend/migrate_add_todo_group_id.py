"""
데이터베이스 마이그레이션: todos 테이블에 todo_group_id 컬럼 추가
여러 날짜에 걸친 일정을 하나의 그룹으로 묶어 관리하기 위함
"""
from sqlalchemy import create_engine, text
import logging
import os

# 환경 변수에서 데이터베이스 URL 가져오기
database_url = os.getenv('DATABASE_URL', 'sqlite:///./momflow.db')

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def migrate_add_todo_group_id():
    """todos 테이블에 todo_group_id 컬럼 추가"""
    engine = create_engine(
        database_url,
        connect_args={"check_same_thread": False}
    )
    
    with engine.connect() as conn:
        try:
            # 컬럼이 이미 있는지 확인
            result = conn.execute(text("PRAGMA table_info(todos)"))
            columns = [row[1] for row in result.fetchall()]
            
            if 'todo_group_id' not in columns:
                logger.info("Adding todo_group_id column to todos table...")
                conn.execute(text("ALTER TABLE todos ADD COLUMN todo_group_id VARCHAR(255)"))
                conn.commit()
                logger.info("Successfully added todo_group_id to todos table")
            else:
                logger.info("todos table already has todo_group_id column")
        except Exception as e:
            logger.error(f"Error adding todo_group_id to todos: {e}")
            raise
    
    logger.info("Migration completed")

if __name__ == "__main__":
    migrate_add_todo_group_id()

