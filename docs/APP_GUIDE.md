# UniOne(ユニワン) 앱 설명서

> 이 앱이 무엇이고, 어떤 기술이 어디서 어떻게 일하는지를 한 곳에 정리한 문서예요.
> 최종 확인: 2026-10-28 (코드·서버 목록·데이터베이스를 직접 대조해서 작성)
> 맨 위 "0. AI에게 붙여넣는 요약"만 복사해서 다른 AI에게 주면 앱 설명이 끝나요.

---

## 0. AI에게 붙여넣는 요약

```
너는 지금부터 내 앱 "UniOne(ユニワン)"의 개발을 돕는다. 아래가 앱의 현재 상태다.

[앱] 일본 대학생용 학교생활 앱(한국 에브리타임의 일본판). 화면 언어는 일본어, 시간대는 JST.
iOS·Android 출시 중(현재 1.0.4). 가입 사용자 22명(国士舘大学 19, 日本文理 2, 亜細亜 1), 등록 학교 19곳.
개발자는 코딩 초보이고 한국어로 소통한다.

[기능] 하단 탭 4개 = ホーム / 時間割 / 掲示板 / マイページ.
- 시간표: 직접 입력, 国士舘은 학교 포털(kaede-i)에서 자동 추출, 그 외 학교는 시간표 스크린샷을 AI(Claude Haiku)가 읽어 추가.
- 課題(과제): 탭 대신 모달. manaba 과제 메일이 오면 자동 추가, 마감 3일 전·전날 18:00에 푸시.
- 통지: 학생이 manaba 알림 메일을 학생별 주소 {token}@unipas.app 으로 받게 설정 → 서버가 받아 푸시. 선택 시 AI 요약.
- 게시판: 같은 학교끼리만 보이는 익명 게시판(사진·좋아요·댓글·신고·차단·저장). 講義評価(수업 평가)와 댓글.
- 학교 사이트 바로가기: 앱 안 브라우저로 열어 로그인 유지(쿠키). ID/PW 자동입력은 国士舘만(기기 안에만 암호화 저장).

[기술]
- 앱: React Native 0.81 + Expo SDK 54(JavaScript). React Navigation, react-native-webview, expo-updates(OTA, runtimeVersion=fingerprint), expo-notifications.
- 서버: Supabase(Postgres + RLS + Auth + Storage + Edge Functions(Deno) + pg_cron).
  로그인=학교 메일로 6자리 코드(supabase.auth.signInWithOtp/verifyOtp), 메일 발송=Resend.
- 메일 수신: Cloudflare Email Routing → Cloudflare Worker → Edge Function mail-inbound.
- AI: Anthropic Claude Haiku 5.5(Edge Function parse-timetable, summarize-notice, _shared/noticeSummary).
- 빌드·배포: EAS Build/Submit/Update. 웹판은 Vercel, 개인정보 페이지는 Cloudflare Worker.
- 디자인: 토스 스타일(primary #3182F6, 배경 #F2F4F6), 기준값은 src/constants/colors.js·spacing.js·typography.js.

[지켜야 할 원칙]
- 학교 비밀번호는 절대 서버에 보내지 않는다(기기 안 AES-256 암호화만).
- 데이터는 같은 학교끼리만 보인다(RLS: university = get_my_university()).
- "슥 보고 나오는 앱" — 매번 잠금 같은 마찰 UX는 피한다.
- 배포 순서: DB 변경(마이그레이션) → 서버 함수 → 앱 OTA. 배포·커밋은 개발자 승인 후.
- 실제 경험이 아닌 정보(비자·세금·금융)로 게시판을 채우지 않는다.
```

---

## 1. 앱 소개

| 항목 | 내용 |
|---|---|
| 이름 | UniOne(ユニワン). 옛 이름은 Unipas(ユニパス) — 도메인 `unipas.app`과 EAS 이름 `unipas`에 흔적이 남아 있어요 |
| 대상 | 일본 대학생. 시작은 国士舘大学, 지금은 19개 학교가 등록돼 있어요 |
| 출시 | iOS App Store(175개국), Google Play(178개국). 현재 1.0.4 |
| 사용자 | 가입 완료 22명(2026-10-28) |
| 한 줄 콘셉트 | 시간표·과제·학교 공지·게시판을 한 앱에서 **슥 보고 나오는** 앱 |

