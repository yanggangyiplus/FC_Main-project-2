# Always Plan 프로젝트 완성 가이드

## 📋 프로젝트 구조

```
FC_Main-project-2/
├── backend/                          # FastAPI 백엔드
│   ├── app/
│   │   ├── api/routes/
│   │   │   ├── auth.py              # Google OAuth 인증 (보안 대책 적용)
│   │   │   ├── todos.py             # 할일/일정 CRUD
│   │   │   ├── family.py            # 가족 구성원 관리
│   │   │   ├── receipts.py          # 영수증 OCR
│   │   │   ├── memos.py             # 메모 관리
│   │   │   └── ai.py                # AI 서비스 (STT/OCR)
│   │   ├── services/
│   │   │   ├── auth_service.py      # JWT + Token 관리
│   │   │   └── ai_service.py        # Claude + Gemini + Tesseract
│   │   ├── repositories/
│   │   │   └── user_repo.py         # 사용자 저장소
│   │   ├── models/
│   │   │   ├── base.py              # 베이스 모델
│   │   │   ├── user.py              # 사용자 모델
│   │   │   └── models.py            # Todo, Receipt, FamilyMember 등
│   │   ├── database/
│   │   │   └── __init__.py          # SQLite + SQLAlchemy
│   │   ├── schemas/                 # Pydantic 스키마
│   │   └── config.py                # 설정 (always-plan.db)
│   ├── main.py                      # FastAPI 앱 진입점
│   ├── run.py                       # 서버 실행 스크립트
│   ├── requirements.txt              # Python 패키지
│   ├── test_integration.py          # 통합 테스트
│   ├── test_api_comprehensive.py    # API 종합 테스트
│   ├── uploads/                     # 업로드 파일 저장소
│   │   └── memos/                   # 메모 이미지
│   └── always-plan.db               # SQLite 데이터베이스 (또는 momflow.db)
│
├── frontend/                        # React + Vite + TypeScript
│   ├── src/
│   │   ├── app/
│   │   │   ├── App.tsx              # 메인 앱 컴포넌트
│   │   │   └── components/         # React 컴포넌트
│   │   │       ├── CalendarHomeScreen.tsx    # 메인 캘린더 화면
│   │   │       ├── RoutineView.tsx           # 시간표 관리
│   │   │       ├── AddTodoModal.tsx          # 일정 추가 모달
│   │   │       ├── MonthCalendar.tsx          # 월간 캘린더
│   │   │       ├── WeekCalendar.tsx          # 주간 캘린더
│   │   │       ├── DayCalendar.tsx           # 일간 캘린더
│   │   │       ├── LoginScreen.tsx           # 로그인 화면
│   │   │       ├── MemberAddSheet.tsx        # 가족 구성원 추가
│   │   │       ├── MyPageScreen.tsx          # 마이페이지
│   │   │       ├── SettingsScreen.tsx        # 설정 화면
│   │   │       ├── NotificationPanel.tsx     # 알림 패널
│   │   │       ├── InputMethodModal.tsx      # 입력 방법 선택
│   │   │       ├── VoiceRecording.tsx        # 음성 녹음
│   │   │       ├── TodoItem.tsx              # 할일 아이템
│   │   │       └── ui/                       # shadcn/ui 컴포넌트
│   │   ├── services/
│   │   │   └── apiClient.ts         # API 클라이언트 (Axios)
│   │   ├── styles/
│   │   │   ├── index.css            # 전역 스타일
│   │   │   ├── tailwind.css         # Tailwind CSS
│   │   │   ├── theme.css            # 테마 스타일
│   │   │   └── fonts.css             # 폰트 설정
│   │   └── main.tsx                 # 진입점
│   ├── vite.config.ts              # Vite 설정
│   ├── package.json                 # Node.js 패키지
│   ├── tsconfig.json                # TypeScript 설정
│   └── public/                      # 정적 파일
│
├── start.sh                          # Mac/Linux 서버 시작 스크립트
├── start.ps1                          # Windows 서버 시작 스크립트
├── README_KR.md                       # 프로젝트 설명 (한국어)
├── COMPLETION_GUIDE.md               # 완성 가이드 (이 파일)
└── ui_ux_docu/                       # UI/UX 문서
    ├── google-issue.md               # OAuth 보안 이슈
    ├── 04_DATABASE_DESIGN.md         # 데이터베이스 설계
    └── ...
```

---

## ✅ 완성된 기능

### 1️⃣ Backend (FastAPI + Python 3.11)

**인증 (Auth)**
- ✅ Google OAuth 2.0 통합
- ✅ httpOnly 쿠키 (XSS 방지)
- ✅ State 파라미터 (CSRF 방지)
- ✅ JWT Access + Refresh Token
- ✅ 자동 토큰 갱신 (15분 주기)
- ✅ 소프트 삭제 패턴
- ✅ 로그아웃 기능

