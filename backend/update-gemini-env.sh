#!/bin/bash

# Gemini API 키를 Cloud Run에 추가하는 스크립트

SERVICE_NAME="always-plan-api"
REGION="asia-northeast3"
PROJECT_ID="always-plan-2025"

echo "🔑 Cloud Run에 Gemini API 키 추가 중..."
echo ""
echo "⚠️  주의: GOOGLE_GEMINI_API_KEY 값을 입력해야 합니다."
echo ""

# 사용자로부터 API 키 입력받기
read -p "GOOGLE_GEMINI_API_KEY를 입력하세요: " GEMINI_API_KEY

if [ -z "$GEMINI_API_KEY" ]; then
    echo "❌ API 키가 입력되지 않았습니다."
    exit 1
fi

# 기존 환경 변수에 추가
gcloud run services update $SERVICE_NAME \
    --region $REGION \
    --project $PROJECT_ID \
    --update-env-vars "GOOGLE_GEMINI_API_KEY=$GEMINI_API_KEY"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Gemini API 키가 성공적으로 추가되었습니다!"
    echo ""
    echo "📝 확인:"
    echo "   gcloud run services describe $SERVICE_NAME --region $REGION --project $PROJECT_ID --format='value(spec.template.spec.containers[0].env)'"
else
    echo "❌ 환경 변수 추가 실패"
    exit 1
fi
