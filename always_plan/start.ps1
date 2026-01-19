# Always Plan 시스템 시작 스크립트
$backend = "C:\Users\USER\OneDrive\Desktop\choi\always_plan\backend"
$frontend = "C:\Users\USER\OneDrive\Desktop\choi\always_plan\frontend"

Write-Host "`n" -ForegroundColor Cyan
Write-Host "=" -NoNewline -ForegroundColor Yellow
Write-Host "=" -NoNewline -ForegroundColor Yellow
Write-Host "=" -NoNewline -ForegroundColor Yellow
Write-Host " 🚀 Always Plan 시스템 시작 " -ForegroundColor Yellow -NoNewline
Write-Host "=" -NoNewline -ForegroundColor Yellow
Write-Host "=" -ForegroundColor Yellow
Write-Host "`n"

# 1. 기존 프로세스 종료
Write-Host "📋 1단계: 기존 프로세스 정리 중..." -ForegroundColor Cyan
Get-Process python, node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Write-Host "✅ 프로세스 정리 완료`n" -ForegroundColor Green

# 2. 백엔드 시작
Write-Host "📋 2단계: 백엔드 서버 시작 중..." -ForegroundColor Cyan
Start-Process -FilePath "cmd.exe" -ArgumentList "/c cd /d $backend && if exist venv\Scripts\activate.bat (call venv\Scripts\activate.bat) && python -m uvicorn main:app --host 0.0.0.0 --port 8000" -WindowStyle Normal
Start-Sleep -Seconds 5
Write-Host "✅ 백엔드 시작됨 (http://localhost:8000)`n" -ForegroundColor Green

# 3. 프론트엔드 시작
Write-Host "📋 3단계: 프론트엔드 서버 시작 중..." -ForegroundColor Cyan
Start-Process -FilePath "cmd.exe" -ArgumentList "/c cd /d $frontend && npm run dev" -WindowStyle Normal
Start-Sleep -Seconds 5
Write-Host "✅ 프론트엔드 시작됨 (http://localhost:5173)`n" -ForegroundColor Green

# 4. 헬스 체크
Write-Host "📋 4단계: 서버 상태 확인 중..." -ForegroundColor Cyan
$maxAttempts = 5
$attempt = 0
$backendHealthy = $false

while ($attempt -lt $maxAttempts -and -not $backendHealthy) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:8000/health" -TimeoutSec 2 -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            $backendHealthy = $true
            Write-Host "✅ 백엔드 상태: 정상" -ForegroundColor Green
        }
    }
    catch {
        $attempt++
        Write-Host "⏳ 대기 중... ($attempt/$maxAttempts)" -ForegroundColor Yellow
        Start-Sleep -Seconds 2
    }
}

if (-not $backendHealthy) {
    Write-Host "⚠️ 백엔드 응답 없음 (타임아웃)" -ForegroundColor Yellow
}

Write-Host "`n"
Write-Host "=" -NoNewline -ForegroundColor Yellow
Write-Host "=" -NoNewline -ForegroundColor Yellow
Write-Host "=" -NoNewline -ForegroundColor Yellow
Write-Host " 🎉 시스템 시작 완료! " -ForegroundColor Yellow -NoNewline
Write-Host "=" -NoNewline -ForegroundColor Yellow
Write-Host "=" -ForegroundColor Yellow

Write-Host "`n📱 접속 주소:`n" -ForegroundColor Cyan
Write-Host "   🌐 프론트엔드: http://localhost:5173" -ForegroundColor Green
Write-Host "   🔧 백엔드:   http://localhost:8000" -ForegroundColor Green
Write-Host "   📊 API 문서:  http://localhost:8000/docs" -ForegroundColor Green

Write-Host "`n⚡ 다음 단계:`n" -ForegroundColor Cyan
Write-Host "   1. 브라우저에서 http://localhost:5173 접속" -ForegroundColor White
Write-Host "   2. 'Google로 시작하기' 버튼 클릭" -ForegroundColor White
Write-Host "   3. Google 로그인 완료" -ForegroundColor White
Write-Host "   4. Always Plan 메인 화면 확인" -ForegroundColor White

Write-Host "`n💡 팁:`n" -ForegroundColor Cyan
Write-Host "   • 백엔드 cmd 창: 실시간 로그 확인 가능" -ForegroundColor Gray
Write-Host "   • 프론트엔드 cmd 창: Vite 개발 서버 로그 확인 가능" -ForegroundColor Gray
Write-Host "   • 종료: Ctrl+C (각 cmd 창에서)" -ForegroundColor Gray

Write-Host "`n" -ForegroundColor Cyan
