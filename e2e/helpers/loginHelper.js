/**
 * loginHelper.js — 로그인 공통 함수
 *
 * signInWithPassword로 세션 토큰을 얻고, URL 해시에 포함해서 앱을 로드합니다.
 * AppNavigator의 handleDeepLink가 토큰을 감지 → supabase.auth.setSession() 호출 → 자동 로그인.
 *
 * 이 방식은 Supabase의 redirect URL 화이트리스트가 필요 없습니다.
 */

const { getTestSession } = require('./supabaseHelper');

/**
 * 테스트 계정으로 로그인 후 홈 화면 대기
 * @param {import('@playwright/test').Page} page
 */
async function loginHelper(page) {
  const session = await getTestSession();

  // URL 해시에 토큰을 포함해서 앱 로드
  // → AppNavigator의 handleDeepLink가 access_token + refresh_token을 감지
  // → supabase.auth.setSession() 호출 → AuthProvider가 MainTab으로 전환
  const url =
    `http://localhost:8083/#access_token=${session.access_token}` +
    `&refresh_token=${session.refresh_token}` +
    `&token_type=bearer&type=magiclink`;

  await page.goto(url);

  // 홈 화면이 표시될 때까지 대기 (setSession → profile fetch → MainTab 렌더링)
  await page.getByText('今日の授業', { exact: true }).first().waitFor({ state: 'visible', timeout: 25000 });
}

module.exports = { loginHelper };
