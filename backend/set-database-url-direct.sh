#!/bin/bash

# DATABASE_URL 직접 설정 스크립트 (비밀번호를 직접 입력)

SERVICE_NAME="always-plan-api"
REGION="asia-northeast3"
PROJECT_ID="always-plan-2025"
INSTANCE_NAME="always-plan-db"
DATABASE_NAME="always_plan"

echo "🔑 Cloud SQL 데이터베이스 URL 설정 (직접 입력 방식)"
echo ""
echo "⚠️  이 방법은 비밀번호를 스크립트에 직접 입력합니다."
echo "   예: YOUR_ACTUAL_PASSWORD를 실제 비밀번호로 교체하세요"
echo ""
echo "📝 사용법:"
echo "   ./set-database-url-direct.sh YOUR_ACTUAL_PASSWORD"
echo ""
echo "또는 아래 줄을 수정하여 실행:"
echo ""

# ============================================
# 🔴 여기에 실제 비밀번호를 입력하세요!
# ============================================
DB_PASSWORD="${1:-YOUR_ACTUAL_PASSWORD_HERE}"

if [ "$DB_PASSWORD" = "YOUR_ACTUAL_PASSWORD_HERE" ] || [ -z "$DB_PASSWORD" ]; then
    echo "❌ 비밀번호를 입력하세요!"
    echo ""
    echo "사용법:"
    echo "  ./set-database-url-direct.sh YOUR_PASSWORD"
    echo ""
    echo "또는 스크립트 파일을 열어서 DB_PASSWORD 변수를 수정하세요."
    exit 1
fi

echo "🔧 비밀번호 URL 인코딩 중..."

# URL 인코딩 (특수문자 포함 시, 개행 문자 제거)
ENCODED_PASSWORD=$(python3 -c "import sys, urllib.parse; password = sys.stdin.read().rstrip('\n\r'); print(urllib.parse.quote(password, safe=''))" <<< "$DB_PASSWORD")

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
else
    echo "❌ 환경변수 설정 실패"
    exit 1
fi
