"""
시간표(Routine) API 테스트
"""
import pytest


class TestRoutineEndpoints:
    """시간표 엔드포인트 테스트"""

    def test_get_routines_unauthorized(self, client):
        """인증 없이 시간표 조회 - 401 반환"""
        response = client.get("/routines")
        assert response.status_code == 401

    def test_get_routines_empty(self, client, auth_headers):
        """빈 시간표 목록 조회"""
        response = client.get("/routines", headers=auth_headers)
        assert response.status_code == 200
        assert response.json() == []

    def test_get_routines_with_data(self, client, auth_headers, test_routine):
        """시간표 목록 조회"""
        response = client.get("/routines", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == "테스트 시간표"

    def test_get_routines_pagination(self, client, auth_headers, db_session, test_user, test_family_member):
        """시간표 페이지네이션 테스트"""
        from app.models.models import Routine
        import json

        # 5개 시간표 생성
        for i in range(5):
            routine = Routine(
                user_id=test_user.id,
                member_id=test_family_member.id,
                name=f"시간표 {i}",
                time_slots=json.dumps([{"day": 1, "startTime": "09:00", "duration": 60}])
            )
            db_session.add(routine)
        db_session.commit()

        # limit=2 테스트
        response = client.get("/routines?limit=2", headers=auth_headers)
        assert response.status_code == 200
        assert len(response.json()) == 2

        # skip=2, limit=2 테스트
        response = client.get("/routines?skip=2&limit=2", headers=auth_headers)
        assert response.status_code == 200
        assert len(response.json()) == 2

    def test_create_routine(self, client, auth_headers, test_family_member):
        """시간표 생성"""
        routine_data = {
            "name": "새 시간표",
            "member_id": test_family_member.id,
            "color": "#FF0000",
            "category": "학원",
            "time_slots": [
                {"day": 1, "startTime": "10:00", "duration": 90}
            ],
            "add_to_calendar": False
        }
        response = client.post("/routines", json=routine_data, headers=auth_headers)
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "새 시간표"
        assert data["category"] == "학원"

    def test_get_routine_by_id(self, client, auth_headers, test_routine):
        """특정 시간표 조회"""
        response = client.get(f"/routines/{test_routine.id}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == test_routine.id
        assert data["name"] == test_routine.name

    def test_get_routine_not_found(self, client, auth_headers):
        """존재하지 않는 시간표 조회 - 404"""
        response = client.get("/routines/nonexistent-id", headers=auth_headers)
        assert response.status_code == 404

    def test_update_routine(self, client, auth_headers, test_routine):
        """시간표 수정"""
        update_data = {"name": "수정된 시간표", "color": "#00FF00"}
        response = client.patch(
            f"/routines/{test_routine.id}",
            json=update_data,
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "수정된 시간표"
        assert data["color"] == "#00FF00"

    def test_delete_routine(self, client, auth_headers, test_routine):
        """시간표 삭제"""
        response = client.delete(f"/routines/{test_routine.id}", headers=auth_headers)
        assert response.status_code == 204

        # 삭제 후 조회 불가
        response = client.get(f"/routines/{test_routine.id}", headers=auth_headers)
        assert response.status_code == 404

    def test_delete_all_routines(self, client, auth_headers, db_session, test_user, test_family_member):
        """모든 시간표 삭제"""
        from app.models.models import Routine
        import json

        # 3개 시간표 생성
        for i in range(3):
            routine = Routine(
                user_id=test_user.id,
                member_id=test_family_member.id,
                name=f"시간표 {i}",
                time_slots=json.dumps([])
            )
            db_session.add(routine)
        db_session.commit()

        # 삭제 전 확인
        response = client.get("/routines", headers=auth_headers)
        assert len(response.json()) == 3

        # 모두 삭제
        response = client.delete("/routines/all", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["deleted_count"] == 3

        # 삭제 후 확인
        response = client.get("/routines", headers=auth_headers)
        assert response.json() == []
