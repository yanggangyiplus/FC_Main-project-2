# Frontend Dockerfile for Google Cloud Run
# Multi-stage build

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# 패키지 파일 복사 및 의존성 설치
COPY package*.json ./
RUN npm ci

# 소스 코드 복사
COPY . .

# 빌드 시 API URL을 환경변수로 주입
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

# 프로덕션 빌드
RUN npm run build

# Stage 2: Production
FROM nginx:alpine

# nginx 설정 복사
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 빌드된 파일 복사
COPY --from=builder /app/dist /usr/share/nginx/html

# Cloud Run은 PORT 환경변수를 자동으로 주입함
EXPOSE 8080

# nginx 시작 (PORT 환경변수 사용)
CMD ["sh", "-c", "sed -i 's/listen 8080/listen '${PORT:-8080}'/g' /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
