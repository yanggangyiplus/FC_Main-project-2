#!/bin/bash

# Google OAuth 환경변수 업데이트 스크립트

echo "🔄 Google OAuth 환경변수 업데이트 중..."

# env-vars-file을 사용 (기존 환경변수와 병합됨)
gcloud run services update always-plan-api \
  --region asia-northeast3 \
  --project always-plan-2025 \
  --env-vars-file env-vars-oauth.yaml

if [ $? -eq 0 ]; then
    echo "✅ 환경변수 업데이트 완료!"
    echo ""
    echo "설정된 환경변수 확인:"
    gcloud run services describe always-plan-api \
      --region asia-northeast3 \
      --project always-plan-2025 \
      --format 'value(spec.template.spec.containers[0].env)' | grep -E "(GOOGLE_CLIENT|JWT_SECRET|ENVIRONMENT)"
else
    echo "❌ 업데이트 실패"
    exit 1
fi
