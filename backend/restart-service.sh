#!/bin/bash

# Cloud Run 서비스 재시작 (새 리비전 배포)
# 이렇게 하면 init_db()가 다시 실행됩니다

SERVICE_NAME="always-plan-api"
REGION="asia-northeast3"
PROJECT_ID="always-plan-2025"

echo "🔄 Cloud Run 서비스 재시작 중..."
echo "서비스: ${SERVICE_NAME}"
echo "리전: ${REGION}"
echo ""

# 환경 변수를 업데이트하여 새 리비전 생성 (실제로는 같은 값)
# 이렇게 하면 새 리비전이 생성되어 init_db()가 다시 실행됩니다
gcloud run services update ${SERVICE_NAME} \
  --region ${REGION} \
  --project ${PROJECT_ID} \
  --update-env-vars "RESTART_TRIGGER=$(date +%s)"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ 서비스 재시작 완료!"
    echo ""
    echo "📝 다음 단계:"
    echo "   - 로그에서 'Database initialized successfully' 메시지 확인"
    echo "   - 로그 확인: gcloud run services logs read ${SERVICE_NAME} --region ${REGION} --project ${PROJECT_ID} --limit 50"
else
    echo "❌ 서비스 재시작 실패"
    exit 1
fi
