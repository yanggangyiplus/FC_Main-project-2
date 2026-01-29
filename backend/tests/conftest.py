"""
테스트 설정 및 픽스처
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
import os
import sys

# 프로젝트 루트를 path에 추가
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.models.base import Base
from app.models.user import User
from app.models.models import Todo, FamilyMember, Memo, Routine, Receipt, Notification
from app.database import get_db
from app.services.auth_service import AuthService
from main import app


# 테스트용 인메모리 SQLite 데이터베이스
SQLALCHEMY_TEST_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db_session():
    """테스트용 데이터베이스 세션"""
    # 테이블 생성
    Base.metadata.create_all(bind=engine)

    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        # 테이블 삭제 (각 테스트 후 클린업)
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db_session):
    """테스트 클라이언트"""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


@pytest.fixture
def test_user(db_session):
    """테스트 사용자 생성"""
    user = User(
        email="test@example.com",
        name="Test User",
        google_id="google_test_123",
        avatar_emoji="🧪"
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def auth_headers(test_user):
    """인증 헤더 (JWT 토큰)"""
    tokens = AuthService.generate_tokens(test_user.id, test_user.email)
    return {"Authorization": f"Bearer {tokens['access_token']}"}


@pytest.fixture
def test_todo(db_session, test_user):
    """테스트 할일 생성"""
    from datetime import date

    todo = Todo(
        user_id=test_user.id,
        title="테스트 할일",
        description="테스트 설명",
        date=date.today(),
        status="pending",
        priority="medium"
    )
    db_session.add(todo)
    db_session.commit()
    db_session.refresh(todo)
    return todo


@pytest.fixture
def test_family_member(db_session, test_user):
    """테스트 가족 구성원 생성"""
    member = FamilyMember(
        user_id=test_user.id,
        name="테스트 가족",
        emoji="👨",
        color_code="#FF0000",
        relation="spouse"
    )
    db_session.add(member)
    db_session.commit()
    db_session.refresh(member)
    return member


@pytest.fixture
def test_memo(db_session, test_user):
    """테스트 메모 생성"""
    memo = Memo(
        user_id=test_user.id,
        content="테스트 메모 내용"
    )
    db_session.add(memo)
    db_session.commit()
    db_session.refresh(memo)
    return memo


@pytest.fixture
def test_routine(db_session, test_user, test_family_member):
    """테스트 루틴 생성"""
    import json

    routine = Routine(
        user_id=test_user.id,
        member_id=test_family_member.id,
        name="테스트 시간표",
        color="#0000FF",
        category="학교",
        time_slots=json.dumps([{"day": 1, "startTime": "09:00", "duration": 60}])
    )
    db_session.add(routine)
    db_session.commit()
    db_session.refresh(routine)
    return routine