**데이터베이스 (SQLite + SQLAlchemy)**
- ✅ 9개 핵심 테이블 설계
  - users (사용자)
  - family_members (가족 구성원)
  - todos (할일/일정)
  - checklist_items (체크리스트)
  - rules (자동화 규칙)
  - rule_items (규칙 항목)
  - receipts (영수증 OCR)
  - notifications (알림)
  - memos (메모)
- ✅ 관계 설정 (1:N, Cascade Delete)
- ✅ 인덱싱 최적화
- ✅ ORM 모델 정의

**AI 모델**
- ✅ Google Gemini 2.0 STT (음성인식)
- ✅ Claude Vision API OCR (이미지 텍스트)
- ✅ Tesseract OCR (폴백)

**API 엔드포인트**
- ✅ `/auth/*` - Google OAuth 로그인 (6개)
- ✅ `/todos/*` - 할일/일정 관리 (9개)
- ✅ `/family/*` - 가족 구성원 관리 (4개)
- ✅ `/receipts/*` - 영수증 OCR (5개)
- ✅ `/memos/*` - 메모 관리
- ✅ `/ai/*` - AI 서비스 (STT/OCR)
- ✅ `/health` - 헬스 체크

### 2️⃣ Frontend (React 18 + Vite + TypeScript)

**주요 화면**
- ✅ 로그인 화면 (Google OAuth)
- ✅ 캘린더 홈 화면 (ToDo/캘린더/시간표 탭)
- ✅ 월간/주간/일간 캘린더 뷰
- ✅ 일정 추가/수정/삭제 모달
- ✅ 시간표 관리 (RoutineView)
- ✅ 가족 구성원 관리
- ✅ 마이페이지
- ✅ 설정 화면
- ✅ 알림 패널

**주요 기능**
- ✅ 일정 CRUD (생성/조회/수정/삭제)
- ✅ 시간표 관리 (요일별 시간 블록)
- ✅ 가족 구성원별 일정 필터링
- ✅ 일정 반복 설정 (매일/매주/매월/매년)
- ✅ 캘린더에 시간표 추가/제거 (체크박스)
- ✅ 프로필 관리 (이름, 이모지)
- ✅ 로그아웃

**UI/UX**
- ✅ Tailwind CSS 스타일링
- ✅ shadcn/ui 컴포넌트 라이브러리
- ✅ 반응형 디자인
- ✅ 다크모드 지원 준비
- ✅ Toast 알림 (sonner)

**API 클라이언트**
- ✅ Axios 기반 HTTP 클라이언트
- ✅ 자동 토큰 갱신
- ✅ httpOnly 쿠키 지원
- ✅ 환경별 설정 (.env.local)
- ✅ 에러 핸들링

---

## 🚀 시작하기

### 백엔드 시작

**Mac/Linux:**
```bash
# 1. 가상환경 활성화 (선택사항)
python3 -m venv .venv
source .venv/bin/activate

# 2. backend 폴더로 이동
cd backend

# 3. 패키지 설치 (처음 1회만)
pip install -r requirements.txt

# 4. FastAPI 서버 시작
python run.py
# 또는
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Windows:**
```powershell
cd backend
python run.py
```

**결과**: `INFO:     Uvicorn running on http://0.0.0.0:8000`

### 프론트엔드 시작

```bash
# 1. frontend 폴더로 이동
cd frontend

# 2. 패키지 설치 (처음 1회만)
npm install
# 또는
pnpm install

# 3. 개발 서버 시작
npm run dev
# 또는
pnpm dev

# 4. 브라우저에서 확인
# http://localhost:5173
```

### 통합 시작 (Mac/Linux)

```bash
# 프로젝트 루트에서
chmod +x start.sh
./start.sh
```

---

## 🧪 테스트

### 통합 테스트 실행

```bash
cd backend
python test_integration.py
```

### API 종합 테스트

```bash
cd backend
python test_api_comprehensive.py
```

**테스트 항목:**
- ✅ 모듈 imports
- 🔄 /health 엔드포인트 (서버 실행 중일 때)
- 🔄 /auth/google-init 엔드포인트 (서버 실행 중일 때)
- 🔄 데이터베이스 초기화
- 🔄 API 엔드포인트 동작 확인

---

## 🔐 Google OAuth 설정

### 1단계: Google Cloud Console에서 OAuth 앱 생성

1. https://console.cloud.google.com 접속
2. 새 프로젝트 생성: "Always Plan"
3. APIs & Services → OAuth consent screen
4. 사용자 타입 선택: "External"
5. 앱 정보 입력
6. Credentials → OAuth 2.0 클라이언트 ID 생성
7. 애플리케이션 타입: "웹 애플리케이션"

