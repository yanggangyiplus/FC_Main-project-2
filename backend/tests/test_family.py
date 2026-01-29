"""
가족 구성원(Family) API 테스트
"""
import pytest


class TestFamilyEndpoints:
    """가족 구성원 엔드포인트 테스트"""

    def test_get_family_members_unauthorized(self, client):
        """인증 없이 가족 구성원 조회 - 401 반환"""
        response = client.get("/family/members")
        assert response.status_code == 401

    def test_get_family_members_empty(self, client, auth_headers):
        """빈 가족 구성원 목록 조회"""
        response = client.get("/family/members", headers=auth_headers)
        assert response.status_code == 200
        assert response.json() == []

    def test_get_family_members_with_data(self, client, auth_headers, test_family_member):
        """가족 구성원 목록 조회"""
        response = client.get("/family/members", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == "테스트 가족"

    def test_get_family_members_pagination(self, client, auth_headers, db_session, test_user):
        """가족 구성원 페이지네이션 테스트"""
        from app.models.models import FamilyMember

        # 5명 가족 구성원 생성
        for i in range(5):
            member = FamilyMember(
                user_id=test_user.id,
                name=f"가족 {i}",
                emoji="👤",
                color_code="#000000"
            )
            db_session.add(member)
        db_session.commit()

        # limit=2 테스트
        response = client.get("/family/members?limit=2", headers=auth_headers)
        assert response.status_code == 200
        assert len(response.json()) == 2

        # skip=2, limit=2 테스트
        response = client.get("/family/members?skip=2&limit=2", headers=auth_headers)
        assert response.status_code == 200
        assert len(response.json()) == 2

    def test_create_family_member(self, client, auth_headers):
        """가족 구성원 생성"""
        member_data = {
            "name": "새 가족",
            "emoji": "👶",
            "color": "#00FF00",
            "relation": "child"
        }
        response = client.post("/family/members", json=member_data, headers=auth_headers)
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "새 가족"
        assert data["emoji"] == "👶"

    def test_get_family_member_by_id(self, client, auth_headers, test_family_member):
        """특정 가족 구성원 조회"""
        response = client.get(
            f"/family/members/{test_family_member.id}",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == test_family_member.id
        assert data["name"] == test_family_member.name

    def test_get_family_member_not_found(self, client, auth_headers):
        """존재하지 않는 가족 구성원 조회 - 404"""
        response = client.get("/family/members/nonexistent-id", headers=auth_headers)
        assert response.status_code == 404

    def test_update_family_member(self, client, auth_headers, test_family_member):
        """가족 구성원 수정"""
        update_data = {"name": "수정된 이름", "emoji": "🎉"}
        response = client.patch(
            f"/family/members/{test_family_member.id}",
            json=update_data,
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "수정된 이름"
        assert data["emoji"] == "🎉"

    def test_delete_family_member(self, client, auth_headers, test_family_member):
        """가족 구성원 삭제 (소프트 삭제)"""
        response = client.delete(
            f"/family/members/{test_family_member.id}",
            headers=auth_headers
        )
        assert response.status_code == 204

        # 삭제 후 조회 불가
        response = client.get(
            f"/family/members/{test_family_member.id}",
            headers=auth_headers
        )
        assert response.status_code == 404
