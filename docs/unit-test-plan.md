# Unipas 유닛 테스트 계획서

작성일: 2026-04-13

---

## 사전 작업: 함수 추출 리팩토링

테스트 전 아래 로직들을 `src/utils/`로 분리해야 합니다.

| 분리할 파일 | 추출 대상 함수 | 현재 위치 |
|---|---|---|
| `src/utils/timetable.js` | `calculateFreePeriods()` | `FreeTimeScreen.js` |
| `src/utils/timetable.js` | `getCourseStatus()` | `HomeScreen.js` |
| `src/utils/assignment.js` | `calcDday()` | `AssignmentScreen.js` |
| `src/utils/assignment.js` | `getDdayColor()` | `HomeScreen.js` |
| `src/utils/assignment.js` | `formatDueDate()` (자동 하이픈) | `AssignmentAddScreen.js` |
| `src/utils/assignment.js` | `isAssignmentFormValid()` | `AssignmentAddScreen.js` |
| `src/utils/date.js` | `getTodayStr()` | `HomeScreen.js` |
| `src/utils/community.js` | `formatTimeAgo()` | `PostListScreen.js` |
| `src/utils/auth.js` | `buildEmail()` | `SchoolPortalAuthScreen.js` |
| `src/utils/review.js` | `toggleTag()`, `addCustomTag()` | `CourseReviewCreateScreen.js` |

---

## 테스트 파일 구조

```
__tests__/
├── utils/
│   ├── timetable.test.js       (11개)
│   ├── assignment.test.js      (22개)
│   ├── date.test.js            (2개)
│   ├── community.test.js       (7개)
│   ├── auth.test.js            (4개)
│   └── review.test.js          (8개)
├── constants/
│   └── boardCategories.test.js (5개)
└── lib/
    └── LargeSecureStore.test.js (7개)
```

**총합: 66개 테스트 케이스**

---

## 테스트 도구

- **Jest** + **jest-expo** (현재 미설치, 작성 전 세팅 필요)

---

## 1. timetable.test.js (11개)

### `calculateFreePeriods(courses)`

| # | 테스트명 | 입력 | 기대 결과 |
|---|---|---|---|
| T-01 | 수업 0개 → 공강 40개 전부 | `[]` | length === 40 |
| T-02 | 수업 40개 (월~금 × 8교시 전부) → 공강 0개 | 40개 course 배열 | length === 0 |
| T-03 | 월요일 1교시 수업 1개 → 해당 칸 제외 39개 | `[{day_of_week:0, period:1}]` | length === 39, `{day:0,period:1}` 미포함 |
| T-04 | 같은 칸 중복 입력 시 Set으로 중복 제거 | `[{day_of_week:0,period:1}, {day_of_week:0,period:1}]` | length === 39 |
| T-05 | 반환 결과에 토요일(day=5) 없음 | 임의 입력 | 결과 내 day >= 5 항목 없음 |
| T-06 | 반환 결과에 9교시(period=9) 없음 | 임의 입력 | 결과 내 period >= 9 항목 없음 |

### `getCourseStatus(period, nowMin, todayCoursesSorted)`

| # | 테스트명 | 입력 | 기대 결과 |
|---|---|---|---|
| T-07 | 수업 시간 중 → `'進行中'` | period=1, nowMin=570(9:30) | `'進行中'` |
| T-08 | 수업 시작 전, 당일 다음 수업 → `'次の授業'` | period=2, nowMin=500(8:20), courses=[period2] | `'次の授業'` |
| T-09 | 수업 종료 후 → `'終了'` | period=1, nowMin=700(11:40) | `'終了'` |
| T-10 | 시작 전이지만 다음 수업 아님 → `'未開始'` | period=3, nowMin=500, courses=[period2,period3] | `'未開始'` |
| T-11 | 존재하지 않는 교시(period=9) → `'未開始'` | period=9 | `'未開始'` |

---

## 2. assignment.test.js (22개)

