/**
 * timetable.spec.js — 시간표 E2E 테스트
 *
 * 커버하는 시나리오:
 *  T-2: 수업 추가 폼 입력 후 저장 → 시간표 그리드에 수업 표시
 *  T-3: 필수 항목 미입력 시 저장 버튼이 비활성화된다
 */

const { test } = require('../../fixtures/auth.fixture');
const { expect } = require('@playwright/test');
const { TimetablePage } = require('../../pages/timetable/TimetablePage');
const { CourseAddPage } = require('../../pages/timetable/CourseAddPage');
const { TEST_COURSE } = require('../../fixtures/testData');

test.describe('시간표', () => {
  test('T-2: 수업 추가 폼을 작성하고 저장하면 시간표 그리드에 수업이 표시된다', async ({ loggedInPage }) => {
    const page = loggedInPage;
    const timetable = new TimetablePage(page);
    const courseAdd = new CourseAddPage(page);

    // 시간표 탭으로 이동
    await timetable.goToTimetableTab();

    // 수업 추가 버튼 클릭
    await timetable.clickAddCourse();

    // 수업 추가 화면 열림 확인
    await expect(page.getByText('授業を追加')).toBeVisible({ timeout: 5000 });

    // 폼 입력
    await courseAdd.fillCourseName(TEST_COURSE.name);
    await courseAdd.selectDay(TEST_COURSE.day);
    await courseAdd.selectPeriod(TEST_COURSE.period);

    // 저장 버튼 클릭
    await courseAdd.submit();

    // 시간표 화면으로 돌아옴 확인 (헤더 타이틀 .first())
    await expect(page.getByText('時間割').first()).toBeVisible({ timeout: 10000 });

    // 추가한 수업이 그리드에 표시되는지 확인
    await expect(page.getByText(TEST_COURSE.name)).toBeVisible({ timeout: 5000 });
  });

  test('T-3: 필수 항목(과목명, 요일, 교시) 미입력 시 저장 버튼이 비활성화된다', async ({ loggedInPage }) => {
    const page = loggedInPage;
    const timetable = new TimetablePage(page);

    // 시간표 탭으로 이동 후 수업 추가 화면 열기
    await timetable.goToTimetableTab();
    await timetable.clickAddCourse();
    await expect(page.getByText('授業を追加')).toBeVisible({ timeout: 5000 });

    // React Native Web: disabled 버튼은 opacity 0.5 적용 (toBeDisabled() 미지원)
    const getSaveBtnOpacity = () =>
      page.getByText('保存する').evaluate((el) => {
        let cur = el;
        while (cur && cur !== document.body) {
          const op = parseFloat(window.getComputedStyle(cur).opacity);
          if (op < 1) return op;
          cur = cur.parentElement;
        }
        return 1;
      });

    // 아무것도 입력하지 않은 상태 — opacity < 1 (비활성화)
    expect(await getSaveBtnOpacity()).toBeLessThan(1);

    // 과목명만 입력 — 여전히 비활성화 (요일, 교시 미선택)
    await page.getByPlaceholder('例: 経営学概論').fill('テスト科目');
    expect(await getSaveBtnOpacity()).toBeLessThan(1);

    // 요일까지 선택 — 여전히 비활성화 (교시 미선택)
    await page.getByText('月', { exact: true }).last().click();
    expect(await getSaveBtnOpacity()).toBeLessThan(1);

    // 교시까지 선택 — opacity 1.0 (활성화)
    await page.getByText('1限').click();
    expect(await getSaveBtnOpacity()).toBe(1);
  });
});
