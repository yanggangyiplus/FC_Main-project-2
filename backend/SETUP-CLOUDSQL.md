# Cloud SQL (PostgreSQL) 설정 가이드

Always Plan 백엔드를 Cloud SQL PostgreSQL과 연동하는 방법입니다.

## 1. Cloud SQL 인스턴스 생성

### 방법 A: Google Cloud Console에서

1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. **SQL** 메뉴로 이동
3. **인스턴스 만들기** 클릭
4. **PostgreSQL** 선택
5. 인스턴스 설정:
   - **인스턴스 ID**: `always-plan-db`
   - **비밀번호**: 강력한 비밀번호 설정 (기억해두세요!)
   - **리전**: `asia-northeast3` (서울, Cloud Run과 같은 리전 권장)
   - **데이터베이스 버전**: PostgreSQL 14 또는 15
   - **기본 머신 유형**: `db-f1-micro` (무료 티어) 또는 `db-g1-small`
   - **스토리지**: `10GB` (필요에 따라 조정)

### 방법 B: gcloud CLI로 생성

```bash
# Cloud SQL 인스턴스 생성
gcloud sql instances create always-plan-db \
  --database-version=POSTGRES_14 \
  --tier=db-f1-micro \
  --region=asia-northeast3 \
  --project=always-plan-2025

# 루트 비밀번호 설정
gcloud sql users set-password postgres \
  --instance=always-plan-db \
  --password=YOUR_SECURE_PASSWORD \
  --project=always-plan-2025
```

## 2. 데이터베이스 생성

```bash
# 데이터베이스 생성
gcloud sql databases create always_plan \
  --instance=always-plan-db \
  --project=always-plan-2025
```

## 3. Cloud Run에 Cloud SQL 연결

### Cloud Run 서비스 업데이트

```bash
gcloud run services update always-plan-api \
  --add-cloudsql-instances always-plan-2025:asia-northeast3:always-plan-db \
  --region asia-northeast3 \
  --project always-plan-2025
```

### 연결 문자열 설정

연결 문자열 형식:
```
postgresql://[USERNAME]:[PASSWORD]@/[DATABASE]?host=/cloudsql/[PROJECT_ID]:[REGION]:[INSTANCE_NAME]
```

예시:
```
postgresql://postgres:YOUR_PASSWORD@/always_plan?host=/cloudsql/always-plan-2025:asia-northeast3:always-plan-db
```

## 4. 환경변수 설정

Cloud Run에 데이터베이스 연결 문자열 추가:

```bash
gcloud run services update always-plan-api \
  --region asia-northeast3 \
  --project always-plan-2025 \
  --update-env-vars "DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@/always_plan?host=/cloudsql/always-plan-2025:asia-northeast3:always-plan-db"
```

⚠️ **보안 주의**: 비밀번호를 명령어에 직접 입력하지 마세요. 환경변수 파일을 사용하는 것이 좋습니다.

### 환경변수 파일 사용 (권장)

`backend/env-vars-db.yaml` 파일 생성:

```yaml
DATABASE_URL: "postgresql://postgres:YOUR_PASSWORD@/always_plan?host=/cloudsql/always-plan-2025:asia-northeast3:always-plan-db"
```

그리고 업데이트:

```bash
cd backend
gcloud run services update always-plan-api \
  --region asia-northeast3 \
  --project always-plan-2025 \
  --env-vars-file env-vars-db.yaml
```

## 5. 백엔드 코드 확인

SQLAlchemy가 PostgreSQL을 지원하는지 확인:

### requirements.txt 확인

PostgreSQL 드라이버가 포함되어 있는지 확인:

```
psycopg2-binary>=2.9.0
```

또는

```
asyncpg>=0.28.0  # 비동기용
```

없다면 추가:

```bash
cd backend
pip install psycopg2-binary
pip freeze > requirements.txt
```

## 6. 마이그레이션 실행

Cloud Run이 시작되면 자동으로 `init_db()` 함수가 실행되어 테이블을 생성합니다.

수동으로 마이그레이션을 실행하려면:

```bash
# 로컬에서 Cloud SQL에 직접 연결 (Cloud SQL 프록시 사용)
gcloud sql connect always-plan-db \
  --user=postgres \
  --database=always_plan \
  --project=always-plan-2025

# 또는 Python 스크립트 실행
python -c "from app.database import init_db; init_db()"
```

## 7. 방화벽 규칙 (선택사항)

Cloud SQL 인스턴스에 외부에서 접근하려면:

1. Cloud SQL → 연결 → 공개 IP 활성화
2. 승인된 네트워크에 IP 추가

⚠️ **보안**: Cloud Run을 통해서만 접근하는 것을 권장합니다.

## 8. 확인

### Cloud Run 로그 확인

```bash
gcloud run services logs read always-plan-api \
  --region asia-northeast3 \
  --project always-plan-2025 \
  --limit 50
```

### 데이터베이스 연결 테스트

Cloud Run 로그에서 다음 메시지를 확인:
- `Database initialized successfully`
- 에러가 없다면 성공

## 9. 기존 SQLite 데이터 마이그레이션 (선택사항)

로컬 SQLite 데이터를 Cloud SQL로 마이그레이션하려면:

```python
# migration_script.py
import sqlite3
import psycopg2
from psycopg2.extras import execute_values

# SQLite에서 데이터 읽기
sqlite_conn = sqlite3.connect('momflow.db')
sqlite_cursor = sqlite_conn.cursor()

# Cloud SQL에 연결
pg_conn = psycopg2.connect(
    "postgresql://postgres:PASSWORD@/always_plan?host=/cloudsql/PROJECT:REGION:INSTANCE"
)
pg_cursor = pg_conn.cursor()

# 테이블별로 데이터 마이그레이션
# (users, todos, family_members 등)

pg_conn.commit()
pg_conn.close()
sqlite_conn.close()
```

## 10. 비용 최적화

### 무료 티어
- `db-f1-micro`: 월 약 $7.67 (약 9,000원)
- 무료 체험: $300 크레딧 (90일)

### 비용 절감 팁
- 개발 환경: `db-f1-micro` 사용
- 프로덕션: 트래픽에 따라 `db-g1-small` 고려
- 사용하지 않을 때는 인스턴스 중지 (데이터는 유지)

## 트러블슈팅

### 연결 오류
- Cloud Run에 Cloud SQL 인스턴스가 추가되었는지 확인
- 연결 문자열 형식 확인
- 비밀번호 확인

### 권한 오류
- Cloud Run 서비스 계정에 Cloud SQL Client 권한 확인

```bash
gcloud projects add-iam-policy-binding always-plan-2025 \
  --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/cloudsql.client"
```

### 테이블 생성 실패
- 데이터베이스가 존재하는지 확인
- 마이그레이션 로그 확인

## 참고 링크

- [Cloud SQL 문서](https://cloud.google.com/sql/docs/postgres)
- [Cloud Run에서 Cloud SQL 연결](https://cloud.google.com/sql/docs/postgres/connect-run)
- [PostgreSQL 연결 문자열 형식](https://www.postgresql.org/docs/current/libpq-connect.html#LIBPQ-CONNSTRING)
