"""
인증 API 테스트
"""
import pytest


class TestAuthEndpoints:
    """인증 엔드포인트 테스트"""

    def test_google_init(self, client):
        """Google OAuth 초기화 테스트"""
        response = client.get("/auth/google-init")
        assert response.status_code == 200
        data = response.json()
        assert "auth_url" in data
        assert "state" in data
        assert len(data["state"]) > 0

    def test_get_current_user_unauthorized(self, client):
        """인증 없이 현재 사용자 조회 - 401 반환"""
        response = client.get("/auth/me")
        assert response.status_code == 401

    def test_get_current_user_authorized(self, client, auth_headers, test_user):
        """인증된 사용자 조회"""
        response = client.get("/auth/me", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == test_user.email
        assert data["name"] == test_user.name

    def test_logout(self, client, auth_headers):
        """로그아웃 테스트"""
        response = client.post("/auth/logout", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Logged out successfully"

    def test_update_current_user(self, client, auth_headers, test_user):
        """현재 사용자 정보 업데이트"""
        update_data = {"name": "Updated Name", "avatar_emoji": "🚀"}
        response = client.patch("/auth/me", json=update_data, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Name"
        assert data["avatar_emoji"] == "🚀"

    def test_refresh_token_invalid(self, client):
        """유효하지 않은 리프레시 토큰"""
        response = client.post("/auth/refresh", json={"refresh_token": "invalid_token"})
        assert response.status_code == 401
