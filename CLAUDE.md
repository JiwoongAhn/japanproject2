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
npx expo start --web --port 8083
```
웹 브라우저(localhost:8083)로 개발 중. Expo Go 앱으로 실기기 확인도 가능.

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
- **학교 인증 이메일 형식:** `{학적번호}@{대학ID}.unipas` (예: `A1234567@kokushikan.unipas`)
- **MCP:** `~/.claude.json` 에 등록됨 — Supabase MCP 툴로 DB 조작 가능

---

# 구현 완료된 기능 (2026-04-16 기준)

| 탭 | 기능 |
|---|---|
| 공통 | 학교 선택 → 포털 로그인 → ac.jp 이메일 인증 (3단계 인증 플로우) |
| 공통 | AuthProvider / useAuth 훅, LargeSecureStore 세션 암호화 저장 |
| 홈 | 오늘 수업·D-3 과제·최신 게시글 실시간 표시, 학번 포함 인사말 |
| 홈 | 学校情報 그리드 (manaba/kaede-i/홈페이지 실제 URL 연결) |
| 시간표 | 요일×6교시 그리드, 수업 추가/삭제, 오늘 요일 강조 |
| 시간표 | 강의평가 목록·상세·작성 (별점·태그·코멘트, Supabase 연결) |
| 시간표 | 공강맞추기 (5×6 터치 그리드, 친구 ID 비교) |
| 과제 | 목록·추가·상태 토글·삭제, 인라인 달력 날짜 선택, 필터별 빈 상태 UX |
| 게시판 | 글 목록 (카테고리·검색·20개씩 페이지네이션), 작성·상세·댓글, 익명 토글 |
| 게시판 | 신고 기능 (post_reports 테이블), 좋아요 (increment_like RPC) |
| マイページ | 프로필 카드, 요일 강조 색상 설정, 내가 올린 게시글 목록, 로그아웃 |

---

# 미실행 Supabase 마이그레이션

Supabase SQL Editor에서 직접 실행 필요한 항목:

```sql
-- 1. 카테고리 제약조건 변경
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_category_check;
ALTER TABLE posts ADD CONSTRAINT posts_category_check
  CHECK (category IN ('qa', 'free', 'secret', 'info'));

-- 2. 시간표 opt-in 공유
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS share_timetable BOOLEAN NOT NULL DEFAULT false;

-- 3. increment_like RPC (좋아요 RLS 우회)
CREATE OR REPLACE FUNCTION increment_like(post_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE posts SET like_count = like_count + 1 WHERE id = post_id;
END;
$$;

-- 4. post_reports 테이블 (신고 기능)
CREATE TABLE IF NOT EXISTS post_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (reason IN ('insult', 'abuse', 'defamation')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (post_id, user_id)
);
ALTER TABLE post_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "로그인 사용자 신고 가능" ON post_reports FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "본인 신고 내역 조회" ON post_reports FOR SELECT USING (auth.uid() = user_id);
```

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

# 향후 예정 작업
- **RevenueCAT MCP** — 프리미엄 기능 개발 시작 전에 추가할 것 (작업 전 사용자에게 먼저 확인)

---

# 국사관대학 교시 시간표

1限 9:00~10:30 / 2限 10:45~12:15 / 3限 12:55~14:25 / 4限 14:40~16:10 / 5限 16:25~17:55 / 6限 18:10~19:40
