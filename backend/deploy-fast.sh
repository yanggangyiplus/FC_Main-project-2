#!/bin/bash

# 🚀 가장 빠른 Cloud Run 배포 스크립트
# 방법 A: 소스에서 직접 배포 (Dockerfile 자동 사용)

# 사용법: ./deploy-fast.sh [PROJECT_ID] [SERVICE_NAME] [REGION]

PROJECT_ID=${1:-"your-project-id"}
SERVICE_NAME=${2:-"always-plan-api"}
REGION=${3:-"asia-northeast3"}  # 서울 리전

echo "🚀 Cloud Run 빠른 배포 시작 (소스에서 직접)"
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

# Cloud Run API 활성화 확인
echo "📋 Cloud Run API 활성화 확인 중..."
gcloud services enable run.googleapis.com --project ${PROJECT_ID}

# 소스에서 직접 배포 (Dockerfile 자동 감지)
echo "🌐 Cloud Run에 배포 중..."
gcloud run deploy ${SERVICE_NAME} \
    --source . \
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
    echo "📝 다음 단계:"
    echo "   1. 환경 변수 설정:"
    echo "      gcloud run services update ${SERVICE_NAME} --region ${REGION} --set-env-vars 'KEY1=value1,KEY2=value2'"
    echo ""
    echo "   2. 로그 확인:"
    echo "      gcloud run services logs tail ${SERVICE_NAME} --region ${REGION}"
fi
