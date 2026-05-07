/**
 * auth.fixture.js — 로그인 상태를 재사용하는 Playwright fixture
 *
 * 역할:
 *  - 매 테스트마다 magic link로 자동 로그인 (OTP 불필요)
 *  - loggedInPage fixture를 사용하는 테스트는 항상 홈 화면에서 시작
 */

const { test: base } = require('@playwright/test');
const { loginHelper } = require('../helpers/loginHelper');

const test = base.extend({
  loggedInPage: async ({ page }, use) => {
    await loginHelper(page);
    await use(page);
  },
});

module.exports = { test };
