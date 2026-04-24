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

# Supabase 설정 완료 현황 (2026-04-24 기준)

- [x] Authentication → Email → **"Confirm email" ON** (OTP 인증 활성화, 2026-04-24 변경)
- [x] `profiles.school_email` 컬럼 추가 완료
- [x] `profiles.student_id` 컬럼 추가 완료 (SQL Editor에서 직접 추가 필요)
- [x] `profiles.share_timetable` 컬럼 추가 완료
- [x] `posts_category_check` 제약조건 (qa/free/secret/info) 변경 완료
- [x] `increment_like` RPC 함수 생성 완료
- [x] `post_reports` 테이블 + RLS 정책 생성 완료

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

# 향후 예정 작업
- **RevenueCAT MCP** — 프리미엄 기능 개발 시작 전에 추가할 것 (작업 전 사용자에게 먼저 확인)

---

# 국사관대학 교시 시간표

1限 9:00~10:30 / 2限 10:45~12:15 / 3限 12:55~14:25 / 4限 14:40~16:10 / 5限 16:25~17:55 / 6限 18:10~19:40
