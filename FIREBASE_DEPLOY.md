# Firebase 배포 가이드

이 문서는 Always Plan 프로젝트를 Firebase Hosting과 Cloud Run에 배포하는 방법을 설명합니다.

## 아키텍처

- **Frontend**: Firebase Hosting (React + Vite)
- **Backend**: Google Cloud Run (Python FastAPI)
- **CI/CD**: GitHub Actions

## 사전 준비

### 1. Firebase 프로젝트 생성

1. [Firebase Console](https://console.firebase.google.com/)에 접속
2. 새 프로젝트 생성 또는 기존 GCP 프로젝트 연결
3. Hosting 활성화

### 2. GCP 설정 (백엔드 배포용)

1. [GCP Console](https://console.cloud.google.com/)에서 프로젝트 선택
2. Cloud Run API 활성화
3. Artifact Registry API 활성화
4. Artifact Registry에 Docker 저장소 생성:
   ```bash
   gcloud artifacts repositories create alwaysplan-backend \
     --repository-format=docker \
     --location=asia-northeast3 \
     --description="Always Plan Backend"
   ```

### 3. 서비스 계정 생성

#### Firebase Hosting용
1. Firebase Console > 프로젝트 설정 > 서비스 계정
2. 새 비공개 키 생성 (JSON)
3. JSON 내용을 GitHub Secrets에 `FIREBASE_SERVICE_ACCOUNT`로 저장

#### Cloud Run용
1. GCP Console > IAM 및 관리자 > 서비스 계정
2. 새 서비스 계정 생성
3. 필요 역할:
   - Cloud Run Admin
   - Storage Admin
   - Artifact Registry Writer
4. JSON 키 생성 후 GitHub Secrets에 `GCP_SA_KEY`로 저장

## GitHub Secrets 설정

Repository > Settings > Secrets and variables > Actions에서 다음 시크릿 추가:

### 필수 시크릿

| 시크릿 이름 | 설명 |
|------------|------|
| `FIREBASE_SERVICE_ACCOUNT` | Firebase 서비스 계정 JSON |
| `FIREBASE_PROJECT_ID` | Firebase 프로젝트 ID |
| `GCP_PROJECT_ID` | GCP 프로젝트 ID |
| `GCP_SA_KEY` | GCP 서비스 계정 JSON |
| `VITE_API_URL` | 백엔드 API URL (예: `https://alwaysplan-backend-xxxxx.run.app`) |

### 백엔드 환경 변수 시크릿

| 시크릿 이름 | 설명 |
|------------|------|
| `CORS_ORIGINS` | CORS 허용 도메인 (예: `https://your-project.web.app`) |
| `GOOGLE_CLIENT_ID` | Google OAuth 클라이언트 ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 클라이언트 시크릿 |
| `JWT_SECRET` | JWT 토큰 서명용 시크릿 |
| `DATABASE_URL` | 데이터베이스 연결 URL |
| `GOOGLE_GEMINI_API_KEY` | Google Gemini API 키 |
| `ANTHROPIC_API_KEY` | Anthropic API 키 |

## 로컬 배포 (수동)

### Firebase CLI 설치

```bash
npm install -g firebase-tools
firebase login
```

### 프론트엔드 빌드 및 배포

```bash
cd frontend
npm install
npm run build
cd ..
firebase deploy --only hosting
```

### 백엔드 배포 (Cloud Run)

```bash
cd backend
gcloud builds submit --tag asia-northeast3-docker.pkg.dev/PROJECT_ID/alwaysplan-backend/alwaysplan-backend
gcloud run deploy alwaysplan-backend \
  --image asia-northeast3-docker.pkg.dev/PROJECT_ID/alwaysplan-backend/alwaysplan-backend \
  --platform managed \
  --region asia-northeast3 \
  --allow-unauthenticated
```

## 자동 배포 (CI/CD)

GitHub Actions가 설정되어 있어 다음 경우 자동 배포됩니다:

- **main 브랜치에 push**:
  - `frontend/` 변경 시 → Firebase Hosting 배포
  - `backend/` 변경 시 → Cloud Run 배포

- **Pull Request 생성**:
  - Firebase Hosting 미리보기 URL 생성

## .firebaserc 설정

`.firebaserc` 파일의 `your-firebase-project-id`를 실제 프로젝트 ID로 변경:

```json
{
  "projects": {
    "default": "실제-프로젝트-id"
  }
}
```

## 프론트엔드 환경 변수

`frontend/.env` 파일 생성:

```env
VITE_API_URL=https://alwaysplan-backend-xxxxx.run.app
```

## 문제 해결

### 빌드 실패
- Node.js 버전 확인 (v20 권장)
- `npm ci` 실행하여 의존성 재설치

### 배포 권한 오류
- 서비스 계정 권한 확인
- Firebase/GCP 프로젝트 ID 확인

### CORS 오류
- Cloud Run의 CORS_ORIGINS 환경 변수에 프론트엔드 도메인 추가
- Firebase Hosting URL 형식: `https://PROJECT_ID.web.app`
