/**
 * auth.fixture.js — 로그인 상태를 재사용하는 Playwright fixture
 *
 * 역할:
 *  - 매 테스트마다 로그인 UI를 반복하지 않고, 저장된 세션을 재사용
 *  - 처음 한 번만 loginHelper로 로그인 → storageState.json 저장
 *  - 이후 테스트들은 storageState.json을 불러와서 바로 시작
 *
 * 사용 방법:
 *  test.use({ storageState: 'e2e/fixtures/storageState.json' });
 *
 * storageState.json 생성 방법:
 *  npx playwright test e2e/tests/auth/login.spec.js --project=desktop-chrome
 *  (login.spec.js 안에서 context.storageState()로 저장)
 */

const { test: base } = require('@playwright/test');
const { loginHelper } = require('../helpers/loginHelper');
const { TEST_USER } = require('./testData');

/**
 * 로그인된 page를 제공하는 커스텀 fixture
 *
 * 사용 예시:
 *   const { test } = require('../../fixtures/auth.fixture');
 *   test('과제 추가', async ({ loggedInPage }) => { ... });
 */
const test = base.extend({
  loggedInPage: async ({ page }, use) => {
    await loginHelper(page, TEST_USER.studentId, TEST_USER.password);
    await use(page);
  },
});

module.exports = { test };
