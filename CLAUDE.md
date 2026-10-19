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

**도구 (2026-10-15)**
- [ ] 이용규정 1차 스캔: `npm run tos:scan -- <홈페이지URL>` → 출력 끝의 사이트 검색(주의 공지)은 사람이 → `docs/university-tos-review.md` 등급표에 기록
- [ ] 역할 지도: `docs/schools/_template.md` 를 `docs/schools/{id}.md` 로 복사해 채움 (시간표·성적·과제·공지를 어느 시스템이 맡는지 + 역할별 연결 방법 A~E)
- [ ] 설정 수정 후 `npm run school:features` (학교별 기능 표 갱신 — 안 하면 Jest `SF-DOC` 실패)

**`src/constants/universities.js`**
- [ ] `id`, `name`, `location`, `emailDomain`, `campuses`
- [ ] `periodRanges`: 학교 공식 홈페이지에서 "時限 時間割" 검색 → 없으면 생략 (국사관 기본값 자동 사용)

**`src/constants/universityLinks.js`** (필드 설명은 파일 헤더 주석)
- [ ] `homepageUrl`: 필수
- [ ] `manabaUrl`: manaba.jp 도메인 확인된 경우에만 → お知らせ/리마인더 기능 자동 활성
- [ ] `lmsUrl` + `lmsLabel`: manaba 미사용 시 (WebClass, UNIPA 등). 앱 내 브라우저(쿠키 유지)로 열림
- [ ] `portalUrl` + `portalLabel`: 학사 포털이 LMS와 별도일 때 (국사관 kaede-i)
- [ ] `autoLoginCandidates`: 공개 로그인 페이지 폼 구조를 `__tests__/utils/loginFormScripts.test.js`로 검증한 호스트(SSO IdP 포함). **앱은 안 읽음 = 자동입력 OFF**
- [ ] `autoLoginHosts`(실제 자동입력 ON): **재학생 실기 로그인 확인 + `docs/university-tos-review.md` 에서 학교가 반대하지 않음을 확인한 뒤에만** 후보를 옮긴다. 테스트 `L-05` 의 VERIFIED 목록에도 추가. 학교가 비공식 앱 ID/PW 입력에 반대하면 `autoLoginBlocked: '사유'` (2026-10-14, 현재 ON = 国士舘뿐 / 차단 = 東京都市·同志社·駒澤)
- [ ] `timetableUrl`: 一括取り込み 전용 파서가 있을 때만 (없으면 一括 버튼 자동 숨김)
- [ ] `syllabusUrl`: 외부 공개 URL만 (로그인 필요 URL 생략)
- [ ] manaba 학교면 `supabase/functions/mail-inbound` `ALLOWED_SENDERS`에 발신 도메인 추가

---

# 커뮤니티 시딩 / 큰 화면 대응 (1.0.3 트랙)

## 講義評価 댓글 (2026-10-01 신규, 1.0.3 포함)

- [x] 평가마다 댓글을 달 수 있다. 게시판 댓글(`post_comments`)과 **같은 규칙**을 따른다
      (같은 학교만 / 차단 반영 / 본인만 삭제 / 수정 없음 / 신고 가능)
- [x] 테이블 = `course_review_comments`, 신고 = `course_review_comment_reports`.
      RLS 는 `course_reviews` 를 거쳐 `university = get_my_university()` 를 확인한다
- [x] 화면 = `CourseReviewDetailScreen` 의 평가 카드 안. **기본은 접어 둔다** —
      평가 여러 개를 비교하며 훑는 화면이라 전부 펼치면 정작 평가를 읽기 어렵다
- [x] 입력 판정은 `utils/courseReviewComments.js` 의 `validateComment()` 순수 함수
      (공백만 입력 차단 / 300자 / 전송 중 중복 차단). 조회는 평가 id 를 모아 한 번에(N+1 방지)
