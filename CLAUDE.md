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
├── e2e/                  Playwright E2E 테스트
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

**`src/constants/universities.js`**
- [ ] `id`, `name`, `location`, `emailDomain`, `campuses`
- [ ] `periodRanges`: 학교 공식 홈페이지에서 "時限 時間割" 검색 → 없으면 생략 (국사관 기본값 자동 사용)

**`src/constants/universityLinks.js`**
- [ ] `homepageUrl`: 필수
- [ ] `manabaUrl`: manaba.jp 도메인 확인된 경우에만
- [ ] `lmsUrl` + `lmsLabel`: manaba 미사용 시 (WebClass, Blackboard, UNIPA 등)
- [ ] `syllabusUrl`: 외부 공개 URL만 (로그인 필요 URL 생략)

---

# 향후 예정 작업

## 묶음 5 (진행 중)
- [x] 게시판 사진 업로드 (2026-05-12 완료)
- [ ] 온보딩 초기 설정 화면 (아이폰 스타일)
- [ ] 시간표 수업 목록 자동 불러오기

## 묶음 5 이후
- [ ] Phase 1 재개 (WebView + manaba 파싱) — Development Build 전환 필요
- [ ] Face ID / 지문 인증 — Development Build 전환 시 함께 적용 가능
- [ ] RevenueCAT MCP — 프리미엄 기능 개발 시작 전 추가 (작업 전 사용자 확인 필요)

---

# 핵심 기능 개발 로드맵

**목표:** 학생이 앱에서 학교 공지사항 확인 + 새 공지 푸시 알림

| Phase | 내용 | 상태 |
|---|---|---|
| Phase 1 | WebView + manaba 파싱 (국사관) | ⏸️ 보류 (Development Build 필요) |
| Phase 2 | 쿠키 영속 저장 (세션 유지) | 🔲 미시작 |
| Phase 3 | 푸시 알림 인프라 (수동 발송) | 🔲 미시작 |
| Phase 4 | 새 공지 자동 감지 → 자동 푸시 | 🔲 미시작 |

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
- 학교 시스템 접근: WebView 로그인 — **비밀번호 서버 저장 절대 금지**
- 세션 유지: 쿠키 영속 저장 — 자동 재로그인(Silent Login) ❌
- Phase 1~4 동안 국사관대학 1개에만 집중
- 학교 서버 과부하 방지 (요청 분산), 학교 이용약관 봇 금지 조항 확인 필수

**Phase 1 시작:** `"Unipas Phase 1 작업 시작할게"` 라고 말하면 바로 진행
