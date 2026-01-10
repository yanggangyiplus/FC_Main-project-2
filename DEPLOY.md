# Google Cloud Run + Supabase 배포 가이드

## 아키텍처 개요

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Frontend      │     │    Backend      │     │    Supabase     │
│  (Cloud Run)    │────▶│  (Cloud Run)    │────▶│   PostgreSQL    │
│   React/Vite    │     │    FastAPI      │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

---

## 1. Supabase 설정

### 1.1 Supabase 프로젝트 생성

1. [Supabase](https://supabase.com) 접속 후 로그인
2. "New Project" 클릭
3. 프로젝트 이름, 데이터베이스 비밀번호, 리전 설정 (서울: Northeast Asia)
4. 프로젝트 생성 완료까지 약 2분 대기

### 1.2 데이터베이스 연결 정보 확인

1. Supabase Dashboard → Settings → Database
2. **Connection string (URI)** 복사:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
   ```
3. 또는 개별 정보 확인:
   - Host: `db.[PROJECT-REF].supabase.co`
   - Database: `postgres`
   - Port: `5432`
   - User: `postgres`
   - Password: 프로젝트 생성 시 설정한 비밀번호

### 1.3 Connection Pooler (권장)

프로덕션에서는 Connection Pooler 사용 권장:
- Settings → Database → Connection Pooler
- **Pooler connection string** 사용 (포트 6543)

```
postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres
```

---

## 1.5 SQLite → PostgreSQL 데이터 마이그레이션 (선택)

기존 SQLite 데이터가 있다면 PostgreSQL로 마이그레이션할 수 있습니다.

### 방법 1: 마이그레이션 스크립트 사용

```bash
cd backend

# 환경변수 설정
export SOURCE_DB="sqlite:///./always-plan.db"
export TARGET_DB="postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"

# 마이그레이션 실행
python migrate_to_postgres.py
```

**스크립트 기능:**
- 모든 테이블 자동 마이그레이션
- 외래키 의존성 순서대로 처리
- Boolean 값 자동 변환 (SQLite: 0/1 → PostgreSQL: true/false)
- 시퀀스 자동 리셋

### 방법 2: 새로 시작 (권장)

프로덕션에서는 새로운 데이터로 시작하는 것을 권장합니다:

1. Supabase에 빈 데이터베이스 생성
2. Cloud Run에서 앱 시작 시 테이블 자동 생성
3. 사용자가 새로 가입하여 데이터 생성

### 방법 3: Supabase SQL Editor 사용

Supabase Dashboard → SQL Editor에서 직접 데이터 삽입:

```sql
-- 예시: 테스트 사용자 추가
INSERT INTO users (id, email, name, created_at)
VALUES ('uuid-here', 'test@example.com', '테스트 사용자', NOW());
```

---

## 2. Google Cloud 설정

### 2.1 사전 준비

```bash
# Google Cloud CLI 설치 확인
gcloud --version

# 로그인
gcloud auth login

# 프로젝트 설정 (없으면 생성)
gcloud projects create [PROJECT_ID] --name="Always Plan"
gcloud config set project [PROJECT_ID]

# 필요한 API 활성화
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable artifactregistry.googleapis.com
```

### 2.2 Artifact Registry 저장소 생성

```bash
# Docker 이미지 저장소 생성
gcloud artifacts repositories create always-plan \
    --repository-format=docker \
    --location=asia-northeast3 \
    --description="Always Plan Docker images"

# Docker 인증 설정
gcloud auth configure-docker asia-northeast3-docker.pkg.dev
```

---

## 3. Backend 배포

### 3.1 Docker 이미지 빌드 및 푸시

```bash
cd backend

# 이미지 빌드
docker build -t asia-northeast3-docker.pkg.dev/[PROJECT_ID]/always-plan/backend:latest .

# 이미지 푸시
docker push asia-northeast3-docker.pkg.dev/[PROJECT_ID]/always-plan/backend:latest
```

### 3.2 Cloud Run 배포

```bash
gcloud run deploy always-plan-backend \
    --image=asia-northeast3-docker.pkg.dev/[PROJECT_ID]/always-plan/backend:latest \
    --platform=managed \
    --region=asia-northeast3 \
    --allow-unauthenticated \
    --set-env-vars="DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres" \
    --set-env-vars="ENVIRONMENT=production" \
    --set-env-vars="JWT_SECRET=[YOUR_JWT_SECRET]" \
    --set-env-vars="GOOGLE_CLIENT_ID=[YOUR_GOOGLE_CLIENT_ID]" \
    --set-env-vars="GOOGLE_CLIENT_SECRET=[YOUR_GOOGLE_CLIENT_SECRET]" \
    --set-env-vars="CORS_ORIGINS=https://[FRONTEND_URL]" \
    --set-env-vars="GOOGLE_GEMINI_API_KEY=[YOUR_GEMINI_KEY]" \
    --set-env-vars="ANTHROPIC_API_KEY=[YOUR_ANTHROPIC_KEY]" \
    --memory=512Mi \
    --cpu=1 \
    --min-instances=0 \
    --max-instances=10
```

배포 완료 후 URL 확인 (예: `https://always-plan-backend-xxxxx-an.a.run.app`)

---

## 4. Frontend 배포

### 4.1 Docker 이미지 빌드 및 푸시

```bash
cd frontend

# 빌드 시 백엔드 URL 주입
docker build \
    --build-arg VITE_API_BASE_URL=https://always-plan-backend-xxxxx-an.a.run.app \
    -t asia-northeast3-docker.pkg.dev/[PROJECT_ID]/always-plan/frontend:latest .

# 이미지 푸시
docker push asia-northeast3-docker.pkg.dev/[PROJECT_ID]/always-plan/frontend:latest
```

### 4.2 Cloud Run 배포

```bash
gcloud run deploy always-plan-frontend \
    --image=asia-northeast3-docker.pkg.dev/[PROJECT_ID]/always-plan/frontend:latest \
    --platform=managed \
    --region=asia-northeast3 \
    --allow-unauthenticated \
    --memory=256Mi \
    --cpu=1 \
    --min-instances=0 \
    --max-instances=5
```

---

## 5. Google OAuth 설정 업데이트

배포 후 Google Cloud Console에서 OAuth 설정 업데이트:

1. [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials
2. OAuth 2.0 Client ID 수정
3. **승인된 JavaScript 원본** 추가:
   ```
   https://always-plan-frontend-xxxxx-an.a.run.app
   ```
4. **승인된 리디렉션 URI** 추가:
   ```
   https://always-plan-frontend-xxxxx-an.a.run.app/auth/callback
   https://always-plan-backend-xxxxx-an.a.run.app/auth/google-callback
   ```

---

## 6. 환경변수 요약

### Backend (Cloud Run)

| 변수명 | 설명 | 예시 |
|--------|------|------|
| `DATABASE_URL` | Supabase PostgreSQL 연결 문자열 | `postgresql://postgres:xxx@db.xxx.supabase.co:5432/postgres` |
| `JWT_SECRET` | JWT 서명 키 (32자 이상 랜덤) | `openssl rand -hex 32` 로 생성 |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID | `xxx.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret | `GOCSPX-xxx` |
| `CORS_ORIGINS` | 허용할 프론트엔드 URL | `https://always-plan-frontend-xxx.run.app` |
| `ENVIRONMENT` | 실행 환경 | `production` |
| `GOOGLE_GEMINI_API_KEY` | Gemini API 키 (STT용) | - |
| `ANTHROPIC_API_KEY` | Claude API 키 (OCR용) | - |

### Frontend (빌드 시)

| 변수명 | 설명 | 예시 |
|--------|------|------|
| `VITE_API_BASE_URL` | Backend API URL | `https://always-plan-backend-xxx.run.app` |

---

## 7. 배포 스크립트 (선택)

### deploy-backend.sh

```bash
#!/bin/bash
set -e

PROJECT_ID="your-project-id"
REGION="asia-northeast3"
SERVICE_NAME="always-plan-backend"
IMAGE="asia-northeast3-docker.pkg.dev/${PROJECT_ID}/always-plan/backend:latest"

echo "Building backend image..."
docker build -t $IMAGE ./backend

echo "Pushing image..."
docker push $IMAGE

echo "Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
    --image=$IMAGE \
    --platform=managed \
    --region=$REGION \
    --allow-unauthenticated

echo "Backend deployed successfully!"
gcloud run services describe $SERVICE_NAME --region=$REGION --format='value(status.url)'
```

### deploy-frontend.sh

```bash
#!/bin/bash
set -e

PROJECT_ID="your-project-id"
REGION="asia-northeast3"
SERVICE_NAME="always-plan-frontend"
IMAGE="asia-northeast3-docker.pkg.dev/${PROJECT_ID}/always-plan/frontend:latest"
BACKEND_URL="https://always-plan-backend-xxxxx-an.a.run.app"

echo "Building frontend image..."
docker build \
    --build-arg VITE_API_BASE_URL=$BACKEND_URL \
    -t $IMAGE ./frontend

echo "Pushing image..."
docker push $IMAGE

echo "Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
    --image=$IMAGE \
    --platform=managed \
    --region=$REGION \
    --allow-unauthenticated

echo "Frontend deployed successfully!"
gcloud run services describe $SERVICE_NAME --region=$REGION --format='value(status.url)'
```

---

## 8. 비용 최적화 팁

1. **min-instances=0**: 트래픽 없을 때 인스턴스 0으로 (Cold Start 있음)
2. **리전 선택**: `asia-northeast3` (서울) - 한국 사용자에게 빠름
3. **메모리 최적화**: Backend 512Mi, Frontend 256Mi로 시작
4. **Supabase Free Tier**: 500MB 스토리지, 2GB 대역폭/월 무료

---

## 9. 트러블슈팅

### Cold Start가 느릴 때
```bash
# 최소 인스턴스 1개 유지 (비용 발생)
gcloud run services update always-plan-backend --min-instances=1 --region=asia-northeast3
```

### CORS 에러
- Backend의 `CORS_ORIGINS` 환경변수에 프론트엔드 URL이 정확히 포함되어 있는지 확인
- `https://` 프로토콜 포함 여부 확인

### 데이터베이스 연결 실패
- Supabase Dashboard에서 IP 허용 목록 확인
- Connection Pooler 사용 시 포트가 `6543`인지 확인

### 로그 확인
```bash
# Backend 로그
gcloud run logs read always-plan-backend --region=asia-northeast3 --limit=50

# Frontend 로그
gcloud run logs read always-plan-frontend --region=asia-northeast3 --limit=50
```
