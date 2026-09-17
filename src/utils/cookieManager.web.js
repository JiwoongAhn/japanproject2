// 웹 전용 쿠키 매니저 스텁 — 웹에는 WebView 도, 네이티브 쿠키 저장소도 없다.
// 모든 메서드는 "쿠키 없음"으로 조용히 응답해, 학교 WebView 화면 밖의 앱 흐름
// (온보딩·홈·게시판 등)이 브라우저(Playwright E2E)에서 정상 동작하게 한다.
const noCookies = async () => ({});
const ok = async () => true;

export default {
  get: noCookies,
  getAll: noCookies,
  set: ok,
  clearAll: ok,
  clearByName: ok,
  flush: ok,
  removeSessionCookies: ok,
};
