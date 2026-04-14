/**
 * loginHelper.js — 로그인 공통 함수
 *
 * 여러 테스트에서 반복되는 로그인 과정을 한 곳에서 관리합니다.
 * Page Object와 달리 "여러 화면에 걸친 흐름"을 처리합니다.
 *
 * 나중에 모바일(Maestro 등)로 전환 시:
 *  - 이 파일의 Playwright API 부분만 교체
 *  - 함수 시그니처(loginHelper(studentId, password))는 그대로 유지
 */

const { UniversitySelectPage } = require('../pages/auth/UniversitySelectPage');
const { SchoolPortalAuthPage } = require('../pages/auth/SchoolPortalAuthPage');
const { TEST_USER } = require('../fixtures/testData');

/**
 * 학교 선택 → 포털 로그인까지 수행
 * @param {import('@playwright/test').Page} page
 * @param {string} studentId
 * @param {string} password
 */
async function loginHelper(page, studentId = TEST_USER.studentId, password = TEST_USER.password) {
  const universityPage = new UniversitySelectPage(page);
  const authPage = new SchoolPortalAuthPage(page);

  // 앱 첫 화면으로 이동
  await universityPage.goto();

  // 학교 선택 화면이 표시될 때까지 대기
  await page.getByText('大学を選んでください').waitFor({ state: 'visible', timeout: 10000 });

  // 학교 선택
  await universityPage.selectUniversity(TEST_USER.universityName);

  // 포털 로그인 화면 대기 (exact: true로 버튼 텍스트만 매칭)
  await page.getByText('ログイン', { exact: true }).waitFor({ state: 'visible', timeout: 10000 });

  // 로그인
  await authPage.login(studentId, password);

  // 홈 화면이 표시될 때까지 대기 (로그인 성공 후 MainTab으로 이동)
  await page.getByText('今日の授業').waitFor({ state: 'visible', timeout: 15000 });
}

module.exports = { loginHelper };
