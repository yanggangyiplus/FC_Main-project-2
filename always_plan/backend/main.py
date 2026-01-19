"""
Always Plan API - Main Application
"""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging
import os
from dotenv import load_dotenv

# 환경변수 로드
load_dotenv()

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# FastAPI 앱 생성
app = FastAPI(
    title="Always Plan API",
    description="가족 일정 관리 및 음성 인식 기반 할일 추가 플랫폼",
    version="1.0.0"
)

# CORS 설정 (google-issue.md 참고 - Phase 1)
from app.config import settings, get_cors_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 글로벌 예외 처리
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """전역 예외 처리"""
    import traceback
    error_detail = str(exc)
    error_traceback = traceback.format_exc()
    
    logger.error(f"Unhandled exception: {error_detail}\n{error_traceback}")
    
    # 개발 환경에서는 상세 에러 정보 포함
    response_data = {
        "detail": "Internal server error",
        "error": error_detail,
    }
    
    if os.getenv("ENVIRONMENT") == "development":
        response_data["traceback"] = error_traceback
    
    # CORS 헤더 추가
    response = JSONResponse(
        status_code=500,
        content=response_data
    )
    
    # CORS 헤더 수동 추가 (에러 발생 시에도 CORS 헤더 전송)
    from app.config import get_cors_origins
    origin = request.headers.get("origin")
    if origin and origin in get_cors_origins():
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "*"
        response.headers["Access-Control-Allow-Headers"] = "*"
    
    return response


# 루트 경로
@app.get("/")
async def root():
    """루트 엔드포인트"""
    return {
        "message": "Always Plan API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health"
    }

# 헬스 체크
@app.get("/health")
async def health_check():
    """헬스 체크 엔드포인트"""
    return {
        "status": "healthy",
        "version": "1.0.0",
        "environment": os.getenv("ENVIRONMENT", "development")
    }


# 라우터 포함
from app.api.routes import auth, todos, receipts, ai, family, routines, files, calendar, notifications

app.include_router(auth.router)
app.include_router(todos.router)
app.include_router(receipts.router)
app.include_router(ai.router)
app.include_router(family.router)
app.include_router(routines.router)
app.include_router(files.router)
app.include_router(calendar.router)
app.include_router(notifications.router)

from app.api.routes import memos
app.include_router(memos.router)

# 데이터베이스 초기화
from app.database import init_db
init_db()

# 알림 스케줄러 시작
from app.services.scheduler_service import scheduler
import asyncio

@app.on_event("startup")
async def startup_event():
    """앱 시작 시 알림 스케줄러 시작"""
    await scheduler.start()
    logger.info("알림 스케줄러가 시작되었습니다.")

@app.on_event("shutdown")
async def shutdown_event():
    """앱 종료 시 알림 스케줄러 중지"""
    await scheduler.stop()
    logger.info("알림 스케줄러가 중지되었습니다.")

logger.info("Always Plan API initialized successfully")


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        app,
        host=os.getenv("SERVER_HOST", "127.0.0.1"),
        port=int(os.getenv("SERVER_PORT", 8000)),
        log_level=os.getenv("LOG_LEVEL", "info").lower()
    )
