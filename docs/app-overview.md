# UniOne(ユニワン) 앱 전체 구조 — 알기 쉬운 정리

> 이 앱이 어떻게 작동하는지, 서버·푸시·로그인·도메인을 한눈에 정리한 메모.

## 0. 한 줄 요약
일본 대학생용 앱. **React Native(Expo) + Supabase**. 학교 이메일로 로그인하고, 시간표·과제·게시판·수업평가를 쓰고, manaba/kaede(학교 시스템)와 연동하며, manaba 새 공지를 푸시로 받는다.

---

## 1. 기술 스택 & 서버 (무엇으로 만들었나)
| 역할 | 사용 기술 |
|---|---|
| 앱(클라이언트) | React Native (Expo SDK 54), JavaScript |
| 백엔드/DB | **Supabase** (PostgreSQL) — project `rexnpusrxezuztxmkaex` |
| 로그인 인증 | Supabase Auth (학교 이메일 OTP) |
| 파일 저장 | Supabase Storage — `post-images` 버킷(게시판 사진) |
| 서버 함수 | Supabase Edge Functions (아래 목록) |
| 메일 수신 | **Cloudflare Email Routing + Worker** (`mail-inbound-worker`) |
| 발신 메일(SMTP) | **Resend** (`noreply@unipas.app`) |
| 푸시 발송 | **Expo Push Service** (내부적으로 FCM/APNs 사용) |

**Edge Functions**: `send-school-otp`(코드 발송) / `verify-school-otp`(코드 확인) / `mail-inbound`(메일→공지·푸시) / `mail-provision`(전달 주소 발급) / `push-retry-worker`(푸시 재시도) / `expo-receipt-poller`(푸시 영수증 확인) / `demo-login`(심사용) / `delete-account`(계정 삭제) 등

---

## 2. 회원가입 / 로그인 (비밀번호 없는 방식)
1. 대학 선택 → 학교 이메일 입력 (예: `@kokushikan.ac.jp`)
2. 6자리 인증 코드를 메일로 발송 (`send-school-otp` → Resend)
3. 코드 입력 → 확인 (`verify-school-otp`) → 로그인 완료
4. 신규 회원은 닉네임 입력 + 온보딩

- **학교 이메일만 허용** → 그 자체가 "재학생 인증" 역할
- 한 번 로그인하면 **Supabase 세션 토큰이 기기에 저장**되어, 앱을 껐다 켜도 로그인 유지

---

## 3. 학교 시스템 연동 & "왜 비밀번호를 한 번만 입력하면 되나" (핵심)
manaba와 kaede는 **재로그인을 안 해도 되는 방식이 서로 다르다.** 공통 원칙: **학교 비밀번호는 서버에 절대 저장하지 않는다.**

### 🟦 manaba (공지·과제 LMS)
- 로그인: WebView에서 **학생이 직접** 로그인
- **재로그인 안 하는 이유**: 로그인에 성공하면 manaba가 발급한 **세션 쿠키(cookie)** 를 받는데, 이 쿠키를 **기기에 AES-256으로 암호화 저장**한다. 다음부터는 저장된 쿠키로 바로 접속 → 재로그인 불필요.
- **비밀번호 자체는 저장하지 않음** (쿠키만 저장)
- 쿠키가 만료되면: 자동 재로그인을 **일부러 안 하고**(학교 서버의 봇 탐지 회피) "재로그인 해주세요" 안내만 표시 → 사용자가 다시 로그인

### 🟨 kaede-i / 修学ナビ (시간표 시스템)
- 로그인: WebView에서 **학생이 직접** 로그인
- **재로그인 안 하는 이유**: 학생 동의 하에 **ID와 비밀번호를 기기에 AES-256으로 암호화 저장**한다(서버 전송 없음). 다음부터는 로그인 폼에 **자동 입력 + 자동 제출** → 자동 로그인.
- manaba와의 차이: **manaba = 쿠키 저장 / kaede = ID·비밀번호 저장(자동입력)**

> 📌 정리: 둘 다 "한 번만 로그인하면 됨"이지만, manaba는 **로그인 결과물(쿠키)** 를 저장하는 방식이고, kaede는 **로그인 정보(ID/PW)** 자체를 기기에만 저장해 매번 자동 입력하는 방식이다. **어느 쪽도 서버에는 비밀번호를 두지 않는다.**

---

## 4. 앱 푸시(알림)는 어떻게 오나
manaba 새 공지 알림은 **두 가지 경로**가 있다.

### A. 앱을 열 때 공지 확인 (실시간 아님)
- 홈 화면이 화면 뒤에서 숨은 WebView로 manaba 홈을 열어, 저장된 쿠키로 **공지를 파싱**해서 "📢 manabaのお知らせ"에 보여준다. (앱을 열어야 갱신됨)

### B. 실시간 푸시 — 메일 전달 방식 (Phase 4)
```
manaba가 공지 메일 발송
  → 학생 Outlook 도착
  → (학생이 만든 전달 규칙) {토큰}@unipas.app 로 전달
  → Cloudflare Email Routing 수신 → Worker가 파싱
  → Supabase mail-inbound 함수 호출 (x-mail-secret으로 신원 확인)
      ① 토큰으로 학생 식별
      ② manaba_notices 에 공지 저장
      ③ Expo Push 발송
  → 폰에 📢 알림 + 앱 홈에 공지 표시
```
- 푸시 발송이 실패하면 **재시도**(`push-retry-worker`, 5회 지수 백오프), 성공 여부는 **영수증 폴링**(`expo-receipt-poller`)으로 확인
- ⚠️ 이 경로가 실제로 동작하려면 **Cloudflare Email Routing 활성화 + `MAIL_INBOUND_SECRET` 등록**이 필요 (출시 전 인프라 작업)
- ⚠️ 푸시 알림 배너는 **실기기에서만** 수신 (시뮬레이터는 푸시 토큰 미발급)

---

## 5. 도메인 정리
| 도메인 | 용도 | 관리 |
|---|---|---|
| `unipas.app` | 메인 도메인 | Cloudflare |
| `privacy.unipas.app` | 개인정보처리방침 공개 페이지 | Cloudflare Worker |
| `noreply@unipas.app` | OTP 등 발신 메일 주소 | Resend(SMTP) |
| `{토큰}@unipas.app` | 학생별 메일 전달 수신 주소 | Cloudflare Email Routing |

> 📌 앱 이름은 **UniOne(ユニワン)** 으로 리브랜딩됐지만, **도메인·내부 키는 `unipas`를 그대로 유지**(의도적 — 바꾸면 인프라가 깨짐).

---

## 6. 개인정보 / 보안 원칙
- **학교 비밀번호는 서버에 절대 저장 안 함** (manaba=쿠키, kaede=ID/PW 모두 기기 내 AES-256 암호화만)
- 수집 데이터: 학교 이메일, 닉네임, 시간표·과제·게시글(본인 콘텐츠), 게시판 사진, 푸시 토큰
- **제3자 공유·광고·추적 SDK 없음**
- 개인정보처리방침 공개 URL: `https://privacy.unipas.app`

---

## 7. 빌드/식별자 (헷갈리기 쉬운 것)
| 항목 | 값 |
|---|---|
| 패키지/번들 ID | `com.jiwoongahn.unione` (iOS·Android 공통) |
| EAS slug | `unipas` (앱 이름과 다름 — EAS 내부 식별자) |
| EAS projectId | `1f321891-59b2-4b9d-8d7d-79e341aa29cb` |
| Supabase project | `rexnpusrxezuztxmkaex` |
