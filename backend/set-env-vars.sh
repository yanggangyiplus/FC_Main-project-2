#!/bin/bash

# Cloud Run 환경변수 설정 스크립트
# 필수 환경변수들을 설정합니다

echo "🔧 Cloud Run 환경변수 설정 중..."

# 현재 환경변수 확인
echo "📋 현재 환경변수 확인 중..."
gcloud run services describe always-plan-api \
  --region asia-northeast3 \
  --project always-plan-2025 \
  --format 'value(spec.template.spec.containers[0].env)' > /tmp/current-env.txt 2>&1

# env-vars.yaml 파일 생성 (필요한 환경변수 추가)
cat > env-vars-full.yaml << 'EOF'
# CORS 설정 (이미 설정됨)
CORS_ORIGINS: "https://always-plan-11f2c.web.app,https://always-plan-11f2c.firebaseapp.com"

# 환경 설정
ENVIRONMENT: "production"

# Google OAuth (이 값들은 실제 값으로 교체해야 합니다)
# GOOGLE_CLIENT_ID: "your-google-client-id"
# GOOGLE_CLIENT_SECRET: "your-google-client-secret"

# JWT 시크릿 (실제 프로덕션 시크릿으로 교체해야 합니다)
# JWT_SECRET: "your-jwt-secret-key"

# Google Gemini API 키
# GOOGLE_GEMINI_API_KEY: "your-gemini-api-key"

# Google Redirect URI (프론트엔드 URL)
GOOGLE_REDIRECT_URI: "https://always-plan-11f2c.web.app"
EOF

echo ""
echo "⚠️  중요: env-vars-full.yaml 파일을 열어서 실제 값들을 입력해야 합니다!"
echo ""
echo "필수 환경변수:"
echo "  - GOOGLE_CLIENT_ID: Google OAuth 클라이언트 ID"
echo "  - GOOGLE_CLIENT_SECRET: Google OAuth 클라이언트 시크릿"
echo "  - JWT_SECRET: JWT 암호화 키 (랜덤 문자열)"
echo "  - GOOGLE_GEMINI_API_KEY: Gemini API 키 (사용하는 경우)"
echo ""
echo "설정 방법:"
echo "  1. env-vars-full.yaml 파일을 열어서 # 제거하고 실제 값 입력"
echo "  2. ./update-env-vars.sh 실행"
echo ""
