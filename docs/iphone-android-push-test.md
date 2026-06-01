# 실기기 푸시 알림 테스트 절차서

Phase 3 푸시 알림 인프라(MS Graph 메일 webhook 방식)를 iPhone + Android 실기기에서 검증하는 절차.

---

## 1. 사전 준비

### iOS
- [ ] **Apple Developer Program 가입** ($99/년) — https://developer.apple.com/programs/
- [ ] **iPhone UDID 등록**
  ```bash
  eas device:create
  ```
  → 안내 링크를 iPhone에서 열어 프로비저닝 프로파일 설치

### Android
- [ ] 디바이스 USB 디버깅 활성화 (개발자 옵션)
- [ ] 기존 preview APK 재설치 가능, 또는 새로 빌드

### 공통
- [ ] Supabase ANON KEY 준비 (curl 호출용)
  - 프로젝트 URL: `https://rexnpusrxezuztxmkaex.supabase.co`
- [ ] 학교 Outlook 계정 (`@kokushikan.ac.jp`) 로그인 정보

---

## 2. 빌드

### iOS (Development Build)
```bash
eas build --profile development-device --platform ios
```
→ 완료 후 QR 또는 링크로 iPhone에 설치

### Android
기존 preview APK 재사용 가능. 신규 빌드 시:
```bash
eas build --profile preview --platform android
```

---

## 3. 설치 후 동작 검증 체크리스트

### 3-1. 앱 기본 흐름
- [ ] 앱 실행 → 학교 선택 → 이메일+OTP 로그인 성공
- [ ] 푸시 권한 허용 팝업 등장 → **허용** 탭
- [ ] Supabase `push_tokens` 테이블에 `platform=ios` 행 생성 확인
- [ ] Android 디바이스에서도 동일 절차 → `platform=android` 행 생성 확인

**Supabase 확인 SQL**
```sql
SELECT user_id, platform, updated_at FROM push_tokens
WHERE user_id = '<로그인한 user_id>';
```

### 3-2. MS Graph 메일 webhook 연결
- [ ] マイページ → **"連携する"** 탭
- [ ] 학교 Outlook(@kokushikan.ac.jp) 로그인 + 권한 동의
- [ ] `mail_subscriptions` 테이블에 행 생성 확인
- [ ] **DuplicateAlertGuideModal** (manaba 자체 메일 알림 OFF 안내) 자동 표시 확인

**Supabase 확인 SQL**
```sql
SELECT user_id, ms_account_email, subscription_expires_at
FROM mail_subscriptions WHERE user_id = '<로그인한 user_id>';
```

### 3-3. 수동 푸시 테스트 (`send-test-push`)
```bash
curl -X POST 'https://rexnpusrxezuztxmkaex.supabase.co/functions/v1/send-test-push' \
  -H 'Authorization: Bearer <ANON_KEY>' \
  -H 'Content-Type: application/json' \
  -d '{"user_id":"<로그인한 user_id>","title":"테스트 공지","body":"푸시 도달 확인"}'
```

- [ ] iPhone에 푸시 도착 (잠금화면/배너)
- [ ] Android에 푸시 도착
- [ ] 양 기기 시간차 1~2초 이내
- [ ] 푸시 탭 → 앱 열림 → **NoticePreviewModal** 자동 표시 확인

### 3-4. (가능 시) E2E: 진짜 manaba 공지 → 자동 푸시
- [ ] 실제로 manaba에 공지가 등록될 때까지 대기 (또는 교수에게 테스트 부탁)
- [ ] 학교 Outlook에 manaba 알림 메일 수신
- [ ] MS Graph webhook → `mail-webhook` Edge Function 트리거
- [ ] `manaba_notices`에 신규 행 INSERT
- [ ] 자동 푸시 도착 → 탭 → 공지 페이지 자동 진입 확인

---

## 4. 자주 발생하는 문제

| 증상 | 원인 | 해결 |
|---|---|---|
| 푸시 권한 팝업 안 뜸 | 이미 거부 이력 | 설정 → 앱 → 알림 → 수동 ON, 재시도 |
| `push_tokens` 행 미생성 | Expo Token 발급 실패 | 콘솔에서 `registerPushToken` 로그 확인 |
| 푸시 안 도착 | APNs 키 / FCM 키 미설정 | EAS dashboard에서 credentials 확인 |
| MS Graph 로그인 실패 | redirect URI 불일치 | Azure 앱 등록 → 리다이렉트 URI 점검 |

---

## 5. 테스트 통과 후

- 결과를 메모리 `project_unipas_phase3_push.md`에 기록
- 묶음 4 (E2E 검증 마무리, UI 최적화)로 이동