**변하지 않는 원칙 3가지**
1. **익명 문화.** 게시판 글은 기본이 익명이고, 같은 학교 학생끼리만 보여요.
2. **학교 비밀번호는 서버로 보내지 않아요.** 자동 로그인에 쓰는 ID/PW는 폰 안에서만 암호화해 저장해요.
3. **간편함 우선.** 앱 전체 잠금처럼 매번 귀찮게 하는 기능은 넣지 않아요.

---

## 2. 기능별 설명 (무엇을 하나 / 어느 파일 / 어느 서버 기능)

화면 파일은 모두 `src/screens/` 아래에 있어요. 하단 탭은 `src/navigation/MainTab.js`가 만들어요.

### 🏠 ホーム(홈)
- 하는 일: 오늘 수업, 課題 칸, manaba 새 공지 미리보기, 학교 사이트 바로가기, 업데이트 안내 배너를 보여줘요.
- 파일: `HomeScreen.js`, 공지 카드 `components/ManabaNoticePreview.js`, 업데이트 배너 `components/UpdateBanner.js`
- 서버: `manaba_notices` 표(받은 공지), `courses` 표(오늘 수업)

### 📅 時間割(시간표)
- 하는 일: 수업 추가·수정, 학기(봄/가을) 전환, 수업별 강의실·시라바스, 친구와 공강 맞추기, 講義評価 입구
- 파일: `timetable/` 폴더(`TimetableScreen`, `CourseAdd`, `CourseDetailModal`, `FreeTime`, `BulkAddInput/Preview`)
- **한 번에 가져오기(一括)는 학교마다 방법이 달라요**
  - 国士舘: 앱 안 브라우저로 kaede-i에 자동 로그인한 뒤, 시간표 칸을 읽어 와요(`SchoolWebViewScreen.js`, `utils/timetableRouter.js`).
  - 그 외 학교: 시간표 **스크린샷**을 고르면 AI가 읽어 줘요(`components/AiImportSheet.js`, `hooks/useAiTimetableImport.js`).
  - 서버 함수 `parse-timetable`을 써요. 한 사람당 하루 10회까지이고, `ai_usage` 표로 횟수를 세요.

### 📝 課題(과제)
- 하는 일: 과제 목록과 제출 체크. 탭에는 없고 홈 칸·시간표 수업·통지에서 열리는 창(모달)이에요.
- 자동 추가: manaba의 과제 메일이 오면 서버가 자동으로 과제를 넣고, 「提出のお知らせ」 메일이 오면 제출 완료로 바꿔요. 판별 규칙은 `supabase/functions/_shared/manabaAssignment.js`에 있어요.
- 마감 알림: 매일 일본 시간 18:00에 未提出 과제를 **3일 전·전날** 푸시로 알려줘요. 서버 함수 `deadline-reminder`를 자동 실행 작업이 불러요.
- 파일: `AssignmentScreen.js`, `assignment/AssignmentAddScreen.js`

### 🔔 통지(manaba 공지 → 푸시)
- 하는 일: 학교 manaba에 새 공지가 올라오면 폰으로 푸시가 와요. 선택하면 AI 요약을 알림 본문에 넣어 줘요.
- 설정 화면: `auth/MailConnectOnboardingScreen.js`, `manaba/ManabaReminderSetupScreen.js`
- 보는 화면: `notice/NoticePreviewModal.js`, `manaba/ManabaNoticeListScreen.js`, `manaba/ManabaNoticeDetailScreen.js`
- 흐름은 아래 4장의 그림 ②를 보세요.

### 💬 掲示板(게시판)
- 하는 일: 익명 글·사진·좋아요·댓글, 「リアルタイム人気(HOT)」, 新着 목록, 저장, 신고·차단
- 파일: `community/` 폴더. HOT 계산은 `utils/boardHot.js`, 금칙어는 `utils/profanity.js`
- 안전장치(App Store 심사 요건): 신고가 쌓이면 자동으로 숨겨요(DB 트리거). 차단은 `user_blocks` 표, 이용약관은 `TermsOfServiceScreen`에 있어요.
- 사진: Supabase Storage의 `post-images` 저장소(최대 5MB)

