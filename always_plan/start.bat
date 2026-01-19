@echo off
cd /d C:\Users\USER\OneDrive\Desktop\ainote\momflow

echo.
echo ========================================
echo  🚀 MomFlow 시스템 시작
echo ========================================
echo.

REM 기존 프로세스 종료
echo 📋 1단계: 기존 프로세스 정리 중...
taskkill /F /IM python.exe >nul 2>&1
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 >nul
echo ✅ 프로세스 정리 완료
echo.

REM 백엔드 시작
echo 📋 2단계: 백엔드 서버 시작 중...
start "MomFlow Backend" cmd /k "cd backend && python -m uvicorn main:app --host 0.0.0.0 --port 8000"
timeout /t 5 >nul
echo ✅ 백엔드 시작됨
echo.

REM 프론트엔드 시작
echo 📋 3단계: 프론트엔드 서버 시작 중...
start "MomFlow Frontend" cmd /k "cd frontend && npm run dev"
timeout /t 5 >nul
echo ✅ 프론트엔드 시작됨
echo.

echo ========================================
echo  🎉 시스템 시작 완료!
echo ========================================
echo.
echo 📱 접속 주소:
echo    🌐 프론트엔드: http://localhost:5173
echo    🔧 백엔드:   http://localhost:8000
echo    📊 API 문서:  http://localhost:8000/docs
echo.
echo ⚡ 다음 단계:
echo    1. 브라우저에서 http://localhost:5173 접속
echo    2. 'Google로 시작하기' 버튼 클릭
echo    3. Google 로그인 완료
echo.

REM 브라우저 열기
timeout /t 3 >nul
start http://localhost:5173
