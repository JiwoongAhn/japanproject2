# 프로젝트 기본 정보
- **앱 이름:** UniOne (ユニワン) — 일본 대학생 학교생활 앱(에브리타임 일본판). iOS·Android 출시 중
- **앱 전체 설명(기능·기술·데이터 흐름):** `docs/APP_GUIDE.md` ← 구조가 궁금하면 여기부터
- **기술 스택:** React Native 0.81 (Expo SDK 54) / JavaScript / Supabase
- **저장소:** github.com/JiwoongAhn/japanproject2 (**공개 저장소** — 실제 학생 데이터는 gitignore)
- **패키지/번들 ID:** `com.jiwoongahn.unione` (iOS·Android 공통), App Store ID `6784875972`
- **EAS slug:** `unipas` (⚠️ 앱 이름과 다르지만 EAS 식별자라 바꾸면 빌드 에러)
- **UI 스타일:** 토스 스타일 (primary #3182F6, background #F2F4F6) — 기준값 `src/constants/colors.js`·`spacing.js`·`typography.js`
- **하단 탭:** 홈 / 시간표 / 게시판 / マイページ. 課題는 루트 모달 `Assignment`(홈 카드·시간표 셀·통지에서 진입)
  - 재검토 조건 = 이용자 20~30명 시점에 `assignments` 행 수 확인(`docs/admin-status.sql`). 0이면 홈 칸도 빼고, 있으면 유지
- **학기:** `courses.term`(spring/fall), `getCurrentTerm()` = 4~8월 春 / 9~3월 秋

---

# 개발 환경

```bash
cd /Users/jiwoong/claudeproject/japanproject
npx expo start --dev-client         # Dev Build로 실행 (WebView 때문에 Expo Go 불가)
npm test                            # Jest (화면 수정 후 __tests__/screens.smoke.test.js 필수 확인)
npm run check:bundle                # 화면/훅 수정 후 필수: Metro 번들+Hermes 컴파일로 import·문법 오류 검출
npm run e2e:layout                  # 작은 화면 넘침 자동 판정 (5뷰포트)
scripts/shot-devices.sh             # 시뮬레이터 4대 스크린샷 (ad-hoc 서명 — 그냥 빌드하면 Keychain 막혀 로그인 불가)
npx wrangler deploy -c wrangler.privacy.toml   # privacy.unipas.app 재배포 (Worker black-bush-a4e0)
```

---

# 파일 구조

```
japanproject/
├── App.js                 시작점 (아이패드 WideScreenContainer)
├── src/
│   ├── screens/           HomeScreen·ProfileScreen·AssignmentScreen·SchoolWebViewScreen
│   │   ├── auth/          Welcome·PrivacyConsent·UniversitySelect·SchoolPortalAuth·OtpVerification·AcEmailInput·Onboarding·MailConnectOnboarding
│   │   ├── timetable/     Timetable·CourseAdd·CourseDetailModal·BulkAddInput/Preview·FreeTime·CourseReview*
│   │   ├── community/     PostList·PostDetail·PostCreate·PostEdit·MyPosts·SavedPosts·BlockedUsers
│   │   ├── manaba/        ManabaLogin·ManabaNoticeList/Detail·ManabaReminderSetup
│   │   ├── notice/        NoticePreviewModal·DuplicateAlertGuideModal
│   │   └── assignment/    AssignmentAdd
│   ├── components/        공용 부품 (Card·Button·AppTextInput·KeyboardAwareScrollView·AiImportSheet·UpdateBanner…)
│   ├── hooks/             useAppUpdate·useAutoRelogin·useAiTimetableImport
│   ├── utils/             순수 함수 (Jest 대상)
│   ├── constants/         colors·spacing·typography·universities·universityLinks…
│   ├── lib/               supabase·AuthProvider·sessionKeeper·largeSecureStore(AES-256)·notifications
│   └── navigation/        AppNavigator·MainTab·각 Stack
├── supabase/functions/    Edge Functions (+ _shared/ 공용 코드)
├── supabase/migrations/   DB 변경 기록
├── cloudflare/mail-inbound-worker/   메일 수신 워커
├── __tests__/  e2e/(Playwright)  .maestro/(네이티브 촬영·스모크)
├── docs/                  APP_GUIDE·스토어 문구·학교 조사·시딩 확정본
└── schema.sql             DB 스키마 참고용
```

---

# Supabase

- **Project ID:** `rexnpusrxezuztxmkaex`
- **인증:** 학교 이메일 → `signInWithOtp()` → `verifyOtp()`. SMTP = Resend (`noreply@unipas.app`), 도메인 Cloudflare 관리
- **Storage:** `post-images` 버킷 (public read, 5MB)
- **RLS:** 게시판·평가는 `university = get_my_university()` 완전일치 (`国士舘`의 舘/館 한 글자 차이로도 안 보임)
- **학교 판정(2026-10-29~):** 서버가 가입 메일 도메인으로 정한다(`university_domains`). 지원 안 하는 도메인은 가입 자체를 거절(`handle_new_user`), 프로필의 `university`·`school_email`·`student_id`는 학생이 바꿔도 트리거(`guard_profile_identity`)가 되돌린다
- **수정 가능한 칸은 허용 목록(column grant):** 글 = 제목·본문·사진, 평가 = 별점·후기·태그, 공지 = 읽음만. 앱에서 새 칸을 저장하게 되면 마이그레이션에서 grant 추가 (안 하면 `permission denied`)

**인증 화면 흐름:**
```
UniversitySelect → SchoolPortalAuth(이메일+OTP발송) → OtpVerification(코드입력)
  └ 신규 회원: AcEmailInput(닉네임) → Onboarding
  └ 기존 회원: MainTab
```

---

# 코딩 규칙

- 변수명: camelCase 영어 / 주석: 한국어 / 순수 함수는 `src/utils/`
- 화면 문구는 일본어
- 화면·훅 수정 후 보고 전: Jest + `check:bundle` + no-undef 검사, UI 변경은 시뮬 실화면까지 확인

---

# ⚠️ 배포 규칙 (반드시 지킬 것)

- **순서:** ① 마이그레이션 → ② Edge Function → ③ 앱 OTA. 역순이면 통지 유실·없는 칸 오류
- **`supabase/functions/_shared/` 수정 시** 그걸 쓰는 함수 전부 재배포 (현재 `mail-inbound`·`summarize-notice`·`send-test-push`·`push-retry-worker`·`deadline-reminder`)
- `mail-inbound`는 `verify_jwt: false` 유지 (Cloudflare 워커가 공유 비밀값으로 호출)
- 새 manaba 학교는 `mail-inbound`의 `ALLOWED_SENDERS`에 발신 도메인 추가
- 배포·커밋·push는 사용자 승인 후. 커밋은 파일 지정 add (`git add -A` 금지 — 다른 세션 파일이 섞인 사고 있음)
- 빌드 시작 전 `git log -1`로 수정 커밋 포함 확인
- Hermes는 일본어를 **UTF-16**으로 저장 → 번들 문자열 검증 시 UTF-8 grep 금지
- `eas submission:view` 명령은 없다 — iOS 제출 상태는 expo.dev에서

### OTA 보내는 법 (fingerprint 정책)
- 로컬 `ios/`·`android/`(prebuild, gitignore)가 있으면 지문이 빌드와 달라져 **OTA가 폰에 도착하지 않는다** → 잠깐 치우고 보낸다
- 루트 `.gitignore`도 지문에 들어간다 — 고치지 말 것 (하위 폴더 `.gitignore` 사용)
```bash
mv ios /tmp/ios-bak && npx eas fingerprint:compare --build-id <최근 빌드 id>   # ✅ matches 확인
npx eas update --channel production --message "…" && mv /tmp/ios-bak ios
```

### TestFlight 함정
TestFlight·Xcode로 설치한 앱은 App Store 업데이트가 영구히 안 온다(항상 「開く」). 「업데이트 안 온다」 신고 시 코드보다 먼저 라이브 버전(`curl -s "https://itunes.apple.com/lookup?id=6784875972&country=jp"`)과 설치 출처 확인. 복구 = 삭제 → App Store 설치

---

# 건강검진 (장애 감지)

- 매일 JST 09:00 `health-check` 함수가 점검 → 🔴는 개발자 폰 푸시, 매일 요약 메일. 점검 목록 = `supabase/functions/health-check/checks.js`, 숫자 = DB 함수 `health_snapshot()`, 기록 = `health_check_runs`
- 시크릿: `OPS_EMAIL`(요약 메일 받는 곳) · `OPS_USER_ID`(푸시 받을 개발자 계정) · `HEARTBEAT_URL`(선택, UptimeRobot)
- 호출 확인: pg_cron이 공개 열쇠(anon)로 부르므로 Vault 암호 `health_check_secret`을 `x-health-secret` 헤더로 확인. 시험 실행(저장·알림 없음) = 주소에 `?notify=0`
- **⚠️ 버그를 고친 뒤 반드시:** 그 고장이 `checks.js`로 잡혔을지 따져 보고, 안 잡혔다면 사용자에게 **"이 고장을 건강검진 점검 목록에 추가할까요?"**라고 먼저 묻는다. 감지 방법(어떤 숫자가 어떻게 되면 🔴/🟠인지)을 한 줄로 함께 제안. 승인되면 `checks.js` 파일 머리말의 「새 점검 추가하는 법」 3단계대로 추가
- 만료일 처리를 끝내면 `checks.js`의 `DEADLINES`에서 지운다 (안 지우면 매일 🔴)

---

# 새 학교 추가 체크리스트

> 학교별 LMS·시간표 시스템 = `docs/university-lms-profiles.md`, 이용규정 = `docs/university-tos-review.md`

**⚠️ 조사 원칙** — 검색 요약을 믿지 말고 **항목마다 공식 원문을 직접 열고**, 시간표는 **LMS 로그인 화면의 「教務·My時間割」 링크까지** 따라가 확인. 근거 URL·확인일을 `docs/schools/{id}.md`에 표로 남긴다 (明治 1차 조사가 旧 시스템·대학원 페이지를 근거로 써서 틀렸다)

**도구**
- [ ] 이용규정 1차 스캔: `npm run tos:scan -- <홈페이지URL>` → 뉴스·お知らせ의 주의 공지는 못 잡으니 사이트 검색은 사람이 → `docs/university-tos-review.md`에 기록
- [ ] 역할 지도: `docs/schools/_template.md`를 `docs/schools/{id}.md`로 복사해 채움
- [ ] 설정 수정 후 `npm run school:features` (안 하면 Jest `SF-DOC` 실패)

**`src/constants/universities.js`**
- [ ] `id`, `name`, `location`, `emailDomain`, `campuses`
- [ ] `periodRanges`: 학교 공식 「時限 時間割」 (없으면 생략 → 국사관 기본값)
- [ ] `emailLocalHint`/`emailNote`: 로그인 ID와 메일 주소가 다른 학교만 (예: 明治)
- [ ] **DB `university_domains`에 `('도메인', '학교명')` 추가하는 새 마이그레이션** — 빠뜨리면 그 학교는 가입이 거절된다 (Jest `US-DOM`이 잡음)

**`src/constants/universityLinks.js`** (필드 설명은 파일 헤더 주석)
- [ ] `homepageUrl`: 필수
- [ ] `manabaUrl`: manaba.jp 도메인 확인된 경우만 → お知らせ·리마인더 자동 활성
- [ ] `lmsUrl` + `lmsLabel`: manaba 미사용 시 (앱 내 브라우저, 쿠키 유지)
- [ ] `portalUrl` + `portalLabel`: 학사 포털이 LMS와 별도일 때 (국사관 kaede-i)
- [ ] `autoLoginCandidates`: 폼 구조를 `__tests__/utils/loginFormScripts.test.js`로 검증한 호스트. **앱은 안 읽음 = 자동입력 OFF**
- [ ] `autoLoginHosts`(실제 ON): **재학생 실기 확인 + 이용규정상 반대 없음 확인 후에만**. 테스트 `L-05` VERIFIED 목록에도 추가. 반대하는 학교는 `autoLoginBlocked: '사유'` (현재 ON = 国士舘 / 차단 = 東京都市·同志社·駒澤)
- [ ] `timetableUrl`: 전용 파서(国士舘 kaede)만. 그 외는 아래 AI 3종
- [ ] `aiTimetableUrl`/`aiTimetableLabel`/`aiTimetableGuide`: 시간표가 있는 **학무 시스템**(LMS 아님) 주소·이름·메뉴 경로
- [ ] `syllabusUrl`: 외부 공개 URL만
- [ ] manaba 학교면 `mail-inbound` `ALLOWED_SENDERS`에 발신 도메인 추가

---

# 핵심 결정사항 (변경 금지)

- 정식 네이티브 앱 (iOS App Store + Google Play) — PWA ❌
- 학교 비밀번호 **서버 저장·전송 절대 금지**. 자동 로그인 ID/PW는 기기 내 AES-256 저장만(사용자 동의)
- 통지 = 메일 수신 방식(Cloudflare Email Routing + 학생별 `{token}@unipas.app`). MS Graph는 학교 테넌트가 막아 폐기(2026-06-11). 서버는 비번·토큰 미보관
- 시간표: 国士舘 = kaede-i 자동 추출 유지, 그 외 학교 = 스크린샷 AI 읽기(Claude Haiku 5.5, 하루 10회)
- 앱 전체 잠금 같은 마찰 UX 지양 (간편 조회 앱)
- 학교 서버 과부하 방지, 백그라운드 자동 재로그인 금지(사용자 행동이 계기일 때만)
- ⚠️ `appreview@kokushikan.ac.jp`(App Store 심사 데모) 계정은 절대 삭제 금지
- ⚠️ Anthropic API 키 2028-08-18 만료 → 그 전에 Supabase 시크릿 `ANTHROPIC_API_KEY` 교체
