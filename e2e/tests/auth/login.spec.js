/**
 * login.spec.js — 인증 플로우 E2E 테스트
 *
 * 커버하는 시나리오:
 *  A-3: 학교 선택 → 포털 로그인 성공 → 홈 화면 이동
 *  A-4: 잘못된 비밀번호 → 에러 Alert 표시
 *  A-5: 빈 입력 필드 → 로그인 버튼 비활성화
 */

const { test, expect } = require('@playwright/test');
const { UniversitySelectPage } = require('../../pages/auth/UniversitySelectPage');
const { SchoolPortalAuthPage } = require('../../pages/auth/SchoolPortalAuthPage');
const { TEST_USER } = require('../../fixtures/testData');

test.describe('인증 플로우', () => {
  test.beforeEach(async ({ page }) => {
    // 각 테스트마다 앱 초기 화면으로 이동 (세션 없는 상태)
    await page.goto('/');
  });

  test('A-3: 학교 선택 후 로그인하면 홈 화면으로 이동한다', async ({ page }) => {
    const universityPage = new UniversitySelectPage(page);
    const authPage = new SchoolPortalAuthPage(page);

    // 학교 선택 화면 확인
    await expect(page.getByText('大学を選んでください')).toBeVisible({ timeout: 10000 });

    // 학교 선택
    await universityPage.selectUniversity(TEST_USER.universityName);

    // 포털 로그인 화면으로 이동 확인
    await expect(page.getByText('ログイン', { exact: true })).toBeVisible({ timeout: 5000 });

    // 로그인
    await authPage.fillStudentId(TEST_USER.studentId);
    await authPage.fillPassword(TEST_USER.password);
    await authPage.submit();

    // 홈 화면으로 이동 확인
    await expect(page.getByText('今日の授業')).toBeVisible({ timeout: 15000 });
  });

  test.skip('A-4: 잘못된 비밀번호 입력 시 에러 처리 (현재 auto-signup 구조로 테스트 불가)', async ({ page }) => {
    // NOTE: 현재 SchoolPortalAuthScreen은 "Invalid login credentials" 에러 시
    // 자동으로 새 계정을 생성하는 구조입니다.
    // 때문에 "틀린 비밀번호" 시나리오를 E2E로 검증하기 어렵습니다.
    // 향후 인증 로직이 "기존 계정만 로그인" 으로 변경되면 이 테스트를 활성화하세요.
    //
    // 현재 커버된 에러 케이스:
    //  - 빈 필드 → 버튼 비활성화 (A-5)
    //  - 이메일 형식 오류 → Supabase 에러 Alert
  });


  test('A-5: 빈 입력 필드가 있으면 로그인 버튼이 비활성화된다', async ({ page }) => {
    const universityPage = new UniversitySelectPage(page);

    // 학교 선택
    await expect(page.getByText('大学を選んでください')).toBeVisible({ timeout: 10000 });
    await universityPage.selectUniversity(TEST_USER.universityName);
    await expect(page.getByText('ログイン', { exact: true })).toBeVisible({ timeout: 5000 });

    // React Native Web: TouchableOpacity disabled 시 opacity: 0.4 CSS 적용
    // 텍스트 노드의 조상 요소 중 opacity < 1 인 요소로 비활성화 상태 판별
    const getButtonOpacity = () =>
      page.getByText('ログイン', { exact: true }).evaluate((el) => {
        let current = el;
        while (current && current !== document.body) {
          const opacity = parseFloat(window.getComputedStyle(current).opacity);
          if (opacity < 1) return opacity;
          current = current.parentElement;
        }
        return 1;
      });

    // 1. 아무것도 입력하지 않은 상태 — opacity 낮음 확인 (disabled)
    const opacityEmpty = await getButtonOpacity();
    expect(opacityEmpty).toBeLessThan(1);

    // 2. 학적번호만 입력 — 여전히 비활성화
    await page.getByPlaceholder('例: A1234567').fill('TEST0001');
    const opacityIdOnly = await getButtonOpacity();
    expect(opacityIdOnly).toBeLessThan(1);

    // 3. 비밀번호까지 입력 — opacity 1.0 (활성화)
    await page.getByPlaceholder('パスワードを入力').fill('some-password');
    const opacityFilled = await getButtonOpacity();
    expect(opacityFilled).toBe(1);
  });
});