- [x] 이 화면도 `KeyboardAwareScrollView` 적용 — 댓글 입력칸이 키보드에 가리지 않는다
- [x] 일부러 뺀 것: 댓글 좋아요 / 대댓글 / 댓글 수정 (현 이용자 규모에 과하고, 기존 게시판과도 일관)
- [x] 검증: Jest 688, `check:bundle` OK, iPhone SE 실기 촬영으로 작성→표시→삭제 전 과정 확인
- [x] ⚠️ **E2E 테스트 계정 대학명 오타 발견·수정** — `e2e/helpers/supabaseHelper.js` 가
      `国士館大学`(館)을 쓰고 있었다. 실제 표기는 `国士舘大学`(舘, 이체자)라 RLS 의 "같은 학교"
      조건에 걸려 **그동안 E2E 가 게시판 글·강의평가를 하나도 못 보고 있었다**. 운영 DB 의
      테스트 계정 프로필도 함께 정정. 앱 소스에는 館 표기가 없어 실사용자 영향은 없다


- [x] 講義評価 빈 상태 → 평가 작성 유도 버튼 (검색어를 과목명으로 자동 입력해 `CourseReviewCreate`로 이동)
- [ ] 講義評価 시딩 22건 — 확정본 `docs/seed-course-reviews.md`, **DB 미투입**. 시드계정 8개(`*@unione.local`) 생성 → SQL 작성 순
- [ ] 게시판 글 시딩 — 사용자가 글 목록 직접 정리 예정 (국사관대학만)
- [x] 아이패드 대응(A안) ✅2026-09-29 — `WideScreenContainer`(폭 700px↑ → 최대 600px 중앙 컬럼)를 `App.js`에 적용, `supportsTablet=true`, `Dimensions.get` 2곳 훅 전환. ⚠️심사 시 iPad 12.9" 스크린샷 필수

# 실기 버그 수정 (1.0.3) — 2026-09-29

- [x] ⑥ 사용 중 대학 선택 화면으로 롤백 — 원인=`AppState`↔토큰 자동갱신 미연결 + 앱 시작 5초 후 강제 로그아웃. `lib/sessionKeeper.js` 신설, 저장된 세션이 있으면 로그아웃시키지 않고 재시도(실패 시 스플래시에 재시도 버튼)
- [x] ⑤ 마나바 통지 미수신 — 원인=주소 발급만 하고 `verified_at`이 빈 사용자(운영 DB 7명 중 5명)에게 앱이 경고하지 않음. 홈 미완료 배너(`utils/manabaSetupStatus.js`) + 마이페이지 `テスト通知を送る`
- [x] ② 홈탭 시간표 미표시 — 원인=홈만 학기 고정 + `now`가 앱 시작 시점에 고정(날 바뀌면 어제 요일 조회)
- [x] ① 課題 탭 제거(A안) — 탭 4개로, 기능은 모달 유지
      **↳ 2026-09-30 결정: 여기서 더 줄이지 않는다.** 홈 `今日のまとめ` 의 課題 칸은 그대로 둔다.
      이유 = 그 칸이 課題 화면으로 가는 **유일한 상시 입구**다(시간표는 수업 칸을 눌러야 하고,
      통지는 알림이 와야 열린다). 이 칸까지 빼면 평소 진입로가 사라져 사용량이 0 으로 고정되고,
      "역시 아무도 안 쓴다"는 잘못된 결론에 이른다. 지금은 관찰 장치를 남겨 둘 단계.
      **재검토 조건 = 이용자 20~30명 시점에 `assignments` 행 수 확인**
      (여전히 0 이면 홈 칸도 빼고 2칸으로 / 몇 건이라도 있으면 유지). 조회는 `docs/admin-status.sql`
