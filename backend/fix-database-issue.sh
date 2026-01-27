#!/bin/bash

# 데이터베이스 문제 해결 스크립트

SERVICE_NAME="always-plan-api"
REGION="asia-northeast3"
PROJECT_ID="always-plan-2025"

echo "🔍 현재 환경변수 상태 확인..."
echo ""

# 현재 환경변수 확인
echo "1️⃣ 현재 DATABASE_URL:"
gcloud run services describe ${SERVICE_NAME} \
  --region ${REGION} \
  --project ${PROJECT_ID} \
  --format="value(spec.template.spec.containers[0].env)" | grep -o "DATABASE_URL[^}]*" || echo "DATABASE_URL이 설정되지 않음"

echo ""
echo "2️⃣ Cloud SQL 연결 상태:"
gcloud run services describe ${SERVICE_NAME} \
  --region ${REGION} \
  --project ${PROJECT_ID} \
  --format="value(spec.template.spec.containers[0].env)" | grep -i cloud_sql || echo "Cloud SQL 연결 정보 없음"

echo ""
echo "3️⃣ 해결 방법 선택:"
echo ""
echo "A) SQLite로 임시 복구 (앱이 먼저 시작되도록)"
echo "   DATABASE_URL 환경변수를 제거하여 SQLite 기본값 사용"
echo ""
echo "B) Cloud SQL 연결 완료 (DATABASE_URL 설정 필요)"
echo "   올바른 DATABASE_URL을 설정해야 함"
echo ""
