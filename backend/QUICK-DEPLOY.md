# 🚀 가장 빠른 Cloud Run 배포 가이드

## 현재 상황
- ✅ Dockerfile 존재 (`backend/Dockerfile`)
- ✅ .dockerignore 존재
- ✅ gcloud CLI 필요 (설치 필요 시: https://cloud.google.com/sdk/docs/install)

## 방법 A: 소스에서 직접 배포 (가장 빠름 ⚡)

**추천**: 가장 빠르고 간단합니다. Dockerfile을 자동으로 감지합니다.

### 실행 방법

```bash
cd backend
./deploy-fast.sh [PROJECT_ID] [SERVICE_NAME] [REGION]
```

예시:
```bash
./deploy-fast.sh my-project-id always-plan-api asia-northeast3
```

또는 직접 명령어:
```bash
cd backend
gcloud run deploy always-plan-api \
    --source . \
    --platform managed \
    --region asia-northeast3 \
    --allow-unauthenticated \
    --memory 512Mi \
    --cpu 1 \
    --timeout 300 \
    --max-instances 10 \
    --set-env-vars ENVIRONMENT=production \
    --project my-project-id
```

**장점:**
- 가장 빠름
- Dockerfile 자동 감지
- 별도 이미지 저장소 불필요

**단점:**
- 이미지 버전 관리 어려움

---

## 방법 B: Docker 이미지 빌드 후 배포 (이미지 관리 포함)

**추천**: 이미지 버전 관리가 필요한 경우

### 실행 방법

```bash
cd backend
./deploy-with-image.sh [PROJECT_ID] [SERVICE_NAME] [REGION]
```

예시:
```bash
./deploy-with-image.sh my-project-id always-plan-api asia-northeast3
```

**장점:**
- 이미지 버전 관리 가능
- Artifact Registry에 이미지 저장
- 재사용 가능

**단점:**
- 방법 A보다 약간 느림

---

## 사전 준비

### 1. gcloud CLI 설치 (없는 경우)

**macOS:**
```bash
brew install google-cloud-sdk
```

**Linux:**
```bash
curl https://sdk.cloud.google.com | bash
exec -l $SHELL
```

**Windows:**
https://cloud.google.com/sdk/docs/install-sdk 에서 설치

### 2. 인증

```bash
gcloud auth login
gcloud auth application-default login
```

### 3. 프로젝트 설정

```bash
gcloud config set project YOUR_PROJECT_ID
```

---

## 배포 후 필수 작업

### 환경 변수 설정

```bash
gcloud run services update always-plan-api \
    --region asia-northeast3 \
    --set-env-vars "DATABASE_URL=postgresql://...,GOOGLE_CLIENT_ID=...,GOOGLE_CLIENT_SECRET=...,GOOGLE_GEMINI_API_KEY=...,JWT_SECRET=...,CORS_ORIGINS=https://your-frontend.com" \
    --project YOUR_PROJECT_ID
```

### 서비스 URL 확인

```bash
gcloud run services describe always-plan-api \
    --region asia-northeast3 \
    --project YOUR_PROJECT_ID \
    --format 'value(status.url)'
```

### 로그 확인

```bash
gcloud run services logs tail always-plan-api \
    --region asia-northeast3 \
    --project YOUR_PROJECT_ID
```

---

## 추천 워크플로우

1. **첫 배포**: 방법 A 사용 (가장 빠름)
2. **이후 업데이트**: 방법 A 계속 사용 (빠른 반복)
3. **프로덕션**: 방법 B 사용 (이미지 버전 관리)

---

## 트러블슈팅

### "Permission denied" 에러
```bash
gcloud auth login
gcloud auth application-default login
```

### "API not enabled" 에러
```bash
gcloud services enable run.googleapis.com --project YOUR_PROJECT_ID
gcloud services enable cloudbuild.googleapis.com --project YOUR_PROJECT_ID
```

### 메모리 부족
```bash
# 메모리 증가
gcloud run services update SERVICE_NAME \
    --region REGION \
    --memory 1Gi
```

### 타임아웃
```bash
# 타임아웃 증가 (최대 3600초)
gcloud run services update SERVICE_NAME \
    --region REGION \
    --timeout 600
```
