# Always Plan - 가족 일정 관리 시스템

가족 구성원들의 일정을 효율적으로 관리할 수 있는 웹 애플리케이션입니다. 음성 인식(STT), 이미지 인식(OCR), Google Calendar 연동 등 다양한 기능을 제공합니다.

## 주요 기능

- 📅 **일정 관리**: 일정 추가, 수정, 삭제, 완료 처리
- 👨‍👩‍👧‍👦 **가족 구성원 관리**: 가족 구성원별 일정 관리
- 🎤 **음성 입력**: STT를 통한 음성으로 일정 추가
- 📷 **이미지 입력**: OCR을 통한 이미지에서 텍스트 추출 및 일정 생성
- 🔄 **Google Calendar 연동**: Google Calendar와 양방향 동기화
- ⏰ **시간표 관리**: 반복되는 일정을 시간표로 관리
- 📝 **메모 및 영수증 관리**: 메모 작성 및 영수증 OCR 처리
- 🔔 **알림 기능**: 일정 알림 설정

## 기술 스택

### Backend
- **Framework**: FastAPI
- **Database**: SQLite
- **ORM**: SQLAlchemy
- **Authentication**: JWT, Google OAuth 2.0
- **AI Services**: 
  - Google Gemini (STT, OCR, LLM)
  - Claude (OCR)
  - Tesseract (OCR)

### Frontend
- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **UI Library**: 
  - Radix UI
  - Tailwind CSS
  - Framer Motion
- **State Management**: React Hooks
- **HTTP Client**: Axios

## 프로젝트 구조

```
FC_Main-project-2/
├── backend/                 # 백엔드 서버
│   ├── app/
│   │   ├── api/
│   │   │   └── routes/      # API 엔드포인트
│   │   ├── models/         # 데이터베이스 모델
│   │   ├── schemas/         # Pydantic 스키마
│   │   ├── services/        # 비즈니스 로직 서비스
│   │   └── database/        # 데이터베이스 설정
│   ├── main.py              # FastAPI 애플리케이션 진입점
│   ├── run.py               # 서버 실행 스크립트
│   └── requirements.txt     # Python 의존성
├── frontend/                 # 프론트엔드 애플리케이션
│   ├── src/
│   │   ├── app/
│   │   │   └── components/  # React 컴포넌트
│   │   ├── services/        # API 클라이언트
│   │   └── styles/          # 스타일 파일
│   ├── package.json         # Node.js 의존성
│   └── vite.config.ts       # Vite 설정
├── start.sh                 # Linux/Mac 실행 스크립트
├── start.bat                # Windows 실행 스크립트
└── start.ps1                # PowerShell 실행 스크립트
```

## 설치 및 실행 방법

### 사전 요구사항

- Python 3.11 이상
- Node.js 18 이상
- npm 또는 yarn

### 1. 저장소 클론

```bash
git clone <repository-url>
cd FC_Main-project-2
```

### 2. Backend 설정

```bash
# 백엔드 디렉토리로 이동
cd backend

# 가상 환경 생성 (선택사항)
python -m venv .venv

# 가상 환경 활성화
# Windows:
.venv\Scripts\activate
# Linux/Mac:
source .venv/bin/activate

# 의존성 설치
pip install -r requirements.txt

# 환경 변수 설정 (.env 파일 생성)
# backend/.env 파일을 생성하고 다음 내용 추가:
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:8000/api/auth/google-callback
GEMINI_API_KEY=your_gemini_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key (선택사항)
JWT_SECRET=your_jwt_secret_key
DATABASE_URL=sqlite:///./momflow.db
```

### 3. Frontend 설정

```bash
# 프론트엔드 디렉토리로 이동
cd frontend

# 의존성 설치
npm install
```

### 4. 서버 실행

#### 방법 1: 자동 실행 스크립트 사용 (권장)

**Windows:**
```bash
# PowerShell
.\start.ps1

# 또는 CMD
start.bat
```

**Linux/Mac:**
```bash
chmod +x start.sh
./start.sh
```

#### 방법 2: 수동 실행

**Backend 서버:**
```bash
cd backend
python run.py
# 또는
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Frontend 서버:**
```bash
cd frontend
npm run dev
```

서버가 실행되면:
- Backend: http://localhost:8000
- Frontend: http://localhost:5173
- API 문서: http://localhost:8000/docs

## 환경 변수 설정

### Backend (.env)

```env
# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:8000/api/auth/google-callback

