"""
데이터베이스 마이그레이션: deleted_at 컬럼 추가
"""
from sqlalchemy import create_engine, text
from app.config import settings
import logging

logger = logging.getLogger(__name__)

def migrate_add_deleted_at():
    """모든 테이블에 deleted_at 컬럼 추가"""
    engine = create_engine(
        settings.database_url,
        connect_args={"check_same_thread": False}
    )
    
    # 추가할 테이블 목록
    tables = [
        'users',
        'family_members',
        'todos',
        'checklist_items',
        'rules',
        'rule_items',
        'receipts',
        'notifications',
        'memos',
        'routines',
        'audio_files',
        'image_files'
    ]
    
    with engine.connect() as conn:
        for table in tables:
            try:
                # 컬럼이 이미 있는지 확인
                result = conn.execute(text(f"PRAGMA table_info({table})"))
                columns = [row[1] for row in result.fetchall()]
                
                if 'deleted_at' not in columns:
                    logger.info(f"Adding deleted_at column to {table}...")
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN deleted_at DATETIME"))
                    conn.commit()
                    logger.info(f"Successfully added deleted_at to {table}")
                else:
                    logger.info(f"{table} already has deleted_at column")
            except Exception as e:
                logger.error(f"Error adding deleted_at to {table}: {e}")
                # 테이블이 없을 수도 있으므로 계속 진행
    
    logger.info("Migration completed")

if __name__ == "__main__":
    migrate_add_deleted_at()

