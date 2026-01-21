# Cloud Run 배포 가이드

## 사전 요구사항

1. Google Cloud SDK 설치 및 설정
2. Google Cloud 프로젝트 생성
3. 필요한 API 활성화:
   - Cloud Run API
   - Cloud Build API
   - Container Registry API (또는 Artifact Registry API)

## 배포 방법

### 방법 1: deploy.sh 스크립트 사용 (추천)

```bash
# 스크립트에 실행 권한 부여
chmod +x deploy.sh

# 배포 실행
./deploy.sh [PROJECT_ID] [SERVICE_NAME] [REGION]
```

예시:
```bash
./deploy.sh my-project-id always-plan-api asia-northeast3
```

### 방법 2: 수동 배포

#### 1. Docker 이미지 빌드 및 푸시

```bash
# 프로젝트 ID 설정
export PROJECT_ID="your-project-id"
export SERVICE_NAME="always-plan-api"
export REGION="asia-northeast3"
export IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

# Docker 이미지 빌드 및 푸시
gcloud builds submit --tag ${IMAGE_NAME} --project ${PROJECT_ID}
```

#### 2. Cloud Run에 배포

```bash
gcloud run deploy ${SERVICE_NAME} \
    --image ${IMAGE_NAME} \
    --platform managed \
    --region ${REGION} \
    --allow-unauthenticated \
    --memory 512Mi \
    --cpu 1 \
    --timeout 300 \
    --max-instances 10 \
    --set-env-vars ENVIRONMENT=production \
    --project ${PROJECT_ID}
```

### 방법 3: Cloud Build 사용 (CI/CD)

`cloudbuild.yaml` 파일을 생성하여 자동 배포 파이프라인 구축 가능

## 환경 변수 설정

Cloud Run에서 환경 변수를 설정하려면:

```bash
gcloud run services update ${SERVICE_NAME} \
    --region ${REGION} \
    --set-env-vars "KEY1=value1,KEY2=value2" \
    --project ${PROJECT_ID}
```

필수 환경 변수:
- `DATABASE_URL`: 데이터베이스 연결 문자열 (Cloud SQL 사용 권장)
- `GOOGLE_CLIENT_ID`: Google OAuth 클라이언트 ID
- `GOOGLE_CLIENT_SECRET`: Google OAuth 클라이언트 시크릿
- `GOOGLE_GEMINI_API_KEY`: Gemini API 키
- `JWT_SECRET`: JWT 시크릿 키
- `CORS_ORIGINS`: 허용할 CORS 오리진 (쉼표로 구분)
- `ANTHROPIC_API_KEY`: Anthropic API 키 (선택사항)

예시:
```bash
gcloud run services update ${SERVICE_NAME} \
    --region ${REGION} \
    --set-env-vars "DATABASE_URL=postgresql://user:pass@/dbname?host=/cloudsql/project:region:instance,CORS_ORIGINS=https://your-frontend-domain.com" \
    --project ${PROJECT_ID}
```

## 데이터베이스 설정

### SQLite (개발용)
기본적으로 SQLite를 사용하며, Cloud Run에서는 영구 볼륨이 없으므로 **프로덕션에서는 사용하지 마세요**.

### Cloud SQL (프로덕션 권장)

1. Cloud SQL 인스턴스 생성
2. 데이터베이스 및 사용자 생성
3. Cloud Run 서비스에 Cloud SQL 연결:

```bash
gcloud run services update ${SERVICE_NAME} \
    --region ${REGION} \
    --add-cloudsql-instances ${PROJECT_ID}:${REGION}:${INSTANCE_NAME} \
    --set-env-vars "DATABASE_URL=postgresql://user:pass@/dbname?host=/cloudsql/${PROJECT_ID}:${REGION}:${INSTANCE_NAME}" \
    --project ${PROJECT_ID}
```

## CORS 설정

프론트엔드 도메인을 `CORS_ORIGINS` 환경 변수에 설정:

```bash
gcloud run services update ${SERVICE_NAME} \
    --region ${REGION} \
    --set-env-vars "CORS_ORIGINS=https://your-frontend-domain.com,https://www.your-frontend-domain.com" \
    --project ${PROJECT_ID}
```

## 파일 업로드

Cloud Run은 영구 스토리지가 없으므로, 파일 업로드는 Cloud Storage를 사용해야 합니다.

`app/services/files.py` 수정 필요 (향후 작업)

## 로그 확인

```bash
# 실시간 로그 확인
gcloud run services logs tail ${SERVICE_NAME} \
    --region ${REGION} \
    --project ${PROJECT_ID}
```

## 서비스 URL 확인

```bash
gcloud run services describe ${SERVICE_NAME} \
    --region ${REGION} \
    --project ${PROJECT_ID} \
    --format 'value(status.url)'
```

## 업데이트

코드 변경 후 재배포:

```bash
./deploy.sh ${PROJECT_ID} ${SERVICE_NAME} ${REGION}
```

또는:

```bash
gcloud builds submit --tag ${IMAGE_NAME} --project ${PROJECT_ID}
gcloud run deploy ${SERVICE_NAME} \
    --image ${IMAGE_NAME} \
    --region ${REGION} \
    --project ${PROJECT_ID}
```

## 트러블슈팅

### 메모리 부족
- `--memory` 옵션 증가 (예: 1Gi, 2Gi)

### 타임아웃
- `--timeout` 옵션 증가 (최대 3600초)

### Cold start 문제
- 최소 인스턴스 설정: `--min-instances 1`

### 데이터베이스 연결 문제
- Cloud SQL 프록시 확인
- 방화벽 규칙 확인
- 데이터베이스 연결 문자열 확인