### ⭐ 講義評価(수업 평가)
- 하는 일: 별점·태그·후기, 그리고 평가마다 댓글
- 파일: `timetable/CourseReview*.js`. 표는 `course_reviews`, `course_review_comments`예요.

### 👤 マイページ
- 하는 일: 닉네임, 내 글·저장한 글, 알림 설정(AI 요약, 과제 자동 추가, 마감 알림), 테스트 알림 보내기, 로그인 정보 초기화, 차단 목록, 약관, 탈퇴, 앱 버전 표시
- 파일: `ProfileScreen.js`. 탈퇴는 서버 함수 `delete-account`가 처리해요.

---

## 3. 기술이 어디서 어떻게 일하나

### 3-1. React Native + Expo — "앱 그 자체"
- **무엇:** 자바스크립트 코드 하나로 아이폰 앱과 안드로이드 앱을 같이 만드는 도구예요. Expo는 그 위에 빌드·업데이트·알림 같은 편의 기능을 얹어 줘요.
- **어디서:**
  - `App.js`: 시작점이에요. 아이패드에서는 가운데 600px 폭으로 보여주는 `WideScreenContainer`로 감싸요.
  - `src/navigation/`: 화면 이동 구조예요. `AppNavigator`가 "로그인 전 / 온보딩 / 본 화면"을 나누고, `MainTab`이 탭 4개를 만들어요.
  - `src/screens/`: 화면들이에요. `src/components/`는 여러 화면이 같이 쓰는 부품(버튼·카드·입력칸 등)이에요.
  - `src/utils/`: 화면과 상관없는 계산(순수 함수)이에요. 자동 시험(Jest)은 주로 여기를 검사해요.
  - `src/lib/`: 로그인 세션(`AuthProvider`, `sessionKeeper`), 암호화 저장소(`largeSecureStore`), 푸시 등록(`notifications`)
- **앱 안 브라우저(WebView):** 학교 사이트(manaba·kaede-i 등)를 앱 안에서 열어 로그인 쿠키를 저장해요. 그래서 다시 로그인할 필요가 거의 없어요(`SchoolWebViewScreen`, `hooks/useAutoRelogin.js`). 이 기능 때문에 Expo Go로는 안 되고 **Dev Build**(내 앱 전용 개발용 앱)가 필요해요.
- **학교 ID/PW 저장:** `src/lib/largeSecureStore.js`가 처리해요. 256비트 AES 키는 폰의 키체인/키스토어에 두고, 데이터는 그 키로 암호화해서 폰 안에만 저장해요.

### 3-2. Supabase — "서버와 데이터베이스"
- **무엇:** 회원 관리, 데이터베이스, 사진 저장, 서버 함수를 한 번에 주는 서비스예요. 프로젝트 ID는 `rexnpusrxezuztxmkaex`예요.
- **로그인:** 학교 메일 주소를 넣으면 6자리 코드가 와요(`supabase.auth.signInWithOtp` → `verifyOtp`). 메일은 Resend가 `noreply@unipas.app`에서 보내요.
- **데이터베이스 표(21개, 전부 RLS 켜짐):**

| 묶음 | 표 |
|---|---|
| 사람 | `profiles`(닉네임·학교·알림 설정) |
| 시간표·과제 | `courses`, `assignments` |
| 게시판 | `posts`, `post_comments`, `post_likes`, `comment_likes`, `post_bookmarks`, `post_reports`, `comment_reports`, `user_blocks` |
| 수업 평가 | `course_reviews`, `course_review_comments`, `course_review_reports`, `course_review_comment_reports` |
| 통지·푸시 | `mail_subscriptions`(학생별 수신 주소), `manaba_notices`(받은 공지), `push_tokens`(폰 주소), `push_delivery_logs`(발송 기록) |
| 기타 | `ai_usage`(AI 횟수 제한), `email_otps`(옛 방식, 현재 안 씀) |

