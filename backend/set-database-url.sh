#!/bin/bash

# DATABASE_URL 환경변수 설정 스크립트

SERVICE_NAME="always-plan-api"
REGION="asia-northeast3"
PROJECT_ID="always-plan-2025"
INSTANCE_NAME="always-plan-db"
DATABASE_NAME="always_plan"

echo "🔑 Cloud SQL 데이터베이스 URL 설정"
echo ""
echo "⚠️  이 스크립트는 Cloud SQL 인스턴스 생성 시 설정한"
echo "   postgres 사용자의 비밀번호가 필요합니다."
echo ""
echo "📝 비밀번호를 입력하세요 (입력한 내용은 화면에 표시되지 않습니다):"
read -s DB_PASSWORD

if [ -z "$DB_PASSWORD" ]; then
    echo "❌ 비밀번호가 입력되지 않았습니다."
    exit 1
fi

echo ""
echo "🔧 비밀번호 URL 인코딩 중..."

# URL 인코딩 (특수문자 포함 시)
ENCODED_PASSWORD=$(python3 -c "import sys, urllib.parse; print(urllib.parse.quote(sys.stdin.read()))" <<< "$DB_PASSWORD")

# 연결 문자열 생성
DATABASE_URL="postgresql://postgres:${ENCODED_PASSWORD}@/${DATABASE_NAME}?host=/cloudsql/${PROJECT_ID}:${REGION}:${INSTANCE_NAME}"

echo ""
echo "📦 Cloud Run 환경변수 업데이트 중..."

# 환경변수 설정
gcloud run services update ${SERVICE_NAME} \
  --region ${REGION} \
  --project ${PROJECT_ID} \
  --update-env-vars "DATABASE_URL=${DATABASE_URL}"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ DATABASE_URL 환경변수 설정 완료!"
    echo ""
    echo "📝 다음 단계:"
    echo "   1. 백엔드를 재배포하세요"
    echo "   2. 배포 후 로그를 확인하세요:"
    echo "      gcloud run services logs read ${SERVICE_NAME} --region ${REGION} --project ${PROJECT_ID} --limit 50"
else
    echo "❌ 환경변수 설정 실패"
    exit 1
fi