### `calcDday(dueDateStr)`

| # | 테스트명 | 입력 | 기대 결과 |
|---|---|---|---|
| A-01 | 오늘 마감 → D-Day | 오늘 날짜 문자열 | `{ label: 'D-Day', isUrgent: true }` |
| A-02 | 내일 마감 → D-1 | 내일 날짜 | `{ label: 'D-1', isUrgent: true }` |
| A-03 | 3일 후 마감 → D-3, 긴급 | 3일 후 | `{ label: 'D-3', isUrgent: true }` |
| A-04 | 4일 후 마감 → D-4, 긴급 아님 | 4일 후 | `{ label: 'D-4', isUrgent: false }` |
| A-05 | 어제 마감 → D+1, 긴급 | 어제 날짜 | `{ label: 'D+1', isUrgent: true }` |
| A-06 | 10일 전 마감 → D+10 | 10일 전 | `{ label: 'D+10', isUrgent: true }` |

### `getDdayColor(dday)`

| # | 테스트명 | 입력 | 기대 결과 |
|---|---|---|---|
| A-07 | dday=0 → warning 색상 | `0` | `colors.warning` |
| A-08 | dday=1 → warning 색상 | `1` | `colors.warning` |
| A-09 | dday=2 → primary 색상 | `2` | `colors.primary` |
| A-10 | dday=3 → primary 색상 | `3` | `colors.primary` |
| A-11 | dday=4 → secondary 색상 | `4` | `colors.textSecondary` |
| A-12 | dday 음수(지남) → warning 색상 | `-1` | `colors.warning` |

### `formatDueDate(text)` (자동 하이픈)

| # | 테스트명 | 입력 | 기대 결과 |
|---|---|---|---|
| A-13 | 4자리 이하 → 그대로 | `"2026"` | `"2026"` |
| A-14 | 5~6자리 → 4자리-나머지 | `"202604"` | `"2026-04"` |
| A-15 | 7~8자리 → YYYY-MM-DD | `"20260415"` | `"2026-04-15"` |
| A-16 | 숫자 아닌 문자 포함 시 제거 | `"2026/04/15"` | `"2026-04-15"` |
| A-17 | 8자리 초과 입력 시 잘라냄 | `"202604151234"` | `"2026-04-15"` |

### `isAssignmentFormValid(courseName, title, dueDate)`

| # | 테스트명 | 입력 | 기대 결과 |
|---|---|---|---|
| A-18 | 모두 입력 → 유효 | courseName+title+`"2026-04-15"` | `true` |
| A-19 | 수업명 없음 → 무효 | courseName 빈 문자열 | `false` |
| A-20 | 제목 없음 → 무효 | title 빈 문자열 | `false` |
| A-21 | 날짜 형식 틀림 → 무효 | `"2026/04/15"` | `false` |
| A-22 | 날짜 불완전 → 무효 | `"2026-04"` | `false` |

---

## 3. date.test.js (2개)

### `getTodayStr()`

| # | 테스트명 | 기대 결과 |
|---|---|---|
| D-01 | 반환값이 `YYYY-MM-DD` 형식 | `/^\d{4}-\d{2}-\d{2}$/` 정규식 매치 |
| D-02 | Jest의 `Date` 고정 후 정확한 날짜 반환 | `jest.setSystemTime`으로 날짜 고정 후 검증 |

---

## 4. community.test.js (7개)

### `formatTimeAgo(timestamp)`

| # | 테스트명 | 입력 | 기대 결과 |
|---|---|---|---|
| C-01 | 30초 전 → `'たった今'` | now - 30s | `'たった今'` |
| C-02 | 10분 전 → `'10分前'` | now - 10min | `'10分前'` |
| C-03 | 59분 전 → `'59分前'` | now - 59min | `'59分前'` |
| C-04 | 1시간 전 → `'1時間前'` | now - 60min | `'1時間前'` |
| C-05 | 23시간 전 → `'23時間前'` | now - 23h | `'23時間前'` |
| C-06 | 1일 전 → `'1日前'` | now - 24h | `'1日前'` |
| C-07 | 3일 전 → `'3日前'` | now - 72h | `'3日前'` |