- [x] ③ 시간표 비교 점검 — 결함 발견·수정: 친구 시간표 0건을 "전 시간대 공강"으로 계산해 모든 칸이 공통으로 표시됐음
- [x] ④ 카에데 로그인 실패 진단 — 에러 분류 안내(`utils/loginDiagnostics.js`) + 마이페이지 `ログイン情報をリセット` + 기기 내 실패 기록 10건
- [x] 검증 장치: `navigationTargets.test.js`(이동 대상↔등록 화면 대조), smoke 목록에 누락 화면 8개 추가. Jest 592→667
- [x] 시뮬레이터 실렌더링 검증 완료(2026-09-30, iPhone SE3) — 홈 배너·탭 4개·課題 모달·닫기·時間割·掲示板·마이페이지 신규 섹션 전부 실물 확인
- [x] ⚠️ 시뮬 촬영이 막히던 원인 수정: `scripts/shot-devices.sh` 가 `CODE_SIGNING_ALLOWED=NO` 로 빌드해 엔타이틀먼트가 빠졌고 → Keychain 불가 → SecureStore 실패 → **앱 로그인 자체가 불가**했다(딥링크·OTP 모두). ad-hoc 서명 + 시뮬 전용 엔타이틀먼트(Keychain 그룹만)로 변경. 로그인 촬영은 `.maestro/shots_103_login.yaml` → 관리자 API로 OTP 발급(메일 미발송) → `shots_103_main.yaml` 2단계

- [x] 작은 화면 인증코드 버튼 가려짐 ✅2026-09-30 — 원인=`OtpVerificationScreen`만 스크롤 컨테이너가 없었음(전 입력화면 전수검사로 확인). `KeyboardAwareScrollView` + `keyboardDismissMode='on-drag'` + 6자리 입력 시 자동 확인(`shouldAutoSubmitOtp`, 같은 코드 반복제출 가드)
- [x] ⚠️ 위 수정만으로는 **버튼이 그대로 가려졌다**(SE 실촬영으로 발견). 진짜 원인=`autoFocus` 로 진입 즉시 포커스될 때는 아직 키보드가 없어 스크롤 가능 범위가 0 이라 `scrollTo` 가 무시됨. `KeyboardAwareScrollView` 가 키보드가 뜬 뒤 한 번 더 스크롤하도록 수정(공용 컴포넌트라 다른 6개 입력 화면에도 같이 적용). SE 재촬영으로 確認 버튼 노출 확인
- [x] 아이패드: 네이티브 모달이 `App.js` 의 `WideScreenContainer` 바깥에 떠서 모달만 화면 폭 전체로 펼쳐지던 문제 수정(`withWideScreen` HOC). 외부 사이트 WebView 모달(manaba·학교 사이트)은 일부러 제외
- [x] 課題 닫기 버튼에 `accessibilityLabel="閉じる"` 추가 — VoiceOver 대응 + 촬영이 좌표 탭에 의존하지 않게
- [x] 아이패드 실화면 확인 ✅2026-09-30 — iPad Pro 13" 시뮬에서 로그인~마이페이지 전 플로우 완주(홈·탭4개·課題모달·시간표·게시판·마이페이지). Jest 677

### ▶ 다음 세션에서 이어서 할 것 (2026-09-30 중단 시점)
1. [x] **`send-test-push` 엣지 함수 배포** ✅2026-09-30 (v7) — 호출자 본인으로 고정하는 보안 수정 포함.
       anon 키로 남의 `userId`를 넣어 호출 → 401 `인증이 필요합니다` 실측 확인
2. [x] **아이패드 실화면 확인** ✅2026-09-30 완료 (아래 기록 참조) — `npx expo prebuild --platform ios` 는 **이미 실행 완료**
       (`TARGETED_DEVICE_FAMILY = "1,2"` 반영됨, `ios/` 는 gitignore 대상이라 로컬에만 존재).
       남은 일 = 아이패드 시뮬레이터 생성 → 앱 설치 → `.maestro/shots_103_login.yaml` + `shots_103_main.yaml` 촬영.
       ⚠️ 시뮬 빌드는 반드시 ad-hoc 서명으로 (그냥 빌드하면 Keychain 막혀 로그인 불가 — `scripts/shot-devices.sh` 참고)
