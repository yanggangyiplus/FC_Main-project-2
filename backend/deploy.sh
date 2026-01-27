#!/bin/bash

# Cloud Run 배포 스크립트
# 사용법: ./deploy.sh [PROJECT_ID] [SERVICE_NAME] [REGION]

PROJECT_ID=${1:-"your-project-id"}
SERVICE_NAME=${2:-"always-plan-api"}
REGION=${3:-"asia-northeast3"}  # 서울 리전
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

echo "🚀 Cloud Run 배포 시작"
echo "프로젝트 ID: ${PROJECT_ID}"
echo "서비스 이름: ${SERVICE_NAME}"
echo "리전: ${REGION}"
echo "이미지: ${IMAGE_NAME}"
echo ""

# 1. Docker 이미지 빌드
echo "📦 Docker 이미지 빌드 중..."
gcloud builds submit --tag ${IMAGE_NAME} --project ${PROJECT_ID}

if [ $? -ne 0 ]; then
    echo "❌ Docker 이미지 빌드 실패"
    exit 1
fi

echo "✅ Docker 이미지 빌드 완료"
echo ""

# 2. Cloud Run에 배포
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
    echo "❌ Cloud Run 배포 실패"
    exit 1
fi

echo "✅ Cloud Run 배포 완료"
echo ""

# 3. 서비스 URL 출력
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} --region ${REGION} --project ${PROJECT_ID} --format 'value(status.url)')
echo "🌍 서비스 URL: ${SERVICE_URL}"
echo ""
echo "✅ 배포 완료!"
