# Backend Dockerfile for Google Cloud Run
FROM python:3.11-slim

# 작업 디렉토리 설정
WORKDIR /app

# 시스템 패키지 설치 (Tesseract OCR 등)
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    tesseract-ocr-kor \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Python 의존성 설치
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# psycopg2 설치 (Supabase PostgreSQL 연결용)
RUN pip install --no-cache-dir psycopg2-binary

# 애플리케이션 코드 복사
COPY . .

# 환경변수 기본값 설정
ENV ENVIRONMENT=production
ENV SERVER_HOST=0.0.0.0
ENV SERVER_PORT=8080

# Cloud Run은 PORT 환경변수를 자동으로 주입함
# 헬스체크를 위한 포트 노출
EXPOSE 8080

# 애플리케이션 실행
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080}"]
