/**
 * assignment.spec.js — 과제 E2E 테스트
 *
 * 커버하는 시나리오:
 *  AS-3: 과제 추가 폼 작성 후 저장 → 과제 목록으로 돌아옴
 *        (주의: AssignmentAddScreen은 현재 MOCK 데이터 단계 — DB 저장 없이 화면만 goBack)
 *  AS-5: 필수 항목 미입력 시 저장 버튼이 비활성화된다
 */

const { test } = require('../../fixtures/auth.fixture');
const { expect } = require('@playwright/test');
const { AssignmentPage } = require('../../pages/assignment/AssignmentPage');
const { AssignmentAddPage } = require('../../pages/assignment/AssignmentAddPage');
const { TEST_ASSIGNMENT } = require('../../fixtures/testData');

test.describe('과제', () => {
  test('AS-3: 과제 추가 폼을 작성하고 저장하면 과제 목록 화면으로 돌아온다', async ({ loggedInPage }) => {
    const page = loggedInPage;
    const assignment = new AssignmentPage(page);
    const addPage = new AssignmentAddPage(page);

    // 과제 탭으로 이동
    await assignment.goToAssignmentTab();

    // ＋ 追加 버튼 클릭
    await assignment.clickAddAssignment();

    // 과제 추가 화면 열림 확인
    await expect(page.getByText('課題を追加')).toBeVisible({ timeout: 5000 });

    // 폼 입력
    await addPage.fillCourseName(TEST_ASSIGNMENT.courseName);
    await addPage.fillTitle(TEST_ASSIGNMENT.title);
    // dueDate: '20271231' → formatDueDate가 '2027-12-31'로 변환
    await addPage.fillDueDate('2027-12-31');

    // 저장 버튼 클릭
    await addPage.submit();

    // 과제 목록 화면으로 돌아옴 확인 (課題 헤더 텍스트 표시)
    await expect(page.getByText('課題').first()).toBeVisible({ timeout: 5000 });
    // 과제 추가 화면이 사라짐 확인
    await expect(page.getByText('課題を追加')).not.toBeVisible({ timeout: 3000 });
  });

  test('AS-5: 필수 항목(과목명, 제목, 마감일) 미입력 시 저장 버튼이 비활성화된다', async ({ loggedInPage }) => {
    const page = loggedInPage;
    const assignment = new AssignmentPage(page);

    // 과제 탭으로 이동 후 추가 화면 열기
    await assignment.goToAssignmentTab();
    await assignment.clickAddAssignment();
    await expect(page.getByText('課題を追加')).toBeVisible({ timeout: 5000 });

    // React Native Web: disabled 버튼은 opacity 0.5 적용 (toBeDisabled() 미지원)
    const getSaveBtnOpacity = () =>
      page.getByText('保存する').last().evaluate((el) => {
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

    // 과목명만 입력 — 여전히 비활성화
    await page.getByPlaceholder('例: 経営学概論').last().fill('テスト科目');
    expect(await getSaveBtnOpacity()).toBeLessThan(1);

    // 과제 제목까지 입력 — 여전히 비활성화 (마감일 미입력)
    await page.getByPlaceholder('例: 第3章 レポート提出').fill('テスト課題');
    expect(await getSaveBtnOpacity()).toBeLessThan(1);

    // 마감일까지 입력 — opacity 1.0 (활성화)
    await page.getByPlaceholder('例: 2026-04-15').fill('2027-12-31');
    expect(await getSaveBtnOpacity()).toBe(1);
  });
});
