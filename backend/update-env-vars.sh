#!/bin/bash

# Cloud Run 환경변수 업데이트 스크립트
# env-vars-full.yaml 파일을 사용하여 환경변수를 업데이트합니다

if [ ! -f "env-vars-full.yaml" ]; then
    echo "❌ env-vars-full.yaml 파일이 없습니다."
    echo "먼저 ./set-env-vars.sh를 실행하세요."
    exit 1
fi

echo "🔄 Cloud Run 환경변수 업데이트 중..."

gcloud run services update always-plan-api \
  --region asia-northeast3 \
  --project always-plan-2025 \
  --update-env-vars-file env-vars-full.yaml

if [ $? -eq 0 ]; then
    echo "✅ 환경변수 업데이트 완료!"
    echo ""
    echo "설정된 환경변수 확인:"
    gcloud run services describe always-plan-api \
      --region asia-northeast3 \
      --project always-plan-2025 \
      --format 'value(spec.template.spec.containers[0].env)'
else
    echo "❌ 업데이트 실패"
    exit 1
fi