# AI Services
GEMINI_API_KEY=your_gemini_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key

# JWT
JWT_SECRET=your_jwt_secret_key
JWT_ALGORITHM=HS256
JWT_ACCESS_EXPIRY_MINUTES=15
JWT_REFRESH_EXPIRY_DAYS=7

# Database
DATABASE_URL=sqlite:///./momflow.db

# Environment
ENVIRONMENT=development
```

## 주요 API 엔드포인트

### 인증
- `POST /api/auth/google-login` - Google OAuth 로그인
- `POST /api/auth/refresh` - 토큰 갱신
- `POST /api/auth/logout` - 로그아웃

### 일정 관리
- `GET /api/todos` - 일정 목록 조회
- `POST /api/todos` - 일정 생성
- `PATCH /api/todos/{todo_id}` - 일정 수정
- `DELETE /api/todos/{todo_id}` - 일정 삭제

### Google Calendar 연동
- `GET /api/calendar/status` - 연동 상태 확인
- `POST /api/calendar/enable` - 연동 활성화
- `POST /api/calendar/disable` - 연동 비활성화
- `POST /api/calendar/toggle-import` - 가져오기 토글
- `POST /api/calendar/toggle-export` - 내보내기 토글
- `POST /api/calendar/sync/all` - 전체 동기화

### AI 서비스
- `POST /api/ai/stt/transcribe` - 음성 텍스트 변환
- `POST /api/ai/ocr/extract-text` - 이미지 텍스트 추출
- `POST /api/ai/todo/extract` - 텍스트에서 일정 정보 추출

## 데이터베이스 마이그레이션

데이터베이스 스키마 변경 시 마이그레이션 스크립트를 실행합니다:

```bash
cd backend
python migrate_db.py
```

개별 마이그레이션 스크립트:
- `migrate_add_bulk_synced.py` - bulk_synced 컬럼 추가
- `migrate_add_google_calendar_event_id.py` - Google Calendar 이벤트 ID 컬럼 추가
- `migrate_add_todo_group_id.py` - 일정 그룹 ID 컬럼 추가

## 개발 가이드

### 코드 스타일
- Backend: PEP 8 Python 스타일 가이드 준수
- Frontend: ESLint 규칙 준수

### 주요 기능 설명

#### 일정 그룹화
여러 날짜에 걸친 일정은 `todo_group_id`로 묶여 관리됩니다. 하나의 날짜에서 일정을 삭제하면 같은 그룹의 모든 일정이 삭제됩니다.

#### Google Calendar 동기화
- **가져오기**: Google Calendar의 일정을 앱에 표시
- **내보내기**: 앱의 일정을 Google Calendar에 표시
- **동기화 후 저장**: 양방향으로 영구 저장 (토글 비활성화 후에도 유지)

#### STT/OCR 일정 추출
음성이나 이미지에서 추출된 텍스트를 LLM으로 분석하여 일정 정보를 자동으로 추출합니다:
- 제목, 날짜(시작/종료), 시간, 카테고리, 장소 등 자동 추출
- 종료 날짜가 없으면 시작 날짜와 동일하게 설정

## 문제 해결

### 포트 충돌
- Backend 기본 포트: 8000
- Frontend 기본 포트: 5173
- 포트가 사용 중이면 환경 변수나 설정 파일에서 변경

### 데이터베이스 오류
- `momflow.db` 파일이 없으면 자동으로 생성됩니다
- 마이그레이션 스크립트를 실행하여 스키마를 업데이트하세요

### Google OAuth 오류
- `.env` 파일의 `GOOGLE_CLIENT_ID`와 `GOOGLE_CLIENT_SECRET` 확인
- Google Cloud Console에서 OAuth 동의 화면 설정 확인
- 리다이렉트 URI가 정확히 설정되었는지 확인

## 라이선스

이 프로젝트는 교육 목적으로 개발되었습니다.

## 기여자

- 프로젝트 개발팀

## 참고 문서

- [Google OAuth 설정 가이드](GOOGLE_OAUTH_SETUP.md)
- [UI/UX 구현 가이드](ui_ux_docu/UI_UX_Implementation_Guide.md)