- **RLS(행 단위 보안):** "이 줄을 누가 볼 수 있나"를 데이터베이스가 직접 막는 규칙이에요. 게시판·평가는 `university = get_my_university()`, 즉 **같은 학교만** 볼 수 있어요. 학교명은 한 글자만 달라도(舘/館) 안 보여요.
- **서버 함수(Edge Functions) — 지금 쓰는 것 11개:**

| 함수 | 하는 일 | 누가 부르나 |
|---|---|---|
| `mail-provision` | 학생별 수신 주소 `{token}@unipas.app` 발급 | 앱 |
| `mail-inbound` | 받은 manaba 메일 → 공지 저장 → 과제 자동 추가 → 푸시 | Cloudflare 워커 |
| `summarize-notice` | 공지 AI 요약(「AIで要約」 버튼) | 앱 |
| `parse-timetable` | 시간표 스크린샷 AI 읽기 | 앱 |
| `deadline-reminder` | 마감 3일 전·전날 알림 | 자동 실행(매일) |
| `push-retry-worker` | 실패한 푸시 다시 보내기 | 자동 실행(매시) |
| `expo-receipt-poller` | 푸시가 실제로 도착했는지 확인 | 자동 실행(15분마다) |
| `push-cleanup` | 오래된 발송 기록 정리 | 자동 실행(매일) |
| `send-test-push` | 마이페이지 「テスト通知を送る」 | 앱 |
| `delete-account` | 탈퇴 처리 | 앱 |
| `demo-login` | App Store 심사용 데모 계정 로그인 | 앱 |

  여러 함수가 같이 쓰는 코드는 `supabase/functions/_shared/`에 있어요. **여기를 고치면 그걸 쓰는 함수를 전부 다시 배포해야 해요.**
- **자동 실행(pg_cron) 4개:** `expo-receipt-poller-15min`, `push-retry-worker-hourly`, `push-cleanup-daily`, `deadline-reminder-daily`(UTC 9시 = 일본 18시)
- **사진 저장소:** `post-images` 버킷(공개 읽기)
- **DB 변경 기록:** `supabase/migrations/`, 전체 구조 참고용은 `schema.sql`

### 3-3. 통지 흐름 — Cloudflare가 메일을 받아요
- manaba는 앱에 직접 알려주는 기능이 없어요. 그래서 **"manaba 알림 메일을 앱 서버가 대신 받는"** 방식을 써요. 학교 Microsoft 계정 연동(MS Graph)은 학교가 막아서 2026-06에 폐기했어요.
- 학생은 manaba 리마인더 설정의 「携帯メールアドレス」에 자기 전용 주소를 한 번 등록해요. 비밀번호는 필요 없어요.
- Cloudflare Email Routing이 `*@unipas.app`으로 온 메일을 모두 워커(`cloudflare/mail-inbound-worker`)로 보내요. 워커는 공유 비밀값을 붙여 `mail-inbound`를 불러요.

### 3-4. OTA 업데이트 — "심사 없이 고치기"
- **업데이트는 두 종류예요.**

| 종류 | 언제 | 방법 | 사용자 쪽 |
|---|---|---|---|
| OTA(무선 업데이트) | 자바스크립트·화면만 바뀔 때 | `eas update` (1~2분) | 홈 파란 배너 「今すぐ更新」 → 앱 안에서 바로 적용 |
| 스토어 업데이트 | 네이티브 부품·설정이 바뀔 때 | `eas build` + 심사 | 「App Store へ」 창 → 스토어로 이동 |

- **fingerprint 방식:** 앱의 네이티브 부분이 같으면 같은 "지문"이 나와요. 지문이 같은 폰에만 OTA가 가요. 그래서 버전 숫자를 올려도 OTA가 끊기지 않아요(1.0.3까지는 끊겼어요).
- 코드: `hooks/useAppUpdate.js`(앱을 켤 때 1번 확인), `components/UpdateBanner.js`, `components/StoreUpdateModal.js`, `utils/storeVersion.js`(Apple 공개 정보로 최신 버전 확인 — 안드로이드는 이런 공개 정보가 없어서 OTA 배너만)
- ⚠️ 보내기 전에 로컬 `ios/`·`android/` 폴더를 잠깐 치워야 지문이 맞아요(CLAUDE.md 「OTA 보내는 법」).

