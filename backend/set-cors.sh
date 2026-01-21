#!/bin/bash

# CORS 설정 스크립트 (env-vars-file 사용)

echo "🔄 CORS 환경변수 설정 중..."

gcloud run services update always-plan-api \
  --region asia-northeast3 \
  --project always-plan-2025 \
  --env-vars-file env-vars.yaml

if [ $? -eq 0 ]; then
    echo "✅ CORS 환경변수 설정 완료!"
    echo ""
    echo "설정된 값:"
    gcloud run services describe always-plan-api \
      --region asia-northeast3 \
      --project always-plan-2025 \
      --format 'value(spec.template.spec.containers[0].env)' | grep CORS_ORIGINS
else
    echo "❌ 설정 실패"
    exit 1
fi
