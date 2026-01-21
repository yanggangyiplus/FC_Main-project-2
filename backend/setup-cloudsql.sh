#!/bin/bash

# Cloud SQL 설정 스크립트
# 사용법: ./setup-cloudsql.sh [INSTANCE_NAME] [DATABASE_NAME] [PASSWORD]

INSTANCE_NAME=${1:-"always-plan-db"}
DATABASE_NAME=${2:-"always_plan"}
REGION="asia-northeast3"
PROJECT_ID="always-plan-2025"
SERVICE_NAME="always-plan-api"

echo "🚀 Cloud SQL 설정 시작"
echo "프로젝트 ID: ${PROJECT_ID}"
echo "인스턴스 이름: ${INSTANCE_NAME}"
echo "데이터베이스 이름: ${DATABASE_NAME}"
echo "리전: ${REGION}"
echo ""

# 비밀번호 입력받기
if [ -z "$3" ]; then
    echo "⚠️  PostgreSQL 루트 비밀번호를 입력하세요 (기억해두세요!):"
    read -s DB_PASSWORD
    echo ""
else
    DB_PASSWORD=$3
fi

if [ -z "$DB_PASSWORD" ]; then
    echo "❌ 비밀번호가 입력되지 않았습니다."
    exit 1
fi

# 1. Cloud SQL 인스턴스 생성
echo "📦 Cloud SQL 인스턴스 생성 중..."
gcloud sql instances create ${INSTANCE_NAME} \
  --database-version=POSTGRES_14 \
  --tier=db-f1-micro \
  --region=${REGION} \
  --project=${PROJECT_ID}

if [ $? -ne 0 ]; then
    echo "⚠️  인스턴스 생성 실패 (이미 존재할 수 있습니다)"
fi

# 2. 루트 비밀번호 설정
echo ""
echo "🔑 루트 비밀번호 설정 중..."
gcloud sql users set-password postgres \
  --instance=${INSTANCE_NAME} \
  --password=${DB_PASSWORD} \
  --project=${PROJECT_ID}

# 3. 데이터베이스 생성
echo ""
echo "🗄️  데이터베이스 생성 중..."
gcloud sql databases create ${DATABASE_NAME} \
  --instance=${INSTANCE_NAME} \
  --project=${PROJECT_ID}

if [ $? -ne 0 ]; then
    echo "⚠️  데이터베이스 생성 실패 (이미 존재할 수 있습니다)"
fi

# 4. Cloud Run에 Cloud SQL 연결
echo ""
echo "🔗 Cloud Run에 Cloud SQL 연결 중..."
gcloud run services update ${SERVICE_NAME} \
  --add-cloudsql-instances ${PROJECT_ID}:${REGION}:${INSTANCE_NAME} \
  --region ${REGION} \
  --project ${PROJECT_ID}

# 5. 연결 문자열 생성
CONNECTION_STRING="postgresql://postgres:${DB_PASSWORD}@/${DATABASE_NAME}?host=/cloudsql/${PROJECT_ID}:${REGION}:${INSTANCE_NAME}"

echo ""
echo "📝 환경변수 파일 생성 중..."
cat > env-vars-db.yaml << EOF
DATABASE_URL: "${CONNECTION_STRING}"
EOF

echo "✅ env-vars-db.yaml 파일이 생성되었습니다."
echo ""
echo "⚠️  보안 주의: env-vars-db.yaml 파일에는 비밀번호가 포함되어 있습니다!"
echo "   .gitignore에 추가하세요."
echo ""

# 6. 환경변수 업데이트
echo "🔧 Cloud Run 환경변수 업데이트 중..."
gcloud run services update ${SERVICE_NAME} \
  --region ${REGION} \
  --project ${PROJECT_ID} \
  --env-vars-file env-vars-db.yaml

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Cloud SQL 설정 완료!"
    echo ""
    echo "📝 다음 단계:"
    echo "   1. requirements.txt에 psycopg2-binary 추가 확인"
    echo "   2. 백엔드 재배포"
    echo "   3. Cloud Run 로그에서 'Database initialized successfully' 메시지 확인"
    echo ""
    echo "🔍 연결 정보:"
    echo "   인스턴스: ${PROJECT_ID}:${REGION}:${INSTANCE_NAME}"
    echo "   데이터베이스: ${DATABASE_NAME}"
    echo ""
    echo "⚠️  env-vars-db.yaml 파일을 안전하게 보관하세요!"
else
    echo "❌ 환경변수 업데이트 실패"
    exit 1
fi