### 3-5. AI — Claude Haiku 5.5
- **시간표 읽기**(`parse-timetable`): 스크린샷 최대 3장 → 수업 목록. 정확도 실측 100%(日本文理 11/11, 国士舘 25/25). 1회에 약 0.2~0.3엔(0.001~0.002달러) 들어요.
- **통지 요약**(`summarize-notice`, `_shared/noticeSummary.ts`): 버튼으로 요약하거나, 설정하면 푸시 본문에 요약을 넣어요. 요약은 한 번만 만들고 저장해서 다시 써요.
- 처음 쓸 때 해외 이전 동의 창(`AiConsentModal`)이 떠요. 개인정보 처리방침에도 Anthropic이 적혀 있어요.
- ⚠️ API 키 만료 2028-08-18

### 3-6. 디자인 — 토스 스타일
- **기준 파일:** `src/constants/colors.js`(색), `src/constants/spacing.js`(간격 4px 단위·둥근 모서리·그림자), `src/constants/typography.js`(글자 크기)
  - 메인 파랑 `#3182F6`, 배경 `#F2F4F6`, 카드 흰색, 제목 `#191F28`
  - 좋아요 빨강 `#F04452`, 댓글 청록 `#0BA5B8`, HOT `#FF5A36`
  - 수업 색은 `src/constants/courseColors.js`의 파스텔 7색
- **공용 부품:** `Card`, `Button`, `AppTextInput`(일본어 글자 잘림 방지), `KeyboardAwareScrollView`(입력칸이 키보드에 가리지 않게), `PostReactions`, `PhoneMockup`(온보딩의 폰 그림)
- **원칙:** 객체 사이 8px 이상, 한 화면엔 한 가지 일, 실패 문구는 부드럽게(`〜できませんでした`)
- **기기 대응:** 아이패드는 가운데 컬럼으로 표시, 위아래 안전 영역은 `react-native-safe-area-context`, 작은 화면(iPhone SE)도 검사해요(`npm run e2e:layout`).

### 3-7. 외부 서비스 지도

| 서비스 | 하는 일 |
|---|---|
| EAS(Expo) | 앱 빌드·스토어 제출·OTA 배포 |
| App Store Connect / Google Play Console | 스토어 등록·심사 |
| Supabase | 로그인·데이터베이스·서버 함수·사진 |
| Resend | 인증 코드 메일 발송 |
| Cloudflare | `unipas.app` 도메인 관리, 메일 받기(Email Routing + 워커), 개인정보 페이지 `privacy.unipas.app`(워커 `black-bush-a4e0`) |
| Namecheap | 도메인 등록(만료 2027-05-04) |
| Vercel | 앱의 웹 버전(GitHub에 push하면 자동 배포) |
| Anthropic | AI(Claude Haiku) |
| GitHub | 코드 저장소 `JiwoongAhn/japanproject2`(공개 저장소라 실제 학생 데이터는 gitignore) |

---

## 4. 데이터 흐름 그림

**① 가입·로그인**
```
대학 선택 → 학교 메일 입력 → Supabase가 Resend로 6자리 코드 발송
→ 코드 입력(verifyOtp) → 신규면 닉네임 입력 → 온보딩 → 홈
(코드 기다리는 중에 앱이 꺼져도 utils/pendingOtp.js가 코드 입력 화면을 복원)
```

**② 통지 → 푸시 → 과제 자동 추가**
```
manaba 새 공지/과제
→ 학생의 {token}@unipas.app 으로 알림 메일
→ Cloudflare Email Routing → mail-inbound-worker
→ Supabase mail-inbound
    ├ manaba_notices 저장(중복 차단)
    ├ 과제 메일이면 assignments 자동 추가/제출 처리
    ├ (설정 시) AI 요약
    └ Expo 푸시 발송 → push_delivery_logs 기록 → 실패분은 push-retry-worker가 재시도
→ 폰에 알림 → 누르면 해당 공지/과제 화면
```

