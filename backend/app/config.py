"""
Config Settings - google-issue.md Phase 1 적용
"""
from pydantic_settings import BaseSettings
import os


def get_cors_origins() -> list:
    """CORS origins 파싱"""
    default_origins = (
        "http://localhost:5173"
        if os.getenv("ENVIRONMENT", "development") == "development"
        else "https://always-plan-fc.web.app,http://localhost:5173"
    )
    cors_str = os.getenv("CORS_ORIGINS", default_origins)
    origins = [origin.strip() for origin in cors_str.split(",")]

    # Capacitor 앱을 위한 origin 추가 (Android/iOS 앱 지원)
    capacitor_origins = [
        "capacitor://localhost",  # Capacitor 기본 origin
        "https://localhost",      # androidScheme: 'https' 사용 시
        "http://localhost",       # iOS 앱
    ]
    for cap_origin in capacitor_origins:
        if cap_origin not in origins:
            origins.append(cap_origin)

    return origins


class Settings(BaseSettings):
    """애플리케이션 설정"""
    
    # 환경
    environment: str = os.getenv("ENVIRONMENT", "development")
    
    # 데이터베이스
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./always-plan.db")
    
    # API 키
    google_gemini_api_key: str = os.getenv("GOOGLE_GEMINI_API_KEY", "")
    anthropic_api_key: str = os.getenv("ANTHROPIC_API_KEY", "")
    google_client_id: str = os.getenv("GOOGLE_CLIENT_ID", "")
    google_client_secret: str = os.getenv("GOOGLE_CLIENT_SECRET", "")
    
    # JWT 설정 (google-issue.md - Phase 1: httpOnly 쿠키)
    jwt_secret: str = os.getenv("JWT_SECRET", "change-this-secret-key-in-production")
    jwt_algorithm: str = "HS256"
    jwt_access_expiry_minutes: int = 15  # 짧은 유효시간
    jwt_refresh_expiry_days: int = 7      # 긴 유효시간
    
    # Google OAuth (google-issue.md - Redirect URI 환경별 관리)
    # 프론트엔드에서 처리하므로 프론트엔드 URL로 설정
    google_redirect_uri: str = os.getenv(
        "GOOGLE_REDIRECT_URI",
        "http://localhost:5173" if os.getenv("ENVIRONMENT", "development") == "development"
        else "https://always-plan-fc.web.app"
    )
    
    # 서버
    server_host: str = os.getenv("SERVER_HOST", "0.0.0.0")
    server_port: int = int(os.getenv("SERVER_PORT", 8000))
    server_reload: bool = os.getenv("SERVER_RELOAD", "True").lower() == "true"
    
    # 로깅
    log_level: str = os.getenv("LOG_LEVEL", "INFO")
    
    class Config:
        env_file = ".env"
        case_sensitive = False
        extra = "ignore"  # .env 파일에 정의되지 않은 필드 무시


settings = Settings()