3. [x] **1.0.3 빌드·제출** ✅2026-10-01
       - 빌드 완료: iOS `1.0.3 (build 11)` / Android `1.0.3 (vc10)`, 둘 다 커밋 `50bce78`
       - iOS = ASC 업로드 완료 → 스크린샷·빌드 선택·출시노트 입력 → **심사 제출 완료**
       - Android = 서비스 계정 키 미설정이라 `eas submit` 비대화형 불가 →
         AAB 직접 업로드 경로 안내(Play Console 프로덕션 → 새 버전 만들기)
       - 아이패드 스크린샷 = `shots/appstore-ipad/` 5장(2064×2752, 13" 규격).
         `.maestro/shots_store_ipad.yaml` 로 촬영. 데이터가 빈 계정으로 찍으면 스토어용으로
         못 쓰므로, 테스트 계정에 시간표·과제·댓글을 넣고 닉네임·푸시토큰까지 맞춘 뒤 촬영했다
       - ⚠️ 촬영용 데이터가 운영 DB의 테스트 계정에 남아 있다(정리 대상):
         `courses` 8건(fall) / `assignments` 3건 / `course_review_comments` 2건 /
         `push_tokens` 1건(`ExponentPushToken[SHOT-ONLY-DO-NOT-SEND]`) / 닉네임 `ユウ` /
         `mail_subscriptions.verified_at`. 전부 테스트 계정 소유라 실사용자에겐 안 보인다

### (이전 기록) 1.0.3 빌드 준비 메모 `app.json` version 을 **1.0.3 으로 올려 커밋 완료**(`fd145f1`).
       `runtimeVersion` 이 appVersion 정책이라 OTA 채널이 갈라진다 = 기존 1.0.2 설치본에는 OTA 전달 불가.
       ✅ **1.0.2 는 이미 심사 승인·출시 완료**(2026-09-30 사용자 확인) → 1.0.3 은 새 버전으로 정상 제출하면 되고,
       심사 취소 같은 처리는 필요 없다. EAS 로그인 상태 정상, 최신 빌드=1.0.2(iOS build 10 / Android vc9).
       빌드 번호·versionCode 는 `eas.json` 의 `appVersionSource: remote` + `autoIncrement` 로 자동 증가한다.
       **사용자 방침(2026-09-30) = 빌드는 아직 시작하지 않고 대기.**
       빌드 명령 = `npx eas build --platform all --profile production`

## ▶▶ 다음 세션 진입점 (2026-10-16 밤 중단 시점)

**순서: ⓪ 콘텐츠 시딩(심사 대기 중 병행) → ① 1.0.4 심사 결과·실기 확인 → ② AI 파서 → ③ 1.0.5**

### ⓪ 다음 작업 = 콘텐츠 (진입: "해외연수 글 작업 시작할게" / "친구 수업평가 시딩 할게")
추천 순서(2026-10-16 합의): **해외연수 경험 글 → 친구 정보로 講義評価 → 게시판 시딩**
- 해외연수 = 사용자 본인 실제 경험. 길면 2~3글로 나눔(신청·준비 / 현지 생활 / 학점 인정), 글당 8~13줄
- 講義評価 우선 = 수강신청마다 재방문 이유. 앱 설치 가능한 친구는 **본인이 직접 앱에서 작성**하게(진짜 사용자 1명 확보), 아닌 친구 정보만 시드 계정으로
- 원칙 유지: 실제 경험만 / 계정마다 말투 다르게 / 제도(비자·세금·금융) 미경험 정보 금지
- 친구 연락 시 **日本文理 2명에게 시간표 HTML 샘플** 요청 → ② AI 파서 차단 해제

### ① 1.0.4 — ✅ 양쪽 심사 제출 완료 (2026-10-16)
- iOS **1.0.4 (12)** ASC 심사 제출 / Android **1.0.4 (vc11)** Play 검토 중 (178개국, 관리형 게시 OFF → 승인 즉시 공개)
- 빌드 기준 커밋 `2a8d77e`(푸시됨). Jest 778, `check:bundle` OK
- 포함: 버전 표시(`42bae0c`) / **인앱 업데이트 안내**(`06ae461`) / URL 탭(`759ec18`) / 遅延証明(`927ee6b`) /
  **미검증 학교 자동로그인 OFF**(`01e1c8f`) / **교실 매칭 수정**(`2a8d77e`)
- **교실 매칭 수정**(실사용자 신고) — 시라바스가 대상 학부 수만큼 같은 교실을 반복(`34B303`×5)해 통째로 저장 +
  학기(春期/秋期)를 안 봐서 秋 木2 町田 수업에 春 世田谷 교실이 들어감. `matchRoom` 에 학기 필터·중복 제거.
  실제 시라바스 데이터 6건 대조. 운영 DB 기존 5건 정리 완료(신고건 → `13304`). `応用英語２ 金6` 2건은 원본도 모호해 유지
- ▶ 승인 후: **App Store/Play 에서** 업데이트(TestFlight 금지) → 마이페이지 `バージョン 1.0.4 (12)`(안드는 `(11)`) 확인 →
  **첫 OTA 실측**(`eas update` 1회 → 홈 배너·「今すぐ更新」 동작). 진입: "1.0.4 심사 결과 나왔어"
- ⚠️ Hermes 는 일본어를 **UTF-16** 으로 저장 — 번들 문자열 검증 시 UTF-8 grep 금지, 대조군과 함께 검사
- ⚠️ `eas submission:view` 명령은 없다 — iOS 제출 상태는 expo.dev 제출 페이지에서 확인. 무료 대기열이라 20분+ 걸림

### 안드로이드 배포 국가 ✅ 일본 1개국 → 178개국 (2026-10-16)
- 「안드에서 검색해도 안 나온다」 신고 원인. Play 「국가」는 거주지가 아니라 **Google 계정 국가** — 일본 거주 유학생·한국 계정이 못 찾았다
- 사용자가 Play Console 에서 직접 변경(Claude 의 프로덕션 설정 클릭은 auto mode 분류기가 차단). 검토 승인 후 한국·미국·일본 검색 1위 확인
- ⚠️ 일본 계정 1명 못 찾은 건은 **미확정**(Console 이상 없음: 18,833기기·API24+·정책문제 0). 검색어 「ユニオン」은 안 잡힌다 → 직접 링크 문구로 판별 요청함
- 비공개 테스트 트랙(버전 6)이 아직 「활성」 — 급하지 않은 정리 대상

### ② AI 시간표 파서 — 설계 확정, 코드 0줄 (진입: "AI파서 작업 시작할게")
타 학교 일괄추가를 **학교별 코딩 없이** 해결한다. 비밀번호를 저장하지 않아 법적 리스크도 피한다.

```
유저가 WebView 에서 직접 로그인 → 시간표 페이지 → HTML 캡처
  → Edge Function → Claude 가 수업 추출 → 기존 미리보기 → 저장
```
- 자리가 이미 비어 있다: `src/utils/timetableRouter.js` 의 `case 'html':` (현재 throw 만, 호출부 없음)
- **AI 인프라 가동 중**: Edge Function `summarize-notice` ACTIVE + `ANTHROPIC_API_KEY` 설정됨. 새로 만들 건 함수 1개
- 반환 형식은 기존과 같이 `{ parsed, unparsed }`
- 비용 무시 가능 — 시간표 추출은 학기당 1회
- 작업 순서: Edge Function → `case 'html'` 연결 → `canBulkImport` 조건 완화 → 샘플로 검증

⚠️ **막히는 지점 = 国士舘이 아닌 학교의 시간표 HTML 샘플 1개.**
日本文理 실사용자 2명이 있으므로 그분들에게 요청하는 게 가장 빠르다(`docs/schools/nbu.md` §4).

실현 가능성(사용자에게 답한 수치): 새 학교 코드작업 0으로 커버 **75%**(PDF·이미지 시간표는 불가) /
샘플 1개로 전 학교 완성 **25%** / 샘플 1개로 시작해 학교별 보정하며 확장 **75%** ← 현실 경로

### 타 학교에서 지금 실제로 되는 것 (2026-10-16 전수 검증)
| 기능 | 범위 |
|---|---|
| 로그인 **유지**(쿠키) | 18교 전부 ✅ |
| ID/PW 저장·자동입력 | **国士舘만** (후보 12교=OFF, 차단 3교, 없음 5교) |
| 시간표 일괄추가 | **国士舘만** — 타교는 버튼 자체가 안 보인다 |
| 게시판 / 講義評価 | 18교 전부 작동하나 **콘텐츠가 학교별 격리** → 日本文理 2명에겐 0건 = 빈 화면 |
| 통지 | 코드상 4교, **실검증은 国士舘만** |

⚠️ 자동로그인은 저장된 ID/PW 를 **완전 자동으로 입력·제출**한다. 탭도 FaceID 도 없다(생체인증 미구현).

## 커뮤니티 시딩 ✅완료 (2026-10-15)
- [x] **게시판 2차 11건 투입** (2026-10-15) — 학년별(単位·時間割·語学·奨学金·ビザ·ゼミ·キャリア·特別課題研究)
      + 유학생 제도(再入国許可·28時間·年金). 일반 권한 조회 **11/11 전부 확인**. 게시판 총 22건
      - ⚠️ **글은 8~13줄로 짧게.** 1차 초안(20~30줄)은 "새로 들어온 사람이 안 읽는다"고 반려됨
      - ⚠️ **말투를 계정마다 다르게.** 전부 ですます면 한 사람이 쓴 티가 난다 → 반말·だ/である·체언종지·笑·！ 분산
      - 🚫 **#16 証券口座·NISA 는 일부러 올리지 않았다** — 실제 경험이 없는 제도 정보는 틀리면 돈 문제로 직결되고,
        지어낸 1건이 나머지 글의 신뢰도까지 깎는다
      - 실제 사용자 질문글(10-11)에 시드 계정 익명 댓글 1건 추가. 운영자 계정은 만들지 않음
        (댓글은 `is_anonymous=true` 면 `匿名1` 로만 표시되므로 불필요)
      - 사후 수정 자유: `posts` 에 `updated_at` 없어 「편집됨」 표시가 안 붙는다. 단 앱에서는 수정 불가(시드 비번 미보관)

## 커뮤니티 시딩 — 講義評価 (2026-10-14)
- [x] **講義評価 22건 DB 투입** — `docs/seed-course-reviews.md` 확정본. 시드 계정 `seed01~08`(07·08 은 이때 생성).
      일반 사용자 권한(anon+로그인)으로 **22건 전부 조회 확인 = RLS 통과**. 별점 ★5=3/★4=7/★3=9/★2=3,
      교수명 있음 11·NULL 11, 태그 10자 제한 위반 0 — 전부 설계값 일치
- [x] **데모 평가 3건 + 댓글 2건 삭제** (`心理学入門` `線形代数` `経営学概論`)
- ⚠️ **`appreview@kokushikan.ac.jp`(`デモ太郎`)는 App Store 심사용 데모 계정 — 절대 삭제하지 말 것.**
      평가만 지웠고 계정·시간표 8건·과제 3건은 심사 로그인용으로 유지. 이 계정 로그인 시 講義評価 22건·게시판 11건 보임
- 💡 **講義評価가 비어 보이던 원인** = 콘텐츠 미투입 + 진입점 2개 혼동.
      `時間割`탭→「講義評価」=전체 목록 / `마이페이지`→`投稿・講義評価`→「講義評価」탭=**내가 쓴 것만**(0건이 정상)

## 1.0.4 트랙 (2026-10-03 착수) — ⏸ **빌드 대기: 추가 수정을 모아 한 번에 올린다**
> **사용자 방침(2026-10-04)** = 업데이트를 너무 자주 하지 않는다. 지금까지의 작업은 `app.json` version `1.0.4` 로
> 올려 쌓아두고, 앞으로 나올 수정까지 모은 뒤에 한 번에 빌드·제출한다. **지금 빌드하지 말 것.**
> 1.0.3 은 실기 확인 완료 — **오류 없음**(2026-10-04 사용자 확인). 사용 중 발견되는 문제는 1.0.4 에 합쳐서 올린다.
> ✅ version 을 올려도 안전해졌다 — `runtimeVersion` 이 `fingerprint` 라 OTA 채널이 갈라지지 않는다
> (`appVersion` 정책이던 1.0.3 까지는 버전을 올리는 순간 기존 유저에게 OTA 가 끊겼다)

- [x] **마이페이지 하단 앱 버전 표시** — `src/utils/appVersion.js` + `ProfileScreen` 푸터.
      `expo-application` 의 **네이티브** 버전/빌드번호를 읽는다(`バージョン 1.0.3 (11)`).
      app.json 버전을 읽으면 OTA 번들 버전이 나와서 「폰에 깔린 실물 앱」을 알 수 없다 —
      7/25 OTA 옛 번들 사건 같은 오판을 막는 용도. Jest 694
- [x] **게시판 본문·댓글 URL 탭 가능하게** ✅2026-10-03 — RN 의 `Text` 는 URL 을 자동 링크로 만들지 않아
      유저가 주소를 복사해 브라우저에 붙여넣어야 했다. `utils/linkify.js`(순수 함수) +
      `components/LinkifiedText.js`(인앱 브라우저로 열기, 기존 시라바스 방식과 통일).
      ⚠️ 일본어 본문은 URL 뒤에 전각 문장부호가 바로 붙으므로(`…/a。`) 전각 문자를 URL 에서 제외해야 한다.
      반각 문장부호는 떼어내되 괄호 짝이 맞으면 유지(위키백과 주소). 유저가 올린 주소라
      열기 전에 확인 Alert 을 띄운다. 「쪼갠 조각을 다시 이으면 원문과 같다」 테스트로 글자 유실 방지. Jest 728
- [x] **遅延証明 한 줄 추가** ✅2026-10-04 (DB 직접 수정, 글 `389d8238`)
      스쿨버스 지연 = `学生厚生課`에서 받음 / 제출 = 담당 교수에게 수업 후 직접.
      ⚠️ **건물·위치와 오다큐선 지연분은 미확인이라 일부러 쓰지 않았다** — 시딩 원칙(실제 경험 기반)에 따라
      추측 금지. 사용자가 확인되면 직접 추가 예정. `posts` 에 `updated_at` 컬럼이 없어 「편집됨」 표시는 안 붙는다
- [x] **인앱 업데이트 안내** ✅2026-10-03 — 유저가 「업데이트가 있다」는 걸 알 방법이 없던 문제.
      OTA 배선(`updates.url`)은 있었지만 **그걸 쓰는 코드가 0곳**이었다.
      - `runtimeVersion` 정책 `appVersion` → **`fingerprint`** 변경.
        appVersion 정책이면 버전을 올리는 순간 OTA 채널이 갈라져 기존 유저에게 OTA 가 안 간다
        (1.0.3 유저가 딱 그 상태였다). fingerprint 는 네이티브가 바뀔 때만 갈라진다
      - `hooks/useAppUpdate.js` — OTA 우선, 없으면 스토어 확인. **앱 실행당 1회**(모듈 레벨 캐시로
        탭 전환 재마운트 시 중복 호출 방지). `Updates.isUpdatePending` 도 함께 봐야 한다
        (expo-updates 기본 ON_LOAD 가 이미 받아둔 경우 `checkForUpdateAsync` 는 false 를 준다)
      - `components/UpdateBanner.js` — 홈 상단 파란 배너 → 「今すぐ更新」 = 앱 안에서 즉시 적용
      - `components/StoreUpdateModal.js` — 네이티브 업데이트 시 모달 → 「App Store へ」 = `itms-apps://` 딥링크.
        **iOS 는 앱이 자기 바이너리를 설치할 수 없다**(OS 제약) → 제품 페이지 열어주는 게 한계
      - `utils/storeVersion.js` — Apple 공개 API(`itunes.apple.com/lookup`)로 라이브 버전 조회. 서버 불필요.
        ⚠️ 버전 비교는 숫자 단위로 (문자열이면 `'1.0.10' < '1.0.9'` 가 되어 안내가 안 뜬다)
      - Android(Play)는 공개 조회 API 가 없어 스토어 확인은 **iOS 전용**. 안드는 OTA 배너 + Play 자동 업데이트
      - ⚠️ **이 기능은 1.0.4 를 설치한 뒤부터 작동한다.** 1.0.3 이하 유저는 한 번은 수동으로 받아야 한다
      - Jest 711

### ⚠️ 반복된 함정: TestFlight 로 받은 앱은 App Store 업데이트가 영구히 안 온다
iOS 는 앱마다 **설치 출처**를 기억한다. 번들 ID 가 같아도 TestFlight·Xcode 로 설치된 앱은
App Store 입장에서 「내가 배달하지 않은 앱」이라서, 새 버전이 나와도 업데이트를 제안하지 않고
**항상 「開く」만 표시**한다. 1.0.2·1.0.3 출시 때 개발자 폰과 친구 테스터 폰에서 같은 증상 발생.
- 복구 순서 = ① 앱 삭제 → ② **App Store** 에서 설치 → ③ 이후 TestFlight 에서 업데이트 누르지 않기
- 삭제해도 안전: 계정·게시글·시간표·과제는 Supabase 서버에 있다. 날아가는 건 마나바 쿠키·로컬 캐시(재로그인 1회)
- 친구 테스터도 7월 공개 링크(TestFlight)로 받았으면 같은 상태다 → App Store 설치로 갈아타게 안내해야 한다

---

# AI 시간표 읽기 (2026-10-19) — 国士舘 외 학교용

- [x] **国士舘은 기존 kaede 자동 추출 그대로** (사용자 방침 — `timetableUrl` 있는 학교는 AI 를 쓰지 않는다)
- [x] 그 외 학교: 「一括」 → `AiImportSheet` 3가지 — ① 학교 시스템에서 읽기(`SchoolWeb` `aiTimetable` 모드: 안내 띠 + 왼쪽 아래 「時間割を読み取る」, 페이지 HTML 을 `CAPTURE_PAGE_JS` 로 가져와 `cleanPageHtml`) ② 스크린샷 최대 3장 ③ 붙여넣기(`BulkAddInput` `aiMode`)
- [x] 공통 흐름 `hooks/useAiTimetableImport` → Edge Function `parse-timetable`(Claude **Haiku 5.5**, 구조화 출력, 사용자당 하루 10회 = `ai_usage` 테이블) → `normalizeAiCourses` → 학기 선택 → 기존 `BulkAddPreview`(확인 필요 수업 맨 위)
- [x] 처음 1회 동의 `AiConsentModal`(해외 이전 고지, 기기 저장 `ai_timetable_consent_v1`). privacy(앱·웹)에 Anthropic 항목 추가
- [x] 학교별 시작점 `universityLinks.aiTimetableUrl/Label/Guide` (16교, 근거 `docs/university-lms-profiles.md` §4). ❓ 메뉴 경로는 재학생 확인 전 추정
- [x] 정확도 실측(스크린샷): 日本文理 11/11·国士舘 25/25 = 100%. 재측정 `node scripts/eval-ai-timetable.js <정답지> <이미지…>` (정답지·이미지는 실제 학생 데이터라 gitignore)
- ⚠️ Anthropic API 키 `unione-supabase` **2028-08-18 만료** → 그 전에 새 키로 Supabase 시크릿 교체 (만료되면 「AIで要約」까지 같이 멈춘다)
- [ ] 日本文理 실기: 앱 브라우저에서 UNIPA 학외 Basic 인증이 통과되는지 / 페이지 읽기 결과

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