**③ 시간표 가져오기**
```
国士舘: 一括 → 앱 안 브라우저로 kaede-i 자동 로그인 → MY時間割 칸 읽기 → 학기 선택 → 미리보기 → 저장
그 외:  一括 → 스크린샷 선택 → parse-timetable(Claude) → 학기 선택 → 미리보기(확인 필요한 수업 맨 위) → 저장
```

---

## 5. 운영

- **배포 순서:** ① DB 변경(마이그레이션) → ② 서버 함수 → ③ 앱 OTA. 거꾸로 하면 새 앱이 없는 칸을 찾거나 공지가 사라질 수 있어요.
- **현황 보기:** `docs/admin-status.sql`(가입자·시간표·푸시 수 등). Claude에게 "현황 보여줘"라고 하면 돼요.
- **비용(2026-10 기준):** Supabase 무료 요금제(데이터베이스 55MB / 한도 500MB), Resend 무료(월 3,000통), Apple 개발자 연 ¥12,980, AI는 사용량에 따라 몇 엔 수준
- **만료일:** Play 난독화 경고 2027-02 / 도메인 2027-05-04 / iOS 배포 인증서 2027-06-27 / AI 키 2028-08-18
- **정기 점검**
  - **학기 시작 직후(4월·9~10월):** 학교가 사이트를 바꾸면 manaba 공지 읽기와 kaede-i 시간표·교실 읽기가 **아무 오류 없이 조용히 깨져요.** 이게 유지보수 1순위예요.
  - **매주:** 서버 함수 오류 기록, Supabase 보안·성능 경고(advisors), 푸시 재시도 쌓임, `support@unipas.app` 문의와 스토어 리뷰
  - **반기:** Expo SDK·라이브러리 업데이트, Apple·Google 정책 변경
  - 오류 자동 수집 도구(Sentry 등)는 아직 없어요.
- **실기 확인 원칙:** 내 폰 1대로는 검증이 아니에요. iOS와 Android를 각각 최소 1대씩 확인해요. **기기 문제와 학교 문제는 별개**예요. 안드로이드 키보드 문제는 모든 학교에 생기고, 학교 사이트 문제는 그 학교에만 생겨요.
- **삭제 금지 계정:** `appreview@kokushikan.ac.jp`(App Store 심사 데모), `e2etest@kokushikan.ac.jp`(자동 시험), `seed01~08@unione.local`(게시판 콘텐츠 작성자)
- **스토어 제출 때 쓰는 문서:** `docs/app-store-listing.md`, `docs/app-store-review-notes.md`, `docs/app-store-privacy.md`, `docs/google-play-listing.md`, `docs/google-play-data-safety.md`
- **학교 관련 문서:** `docs/university-lms-profiles.md`(학교별 시스템), `docs/university-tos-review.md`(이용규정 조사), `docs/schools/`

---

## 6. 쉬운 말 용어집

| 용어 | 뜻 |
|---|---|
| OTA | 스토어 심사 없이 앱 내용을 바꾸는 무선 업데이트 |
| 빌드 | 코드를 스토어에 올릴 수 있는 앱 파일로 만드는 것 |
| Dev Build | 개발 중 시험용으로 만든 내 앱 전용 개발 앱 |
| Edge Function | Supabase 위에서 도는 작은 서버 프로그램 |
| RLS | 데이터베이스가 "누가 어떤 줄을 볼 수 있나"를 직접 막는 규칙 |
| 마이그레이션 | 데이터베이스 구조를 바꾸는 기록 파일 |
| pg_cron | 정해진 시간마다 자동으로 일을 시키는 장치 |
| WebView | 앱 안에 들어 있는 작은 웹 브라우저 |
| 푸시 토큰 | 알림을 보낼 폰의 주소 |
| fingerprint | 앱 네이티브 부분의 "지문". 같아야 OTA가 도착함 |
| manaba / kaede-i | 国士舘의 수업 관리 시스템 / 학사 포털(시간표가 있는 곳) |
| 시딩 | 처음 온 사람이 볼 수 있도록 게시판에 글을 미리 채워 두는 것 |
