# 프로젝트 기본 정보
- 앱 이름: Unipas
- 목적: 일본 대학생을 위한 학교 생활 앱
- 기술 스택: React Native / Expo / JavaScript
- 백엔드: Supabase (API 키 미입력, 구조만 준비된 상태)
- 저장소: github.com/JiwoongAhn/japanproject2

# 코드 컨벤션
- 변수명: camelCase 영어
- 주석: 한국어
- 초보자도 이해할 수 있게 설명 포함

# 현재 완료된 것
- 회원가입 / 로그인 (인증)
- 하단 탭 네비게이션 4개 구조
- Supabase 테이블 구조 설계

# MVP 확정 범위
1단계: Supabase 연결 (API 키는 직접 입력 예정)
2단계: 시간표 (추가/삭제/그리드 표시) - 시간 겹침 감지 제외
3단계: 과제 (등록/상태 토글 3단계/D-day) - 푸시 알림 제외
4단계: 홈 화면 (오늘 수업 카드 + D-3 이하 과제 카드)
Post-MVP: 커뮤니티, WebView

# 현재 개발 환경
- 웹 브라우저로 개발 중
- 목표: Expo Go QR 연결로 전환

# 테스트 구조

## 유닛 테스트 (Jest)

- **실행:** `npm test`
- **위치:** `__tests__/`
- **대상:** `src/utils/` 와 `src/constants/`, `src/lib/` 의 순수 함수
- **총 케이스:** 66개 (8개 파일)

```
__tests__/
├── utils/
│   ├── timetable.test.js       (11개) calculateFreePeriods, getCourseStatus
│   ├── assignment.test.js      (22개) calcDday, getDdayColor, formatDueDate, isAssignmentFormValid
│   ├── date.test.js            (2개)  getTodayStr
│   ├── community.test.js       (7개)  formatTimeAgo
│   ├── auth.test.js            (4개)  buildEmail
│   └── review.test.js          (8개)  toggleTag, addCustomTag
├── constants/
│   └── boardCategories.test.js (5개)  getCategoryInfo
└── lib/
    └── LargeSecureStore.test.js (7개)  setItem, getItem, removeItem
```

화면 컴포넌트에 있던 순수 함수들은 `src/utils/` 로 분리되어 있음.
원본 화면 파일은 `import` 로 연결되어 동작은 동일하게 유지됨.

---

## E2E 테스트 (Playwright)

- **실행:** `npm run e2e`
- **UI 모드:** `npm run e2e:ui` (디버깅 편함)
- **리포트:** `npm run e2e:report`
- **위치:** `e2e/`
- **대상:** `expo start --web --port 8083` 으로 띄운 웹 버전

### 폴더 구조

```
e2e/
├── playwright.config.js    Chromium + 모바일 뷰포트(Pixel7, iPhone15) 설정
├── pages/                  Page Object Model — 화면별 선택자·액션 캡슐화
│   ├── BasePage.js         공통 기반 (탭 이동, waitForText 등)
│   ├── auth/               UniversitySelectPage, SchoolPortalAuthPage
│   ├── home/               HomePage
│   ├── timetable/          TimetablePage, CourseAddPage, CourseReviewPage
│   ├── assignment/         AssignmentPage, AssignmentAddPage
│   └── community/          PostListPage, PostDetailPage, PostCreatePage
├── tests/                  시나리오 파일 (spec)
│   ├── auth/login.spec.js
│   ├── home/home.spec.js
│   ├── timetable/timetable.spec.js, review.spec.js
│   ├── assignment/assignment.spec.js
│   └── community/community.spec.js
├── fixtures/
│   ├── testData.js         테스트용 계정·과제·게시글·수업 데이터 상수
│   └── auth.fixture.js     로그인 상태를 재사용하는 커스텀 fixture
└── helpers/
    ├── loginHelper.js      학교 선택 → 포털 로그인 공통 함수
    └── supabaseHelper.js   테스트 전후 DB seed / cleanup
```

### Page Object Model 패턴

버튼 위치나 선택자가 바뀌어도 `pages/` 파일 하나만 수정하면 모든 테스트에 반영됨.

```
tests/*.spec.js  →  pages/*.js (어떤 버튼인지)  →  실제 화면
```

### 나중에 모바일(Maestro 등)로 전환 시

| 폴더 | 재사용 여부 | 이유 |
|---|---|---|
| `tests/*.spec.js` | 95% 재사용 | 시나리오 흐름은 동일 |
| `fixtures/testData.js` | 100% 재사용 | 플랫폼 무관 |
| `helpers/supabaseHelper.js` | 100% 재사용 | DB 연동은 플랫폼 무관 |
| `pages/*.js` | 새로 작성 | CSS 선택자 → 네이티브 접근성 ID로 교체 필요 |

### 테스트 실행 전제 조건

1. `npx expo start --web --port 8083` 으로 앱 서버 실행
2. Supabase 연결 확인 (`.env` 파일에 키 입력)
3. `E2E_STUDENT_ID`, `E2E_PASSWORD` 환경변수 설정 (테스트 계정)

---

# Compact Instructions
/compact 실행 시 다음을 반드시 보존해줘:
- 현재 MVP 몇 단계 작업 중인지
- 작업 중인 화면/컴포넌트 이름
- 미완성이거나 에러 중인 항목과 시도한 방법
- 다음에 할 작업 목록
