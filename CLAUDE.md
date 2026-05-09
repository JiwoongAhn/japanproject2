# 프로젝트 기본 정보
- **앱 이름:** Unipas (ユニパス)
- **목적:** 일본 대학생을 위한 학교 생활 앱 (에브리타임 일본판)
- **기술 스택:** React Native (Expo SDK 54) / JavaScript / Supabase
- **저장소:** github.com/JiwoongAhn/japanproject2
- **UI 스타일:** 토스 스타일 (primary #3182F6, background #F2F4F6)
- **하단 탭:** 홈 / 시간표 / 과제 / 게시판 / マイページ (5개)

---

# 개발 환경

```bash
cd /Users/jiwoong/claudeproject/japanproject
npx expo start          # 모바일(Expo Go) + 웹 동시 지원 ← 권장
npx expo start --web --port 8083   # 웹 브라우저만
```

**모바일 테스트 (Expo Go):**
1. 폰에 Expo Go 설치 (App Store / Google Play)
2. `npx expo start` 실행 → QR코드 스캔
3. 아이폰: 기본 카메라 앱으로 스캔 / 안드로이드: Expo Go 앱 내 스캔
4. 코드 수정 시 폰에 자동 반영 (Hot Reload)

**다른 사람 테스트 공유:**
- Vercel URL로 컴퓨터/모바일 브라우저에서 바로 접속 가능
- Vercel 대시보드 → japanproject → 배포 URL 확인

---

# 파일 구조

```
japanproject/
├── src/
│   ├── screens/
│   │   ├── auth/         UniversitySelectScreen, SchoolPortalAuthScreen, AcEmailInputScreen, EmailVerificationPendingScreen, SplashScreen
│   │   ├── timetable/    TimetableScreen, CourseAddScreen, CourseDetailModal, CourseReviewScreen, CourseReviewCreateScreen, CourseReviewDetailScreen, FreeTimeScreen
│   │   ├── assignment/   AssignmentScreen, AssignmentAddScreen
│   │   ├── community/    PostListScreen, PostDetailScreen, PostCreateScreen
│   │   ├── HomeScreen.js
│   │   └── ProfileScreen.js
│   ├── utils/            timetable.js, assignment.js, auth.js, review.js, date.js, community.js
│   ├── constants/        colors.js, courseColors.js, boardCategories.js, universities.js
│   ├── lib/              supabase.js, AuthProvider.js, LargeSecureStore (AES-256 암호화)
│   └── navigation/       AppNavigator.js, MainTab.js, AuthStack.js, TimetableStack.js, AssignmentStack.js, CommunityStack.js
├── __tests__/            Jest 유닛 테스트 (66개 케이스, 8개 파일)
├── e2e/                  Playwright E2E 테스트
├── schema.sql            Supabase DB 스키마 + RLS 정책 전체
└── App.js
```

---

# Supabase

- **Project ID:** `rexnpusrxezuztxmkaex`
- **학교 인증 이메일 형식:** `{학적번호}@{대학도메인}` (예: `A1234567@kokushikan.ac.jp`) — 이 이메일이 Supabase 계정 이메일
- **인증 방식:** Supabase 내장 SMTP OTP (`signInWithOtp` + `verifyOtp`) — Edge Function / Resend API 없음
- **MCP:** `~/.claude.json` 에 등록됨 — Supabase MCP 툴로 DB 조작 가능

---

# 구현 완료된 기능 (2026-04-20 기준)

| 탭 | 기능 |
|---|---|
| 공통 | 학교 선택 → 학교 이메일 입력 → Supabase OTP 인증 → 신규 회원은 닉네임 설정 |
| 공통 | Supabase 계정 = 학교 ac.jp 이메일 (내부 @unipas 이메일 제거, OTP 로그인) |
| 공통 | AuthProvider / useAuth 훅 (session + profile + refreshProfile), LargeSecureStore 세션 암호화 저장 |
| 홈 | 오늘 수업·D-3 과제·최신 게시글 실시간 표시, 학번 포함 인사말 |
| 홈 | 学校情報 그리드 (manaba/kaede-i/홈페이지 실제 URL 연결) |
| 시간표 | 요일×6교시 그리드, 수업 추가/삭제, 오늘 요일 강조 |
| 시간표 | 강의평가 목록·상세·작성 (별점·태그·코멘트, Supabase 연결) |
| 시간표 | 공강맞추기 (5×6 터치 그리드, 친구 ID 비교, share_timetable 비공개 차단) |
| 과제 | 목록·추가·상태 토글·삭제, 인라인 달력 날짜 선택, 필터별 빈 상태 UX |
| 게시판 | 글 목록 (카테고리·검색·20개씩 페이지네이션), 작성·상세·댓글, 익명 토글 |
| 게시판 | 신고 기능 (post_reports 테이블), 좋아요 (increment_like RPC) |
| マイページ | 프로필 카드, 요일 강조 색상 설정, 내가 올린 게시글 목록, 로그아웃 |

---

# Supabase 설정 완료 현황 (2026-05-07 기준)

- [x] Authentication → Email → **"Confirm email" ON** (OTP 인증 활성화)
- [x] `profiles.school_email` / `student_id` / `share_timetable` 컬럼 추가 완료
- [x] `posts_category_check` 제약조건 (qa/free/secret/info) 변경 완료
- [x] `post_likes` 테이블 + `toggle_like` RPC 생성 완료 (좋아요 중복 방지)
- [x] `post_reports` 테이블 + RLS 정책 생성 완료
- [x] `comment_likes` 테이블 + `toggle_comment_like` RPC 생성 완료 (댓글 좋아요)
- [x] OTP 토큰 자리수 6자리로 설정 완료
- [x] 이메일 템플릿 수정 완료 — Magic Link + Confirm signup 모두 `{{ .Token }}` 6자리 코드 표시
- [x] `posts.university` / `course_reviews.university` 컬럼 추가 완료 (학교별 격리)
- [x] `get_my_university()` SECURITY DEFINER 함수 생성 완료 (RLS 무한재귀 방지)
- [x] 학교별 데이터 격리 RLS 정책 적용 완료 (2026-05-07)
  - `profiles`: 본인 + 같은 학교 사용자만 조회
  - `posts`: 같은 학교 게시글만 조회
  - `post_comments`: 같은 학교 게시글의 댓글만 조회
  - `courses`: 본인 시간표 + 같은 학교 공유 시간표만 조회
  - `course_reviews`: 같은 학교 강의평가만 조회

## 인증 아키텍처 (2026-04-24 변경)

**이전:** 학적번호+비밀번호 로그인 → 가입 시 Resend API Edge Function으로 OTP 발송 → `@unipas` 내부 이메일로 Supabase 계정 생성  
**현재:** 학교 이메일 입력 → `supabase.auth.signInWithOtp()` → `supabase.auth.verifyOtp()` → 학교 이메일이 Supabase 계정

**화면 흐름:**
```
UniversitySelect → SchoolPortalAuth(이메일+OTP발송) → OtpVerification(코드입력)
  └ 신규 회원: AppNavigator가 자동으로 AcEmailInput(닉네임 입력) 표시
  └ 기존 회원: AppNavigator가 자동으로 MainTab 이동
```

**Edge Functions:** `send-school-otp`, `verify-school-otp` — 더 이상 사용 안 함 (삭제 가능)

---

# 코딩 규칙

- 변수명: camelCase 영어
- 주석: 한국어 (초보자도 이해할 수 있게 코드 의도 설명)
- 순수 함수는 `src/utils/`에 분리, 화면 컴포넌트는 `import`로 연결

---

# 테스트

```bash
npm test          # Jest 유닛 테스트 (66개)
npm run e2e       # Playwright E2E (앱 서버가 8083에서 실행 중이어야 함)
npm run e2e:ui    # Playwright UI 모드 (디버깅 편함)
```

---

# 인프라 설정 완료 현황

- [x] `.github/workflows/keep-supabase-alive.yml` — 매일 오전 9시(JST) Supabase 자동 핑, 무료 플랜 일시 중지 방지
- [x] DNS — Namecheap → **Cloudflare** 이전 완료 (2026-05-05, Namecheap `/` 버그로 인한 이전)
- [x] Resend SMTP 설정 완료 — 도메인 `unipas.app` Verified, 발신 주소 `noreply@unipas.app`
- [x] Supabase SMTP 연결 — Host: `smtp.resend.com`, Port: `465`, Username: `resend`

# 새 학교 추가 체크리스트

새 학교 추가 시 아래 순서로 진행할 것:

**`src/constants/universities.js`**
- [ ] `id`, `name`, `location`, `emailDomain`, `campuses`
- [ ] `periodRanges`: 학교 공식 홈페이지에서 "時限 時間割" 검색 → 없으면 생략 (국사관 기본값 자동 사용)

**`src/constants/universityLinks.js`**
- [ ] `homepageUrl`: 필수
- [ ] `manabaUrl`: manaba.jp 도메인 확인된 경우에만 추가
- [ ] `lmsUrl` + `lmsLabel`: manaba 미사용 시 추가 (WebClass, Blackboard, UNIPA 등)
- [ ] `syllabusUrl`: 외부 공개 URL 있으면 추가 (로그인 필요 URL은 생략)
- [ ] `kaedeUrl`, `portalUrl`: 국사관 전용 → 다른 학교는 비워둠

---

# 향후 예정 작업
- **RevenueCAT MCP** — 프리미엄 기능 개발 시작 전에 추가할 것 (작업 전 사용자에게 먼저 확인)

---

# 작업 묶음 진행 현황 (2026-05-07 기준)

## 🔴 묶음 1 — 핵심 버그 수정 ✅ 완료
- [x] OTP 이메일 6자리 코드 발송 — Resend SMTP + Cloudflare DNS + 이메일 템플릿 수정 완료
- [x] 로그아웃 버그 수정 — signOut({ scope: 'local' })로 변경
- [x] 신고 기능 버그 — 에러 메시지 개선 완료 (실제 error.message 표시)
- [x] 좋아요 중복 방지 — post_likes 테이블 + toggle_like RPC + UI(♡/♥) 업데이트 완료

## 🟡 묶음 2 — 기존 화면 기능 완성 ✅ 완료
- [x] 시간표 삭제 기능 — 이미 구현되어 있음 (CourseDetailModal → onDelete)
- [x] 마이페이지 내 게시글 열람 — 이미 구현되어 있음 (navigation.navigate 정상 동작)
- [x] 댓글 좋아요 기능 — comment_likes 테이블 + toggle_comment_like RPC + UI(♡/♥) 완료
- [x] 과제 삭제 기능 — 이미 구현되어 있음 (길게 누르기 → 삭제)

## 묶음 1·2 테스트 결과 (2026-05-05 완료)
- [x] OTP 이메일 6자리 코드 수신 ✅
- [x] 신규 회원 닉네임 입력 화면 표시 ✅
- [x] 신고 기능 작동 (post_reports 저장 확인) ✅
- [x] 좋아요 중복 방지 (♥→♡ 취소) ✅
- [x] 댓글 좋아요 (♡/♥ 토글, 숫자 증감) ✅

## 🔴 묶음 3 — 계정 관련 기능 ✅ 완료
- [x] 닉네임 변경 모달 작동 확인 + refreshProfile() 동기화 추가
- [x] 탈퇴 후 재가입 시 닉네임 입력 화면 정상 표시 확인
- [x] AcEmailInputScreen 문구 수정 ("後からいつでも変更できます")
- [x] 이메일/닉네임 입력 placeholder letterSpacing 버그 수정 (iOS 글자 간격)
- [x] autoFocus 제거 — 닉네임 화면 부제목 표시 보장
- [x] 편집 버튼 프로필 카드 우측 끝으로 이동 및 크기 확대
- [x] 시간표 타인 수업 노출 버그 수정 (user_id 필터 추가)
- [x] 홈 오늘 수업 타인 수업 노출 버그 수정
- [x] 마이페이지 내 게시글 조회 버그 수정 (comment_count → post_comments(count))
- [x] PostDetailScreen — 내 글이면 수정/삭제 메뉴(···), 타인 글이면 신고
- [x] MyPostsScreen 새로 추가 — 전체 목록, 수정/삭제 버튼, 포커스 시 새로고침
- [x] PostEditScreen 새로 추가 — 제목/본문 수정
- [x] 마이페이지 게시글 5개 미리보기 + "すべて見る" 버튼
- [x] ProfileScreen 포커스 리스너 추가 — MyPosts 삭제 후 목록 동기화
- [x] 각 탭 헤더 글씨 크기 확대 (20→24, 22→26)
- [x] 세부 탭 글씨 크기 확대 (14→16, paddingVertical 12→14)
- [x] ··· 버튼 크기 확대 (12→22)
- [x] 홈 최신 게시글 3개 표시 — 전체 유저 대상 이미 구현됨 확인
- [x] 인기글 기능 판단 — 구현 가능, 사용자 증가 후 전환 예정

## 🔵 묶음 3.5 — 학교별 데이터 격리 ✅ 완료 (2026-05-07)
- [x] `posts` / `course_reviews` 테이블에 `university` 컬럼 추가
- [x] `PostCreateScreen` INSERT 시 `university` 필드 포함
- [x] `CourseReviewCreateScreen` INSERT 시 `university` 필드 포함
- [x] Supabase RLS 정책 전면 교체 (5개 테이블 — SECURITY DEFINER 함수로 무한재귀 방지)
- [x] 대학 목록 확장 — 大阪国際大学(oiu.jp), 日本文理大学(nbu.ac.jp) 추가 → **총 17개 대학**
- [x] E2E Playwright 테스트 24개 전부 통과 (Chrome / 모바일 Chrome / Safari)
  - 달력 날짜 선택 방식으로 AS-3/AS-5 수정
  - 카테고리 라벨 수정 (フリー → 自由) C-4
  - strict mode 위반 수정 (T-2, T-3)
  - supabaseHelper upsert로 테스트 계정 닉네임 보장

## 🟢 묶음 4 — 콘텐츠 확장 (진행 중)
- [x] 학교 추가 — 17개 대학 지원 중 (묶음 3.5에서 완료)
- [x] 학교별 교시 시간(periodRanges) 추가 — 14개 학교 실제 시간 반영 (2026-05-10)
  - 100분 수업: 神奈川大, 東海大 / 105분: 亜細亜大, 拓殖大 / 50분: 玉川大 등
  - 東京電機大, 大阪国際大는 시간 미공개로 국사관 기본값 유지
- [x] universityLinks 업데이트 — lmsUrl/lmsLabel 필드 추가 (WebClass, UNIPA, Open LMS 등)
- [x] HomeScreen — manaba 없는 학교에 lmsLabel(WebClass 등) 표시
- [x] CLAUDE.md — 새 학교 추가 체크리스트 추가
- [x] 모바일 UI 최적화 완료 (2026-05-10)
  - A-4: 하단 탭바 겹침 — paddingBottom 84로 통일 (홈/과제/시간표)
  - A-2: 키보드 가림 — PostCreateScreen, CourseReviewCreateScreen KeyboardAvoidingView 추가
  - C-2: 긴 텍스트 줄임 — 홈/프로필/강의평가 4곳 numberOfLines 추가
  - D-1: CourseReviewScreen key={index} 버그 수정
  - C-3, B-2: 이미 구현 완료 확인

## 🟢 묶음 5 — 새 기능
- [ ] 게시판 사진 업로드
- [ ] 온보딩 초기 설정 화면 (아이폰 스타일)
- [ ] 시간표 수업 목록 자동 불러오기

---

# 국사관대학 교시 시간표

1限 9:00~10:30 / 2限 10:45~12:15 / 3限 12:55~14:25 / 4限 14:40~16:10 / 5限 16:25~17:55 / 6限 18:10~19:40

---

# 🎯 핵심 기능 개발 로드맵

## 프로젝트 최종 목표

**"이 앱 하나로 일본 대학교 학교생활이 가능하게 한다"**

학생이 학교 홈페이지에 직접 접속하지 않아도:
1. 학교 공지사항을 앱에서 바로 확인
2. 새 공지가 올라오면 푸시 알림으로 즉시 알림
3. 알림 탭 → 앱 안에서 상세 내용 확인

## 확정된 기술 스택

| 역할 | 기술 |
|---|---|
| 프론트엔드 | React Native + Expo (iOS/Android 정식 앱) |
| DB/인증 | Supabase |
| 푸시 알림 | Expo Notifications + FCM |
| 서버 크론 | Vercel Cron Jobs 또는 Supabase Edge Functions |
| HTML 파싱 | cheerio |
| WebView | react-native-webview |
| 쿠키 관리 | @react-native-cookies/cookies |

## 핵심 기술적 결정사항 (변경 금지)

### ✅ 정식 네이티브 앱 (PWA ❌)
iOS App Store + Google Play 출시 목표. React Native + Expo 유지.

### ✅ 학교 시스템 접근: WebView 로그인
학생이 앱 안의 WebView에서 학교 포털에 직접 로그인.
**유니패스 서버에 비밀번호 절대 저장 금지.**

### ✅ 세션 유지: 쿠키 영속 저장 (Cookie Persistence)
- 자동 재로그인(Silent Login) 방식 ❌ — 비밀번호 저장 보안 리스크 + 학교 봇 정책 위반 우려
- @react-native-cookies/cookies로 쿠키를 폰 보안 저장소에 영속 보관
- 학기당 1~2회 재로그인 수준이면 충분

### ✅ 첫 타겟: 국사관대학 manaba
일본 80% 대학이 manaba 사용 → manaba 파서 1개로 다수 학교 재사용 가능.
단, 학교마다 manaba 버전/커스터마이징이 달라 2~3개 학교 구현 후 공통 부분 추출 필요.

## 개발 순서 (Phase)

### Phase 1: WebView + manaba 파싱
**목표:** 국사관대학 학생이 앱에서 manaba 공지사항을 볼 수 있다.

완료 기준:
- [ ] 학생이 앱에서 manaba 로그인 가능
- [ ] manaba 공지사항이 앱에 리스트로 표시됨
- [ ] 공지 탭하면 상세 내용 확인 가능

### Phase 2: 쿠키 영속 저장으로 세션 유지
**목표:** 한 번 로그인하면 앱을 껐다 켜도 로그인 상태 유지.

완료 기준:
- [ ] 앱 재시작 후에도 로그인 상태 유지
- [ ] 쿠키 만료 시 재로그인 화면으로 안내
- [ ] 학기당 1~2회 정도만 재로그인 발생

### Phase 3: 푸시 알림 인프라 (수동 발송)
**목표:** 수동으로 푸시를 보내면 학생 폰에 알림이 뜬다.

완료 기준:
- [ ] 앱 첫 실행 시 푸시 권한 요청
- [ ] 푸시 토큰이 Supabase push_tokens 테이블에 저장됨
- [ ] 관리자 수동 푸시 → 학생 폰에 도착
- [ ] 알림 탭 시 해당 공지 화면으로 이동

### Phase 4: 새 공지 자동 감지 → 자동 푸시
**목표:** 서버가 주기적으로 manaba를 체크해 새 공지 시 자동 푸시.

완료 기준:
- [ ] 서버 크론이 10~30분마다 정상 실행
- [ ] 새 공지 발견 시 자동으로 푸시 발송
- [ ] 학생이 알림 탭하면 해당 공지 화면으로 이동
- [ ] **학교 이용약관 위반 없음 확인 (가장 중요)**

## 학교 추가 전략

| 단계 | 전략 |
|---|---|
| Phase 1~4 동안 | 국사관대학 1개에만 집중 |
| 2~3번째 학교 | manaba 사용 학교 우선, 설정을 `/data/schools/{id}.json`으로 분리 |
| 5개 이상 | CLI 자동화 도구 (`npm run add-school`) + Claude API로 학교 시스템 자동 감지 |

## 보안 및 법적 필수 사항

- 학생 비밀번호는 절대 서버에 저장하지 않음
- 쿠키는 반드시 암호화 저장 (pgcrypto 등)
- 학생 탈퇴 시 모든 데이터 즉시 삭제
- 각 학교 이용약관에서 자동화 봇 금지 조항 확인
- 학교 서버 과부하 방지 — 요청 분산 처리 필수
- 프라이버시 정책(プライバシーポリシー) 명시 필수

## 절대 하지 말 것 ❌

1. 학생 비밀번호를 유니패스 서버에 저장
2. 쿠키 평문 저장 (반드시 암호화)
3. 학교 서버에 과도한 동시 요청 (IP 차단 위험)
4. PWA로 회귀 (정식 네이티브 앱 유지)
5. 자동 재로그인(Silent Login) 방식 채택
6. Phase 1~4 동안 여러 학교 동시 구현

## 작업 시작 방법

새 대화에서 아래처럼 말하면 이 CLAUDE.md를 참고해서 해당 Phase 작업을 진행함:
- `"Unipas Phase 1 작업 시작할게"` → WebView + manaba 파싱
- `"Unipas Phase 2 작업 시작할게"` → 쿠키 영속 저장
- `"Unipas Phase 3 작업 시작할게"` → 푸시 알림 인프라
- `"Unipas Phase 4 작업 시작할게"` → 자동 감지 + 자동 푸시

## 진행 체크리스트

- [ ] Phase 1: WebView + manaba 파싱 (국사관)
- [ ] Phase 2: 쿠키 영속 저장으로 세션 유지
- [ ] Phase 3: 푸시 알림 인프라 (수동 발송까지)
- [ ] Phase 4: 새 공지 자동 감지 → 자동 푸시
- [ ] 두 번째 학교 추가 (Phase 1~4 완료 후)
- [ ] 학교 추가 자동화 CLI (5개 학교 이상 시)
