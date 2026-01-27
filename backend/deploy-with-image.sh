#!/bin/bash

# 🐳 Docker 이미지 빌드 후 Cloud Run 배포
# 방법 B: Artifact Registry 사용 (이미지 관리 포함)

# 사용법: ./deploy-with-image.sh [PROJECT_ID] [SERVICE_NAME] [REGION]

PROJECT_ID=${1:-"your-project-id"}
SERVICE_NAME=${2:-"always-plan-api"}
REGION=${3:-"asia-northeast3"}  # 서울 리전
REPO_NAME="cloud-run-source-deploy"  # Artifact Registry 리포지토리 이름

echo "🐳 Docker 이미지 빌드 후 Cloud Run 배포"
echo "프로젝트 ID: ${PROJECT_ID}"
echo "서비스 이름: ${SERVICE_NAME}"
echo "리전: ${REGION}"
echo ""

# gcloud CLI 확인
if ! command -v gcloud &> /dev/null; then
    echo "❌ gcloud CLI가 설치되어 있지 않습니다."
    echo "설치 방법: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# 프로젝트 설정
echo "📋 프로젝트 설정 중..."
gcloud config set project ${PROJECT_ID}

# Artifact Registry API 활성화
echo "📋 Artifact Registry API 활성화 중..."
gcloud services enable artifactregistry.googleapis.com --project ${PROJECT_ID}

# Artifact Registry 리포지토리 생성 (없는 경우)
echo "📦 Artifact Registry 리포지토리 확인 중..."
if ! gcloud artifacts repositories describe ${REPO_NAME} --location=${REGION} --project=${PROJECT_ID} &>/dev/null; then
    echo "📦 리포지토리 생성 중..."
    gcloud artifacts repositories create ${REPO_NAME} \
        --repository-format=docker \
        --location=${REGION} \
        --project=${PROJECT_ID}
fi

# 이미지 URL
IMAGE_NAME="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${SERVICE_NAME}"

# Docker 이미지 빌드 및 푸시
echo "🔨 Docker 이미지 빌드 및 푸시 중..."
gcloud builds submit --tag ${IMAGE_NAME} --project ${PROJECT_ID}

if [ $? -ne 0 ]; then
    echo "❌ Docker 이미지 빌드 실패"
    exit 1
fi

echo "✅ 이미지 빌드 완료: ${IMAGE_NAME}"
echo ""

# Cloud Run API 활성화
echo "📋 Cloud Run API 활성화 중..."
gcloud services enable run.googleapis.com --project ${PROJECT_ID}

# Cloud Run에 배포
echo "🌐 Cloud Run에 배포 중..."
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

if [ $? -ne 0 ]; then
    echo "❌ 배포 실패"
    exit 1
fi

echo ""
echo "✅ 배포 완료!"
echo ""

# 서비스 URL 출력
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} --region ${REGION} --project ${PROJECT_ID} --format 'value(status.url)' 2>/dev/null)
if [ ! -z "$SERVICE_URL" ]; then
    echo "🌍 서비스 URL: ${SERVICE_URL}"
    echo ""
    echo "📝 이미지 URL: ${IMAGE_NAME}"
    echo ""
    echo "📝 다음 단계:"
    echo "   1. 환경 변수 설정:"
    echo "      gcloud run services update ${SERVICE_NAME} --region ${REGION} --set-env-vars 'KEY1=value1,KEY2=value2'"
    echo ""
    echo "   2. 로그 확인:"
    echo "      gcloud run services logs tail ${SERVICE_NAME} --region ${REGION}"
fi
