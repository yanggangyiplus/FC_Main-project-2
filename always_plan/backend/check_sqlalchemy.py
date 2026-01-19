# -*- coding: utf-8 -*-
"""Check SQLAlchemy returns for has_notification"""
import sys
sys.path.insert(0, '.')

from app.database import SessionLocal
from app.models.models import Todo

db = SessionLocal()

try:
    # 첫 10개 todos 조회
    todos = db.query(Todo).filter(Todo.deleted_at.is_(None)).limit(10).all()
    
    print("SQLAlchemy로 조회한 has_notification 값:")
    print("=" * 70)
    
    for i, todo in enumerate(todos):
        print(f"[{i}] title: {todo.title[:25] if todo.title else 'N/A'}")
        print(f"    has_notification: {todo.has_notification} (type: {type(todo.has_notification).__name__})")
        print(f"    notification_reminders: {todo.notification_reminders[:50] if todo.notification_reminders else 'None'}...")
        print()
    
    # has_notification이 True인 것 개수
    count_true = db.query(Todo).filter(
        Todo.deleted_at.is_(None),
        Todo.has_notification == True
    ).count()
    print(f"has_notification == True: {count_true}")
    
    # has_notification이 1인 것 개수
    count_one = db.query(Todo).filter(
        Todo.deleted_at.is_(None),
        Todo.has_notification == 1
    ).count()
    print(f"has_notification == 1: {count_one}")
    
    # notification_reminders가 있는 것 개수
    from sqlalchemy import and_, or_
    count_reminders = db.query(Todo).filter(
        Todo.deleted_at.is_(None),
        Todo.notification_reminders.isnot(None),
        Todo.notification_reminders != '[]',
        Todo.notification_reminders != ''
    ).count()
    print(f"notification_reminders가 있는 것: {count_reminders}")

finally:
    db.close()
