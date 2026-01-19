#!/usr/bin/env python
"""
Always Plan Backend Launcher
모든 경로 설정을 자동으로 처리하고 서버를 시작합니다.
"""
import os
import sys
import subprocess
from pathlib import Path

# 백엔드 디렉토리를 Python 경로에 추가
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))
os.environ['PYTHONPATH'] = str(backend_dir)

# 작업 디렉토리를 백엔드 디렉토리로 설정
os.chdir(backend_dir)

# .env 파일 확인
env_file = backend_dir / '.env'
if not env_file.exists():
    print(f"⚠️  경고: {env_file}이 없습니다. .env 파일을 생성해주세요.")
    print("예시:")
    print("GOOGLE_CLIENT_ID=your_client_id")
    print("GOOGLE_CLIENT_SECRET=your_client_secret")
    print("GOOGLE_REDIRECT_URI=http://localhost:8000/api/auth/google-callback")

print(f"✅ 작업 디렉토리: {os.getcwd()}")
print(f"✅ PYTHONPATH: {os.environ.get('PYTHONPATH')}")
print(f"✅ Python 버전: {sys.version.split()[0]}")

# FastAPI 서버 시작
if __name__ == "__main__":
    print("\n🚀 FastAPI 서버 시작 중...")
    try:
        import uvicorn
        uvicorn.run(
            "main:app",
            host="0.0.0.0",
            port=8000,
            reload=True,
            log_level="info"
        )
    except Exception as e:
        print(f"❌ 에러: {e}")
        sys.exit(1)
