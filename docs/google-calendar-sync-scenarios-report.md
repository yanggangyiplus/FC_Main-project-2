# Google Calendar 내보내기 시나리오별 동작 분석 보고서

> **분석 일자**: 2025년 1월
> **분석 범위**: 내보내기(Export) 토글 ON 상태에서의 모든 동기화 동작
> **관련 파일**: `backend/app/api/routes/todos.py`, `backend/app/services/calendar_service.py`

---

## 목차

1. [기간(다일) 프로젝트 설정](#시나리오-1-기간다일-프로젝트-설정)
2. [반복 일정 설정](#시나리오-2-반복-일정-설정)
3. [Todo 완료 체크](#시나리오-3-todo-완료-체크)
4. [알림 설정](#시나리오-4-알림-설정)
5. [체크리스트 & 카달로그](#시나리오-5-체크리스트--카달로그)
6. [우선순위 설정](#시나리오-6-우선순위-설정)
7. [카테고리/태그 설정](#시나리오-7-카테고리태그-설정)
8. [종일 이벤트 vs 시간 지정](#시나리오-8-종일-이벤트-vs-시간-지정)
9. [위치/장소 설정](#시나리오-9-위치장소-설정)
10. [메모/설명 작성](#시나리오-10-메모설명-작성)
11. [일정 수정](#시나리오-11-일정-수정)
12. [일정 삭제](#시나리오-12-일정-삭제)
13. [가족 구성원 공유](#시나리오-13-가족-구성원-공유)
14. [음성/카메라 입력 일정](#시나리오-14-음성카메라-입력-일정)
15. [자동화 규칙 생성 일정](#시나리오-15-자동화-규칙-생성-일정)
16. [오프라인 상태에서 생성](#시나리오-16-오프라인-상태에서-생성)
17. [토큰 만료 상황](#시나리오-17-토큰-만료-상황)
18. [Google Calendar에서 직접 수정](#시나리오-18-google-calendar에서-직접-수정)

---

## 시나리오 1: 기간(다일) 프로젝트 설정

### 사용자 액션
- 시작일: 2025-01-10
- 종료일: 2025-01-15 (6일간)
- 제목: "프로젝트 마감"

### 현재 동작

#### Always Plan에서
```
Todo 생성:
- date: 2025-01-10
- end_date: 2025-01-15
- all_day: true (종일 이벤트로 처리)
```

#### Google Calendar로 전송
```json
{
  "summary": "프로젝트 마감",
  "start": {
    "date": "2025-01-10",
    "timeZone": "Asia/Seoul"
  },
  "end": {
    "date": "2025-01-16",  // ⚠️ end_date + 1일 (Google Calendar는 exclusive)
    "timeZone": "Asia/Seoul"
  }
}
```

### Google Calendar 표시
| 항목 | 결과 |
|------|------|
| 기간 | 1/10 ~ 1/15 (6일간 올바르게 표시) |
| 형태 | 종일 이벤트 배너 |

### 분석 결과
| 상태 | 설명 |
|------|------|
| ✅ 정상 | 기간 일정이 Google Calendar에 정확히 반영됨 |
| ⚠️ 주의 | end_date는 exclusive로 +1일 처리 필요 (현재 구현됨) |

---

## 시나리오 2: 반복 일정 설정

### 사용자 액션
- 매주 월요일 팀 미팅
- 반복 유형: weekly
- 시작일: 2025-01-06 (월요일)
- 반복 종료: 2025-03-31

### 현재 동작

#### Always Plan에서
```
반복 규칙에 따라 개별 Todo 생성:
- 2025-01-06 팀 미팅 (todo_group_id: "abc123")
- 2025-01-13 팀 미팅 (todo_group_id: "abc123")
- 2025-01-20 팀 미팅 (todo_group_id: "abc123")
- ... (각각 독립적인 Todo)
```

#### Google Calendar로 전송
```json
// ⚠️ 각 일정이 개별 이벤트로 생성됨 (반복 규칙 없음)
{
  "summary": "팀 미팅",
  "start": { "dateTime": "2025-01-06T09:00:00", "timeZone": "Asia/Seoul" },
  "end": { "dateTime": "2025-01-06T10:00:00", "timeZone": "Asia/Seoul" }
  // ❌ recurrence 필드 없음
}
```

### Google Calendar 표시
| 항목 | 결과 |
|------|------|
| 반복 아이콘 | ❌ 없음 (개별 이벤트로 표시) |
| 일괄 수정 | ❌ 불가 (각각 독립적) |
| 일정 개수 | 약 13개 (3개월치 개별 이벤트) |

### 분석 결과
| 상태 | 설명 |
|------|------|
| ⚠️ 제한적 | 반복 규칙(RRULE)이 Google Calendar로 전달되지 않음 |
| 📝 이유 | 중복 일정 생성 방지를 위해 의도적으로 비활성화됨 |
| 🔧 영향 | Google Calendar에서 "반복 일정 모두 수정" 기능 사용 불가 |

### 코드 근거
```python
# calendar_service.py 라인 ~290
# 반복 정보는 Google Calendar로 전달하지 않음 (중복 일정 생성 방지)
if False:  # 의도적으로 비활성화
    event['recurrence'] = [rrule_string]
```

---

## 시나리오 3: Todo 완료 체크

### 사용자 액션
- 기존 일정 "보고서 제출" 완료 체크
- status: "pending" → "completed"
- completed_at: 현재 시간 저장

### 현재 동작

#### Always Plan에서
```python
todo.status = "completed"
todo.completed_at = datetime.utcnow()
db.commit()
```

#### Google Calendar로 전송
```
❌ 아무것도 전송되지 않음
```

### Google Calendar 표시
| 항목 | 결과 |
|------|------|
| 상태 변경 | ❌ 없음 (여전히 일반 이벤트) |
| 취소선 | ❌ 없음 |
| 색상 변경 | ❌ 없음 |

### 분석 결과
| 상태 | 설명 |
|------|------|
| ❌ 미동기화 | Google Calendar에는 "완료" 개념이 없음 |
| 📝 이유 | Google Calendar Event API에 status/completed 필드 없음 |
| 💡 대안 | 완료 시 이벤트 삭제 또는 제목에 ✓ 추가 가능 (미구현) |

### 잠재적 개선안
```python
# 옵션 1: 완료 시 제목 수정
await GoogleCalendarService.update_event(
    title=f"✓ {todo.title}",  # 완료 표시
    ...
)

# 옵션 2: 완료 시 색상 변경
event['colorId'] = '8'  # 회색

# 옵션 3: 완료 시 Google Calendar에서 삭제
await GoogleCalendarService.delete_event(event_id)
```

---

## 시나리오 4: 알림 설정

### 사용자 액션
- 알림 활성화: has_notification = true
- 알림 시간: 30분 전, 1시간 전, 1일 전

### 현재 동작

#### Always Plan에서
```json
{
  "has_notification": true,
  "notification_reminders": [
    {"value": 30, "unit": "minutes"},
    {"value": 1, "unit": "hours"},
    {"value": 1, "unit": "days"}
  ]
}
```

#### Google Calendar로 전송
```json
{
  "reminders": {
    "useDefault": false,
    "overrides": [
      {"method": "popup", "minutes": 30},
      {"method": "popup", "minutes": 60},      // 1시간 = 60분
      {"method": "popup", "minutes": 1440}     // 1일 = 1440분
    ]
  }
}
```

### Google Calendar 표시
| 항목 | 결과 |
|------|------|
| 알림 개수 | 3개 |
| 알림 유형 | 팝업 알림 |
| 이메일 알림 | ❌ 미지원 (popup만 사용) |

### 분석 결과
| 상태 | 설명 |
|------|------|
| ✅ 정상 | 알림이 정확히 변환되어 전송됨 |
| ⚠️ 제한 | Google Calendar의 기본 알림은 무시됨 (useDefault: false) |
| ⚠️ 제한 | 이메일 알림은 지원하지 않음 (method: "popup"만 사용) |

### 단위 변환 로직
```python
# calendar_service.py
if unit == "minutes":
    minutes = value
elif unit == "hours":
    minutes = value * 60
elif unit == "days":
    minutes = value * 24 * 60
elif unit == "weeks":
    minutes = value * 7 * 24 * 60
```

---

## 시나리오 5: 체크리스트 & 카달로그

### 사용자 액션
- Todo "프로젝트 준비"에 체크리스트 추가:
  - [ ] 자료 수집
  - [x] 미팅 일정 확인
  - [ ] 발표 자료 작성

### 현재 동작

#### Always Plan에서
```
ChecklistItem 테이블에 저장:
- todo_id: "프로젝트 준비" ID
- items: [{text: "자료 수집", completed: false}, ...]
```

#### Google Calendar로 전송
```
❌ 체크리스트 정보 전송 안됨
```

### Google Calendar 표시
| 항목 | 결과 |
|------|------|
| 체크리스트 | ❌ 표시 안됨 |
| 설명에 포함 | ❌ 포함 안됨 |

### 분석 결과
| 상태 | 설명 |
|------|------|
| ❌ 미동기화 | Google Calendar Event에 체크리스트 필드 없음 |
| 📝 참고 | 카달로그 기능은 현재 프로젝트에 구현되어 있지 않음 |

### 잠재적 개선안
```python
# 체크리스트를 description에 텍스트로 포함
checklist_text = "\n\n📋 체크리스트:\n"
for item in todo.checklist_items:
    status = "✓" if item.completed else "○"
    checklist_text += f"{status} {item.text}\n"

await GoogleCalendarService.update_event(
    description=f"{todo.description}{checklist_text}",
    ...
)
```

---

## 시나리오 6: 우선순위 설정

### 사용자 액션
- 우선순위: high (높음)
- priority 필드: "high"

### 현재 동작

#### Always Plan에서
```python
todo.priority = "high"  # low, medium, high
```

#### Google Calendar로 전송
```
❌ 우선순위 정보 전송 안됨
```

### Google Calendar 표시
| 항목 | 결과 |
|------|------|
| 우선순위 표시 | ❌ 없음 |
| 색상 구분 | ❌ 없음 |
| 중요 표시 | ❌ 없음 |

### 분석 결과
| 상태 | 설명 |
|------|------|
| ❌ 미동기화 | Google Calendar API에 priority 필드 없음 |
| 💡 대안 | colorId로 우선순위 시각화 가능 (미구현) |

### 잠재적 개선안
```python
# 우선순위별 색상 매핑
PRIORITY_COLORS = {
    "high": "11",    # 빨강
    "medium": "5",   # 노랑
    "low": "8"       # 회색
}

event['colorId'] = PRIORITY_COLORS.get(todo.priority, "0")
```

---

## 시나리오 7: 카테고리/태그 설정

### 사용자 액션
- 카테고리: "업무"
- 태그: ["중요", "프로젝트A", "2025Q1"]

### 현재 동작

#### Always Plan에서
```python
todo.category = "업무"
todo.tags = '["중요", "프로젝트A", "2025Q1"]'  # JSON string
```

#### Google Calendar로 전송
```
❌ 카테고리/태그 정보 전송 안됨
```

### Google Calendar 표시
| 항목 | 결과 |
|------|------|
| 카테고리 | ❌ 없음 |
| 태그/라벨 | ❌ 없음 |

### 분석 결과
| 상태 | 설명 |
|------|------|
| ❌ 미동기화 | Google Calendar에 태그/카테고리 개념 없음 |
| 💡 대안 1 | 제목에 [카테고리] 접두사 추가 |
| 💡 대안 2 | 별도 캘린더에 저장 (calendarId 변경) |

---

## 시나리오 8: 종일 이벤트 vs 시간 지정

### 케이스 A: 종일 이벤트

#### 사용자 액션
```
all_day: true
date: 2025-01-10
```

#### Google Calendar로 전송
```json
{
  "start": {
    "date": "2025-01-10",      // 날짜만 (시간 없음)
    "timeZone": "Asia/Seoul"
  },
  "end": {
    "date": "2025-01-11",      // 다음날 (exclusive)
    "timeZone": "Asia/Seoul"
  }
}
```

### 케이스 B: 시간 지정 이벤트

#### 사용자 액션
```
all_day: false
date: 2025-01-10
start_time: 14:00
end_time: 15:30
```

#### Google Calendar로 전송
```json
{
  "start": {
    "dateTime": "2025-01-10T14:00:00",
    "timeZone": "Asia/Seoul"
  },
  "end": {
    "dateTime": "2025-01-10T15:30:00",
    "timeZone": "Asia/Seoul"
  }
}
```

### 분석 결과
| 상태 | 설명 |
|------|------|
| ✅ 정상 | 종일/시간 지정 모두 정확히 처리됨 |
| ⚠️ 주의 | end_time 없으면 자동으로 +1시간 설정 |

---

## 시나리오 9: 위치/장소 설정

### 사용자 액션
- 위치: "서울시 강남구 테헤란로 123, 회의실 A"

### 현재 동작

#### Google Calendar로 전송
```json
{
  "location": "서울시 강남구 테헤란로 123, 회의실 A"
}
```

### Google Calendar 표시
| 항목 | 결과 |
|------|------|
| 위치 표시 | ✅ 정상 표시 |
| 지도 링크 | ✅ Google Maps 자동 연결 |
| 길찾기 | ✅ 사용 가능 |

### 분석 결과
| 상태 | 설명 |
|------|------|
| ✅ 정상 | 위치 정보가 완벽하게 동기화됨 |

---

## 시나리오 10: 메모/설명 작성

### 사용자 액션
- 설명: "분기 보고서 검토 미팅"
- 메모: "자료 준비 필수. 노트북 지참."

### 현재 동작

#### Always Plan에서
```python
todo.description = "분기 보고서 검토 미팅"
todo.memo = "자료 준비 필수. 노트북 지참."
```

#### Google Calendar로 전송
```json
{
  "description": "자료 준비 필수. 노트북 지참.\n\n[AlwaysPlanID: abc123]"
  // ⚠️ memo 우선, description은 memo 없을 때만 사용
}
```

### 분석 결과
| 상태 | 설명 |
|------|------|
| ⚠️ 부분적 | memo OR description 중 하나만 전송됨 |
| 📝 우선순위 | `memo or description` 로직 사용 |
| 📝 태그 추가 | AlwaysPlanID 자동 추가 (중복 제거용) |

### 코드 근거
```python
# todos.py
description=db_todo.memo or db_todo.description or ""
```

### 잠재적 개선안
```python
# 둘 다 있으면 합치기
full_description = ""
if todo.description:
    full_description += todo.description
if todo.memo:
    full_description += f"\n\n📝 메모:\n{todo.memo}"
```

---

## 시나리오 11: 일정 수정

### 사용자 액션
- 기존 일정 "팀 미팅" 수정
- 시간 변경: 14:00 → 15:00
- 제목 변경: "팀 미팅" → "분기 팀 미팅"

### 현재 동작

#### Always Plan에서
```python
# PATCH /todos/{todo_id}
todo.title = "분기 팀 미팅"
todo.start_time = time(15, 0)
```

#### Google Calendar로 전송
```python
# google_calendar_event_id가 있으면 UPDATE
await GoogleCalendarService.update_event(
    event_id=todo.google_calendar_event_id,
    title="분기 팀 미팅",
    start_datetime=datetime(2025, 1, 10, 15, 0),
    ...
)
```

### 분석 결과
| 상태 | 설명 |
|------|------|
| ✅ 정상 | 기존 이벤트가 업데이트됨 |
| ⚠️ 조건 | `google_calendar_event_id`가 있어야 UPDATE, 없으면 CREATE |

---

## 시나리오 12: 일정 삭제

### 사용자 액션
- "팀 미팅" 일정 삭제

### 현재 동작

#### Always Plan에서
```python
# DELETE /todos/{todo_id}
# Soft delete
todo.deleted_at = datetime.utcnow()
```

#### Google Calendar로 전송
```python
# google_calendar_event_id가 있으면 삭제
await GoogleCalendarService.delete_event(
    event_id=todo.google_calendar_event_id
)
```

### 분석 결과
| 상태 | 설명 |
|------|------|
| ✅ 정상 | Google Calendar에서도 삭제됨 |
| 📝 참고 | todo_group_id 있으면 그룹 전체 삭제 |

---

## 시나리오 13: 가족 구성원 공유

### 사용자 액션
- 가족 구성원과 일정 공유
- family_member_ids: ["user2", "user3"]

### 현재 동작

#### Always Plan에서
```python
todo.family_member_ids = '["user2", "user3"]'
```

#### Google Calendar로 전송
```
❌ 공유 정보 전송 안됨
```

### Google Calendar 표시
| 항목 | 결과 |
|------|------|
| 참석자 추가 | ❌ 없음 |
| 공유 상태 | ❌ 없음 |

### 분석 결과
| 상태 | 설명 |
|------|------|
| ❌ 미동기화 | Google Calendar 참석자(attendees) 기능 미사용 |
| 💡 대안 | attendees 필드로 이메일 초대 가능 (미구현) |

### 잠재적 개선안
```python
# 가족 구성원을 Google Calendar 참석자로 추가
attendees = []
for member_id in family_member_ids:
    member = get_user(member_id)
    if member.email:
        attendees.append({"email": member.email})

event['attendees'] = attendees
```

---

## 시나리오 14: 음성/카메라 입력 일정

### 사용자 액션
- 음성으로 일정 생성: "내일 오후 3시 치과 예약"
- source: "voice"

### 현재 동작

#### Always Plan에서
```python
todo.source = "voice"  # 또는 "camera", "text"
```

#### Google Calendar로 전송
```
❌ source 정보 전송 안됨
```

### 분석 결과
| 상태 | 설명 |
|------|------|
| ❌ 미동기화 | 입력 소스 정보는 내부 용도로만 사용 |
| 📝 영향 없음 | 일정 내용 자체는 정상 동기화됨 |

---

## 시나리오 15: 자동화 규칙 생성 일정

### 사용자 액션
- 자동화 규칙에 의해 자동 생성된 일정
- rule_id: "rule_abc123"

### 현재 동작

#### Always Plan에서
```python
todo.rule_id = "rule_abc123"  # 자동화 규칙 참조
```

#### Google Calendar로 전송
```
✅ 일반 일정과 동일하게 동기화
❌ rule_id 정보는 전송 안됨
```

### 분석 결과
| 상태 | 설명 |
|------|------|
| ✅ 정상 | 일정 내용은 정상 동기화 |
| ⚠️ 메타데이터 | 자동화 출처 정보는 미전송 |

---

## 시나리오 16: 오프라인 상태에서 생성

### 사용자 액션
- 네트워크 연결 없이 일정 생성

### 현재 동작

```
1. 로컬 DB에 Todo 저장 ✅
2. Google Calendar API 호출 시도
3. 네트워크 오류 발생
4. google_calendar_event_id = NULL 상태로 저장
5. 온라인 복귀 후 → 자동 재동기화 없음 ❌
```

### 분석 결과
| 상태 | 설명 |
|------|------|
| ⚠️ 문제 | 오프라인 생성 일정은 수동 동기화 필요 |
| 🔧 해결 | toggle-export 재활성화 또는 sync/all 실행 필요 |

---

## 시나리오 17: 토큰 만료 상황

### 상황
- Google OAuth 토큰 만료 (보통 1시간)
- Refresh 토큰으로 자동 갱신 시도

### 현재 동작

```python
# calendar_service.py - get_credentials_from_token()
if credentials.expired and credentials.refresh_token:
    credentials.refresh(Request())
    # 갱신된 토큰 반환
```

### 분석 결과
| 상태 | 설명 |
|------|------|
| ✅ 자동 갱신 | refresh_token 있으면 자동 갱신 |
| ⚠️ 예외 | refresh_token 없거나 무효화되면 재인증 필요 |

---

## 시나리오 18: Google Calendar에서 직접 수정

### 사용자 액션
- Google Calendar 앱에서 직접 일정 시간 변경
- 웹앱의 동일 일정은?

### 현재 동작

```
Google Calendar에서 수정:
- 시간: 14:00 → 16:00

Always Plan에서:
- ❌ 변경사항 감지 안됨
- 여전히 14:00으로 표시
```

### 분석 결과
| 상태 | 설명 |
|------|------|
| ❌ 단방향 | 현재 Export만 지원, Import로 가져오기는 읽기 전용 |
| 📝 충돌 가능 | 양쪽에서 다른 시간 표시 → 다음 수정 시 덮어쓰기 |

---

## 종합 요약표

### 동기화 상태 매트릭스

| # | 시나리오 | Google Calendar 반영 | 비고 |
|---|----------|---------------------|------|
| 1 | 기간(다일) 프로젝트 | ✅ 완전 지원 | end_date + 1일 처리 |
| 2 | 반복 일정 | ⚠️ 부분 지원 | 개별 이벤트로 생성 (RRULE 미사용) |
| 3 | 완료 체크 | ❌ 미지원 | Google Calendar에 완료 개념 없음 |
| 4 | 알림 설정 | ✅ 완전 지원 | popup 알림만 (이메일 미지원) |
| 5 | 체크리스트 | ❌ 미지원 | Google Calendar에 체크리스트 없음 |
| 6 | 우선순위 | ❌ 미지원 | colorId로 대체 가능 |
| 7 | 카테고리/태그 | ❌ 미지원 | 별도 캘린더로 대체 가능 |
| 8 | 종일/시간 지정 | ✅ 완전 지원 | date vs dateTime 자동 선택 |
| 9 | 위치/장소 | ✅ 완전 지원 | Google Maps 연동 |
| 10 | 메모/설명 | ⚠️ 부분 지원 | memo OR description (둘 중 하나) |
| 11 | 일정 수정 | ✅ 완전 지원 | UPDATE API 사용 |
| 12 | 일정 삭제 | ✅ 완전 지원 | DELETE API 사용 |
| 13 | 가족 공유 | ❌ 미지원 | attendees 미사용 |
| 14 | 음성/카메라 입력 | ✅ 내용만 지원 | source 메타데이터 미전송 |
| 15 | 자동화 규칙 일정 | ✅ 내용만 지원 | rule_id 미전송 |
| 16 | 오프라인 생성 | ⚠️ 수동 동기화 필요 | 자동 재시도 없음 |
| 17 | 토큰 만료 | ✅ 자동 갱신 | refresh_token 필요 |
| 18 | Google에서 수정 | ❌ 미반영 | 단방향 동기화 (Export only) |

---

## 개선 우선순위 제안

### 높음 (High Priority)
1. **완료 상태 동기화** - 제목에 ✓ 표시 또는 색상 변경
2. **양방향 동기화** - Google Calendar 변경사항 감지
3. **오프라인 동기화 큐** - 온라인 복귀 시 자동 재시도

### 중간 (Medium Priority)
4. **체크리스트 → description 포함**
5. **우선순위 → 색상 매핑**
6. **반복 규칙 RRULE 전송** (충돌 해결 후)

### 낮음 (Low Priority)
7. 카테고리/태그 → 별도 캘린더
8. 가족 공유 → attendees
9. 이메일 알림 지원

---

*보고서 작성일: 2025년 1월*
*분석 버전: 1.0*
