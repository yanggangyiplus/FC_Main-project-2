"""
메모(Memo) API 테스트
"""
import pytest


class TestMemoEndpoints:
    """메모 엔드포인트 테스트"""

    def test_get_memos_unauthorized(self, client):
        """인증 없이 메모 조회 - 401 반환"""
        response = client.get("/memos")
        assert response.status_code == 401

    def test_get_memos_empty(self, client, auth_headers):
        """빈 메모 목록 조회"""
        response = client.get("/memos", headers=auth_headers)
        assert response.status_code == 200
        assert response.json() == []

    def test_get_memos_with_data(self, client, auth_headers, test_memo):
        """메모 목록 조회"""
        response = client.get("/memos", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["content"] == "테스트 메모 내용"

    def test_get_memos_pagination(self, client, auth_headers, db_session, test_user):
        """메모 페이지네이션 테스트"""
        from app.models.models import Memo

        # 5개 메모 생성
        for i in range(5):
            memo = Memo(
                user_id=test_user.id,
                content=f"메모 {i}"
            )
            db_session.add(memo)
        db_session.commit()

        # limit=2 테스트
        response = client.get("/memos?limit=2", headers=auth_headers)
        assert response.status_code == 200
        assert len(response.json()) == 2

        # skip=2, limit=2 테스트
        response = client.get("/memos?skip=2&limit=2", headers=auth_headers)
        assert response.status_code == 200
        assert len(response.json()) == 2

    def test_create_memo(self, client, auth_headers):
        """메모 생성"""
        memo_data = {
            "content": "새 메모 내용"
        }
        response = client.post("/memos", json=memo_data, headers=auth_headers)
        assert response.status_code == 201
        data = response.json()
        assert data["content"] == "새 메모 내용"

    def test_get_memo_by_id(self, client, auth_headers, test_memo):
        """특정 메모 조회"""
        response = client.get(f"/memos/{test_memo.id}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == test_memo.id
        assert data["content"] == test_memo.content

    def test_delete_memo(self, client, auth_headers, test_memo):
        """메모 삭제"""
        response = client.delete(f"/memos/{test_memo.id}", headers=auth_headers)
        assert response.status_code == 204

        # 삭제 후 조회 불가
        response = client.get(f"/memos/{test_memo.id}", headers=auth_headers)
        assert response.status_code == 404