### 2단계: Redirect URI 등록

**개발 환경:**
```
http://localhost:5173
```

**프로덕션:**
```
https://always-plan.com
```

### 3단계: 환경변수 설정

```bash
# backend/.env
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret
JWT_SECRET=your_jwt_secret_min_32_chars
DATABASE_URL=sqlite:///./always-plan.db
```

---

## 📊 데이터베이스

### 데이터 저장 위치

**백엔드 데이터베이스 (SQLite)**
- 파일 위치: `backend/always-plan.db` (설정상) 또는 `backend/momflow.db` (실제 파일)
- 저장 데이터:
  - 사용자 정보 (users)
  - 할일/일정 (todos)
  - 가족 구성원 (family_members)
  - 영수증 (receipts)
  - 메모 (memos)
  - 규칙 (rules)
  - 알림 (notifications)

**프론트엔드 localStorage (브라우저)**
- 저장 데이터:
  - `access_token`: JWT 액세스 토큰
  - `refresh_token`: JWT 리프레시 토큰
  - `remember_me`: 로그인 상태 유지 플래그

**프론트엔드 메모리 (React State)**
- 저장 데이터 (임시, 새로고침 시 초기화):
  - `todos`: 할일 목록
  - `routines`: 시간표/루틴 목록
  - `familyMembers`: 가족 구성원 목록
  - UI 상태 (모달, 선택된 날짜 등)

### 데이터베이스 초기화

자동으로 첫 실행 시 생성됩니다:

```python
# backend/always-plan.db
# SQLite 데이터베이스 파일
```

### 테이블 목록
1. **users** - 사용자
2. **family_members** - 가족 구성원
3. **todos** - 할일/일정
4. **checklist_items** - 체크리스트
5. **rules** - 자동화 규칙
6. **rule_items** - 규칙 항목
7. **receipts** - 영수증 OCR
8. **notifications** - 알림
9. **memos** - 메모

---

## 🛠️ 문제 해결

### 1. 서버가 시작되지 않음
```bash
# 포트 확인
lsof -i :8000  # Mac/Linux
netstat -ano | findstr :8000  # Windows

# 패키지 재설치
pip install -r requirements.txt --upgrade
```

### 2. CORS 에러
- `vite.config.ts`의 proxy 설정 확인
- `backend/app/config.py`의 CORS 미들웨어 확인

### 3. 토큰 만료
- localStorage에서 `refresh_token` 확인
- `/auth/refresh` 엔드포인트 동작 확인

### 4. 데이터베이스 파일 찾기
```bash
# backend 폴더에서
ls -la *.db
# 또는
find . -name "*.db"
```

---

## 📚 참고 문서

- [README_KR.md](./README_KR.md) - 프로젝트 설명 (한국어)
- [ui_ux_docu/google-issue.md](./ui_ux_docu/google-issue.md) - OAuth 보안 이슈 및 해결책
- [ui_ux_docu/사용모델.md](./ui_ux_docu/사용모델.md) - AI 모델 스택
- [ui_ux_docu/04_DATABASE_DESIGN.md](./ui_ux_docu/04_DATABASE_DESIGN.md) - 데이터베이스 설계

---

## 🎯 주요 기능 상세

### 일정 관리
- ✅ 일정 추가/수정/삭제
- ✅ 일정 반복 설정 (매일/매주/매월/매년)
- ✅ 시간표에서 캘린더로 추가 (체크박스)
- ✅ 가족 구성원별 필터링
- ✅ 월간/주간/일간 뷰

### 시간표 관리
- ✅ 요일별 시간 블록 설정
- ✅ 드래그 앤 드롭으로 시간 조정
- ✅ 시간표 항목 추가/수정/삭제
- ✅ 캘린더 연동 (선택적)

### 가족 구성원 관리
- ✅ 구성원 추가/수정/삭제
- ✅ 이모지 및 색상 설정
- ✅ 구성원별 일정 필터링

---

## 🎯 다음 단계

### Phase 1: 로컬 테스트 ✅
- ✅ 백엔드 API 구현
- ✅ 프론트엔드 기본 기능 구현
- ✅ 로컬 테스트 및 동작 확인

### Phase 2: 기능 확장
- 🔄 STT/OCR 기능 프론트엔드 통합
- 🔄 알림 시스템 구현
- 🔄 자동화 규칙 관리

### Phase 3: 배포
- 🔄 Docker 배포 구성
- 🔄 프로덕션 환경 설정
- 🔄 HTTPS 인증서 설정

---

**마지막 업데이트**: 2025-01-27
**버전**: 1.0.0
**프로젝트명**: Always Plan