---

## 5. auth.test.js (4개)

### `buildEmail(studentId, universityId)`

| # | 테스트명 | 입력 | 기대 결과 |
|---|---|---|---|
| AU-01 | 정상 조합 | `("A1234567", "kokushikan")` | `"A1234567@kokushikan.unipas"` |
| AU-02 | 학적번호 앞뒤 공백 제거 | `("  A1234567  ", "kokushikan")` | `"A1234567@kokushikan.unipas"` |
| AU-03 | 대학 ID null → 기본값 `kokushikan` | `("A1234567", null)` | `"A1234567@kokushikan.unipas"` |
| AU-04 | 대학 ID undefined → 기본값 `kokushikan` | `("A1234567", undefined)` | `"A1234567@kokushikan.unipas"` |

---

## 6. review.test.js (8개)

### `toggleTag(tag, selectedTags)`

| # | 테스트명 | 입력 | 기대 결과 |
|---|---|---|---|
| R-01 | 없는 태그 추가 | `("わかりやすい", [])` | `["わかりやすい"]` |
| R-02 | 있는 태그 토글 → 제거 | `("わかりやすい", ["わかりやすい"])` | `[]` |
| R-03 | 기존 태그 유지하며 추가 | `("おすすめ", ["わかりやすい"])` | `["わかりやすい", "おすすめ"]` |

### `addCustomTag(tag, selectedTags)`

| # | 테스트명 | 입력 | 기대 결과 |
|---|---|---|---|
| R-04 | 정상 태그 추가 | `("自由記述", [])` | `["自由記述"]` |
| R-05 | 빈 문자열 → 추가 안 됨 | `("", [])` | `[]` |
| R-06 | 공백만 → 추가 안 됨 | `("   ", [])` | `[]` |
| R-07 | 중복 태그 → 추가 안 됨 | `("わかりやすい", ["わかりやすい"])` | `["わかりやすい"]` |
| R-08 | 8개 초과 → 추가 안 됨 | 8개 태그 있을 때 추가 시도 | 여전히 8개 |

---

## 7. boardCategories.test.js (5개)

### `getCategoryInfo(key)`

| # | 테스트명 | 입력 | 기대 결과 |
|---|---|---|---|
| B-01 | `'qa'` → 質問 카테고리 | `'qa'` | `{ key: 'qa', label: '質問' }` |
| B-02 | `'free'` → フリー 카테고리 | `'free'` | `{ key: 'free', label: 'フリー' }` |
| B-03 | `'flea'` → フリマ 카테고리 | `'flea'` | `{ key: 'flea', label: 'フリマ' }` |
| B-04 | 없는 key → 첫 번째 카테고리 폴백 | `'unknown'` | `BOARD_CATEGORIES[0]` |
| B-05 | 빈 문자열 → 폴백 | `''` | `BOARD_CATEGORIES[0]` |

---

## 8. LargeSecureStore.test.js (7개)

| # | 테스트명 | 기대 결과 |
|---|---|---|
| L-01 | `setItem` → `getItem` 왕복 → 원본과 동일 | `"v"` |
| L-02 | 긴 문자열(JWT 토큰 길이) 왕복 테스트 | 1500자 문자열 저장 후 복원 동일 |
| L-03 | 한국어/일본어 유니코드 왕복 | `"テスト値"` 저장 후 복원 동일 |
| L-04 | `removeItem` 후 `getItem` → null | null |
| L-05 | 저장 안 한 key 조회 → null | null |
| L-06 | `setItem` 두 번 → 마지막 값으로 덮어쓰기 | 두 번째 값이 조회됨 |
| L-07 | 다른 key는 영향 없음 | key-A 삭제 시 key-B 그대로 |
