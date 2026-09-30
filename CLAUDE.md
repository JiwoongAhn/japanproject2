# 프로젝트 기본 정보
- **앱 이름:** UniOne (ユニワン)
- **목적:** 일본 대학생을 위한 학교 생활 앱 (에브리타임 일본판)
- **기술 스택:** React Native (Expo SDK 54) / JavaScript / Supabase
- **저장소:** github.com/JiwoongAhn/japanproject2
- **패키지/번들 ID:** `com.jiwoongahn.unione` (iOS·Android 공통)
- **EAS slug:** `unipas` / projectId `1f321891…` (⚠️ slug는 EAS 식별자라 앱 이름 unione와 다름, 바꾸면 빌드 에러)
- **UI 스타일:** 토스 스타일 (primary #3182F6, background #F2F4F6)
- **하단 탭:** 홈 / 시간표 / 게시판 / マイページ (4개). 課題는 실사용 0건이라 탭에서 빼고 루트 모달 `Assignment`로 유지(홈 카드·시간표 셀·통지에서 진입) (2026-09-29)
- **학기 구분:** `courses.term`(spring/fall). 기준=`getCurrentTerm()`(4~8월 春, 9~3월 秋). 시간표 헤더 라벨 탭으로 전환, kaede 추출 시 학기 선택 알림 (2026-09-18). 홈은 학기로 DB를 거르지 않고 `pickTodayCourses()`가 고른다 — 현재 학기가 비면 다른 학기라도 보여줘 홈이 빈 채로 남지 않게 함 (2026-09-29)
- **타 대학 "재로그인 0회" 일반화(2026-09-20):** 자동입력 허용 판정은 `universityLinks[id].autoLoginHosts` 단일 소스(`utils/autoLoginPolicy.js`), 자동 재로그인 로직은 `hooks/useAutoRelogin.js`를 manaba/리마인더/SchoolWeb 3화면이 공유. LMS(`lmsUrl`)는 외부 브라우저가 아니라 `SchoolWeb` 인앱(쿠키 영속)으로 연다. 一括取り込み는 `timetableUrl` 있는 학교만 노출. 온보딩 문구는 `utils/onboardingCopy.js`가 학교 링크로 분기. 게시판은 RLS(`profiles.university`)로 이미 전 대학 분리
- **과목별 시라바스(1.0.2):** kaede 학교는 수업 시트 シラバス → `SchoolWeb`을 `syllabusTarget:{day,period,term}`으로 열어 MY時間割 도착 시 `td#Cell{열}_{교시}_{Spring|Autumn}` 안 링크의 `onclick=OpenSyllabusWindow(uid)`에서 uid를 읽어 같은 WebView에서 `/Syllabus/SyllabusViewVer2.aspx?uid=…`로 이동(`utils/syllabusLink.js`, 2026-09-18 Chrome 실측 검증). 원 링크는 window.open 새창이라 클릭 방식 불가. 실패 시 알림만. 타학교는 Top URL 인앱 브라우저 유지

---

# 개발 환경

```bash
cd /Users/jiwoong/claudeproject/japanproject
npx expo start          # 모바일(Expo Go) + 웹 동시 지원 ← 권장
npx expo start --web --port 8083   # 웹 브라우저만
npm test                           # Jest (화면 수정 후 __tests__/screens.smoke.test.js 필수 확인)
npm run check:bundle               # 화면/훅 수정 후 필수: Metro 번들+Hermes 컴파일로 import·문법 오류 검출 (Jest가 못 잡는 것)
npm run e2e:layout                 # 온보딩 넘침 자동 판정 (5뷰포트, 웹 서버 자동 기동)
scripts/shot-devices.sh            # 릴리스 전 시뮬레이터 4대 스크린샷 대조 시트 (--no-build 재사용)
npx wrangler deploy -c wrangler.privacy.toml   # privacy.unipas.app 재배포 (Worker black-bush-a4e0, 사전 npx wrangler login)
```

---

# 파일 구조

```
japanproject/
├── src/
│   ├── screens/
│   │   ├── auth/         UniversitySelect, SchoolPortalAuth, AcEmailInput, EmailVerificationPending, Splash
│   │   ├── timetable/    Timetable, CourseAdd, CourseDetailModal, CourseReview(Create/Detail), FreeTime
│   │   ├── assignment/   Assignment, AssignmentAdd
│   │   ├── community/    PostList, PostDetail, PostCreate, PostEdit, MyPosts
│   │   ├── HomeScreen.js
│   │   └── ProfileScreen.js
│   ├── utils/            timetable, assignment, auth, review, date, community, imageUpload
│   ├── constants/        colors, courseColors, boardCategories, universities, universityLinks
│   ├── lib/              supabase, AuthProvider, LargeSecureStore (AES-256 암호화)
│   └── navigation/       AppNavigator, MainTab, AuthStack, TimetableStack, AssignmentStack, CommunityStack
├── __tests__/            Jest 유닛 테스트
├── e2e/                  Playwright E2E 테스트 (웹 화면 검증)
├── .maestro/             Maestro 네이티브 E2E (앱 실행 크래시 감지, preview APK로 실행)
├── schema.sql            Supabase DB 스키마 + RLS 정책 전체
└── App.js
```

> 구현된 기능 상세는 코드를 직접 참조 (CLAUDE.md에 중복 기록하지 않음)

---

# Supabase

- **Project ID:** `rexnpusrxezuztxmkaex`
- **인증 방식:** 학교 이메일 → `signInWithOtp()` → `verifyOtp()`
- **SMTP:** Resend (`noreply@unipas.app`), 도메인 Cloudflare 관리
- **Storage:** `post-images` 버킷 (게시판 사진, public read, 5MB 제한)
- **MCP:** `~/.claude.json` 에 등록됨

**인증 화면 흐름:**
```
UniversitySelect → SchoolPortalAuth(이메일+OTP발송) → OtpVerification(코드입력)
  └ 신규 회원: AppNavigator가 자동으로 AcEmailInput(닉네임 입력) 표시
  └ 기존 회원: AppNavigator가 자동으로 MainTab 이동
```

---

# 코딩 규칙

- 변수명: camelCase 영어
- 주석: 한국어
- 순수 함수는 `src/utils/`에 분리

---

# 새 학교 추가 체크리스트

> 17개교 LMS 조사 결과·개통 우선순위는 `docs/university-lms-profiles.md` 참조 (2026-09-18)

**`src/constants/universities.js`**
- [ ] `id`, `name`, `location`, `emailDomain`, `campuses`
- [ ] `periodRanges`: 학교 공식 홈페이지에서 "時限 時間割" 검색 → 없으면 생략 (국사관 기본값 자동 사용)

**`src/constants/universityLinks.js`** (필드 설명은 파일 헤더 주석)
- [ ] `homepageUrl`: 필수
- [ ] `manabaUrl`: manaba.jp 도메인 확인된 경우에만 → お知らせ/리마인더 기능 자동 활성
- [ ] `lmsUrl` + `lmsLabel`: manaba 미사용 시 (WebClass, UNIPA 등). 앱 내 브라우저(쿠키 유지)로 열림
- [ ] `portalUrl` + `portalLabel`: 학사 포털이 LMS와 별도일 때 (국사관 kaede-i)
- [ ] `autoLoginHosts`: ID/PW 자동입력을 허용할 로그인 폼 호스트(SSO IdP 포함). **공개 로그인 페이지 폼 구조를 `__tests__/utils/loginFormScripts.test.js`에 넣어 검증 후에만** 추가. 없으면 쿠키 유지만(안전)
- [ ] `timetableUrl`: 一括取り込み 전용 파서가 있을 때만 (없으면 一括 버튼 자동 숨김)
- [ ] `syllabusUrl`: 외부 공개 URL만 (로그인 필요 URL 생략)
- [ ] manaba 학교면 `supabase/functions/mail-inbound` `ALLOWED_SENDERS`에 발신 도메인 추가

---

# 커뮤니티 시딩 / 큰 화면 대응 (1.0.3 트랙)

- [x] 講義評価 빈 상태 → 평가 작성 유도 버튼 (검색어를 과목명으로 자동 입력해 `CourseReviewCreate`로 이동)
- [ ] 講義評価 시딩 22건 — 확정본 `docs/seed-course-reviews.md`, **DB 미투입**. 시드계정 8개(`*@unione.local`) 생성 → SQL 작성 순
- [ ] 게시판 글 시딩 — 사용자가 글 목록 직접 정리 예정 (국사관대학만)
- [x] 아이패드 대응(A안) ✅2026-09-29 — `WideScreenContainer`(폭 700px↑ → 최대 600px 중앙 컬럼)를 `App.js`에 적용, `supportsTablet=true`, `Dimensions.get` 2곳 훅 전환. ⚠️심사 시 iPad 12.9" 스크린샷 필수

# 실기 버그 수정 (1.0.3) — 2026-09-29

- [x] ⑥ 사용 중 대학 선택 화면으로 롤백 — 원인=`AppState`↔토큰 자동갱신 미연결 + 앱 시작 5초 후 강제 로그아웃. `lib/sessionKeeper.js` 신설, 저장된 세션이 있으면 로그아웃시키지 않고 재시도(실패 시 스플래시에 재시도 버튼)
- [x] ⑤ 마나바 통지 미수신 — 원인=주소 발급만 하고 `verified_at`이 빈 사용자(운영 DB 7명 중 5명)에게 앱이 경고하지 않음. 홈 미완료 배너(`utils/manabaSetupStatus.js`) + 마이페이지 `テスト通知を送る`
- [x] ② 홈탭 시간표 미표시 — 원인=홈만 학기 고정 + `now`가 앱 시작 시점에 고정(날 바뀌면 어제 요일 조회)
- [x] ① 課題 탭 제거(A안) — 탭 4개로, 기능은 모달 유지
- [x] ③ 시간표 비교 점검 — 결함 발견·수정: 친구 시간표 0건을 "전 시간대 공강"으로 계산해 모든 칸이 공통으로 표시됐음
- [x] ④ 카에데 로그인 실패 진단 — 에러 분류 안내(`utils/loginDiagnostics.js`) + 마이페이지 `ログイン情報をリセット` + 기기 내 실패 기록 10건
- [x] 검증 장치: `navigationTargets.test.js`(이동 대상↔등록 화면 대조), smoke 목록에 누락 화면 8개 추가. Jest 592→667
- [x] 시뮬레이터 실렌더링 검증 완료(2026-09-30, iPhone SE3) — 홈 배너·탭 4개·課題 모달·닫기·時間割·掲示板·마이페이지 신규 섹션 전부 실물 확인
- [x] ⚠️ 시뮬 촬영이 막히던 원인 수정: `scripts/shot-devices.sh` 가 `CODE_SIGNING_ALLOWED=NO` 로 빌드해 엔타이틀먼트가 빠졌고 → Keychain 불가 → SecureStore 실패 → **앱 로그인 자체가 불가**했다(딥링크·OTP 모두). ad-hoc 서명 + 시뮬 전용 엔타이틀먼트(Keychain 그룹만)로 변경. 로그인 촬영은 `.maestro/shots_103_login.yaml` → 관리자 API로 OTP 발급(메일 미발송) → `shots_103_main.yaml` 2단계
- [ ] ⚠️ **미배포**: `send-test-push` 엣지 함수(호출자 본인으로 고정하는 보안 수정 포함) — 배포 전까지 テスト通知 버튼 동작 안 함
- [ ] ⚠️ 1.0.3 빌드 필요 — `app.json` 변경 포함이라 OTA 불가

---

# 향후 예정 작업

## 묶음 4 잔여 (모바일 UI 최적화)
- [ ] 추가 학교 periodRanges 미정의 (국사관 외 16개) — 학교별 시간 확인 후 적용
- [ ] 외관 잔여: C-2(텍스트 overflow), C-1(폰트 일관성 103곳), C-3(빈 상태 빈틈) — 출시 후 결정

## 묶음 5 이후
- [ ] Phase 1 재개 (WebView + manaba 파싱) — Development Build 전환 필요
- [ ] Face ID / 지문 인증 — Development Build 전환 시 함께 적용 가능
- [ ] RevenueCat MCP — 프리미엄 기능 개발 시작 전 추가 (작업 전 사용자 확인 필요)

## 배치잡 시스템 (Phase 3 푸시 안정화)
- 설계 plan: `~/.claude/plans/1-polished-jellyfish.md`
- 싱크(ticket 발급)/어싱크(receipt 폴링·재시도) 2단계 모델, 5회 지수 백오프, Supabase Dashboard Cron
- [ ] 출시 전: 시나리오 1~5 시뮬레이션, 마이페이지 배지(MS 연결/최근 푸시/실패 카운트), dead 큐 임계치 dev 알림 채널 결정

---

# 핵심 기능 개발 로드맵

**목표:** 학생이 앱에서 학교 공지사항 확인 + 새 공지 푸시 알림

| Phase | 내용 | 상태 |
|---|---|---|
| Phase 1 | WebView + manaba 파싱 (국사관) | ✅ manaba 공지/원본 분리 + kaede 자동로그인 완료 (2026-05-21) |
| Phase 2 | 세션 유지 | ✅ manaba=쿠키 영속 + 로그인 폼 감지는 URL 아닌 **비밀번호 칸 유무(프로브)** — 국사관 manaba는 만료돼도 /ct/home URL 그대로 자체 ID/PW 폼을 띄움(2026-09-18 실측). manaba 폼·kaede 폼 모두 ID/PW 기기 저장(호스트별 키)+자동입력. 홈 미리보기도 hasPassword로 만료 판정(캐시 오삭제 방지). 로그아웃은 /ct/logout 도착을 프로브로 확인한 뒤 정리(state 변경으로 WebView source 재로드→로그아웃 요청 취소되던 경합 수정). 시뮬 실기 검증 완료, **1.0.2 빌드에 포함 예정** |
| Phase 3 | 푸시 알림 인프라 (배치잡·재시도) | ✅ 완료 |
| Phase 4 | 새 공지 자동 감지 → 자동 푸시 | 🔄 인프라 배포·완주 (2026-07-04). 인증=**6자리 코드방식** 실측. E-분기(학생용 코드표시)+시스템메일 필터 ✅완료·배포·커밋(2026-07-07 `7ad53e2`). 남은=실기기 1회 검증(인증완료 메일 제목·코드추출) + 실제 공지 푸시 확인. 상세=memory `project_unipas_manaba_reminder_push` |

**Phase 1 보류 사유 (2026-05-12):**
- Expo Go는 `react-native-webview` 13.15.0의 New Architecture 호환 native module 미내장
- 런타임 에러 `ReferenceError: Property 'CELL_HEIGHT' doesn't exist`
- **Development Build 1회 생성 시 동시 해결되는 항목:**
  1. Phase 1~4 WebView 기능
  2. Face ID / 지문 인증 (`expo-local-authentication`)
  3. 세션 유지 불안정 문제 (Expo Go의 SecureStore 공유 컨테이너 한계)
- **보존된 파일:** `src/screens/manaba/` (3개 화면), `src/navigation/ManabaStack.js`
- **재개 절차:**
  1. `npm install react-native-webview@13.15.0`
  2. `AppNavigator.js`에 RootStack + ManabaStack 모달 등록 복원
  3. `HomeScreen.js`의 manaba 버튼 `navigation.navigate('Manaba')`로 복원
  4. `eas build --profile development --platform ios` 실행

**확정된 기술 스택:** Expo Notifications + FCM / Vercel Cron 또는 Supabase Edge Functions / cheerio / react-native-webview / @react-native-cookies/cookies

**핵심 결정사항 (변경 금지):**
- 정식 네이티브 앱 (iOS App Store + Google Play) — PWA ❌
- 학교 시스템 접근: WebView 로그인 — **비밀번호 서버 저장 절대 금지**(서버 X 유지). 단 kaede는 사용자 동의(2026-05-21) 하에 ID/PW를 **기기 내 AES-256 저장**(서버 전송 없음)해 자동 로그인 — 출시 전 보안 재검토 필요(생체인증 잠금)
- 세션 유지: manaba=쿠키 영속, kaede=ID/PW 자동입력(매번 재로그인). Silent Login은 kaede에 한해 사용자 동의로 허용
- Phase 4 공지 감지 = **메일전달(Cloudflare Email Routing + 학생별 고유 `{token}@unipas.app`)**. MS Graph는 학교 테넌트 admin consent 차단으로 폐기(2026-06-11). 서버는 비번/토큰 미보관
- Phase 1~4 동안 국사관대학 1개에만 집중
- 학교 서버 과부하 방지 (요청 분산), 학교 이용약관 봇 금지 조항 확인 필수

**Phase 1 시작:** `"UniOne Phase 1 작업 시작할게"` 라고 말하면 바로 진행
