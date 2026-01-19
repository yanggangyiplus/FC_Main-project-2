#!/bin/bash

# Always Plan 시스템 시작 스크립트 (Mac/Linux용)
# 사용법: ./start.sh 또는 bash start.sh

echo ""
echo "=========================================="
echo "🚀 Always Plan 시스템 시작"
echo "=========================================="
echo ""

# 프로젝트 루트 디렉토리
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"

# 1. 기존 프로세스 종료
echo "📋 1단계: 기존 프로세스 정리 중..."
pkill -f "uvicorn main:app" 2>/dev/null
pkill -f "vite" 2>/dev/null
sleep 2
echo "✅ 프로세스 정리 완료"
echo ""

# 2. 백엔드 시작
echo "📋 2단계: 백엔드 서버 시작 중..."
cd "$BACKEND_DIR"

# 가상환경 활성화 (있는 경우)
if [ -d ".venv" ]; then
    source .venv/bin/activate
elif [ -d "venv" ]; then
    source venv/bin/activate
fi

# 백엔드를 백그라운드에서 시작
python3 run.py > backend.log 2>&1 &
BACKEND_PID=$!
echo "✅ 백엔드 시작됨 (PID: $BACKEND_PID, http://localhost:8000)"
echo "   로그 파일: $BACKEND_DIR/backend.log"
echo ""

# 3. 프론트엔드 시작
echo "📋 3단계: 프론트엔드 서버 시작 중..."
cd "$FRONTEND_DIR"

# 프론트엔드를 백그라운드에서 시작
npm run dev > frontend.log 2>&1 &
FRONTEND_PID=$!
echo "✅ 프론트엔드 시작됨 (PID: $FRONTEND_PID, http://localhost:5173)"
echo "   로그 파일: $FRONTEND_DIR/frontend.log"
echo ""

# 4. 헬스 체크
echo "📋 4단계: 서버 상태 확인 중..."
MAX_ATTEMPTS=5
ATTEMPT=0
BACKEND_HEALTHY=false

while [ $ATTEMPT -lt $MAX_ATTEMPTS ] && [ "$BACKEND_HEALTHY" = false ]; do
    sleep 2
    if curl -s http://localhost:8000/health > /dev/null 2>&1; then
        BACKEND_HEALTHY=true
        echo "✅ 백엔드 상태: 정상"
    else
        ATTEMPT=$((ATTEMPT + 1))
        echo "⏳ 대기 중... ($ATTEMPT/$MAX_ATTEMPTS)"
    fi
done

if [ "$BACKEND_HEALTHY" = false ]; then
    echo "⚠️  백엔드 응답 없음 (타임아웃)"
fi

echo ""
echo "=========================================="
echo "🎉 시스템 시작 완료!"
echo "=========================================="
echo ""
echo "📱 접속 주소:"
echo ""
echo "   🌐 프론트엔드: http://localhost:5173"
echo "   🔧 백엔드:   http://localhost:8000"
echo "   📊 API 문서:  http://localhost:8000/docs"
echo ""
echo "⚡ 다음 단계:"
echo ""
echo "   1. 브라우저에서 http://localhost:5173 접속"
echo "   2. 'Google로 시작하기' 버튼 클릭"
echo "   3. Google 로그인 완료"
echo "   4. Always Plan 메인 화면 확인"
echo ""
echo "💡 팁:"
echo ""
echo "   • 백엔드 로그: tail -f $BACKEND_DIR/backend.log"
echo "   • 프론트엔드 로그: tail -f $FRONTEND_DIR/frontend.log"
echo "   • 종료: kill $BACKEND_PID $FRONTEND_PID"
echo ""
echo "   또는 다음 명령어로 종료:"
echo "   pkill -f 'uvicorn main:app'"
echo "   pkill -f 'vite'"
echo ""

