"""
할일(Todo) API 테스트
"""
import pytest
from datetime import date, timedelta


class TestTodoEndpoints:
    """할일 엔드포인트 테스트"""

    def test_get_todos_unauthorized(self, client):
        """인증 없이 할일 조회 - 401 반환"""
        response = client.get("/todos")
        assert response.status_code == 401

    def test_get_todos_empty(self, client, auth_headers):
        """빈 할일 목록 조회"""
        response = client.get("/todos", headers=auth_headers)
        assert response.status_code == 200
        assert response.json() == []

    def test_get_todos_with_data(self, client, auth_headers, test_todo):
        """할일 목록 조회"""
        response = client.get("/todos", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["title"] == "테스트 할일"

    def test_get_todos_pagination(self, client, auth_headers, db_session, test_user):
        """할일 페이지네이션 테스트"""
        from app.models.models import Todo

        # 5개 할일 생성
        for i in range(5):
            todo = Todo(
                user_id=test_user.id,
                title=f"할일 {i}",
                date=date.today(),
                status="pending"
            )
            db_session.add(todo)
        db_session.commit()

        # limit=2 테스트
        response = client.get("/todos?limit=2", headers=auth_headers)
        assert response.status_code == 200
        assert len(response.json()) == 2

        # skip=2, limit=2 테스트
        response = client.get("/todos?skip=2&limit=2", headers=auth_headers)
        assert response.status_code == 200
        assert len(response.json()) == 2

    def test_create_todo(self, client, auth_headers):
        """할일 생성"""
        todo_data = {
            "title": "새 할일",
            "description": "설명",
            "date": str(date.today()),
            "priority": "high",
            "status": "pending"
        }
        response = client.post("/todos", json=todo_data, headers=auth_headers)
        assert response.status_code == 201
        data = response.json()
        assert data["title"] == "새 할일"
        assert data["priority"] == "high"

    def test_get_todo_by_id(self, client, auth_headers, test_todo):
        """특정 할일 조회"""
        response = client.get(f"/todos/{test_todo.id}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == test_todo.id
        assert data["title"] == test_todo.title

    def test_get_todo_not_found(self, client, auth_headers):
        """존재하지 않는 할일 조회 - 404"""
        response = client.get("/todos/nonexistent-id", headers=auth_headers)
        assert response.status_code == 404

    def test_update_todo(self, client, auth_headers, test_todo):
        """할일 수정"""
        update_data = {"title": "수정된 할일", "status": "completed"}
        response = client.patch(
            f"/todos/{test_todo.id}",
            json=update_data,
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "수정된 할일"
        assert data["status"] == "completed"

    def test_delete_todo(self, client, auth_headers, test_todo):
        """할일 삭제 (소프트 삭제)"""
        response = client.delete(f"/todos/{test_todo.id}", headers=auth_headers)
        assert response.status_code == 204

        # 삭제 후 조회 불가
        response = client.get(f"/todos/{test_todo.id}", headers=auth_headers)
        assert response.status_code == 404

    def test_complete_todo(self, client, auth_headers, test_todo):
        """할일 완료 처리"""
        response = client.post(f"/todos/{test_todo.id}/complete", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "completed"

    def test_get_todos_by_status(self, client, auth_headers, db_session, test_user):
        """상태별 할일 조회"""
        from app.models.models import Todo

        # pending 할일 생성
        todo_pending = Todo(
            user_id=test_user.id,
            title="대기중 할일",
            date=date.today(),
            status="pending"
        )
        db_session.add(todo_pending)

        # completed 할일 생성
        todo_completed = Todo(
            user_id=test_user.id,
            title="완료된 할일",
            date=date.today(),
            status="completed"
        )
        db_session.add(todo_completed)
        db_session.commit()

        # pending만 조회
        response = client.get("/todos?status_filter=pending", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert all(t["status"] == "pending" for t in data)
