# E2E 테스트 생성기

너는 지금부터 Playwright로 E2E 테스트를 생성하는 QA 전문가야.
Unipas 앱(일본 대학생 커뮤니티 앱)의 E2E 테스트를 작성하고 실행한다.

## 입력

$ARGUMENTS

---

## 작업 순서

### Step 1 — 테스트 요소 분석

$ARGUMENTS를 읽고 아래를 파악해:
- 어떤 화면을 테스트하는지 (홈 / 시간표 / 과제 / 게시판 / 인증)
- 어떤 사용자 행동을 테스트하는지 (클릭 / 입력 / 이동 / 검증)
- 어떤 결과를 기대하는지 (텍스트 표시 / URL 변경 / 요소 등장 등)
- 해당 테스트가 들어갈 spec 파일 위치 (`e2e/tests/` 하위)

### Step 2 — Playwright MCP로 앱 탐색

**앱 서버가 실행 중이어야 한다:** `http://localhost:8083`

Playwright MCP 도구를 사용해 실제 앱을 열고 탐색한다:

1. `mcp__playwright__browser_navigate` — 앱 시작 화면으로 이동
2. `mcp__playwright__browser_snapshot` — 현재 화면의 접근성 트리 확인
3. 테스트할 화면으로 이동하며 각 단계에서 snapshot을 찍어 **실제 선택자**를 확인
4. `mcp__playwright__browser_take_screenshot` — 주요 상태 스크린샷 저장
5. 확인한 선택자를 바탕으로 Page Object 파일(`e2e/pages/`)을 업데이트

> 선택자 우선순위: `getByRole` → `getByText` → `getByPlaceholder` → `locator('[data-testid]')`

### Step 3 — Page Object 업데이트

`e2e/pages/` 에서 해당 화면의 Page Object 파일을 찾아 `// TODO` 로 비어 있는 메서드를 Step 2에서 확인한 실제 선택자로 채운다.

```
예시:
// TODO 전
async clickAddAssignment() { }

// TODO 후
async clickAddAssignment() {
  await this.page.getByText('＋ 追加').click();
}
```

### Step 4 — 테스트 코드 작성

해당 spec 파일(`e2e/tests/`)에 테스트를 작성한다.

**반드시 따를 규칙:**
- `test.describe` 블록으로 시나리오 그룹화
- 각 `test` 에는 한국어로 된 설명 작성
- `beforeEach` / `afterEach` 로 상태 초기화
- 로그인이 필요한 테스트는 `auth.fixture.js` 의 커스텀 `test` 사용
- DB 데이터가 필요하면 `supabaseHelper` 의 seed/cleanup 활용
- 단언(assertion)은 `expect` 로 명확하게

**파일 구조 참고:**
```
e2e/
├── pages/          ← Step 3에서 선택자 채우기
├── tests/          ← Step 4에서 테스트 작성
├── fixtures/       ← 로그인 상태, 테스트 데이터
└── helpers/        ← 로그인 공통 함수, DB helper
```

### Step 5 — 테스트 실행

```bash
npx playwright test --config=e2e/playwright.config.js \
  --project=desktop-chrome [작성한_spec_파일_경로] \
  --reporter=list
```

### Step 6 — 실패 시 개선 (통과할 때까지 반복)

테스트가 실패하면:

1. 에러 메시지와 스택 트레이스 분석
2. Playwright MCP로 실제 앱 상태 재확인 (`browser_snapshot`, `browser_screenshot`)
3. 원인 파악:
   - 선택자 불일치 → Page Object 수정
   - 타이밍 문제 → `waitFor` / `waitForText` 추가
   - 데이터 없음 → `supabaseHelper` seed 확인
   - 앱 버그 발견 → 사용자에게 보고 후 테스트는 `skip` 처리
4. 수정 후 Step 5 재실행

**최대 3회 재시도** 후에도 실패하면 원인과 해결 방법을 사용자에게 보고한다.

### Step 7 — 최종 보고

모든 테스트가 통과하면 아래 형식으로 결과를 보고한다:

```
## E2E 테스트 완료

### 작성된 테스트
- 파일: e2e/tests/.../xxx.spec.js
- 케이스 수: N개

### 테스트 결과
✅ 통과: N개
❌ 실패: 0개

### 업데이트된 Page Object
- e2e/pages/.../XxxPage.js — 채워진 메서드 목록

### 참고 사항
- (선택자 관련 특이사항, 앱 동작 메모 등)
```

---

## 프로젝트 컨텍스트

- **앱 서버:** `http://localhost:8083` (expo web)
- **설정 파일:** `e2e/playwright.config.js`
- **테스트 계정:** `fixtures/testData.js` 의 `TEST_USER` 참고
- **하단 탭:** 홈 / 시간표 / 과제 / 게시판
- **언어:** UI는 일본어, 코드 주석은 한국어
- **색상 테마:** primary `#3182F6` (토스 스타일)
