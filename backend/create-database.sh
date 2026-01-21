#!/bin/bash

# Cloud SQL 데이터베이스 생성 스크립트

INSTANCE_NAME="always-plan-db"
DATABASE_NAME="always_plan"
PROJECT_ID="always-plan-2025"

echo "🗄️  데이터베이스 생성 중..."
echo "인스턴스: ${INSTANCE_NAME}"
echo "데이터베이스: ${DATABASE_NAME}"
echo "프로젝트: ${PROJECT_ID}"
echo ""

gcloud sql databases create ${DATABASE_NAME} \
  --instance=${INSTANCE_NAME} \
  --project=${PROJECT_ID}

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ 데이터베이스 '${DATABASE_NAME}' 생성 완료!"
    echo ""
    echo "📝 다음 단계:"
    echo "   - Cloud Run이 자동으로 테이블을 생성합니다"
    echo "   - 로그에서 'Database initialized successfully' 메시지 확인"
else
    echo ""
    echo "⚠️  데이터베이스 생성 실패 (이미 존재할 수 있습니다)"
    echo ""
    echo "확인 명령어:"
    echo "  gcloud sql databases list --instance=${INSTANCE_NAME} --project=${PROJECT_ID}"
fi
