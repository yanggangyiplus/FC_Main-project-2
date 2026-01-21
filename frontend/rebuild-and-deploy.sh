#!/bin/bash

# 프론트엔드 재빌드 및 Firebase 배포 스크립트

echo "🧹 이전 빌드 파일 삭제 중..."
rm -rf dist
rm -rf node_modules/.vite

echo ""
echo "📦 환경변수 확인..."
if [ -f .env.production ]; then
    cat .env.production
    echo ""
    # 환경변수에서 http://가 있는지 확인
    if grep -q "http://always-plan-api" .env.production; then
        echo "❌ 오류: .env.production에 http://가 포함되어 있습니다!"
        echo "   https://로 변경해주세요."
        exit 1
    fi
    # https://가 있는지 확인
    if ! grep -q "https://always-plan-api" .env.production; then
        echo "❌ 오류: .env.production에 https:// API URL이 없습니다!"
        exit 1
    fi
    echo "✅ 환경변수 확인 완료 (https:// 포함됨)"
else
    echo "❌ 오류: .env.production 파일이 없습니다!"
    exit 1
fi

echo ""
echo "🧹 Vite 캐시 완전 삭제..."
rm -rf node_modules/.vite
rm -rf .vite

echo ""
echo "🔨 새로 빌드 중..."
VITE_API_BASE_URL=$(grep VITE_API_BASE_URL .env.production | cut -d '=' -f2)
echo "빌드 시 사용할 API URL: $VITE_API_BASE_URL"
npm run build

if [ $? -ne 0 ]; then
    echo "❌ 빌드 실패"
    exit 1
fi

echo ""
echo "✅ 빌드 완료!"
echo ""
echo "🔍 빌드된 파일에서 API URL 확인 중..."
echo ""
echo "=== HTTP URL 확인 (있으면 안 됨) ==="
if grep -r "http://always-plan-api" dist/assets/*.js 2>/dev/null; then
    echo "❌ 오류: 빌드된 파일에 http://가 포함되어 있습니다!"
    echo "   .env.production 파일을 확인해주세요."
    exit 1
fi
echo "✅ HTTP URL 없음"

echo ""
echo "=== HTTPS URL 확인 ==="
if grep -r "https://always-plan-api" dist/assets/*.js 2>/dev/null | head -1; then
    echo "✅ HTTPS URL 확인됨"
else
    echo "❌ 오류: 빌드된 파일에 https:// URL이 없습니다!"
    exit 1
fi

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
