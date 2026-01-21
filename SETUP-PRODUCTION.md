# 🚀 프로덕션 배포 설정 가이드

## 완료된 작업 ✅

1. ✅ Cloud Run 배포 완료
   - URL: https://always-plan-api-whdapyskmq-du.a.run.app
   
2. ✅ 프론트엔드 환경변수 설정
   - `frontend/.env.production` 생성 완료

## 🔧 다음 단계 (필수!)

### 1. 프론트엔드 재빌드 및 Firebase 배포

```bash
# 프론트엔드로 이동
cd frontend

# 빌드 (VITE_API_BASE_URL 환경변수 적용됨)
npm run build

# 프로젝트 루트로 이동
cd ..

# Firebase 배포
firebase deploy
```

### 2. 백엔드 CORS 설정 (필수!)

**Firebase Hosting URL을 Cloud Run에 등록해야 합니다.**

```bash
gcloud run services update always-plan-api \
  --region asia-northeast3 \
  --project always-plan-2025 \
  --set-env-vars "CORS_ORIGINS=https://always-plan-11f2c.web.app,https://always-plan-11f2c.firebaseapp.com"
```

**⚠️ 중요**: `always-plan-11f2c.web.app`이 실제 Firebase Hosting URL이 맞는지 확인하세요!

실제 URL 확인 방법:
```bash
firebase hosting:sites:list
# 또는 Firebase Console에서 확인
```

### 3. Google OAuth 리디렉트 URI 설정 (필수!)

Google Cloud Console에서 설정해야 합니다:

#### (A) 승인된 JavaScript 원본
```
https://always-plan-11f2c.web.app
https://always-plan-11f2c.firebaseapp.com
```

#### (B) 승인된 리디렉션 URI

**프론트엔드 URL로 설정** (프론트엔드에서 코드를 받아서 백엔드로 보내는 구조):

```
https://always-plan-11f2c.web.app
https://always-plan-11f2c.firebaseapp.com
```

**참고**: 현재 코드 구조는:
1. 프론트엔드에서 `/auth/google-init` 호출
2. 받은 `auth_url`로 리디렉트 (Google 인증)
3. Google에서 인증 후 **프론트엔드 URL로 리디렉트** (코드 포함)
4. 프론트엔드에서 코드를 받아 `/auth/google-login`으로 POST

따라서 **리디렉션 URI는 프론트엔드 URL**이어야 합니다!

### 4. 백엔드 Google Redirect URI 환경변수 (선택사항)

현재 백엔드 코드는 `ENVIRONMENT=production`일 때 `https://always-plan.com`을 기본값으로 사용합니다.

프론트엔드 URL과 다르다면 Cloud Run 환경변수로 설정:

```bash
gcloud run services update always-plan-api \
  --region asia-northeast3 \
  --project always-plan-2025 \
  --set-env-vars "GOOGLE_REDIRECT_URI=https://always-plan-11f2c.web.app"
```

## 📝 Google Cloud Console 설정 위치

1. Google Cloud Console 접속
2. API 및 서비스 → 사용자 인증 정보
3. OAuth 2.0 클라이언트 ID 클릭
4. "승인된 JavaScript 원본" 섹션에 프론트엔드 URL 추가
5. "승인된 리디렉션 URI" 섹션에 프론트엔드 URL 추가

## ✅ 확인 사항

배포 후 확인:

1. **프론트엔드가 Cloud Run API 호출하는지**
   - 브라우저 개발자 도구 → Network 탭
   - `localhost:8000` 호출이 없어야 함
   - 모든 API 호출이 `always-plan-api-whdapyskmq-du.a.run.app`로 가야 함

2. **CORS 에러 없는지**
   - 브라우저 콘솔에서 CORS 에러 확인
   - 없으면 정상

3. **Google 로그인 작동하는지**
   - 로그인 버튼 클릭
   - Google 인증 후 프론트엔드로 돌아와야 함
   - 로그인 성공해야 함

## 🔍 문제 해결

### CORS 에러가 발생하면?
```bash
# 현재 설정된 CORS_ORIGINS 확인
gcloud run services describe always-plan-api \
  --region asia-northeast3 \
  --project always-plan-2025 \
  --format 'value(spec.template.spec.containers[0].env)'
```

### 로그 확인
```bash
# Cloud Run 로그
gcloud run services logs tail always-plan-api \
  --region asia-northeast3 \
  --project always-plan-2025

# Firebase 로그
firebase functions:log
```

## 🎯 빠른 실행 순서

```bash
# 1. 프론트엔드 빌드 & 배포
cd frontend && npm run build && cd .. && firebase deploy

# 2. CORS 설정
gcloud run services update always-plan-api \
  --region asia-northeast3 \
  --project always-plan-2025 \
  --set-env-vars "CORS_ORIGINS=https://always-plan-11f2c.web.app,https://always-plan-11f2c.firebaseapp.com"

# 3. Google Cloud Console에서 OAuth 설정
# (웹 콘솔에서 수동 설정 필요)
```

완료! 🎉
