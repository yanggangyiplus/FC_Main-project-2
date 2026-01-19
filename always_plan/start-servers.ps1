# PowerShell 스크립트: MomFlow 서버 자동 관리
# 사용법: .\start-servers.ps1

param(
    [switch]$Stop,
    [switch]$Restart
)

$projectRoot = "C:\Users\USER\OneDrive\Desktop\ainote\momflow"
$backendDir = "$projectRoot\backend"
$frontendDir = "$projectRoot\frontend"

# 색상 정의
$Success = @{ ForegroundColor = 'Green' }
$Error = @{ ForegroundColor = 'Red' }
$Info = @{ ForegroundColor = 'Cyan' }

function Stop-Servers {
    Write-Host "🛑 모든 서버 중지 중..." @Info
    Get-Process python -ErrorAction SilentlyContinue | Where-Object { $_.Name -eq "python" } | Stop-Process -Force
    Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
    Start-Sleep -Seconds 2
    Write-Host "✅ 서버 중지 완료" @Success
}

function Start-Servers {
    Write-Host "`n🚀 MomFlow 서버 시작 중...`n" @Info
    
    # 백엔드 서버 시작
    Write-Host "📡 백엔드 서버 시작..." @Info
    Push-Location $backendDir
    Start-Process -NoNewWindow -FilePath "python" -ArgumentList "run.py"
    Pop-Location
    Write-Host "✅ 백엔드 시작됨 (http://localhost:8000)" @Success
    
    Start-Sleep -Seconds 3
    
    # 프론트엔드 서버 시작
    Write-Host "`n🎨 프론트엔드 서버 시작..." @Info
    Push-Location $frontendDir
    Start-Process -NoNewWindow -FilePath "npm" -ArgumentList "run dev"
    Pop-Location
    Write-Host "✅ 프론트엔드 시작됨 (http://localhost:5173)" @Success
    
    Write-Host "`n" 
    Write-Host "✅ 모든 서버가 시작되었습니다!" @Success
    Write-Host "   📡 Backend:  http://localhost:8000" @Info
    Write-Host "   🎨 Frontend: http://localhost:5173" @Info
}

function Test-Servers {
    Write-Host "`n🔍 서버 상태 확인 중...`n" @Info
    
    # 백엔드 확인
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:8000/health" -ErrorAction SilentlyContinue -TimeoutSec 2
        if ($response.StatusCode -eq 200) {
            Write-Host "✅ 백엔드: 정상" @Success
        }
    } catch {
        Write-Host "❌ 백엔드: 응답 없음" @Error
    }
    
    # 프론트엔드 확인
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:5173" -ErrorAction SilentlyContinue -TimeoutSec 2
        if ($response.StatusCode -eq 200) {
            Write-Host "✅ 프론트엔드: 정상" @Success
        }
    } catch {
        Write-Host "❌ 프론트엔드: 응답 없음" @Error
    }
}

# 메인 로직
if ($Restart) {
    Stop-Servers
    Start-Sleep -Seconds 1
    Start-Servers
    Start-Sleep -Seconds 5
    Test-Servers
} elseif ($Stop) {
    Stop-Servers
} else {
    Start-Servers
    Start-Sleep -Seconds 5
    Test-Servers
}

Write-Host "`n✅ 완료!" @Success
