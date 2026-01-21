#!/bin/bash

# Cloud SQL 연결 상태 확인 스크립트

SERVICE_NAME="always-plan-api"
REGION="asia-northeast3"
PROJECT_ID="always-plan-2025"
INSTANCE_NAME="always-plan-db"

echo "🔍 Cloud SQL 연결 상태 확인"
echo ""

# 1. Cloud SQL 인스턴스 확인
echo "1️⃣ Cloud SQL 인스턴스 확인:"
gcloud sql instances describe ${INSTANCE_NAME} \
  --project ${PROJECT_ID} \
  --format="table(name,databaseVersion,region,tier,state)"

echo ""
echo "2️⃣ Cloud Run 서비스에 Cloud SQL 연결 확인:"
gcloud run services describe ${SERVICE_NAME} \
  --region ${REGION} \
  --project ${PROJECT_ID} \
  --format="value(spec.template.spec.containers[0].env)" | grep -i cloud_sql || echo "⚠️  Cloud SQL 연결 정보를 찾을 수 없습니다"

echo ""
echo "3️⃣ 환경변수 확인:"
gcloud run services describe ${SERVICE_NAME} \
  --region ${REGION} \
  --project ${PROJECT_ID} \
  --format="value(spec.template.spec.containers[0].env)" | grep DATABASE_URL || echo "⚠️  DATABASE_URL 환경변수가 설정되지 않았습니다"

echo ""
echo "4️⃣ 데이터베이스 목록 확인:"
gcloud sql databases list \
  --instance=${INSTANCE_NAME} \
  --project=${PROJECT_ID}

echo ""
echo "✅ 확인 완료"
echo ""
echo "📝 다음 단계:"
echo "   - Cloud SQL 연결이 안 되어 있다면:"
echo "     gcloud run services update ${SERVICE_NAME} \\"
echo "       --add-cloudsql-instances ${PROJECT_ID}:${REGION}:${INSTANCE_NAME} \\"
echo "       --region ${REGION} --project ${PROJECT_ID}"
echo ""
echo "   - DATABASE_URL이 설정되지 않았다면:"
echo "     env-vars-db.yaml 파일을 사용하여 설정하세요"
