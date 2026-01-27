#!/bin/bash

# AI 환경변수 (Gemini API 키) 업데이트 스크립트

echo "🔑 AI 환경변수 (Gemini API 키) 업데이트 중..."
echo ""
echo "⚠️  주의사항:"
echo "   1. env-vars-ai.yaml 파일에서 GOOGLE_GEMINI_API_KEY 값을 수정하세요."
echo "   2. 'YOUR_GEMINI_API_KEY_HERE'를 실제 Gemini API 키로 교체하세요."
echo ""
read -p "계속하시겠습니까? (y/n): " confirm

if [ "$confirm" != "y" ]; then
    echo "취소되었습니다."
    exit 0
fi

# env-vars-file을 사용 (기존 환경변수와 병합됨)
gcloud run services update always-plan-api \
  --region asia-northeast3 \
  --project always-plan-2025 \
  --env-vars-file env-vars-ai.yaml

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ AI 환경변수 업데이트 완료!"
    echo ""
    echo "📝 설정된 환경변수 확인:"
    gcloud run services describe always-plan-api \
      --region asia-northeast3 \
      --project always-plan-2025 \
      --format 'value(spec.template.spec.containers[0].env)' | grep -E "(GOOGLE_GEMINI|GOOGLE_CLIENT|JWT_SECRET)"
else
    echo "❌ 업데이트 실패"
    exit 1
fi
