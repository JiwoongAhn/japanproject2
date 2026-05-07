/**
 * login.spec.js — 인증 플로우 E2E 테스트
 *
 * 커버하는 시나리오:
 *  A-3: 학교 선택 → 이메일 입력 → 버튼 활성화 확인
 *  A-5: 이메일 비어있으면 전송 버튼 비활성화
 *
 * NOTE: OTP 코드 입력 → 홈 화면 이동은 실제 이메일 수신이 필요해
 *       E2E 자동화 불가. 로그인 완료 시나리오는 auth.fixture의
 *       magic link 방식으로 다른 테스트에서 간접 검증합니다.
 */

const { test, expect } = require('@playwright/test');
const { UniversitySelectPage } = require('../../pages/auth/UniversitySelectPage');
const { SchoolPortalAuthPage } = require('../../pages/auth/SchoolPortalAuthPage');
const { TEST_USER } = require('../../fixtures/testData');

test.describe('인증 플로우', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('A-3: 학교 선택 후 이메일 입력 시 전송 버튼이 활성화된다', async ({ page }) => {
    const universityPage = new UniversitySelectPage(page);
    const authPage = new SchoolPortalAuthPage(page);

    // 학교 선택 화면 확인
    await expect(page.getByText('大学を選んでください')).toBeVisible({ timeout: 10000 });

    // 학교 선택
    await universityPage.selectUniversity(TEST_USER.universityName);

    // 이메일 입력 화면으로 이동 확인
    await expect(page.getByText('認証コードを送信', { exact: true })).toBeVisible({ timeout: 5000 });

    // 이메일 입력 전 — 버튼 비활성화
    expect(await authPage.isSendButtonEnabled()).toBe(false);

    // 학교 이메일 입력
    await authPage.fillEmail(`A1234567@kokushikan.ac.jp`);

    // 이메일 입력 후 — 버튼 활성화
    expect(await authPage.isSendButtonEnabled()).toBe(true);
  });

  test('A-5: 이메일이 비어있으면 전송 버튼이 비활성화된다', async ({ page }) => {
    const universityPage = new UniversitySelectPage(page);
    const authPage = new SchoolPortalAuthPage(page);

    await expect(page.getByText('大学を選んでください')).toBeVisible({ timeout: 10000 });
    await universityPage.selectUniversity(TEST_USER.universityName);
    await expect(page.getByText('認証コードを送信', { exact: true })).toBeVisible({ timeout: 5000 });

    // 아무것도 입력하지 않은 상태 — 비활성화
    expect(await authPage.isSendButtonEnabled()).toBe(false);

    // 이메일 입력 — 활성화
    await authPage.fillEmail('A9999999@kokushikan.ac.jp');
    expect(await authPage.isSendButtonEnabled()).toBe(true);

    // 이메일 지우기 — 다시 비활성화
    await authPage.fillEmail('');
    expect(await authPage.isSendButtonEnabled()).toBe(false);
  });
});
