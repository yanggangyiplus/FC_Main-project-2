#!/bin/bash

echo "🧹 완전 클린 빌드 및 배포 시작..."
echo ""

# 프론트엔드 디렉토리로 이동
cd "$(dirname "$0")"

# 1. 이전 빌드 완전 삭제
echo "📦 이전 빌드 파일 삭제 중..."
rm -rf dist
rm -rf node_modules/.vite

# 2. 환경변수 확인
echo ""
echo "🔍 환경변수 확인..."
if [ -f .env.production ]; then
    cat .env.production
else
    echo "⚠️  .env.production 파일이 없습니다!"
    exit 1
fi

# 3. 빌드
echo ""
echo "🔨 새로 빌드 중..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ 빌드 실패"
    exit 1
fi

# 4. 빌드된 파일에서 URL 확인
echo ""
echo "🔍 빌드된 파일에서 API URL 확인 중..."
if [ -f dist/assets/index-*.js ]; then
    grep -r "always-plan-api" dist/assets/*.js 2>/dev/null | head -2
fi

# 5. Firebase 배포
echo ""
echo "🚀 Firebase 배포 중..."
cd ..
firebase deploy --only hosting

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ 배포 완료!"
    echo ""
    echo "📝 다음 단계:"
    echo "   1. 브라우저에서 완전히 캐시 삭제:"
    echo "      - 개발자 도구(F12) → Application → Storage → Clear site data"
    echo "      - Service Workers 모두 Unregister"
    echo "   2. 하드 새로고침: Cmd+Shift+R (Mac) 또는 Ctrl+Shift+R (Windows)"
    echo "   3. 시크릿 모드에서 테스트"
    echo "   4. 개발자 도구 → Network 탭에서 /todos 요청이 https://로 시작하는지 확인"
else
    echo "❌ 배포 실패"
    exit 1
fi
