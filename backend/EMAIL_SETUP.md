# 이메일 알림 설정 가이드

FastAPI에 이메일 알림 기능이 추가되었습니다. 일정 알림을 이메일로 받을 수 있습니다.

## 환경 변수 설정

`.env` 파일에 다음 SMTP 설정을 추가하세요:

```env
# SMTP 설정 (Gmail 예시)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_EMAIL=your-email@gmail.com
```

### Gmail 설정 방법

1. **앱 비밀번호 생성**
   - Google 계정 설정 → 보안 → 2단계 인증 활성화
   - 앱 비밀번호 생성: https://myaccount.google.com/apppasswords
   - 생성된 16자리 비밀번호를 `SMTP_PASSWORD`에 입력

2. **환경 변수 설정**
   ```env
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASSWORD=xxxx xxxx xxxx xxxx  # 앱 비밀번호 (공백 제거)
   SMTP_FROM_EMAIL=your-email@gmail.com
   ```

### 다른 이메일 서비스 설정

#### Outlook/Hotmail
```env
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_USER=your-email@outlook.com
SMTP_PASSWORD=your-password
SMTP_FROM_EMAIL=your-email@outlook.com
```

#### 네이버
```env
SMTP_HOST=smtp.naver.com
SMTP_PORT=587
SMTP_USER=your-email@naver.com
SMTP_PASSWORD=your-password
SMTP_FROM_EMAIL=your-email@naver.com
```

#### SendGrid (추천 - 프로덕션용)
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=your-sendgrid-api-key
SMTP_FROM_EMAIL=your-email@yourdomain.com
```

## 사용 방법

### 1. 일정에 알림 설정

일정을 생성하거나 수정할 때 `has_notification: true`와 `notification_reminders`를 설정하세요:

```json
{
  "title": "회의",
  "date": "2024-01-15",
  "start_time": "14:00",
  "has_notification": true,
  "notification_reminders": [
    {"value": 30, "unit": "minutes"},
    {"value": 1, "unit": "hours"}
  ]
}
```

### 2. 알림 발송 (수동)

알림 발송 엔드포인트를 호출하여 예정된 알림을 발송합니다:

```bash
POST /api/notifications/send-scheduled
```

### 3. 자동 알림 발송 (권장)

프로덕션 환경에서는 주기적으로 알림을 발송하도록 스케줄러를 설정하세요:

#### Cron Job 예시 (매 5분마다 실행)
```bash
*/5 * * * * curl -X POST http://localhost:8000/api/notifications/send-scheduled -H "Authorization: Bearer YOUR_TOKEN"
```

#### Python 스케줄러 예시
```python
import schedule
import time
import requests

def send_notifications():
    response = requests.post(
        "http://localhost:8000/api/notifications/send-scheduled",
        headers={"Authorization": "Bearer YOUR_TOKEN"}
    )
    print(f"알림 발송: {response.json()}")

# 매 5분마다 실행
schedule.every(5).minutes.do(send_notifications)

while True:
    schedule.run_pending()
    time.sleep(1)
```

## API 엔드포인트

### 알림 발송
```
POST /api/notifications/send-scheduled
```
예정된 알림 이메일을 발송합니다.

### 알림 목록 조회
```
GET /api/notifications?skip=0&limit=100
```
사용자의 알림 목록을 조회합니다.

## 주의사항

1. **SMTP 설정이 없으면 이메일이 발송되지 않습니다**
   - 환경 변수가 설정되지 않으면 로그에 경고만 출력됩니다.

2. **알림 시간 정확도**
   - 알림 발송 엔드포인트를 호출한 시점에서 5분 이내의 알림만 발송됩니다.
   - 정확한 알림을 위해 주기적으로 엔드포인트를 호출해야 합니다.

3. **중복 발송 방지**
   - 같은 일정의 같은 알림 시간에 대해 한 번만 발송됩니다.
   - `notifications` 테이블에 발송 기록이 저장됩니다.

## 문제 해결

### 이메일이 발송되지 않는 경우

1. 환경 변수 확인
   ```bash
   echo $SMTP_USER
   echo $SMTP_PASSWORD
   ```

2. 로그 확인
   ```bash
   # 백엔드 로그에서 [EMAIL] 태그로 검색
   tail -f logs/app.log | grep EMAIL
   ```

3. SMTP 연결 테스트
   ```python
   from app.services.email_service import EmailService
   
   success = EmailService.send_notification_email(
       to_email="test@example.com",
       todo_title="테스트",
       todo_date="2024-01-15",
       todo_time="14:00",
       reminder_time="30분 전"
   )
   print(f"발송 성공: {success}")
   ```

