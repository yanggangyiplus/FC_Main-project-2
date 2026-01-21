#!/bin/bash

# 프론트엔드 재빌드 및 Firebase 배포 스크립트

echo "🧹 이전 빌드 파일 삭제 중..."
rm -rf dist
rm -rf node_modules/.vite

echo ""
echo "📦 환경변수 확인..."
cat .env.production

echo ""
echo "🔨 새로 빌드 중..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ 빌드 실패"
    exit 1
fi

echo ""
echo "✅ 빌드 완료!"
echo ""
echo "🔍 빌드된 파일에서 API URL 확인 중..."
grep -r "always-plan-api" dist/assets/*.js 2>/dev/null | head -2

echo ""
echo "🚀 Firebase 배포 중..."
cd ..
firebase deploy

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ 배포 완료!"
    echo ""
    echo "📝 다음 단계:"
    echo "   1. 브라우저에서 하드 새로고침 (Cmd+Shift+R 또는 Ctrl+Shift+R)"
    echo "   2. 개발자 도구 → Network 탭에서 API 호출 URL 확인"
    echo "   3. https://로 호출되는지 확인"
else
    echo "❌ 배포 실패"
    exit 1
fi
