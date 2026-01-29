"""
Rate Limiting 설정
- API 남용 방지를 위한 요청 횟수 제한
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

# Rate Limiter 인스턴스 (IP 주소 기반)
limiter = Limiter(key_func=get_remote_address)

# 기본 제한 설정
DEFAULT_RATE_LIMIT = "100/minute"  # 일반 API: 분당 100회
AI_RATE_LIMIT = "10/minute"        # AI/OCR API: 분당 10회 (비용 절감)
AUTH_RATE_LIMIT = "20/minute"      # 인증 API: 분당 20회 (무차별 대입 방지)
