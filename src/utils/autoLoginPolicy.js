// 자동 로그인(ID/PW 기기 저장 + 자동 입력) 허용 정책 — 학교 무관 순수 함수
//
// 판정의 단일 소스는 universityLinks[id].autoLoginHosts (호스트명 배열).
//   - 배열에 있는 호스트의 로그인 폼에서만 ID/PW를 캡처·저장·자동입력한다.
//   - 배열이 없거나 비어 있으면 = 쿠키 영속만 하고 자동입력은 하지 않는다(안전한 강등).
//   - SSO 학교는 IdP 호스트(예: asia.ex-tic.com)를 명시적으로 넣어야 자동입력 대상이 된다.
// 이 정책을 ManabaLoginScreen / ManabaReminderSetupScreen / SchoolWebViewScreen 이 공유한다.

// URL에서 호스트만 뽑는다 ('https://kaedei.kokushikan.ac.jp/x' → 'kaedei.kokushikan.ac.jp')
export function hostOf(url) {
  const m = String(url || '').match(/^https?:\/\/([^/?#]+)/);
  return m ? m[1].toLowerCase() : '';
}

// 학교 링크 객체 → 자동입력 허용 호스트 배열 (없으면 빈 배열)
export function autoLoginHostsFor(links) {
  const hosts = links?.autoLoginHosts;
  return Array.isArray(hosts) ? hosts.map((h) => String(h).toLowerCase()) : [];
}

// 이 URL의 로그인 폼에 자동입력해도 되는가 (호스트 정확 일치, 서브도메인 불허)
export function isAutoLoginHost(url, links) {
  const h = hostOf(url);
  return !!h && autoLoginHostsFor(links).includes(h);
}

// 이 학교가 자동입력을 하나라도 지원하는가 (온보딩/홈 문구 분기용)
export function supportsAutoLogin(links) {
  return autoLoginHostsFor(links).length > 0;
}

// 학교의 대표 LMS 진입점 — manaba 우선, 없으면 lmsUrl, 둘 다 없으면 null
// 홈 그리드·お知らせ 알림·온보딩 문구가 같은 규칙을 쓰도록 한 곳에 둔다.
export function lmsEntryFor(links) {
  if (links?.manabaUrl) return { url: links.manabaUrl, label: 'manaba', kind: 'manaba' };
  if (links?.lmsUrl) return { url: links.lmsUrl, label: links.lmsLabel ?? 'LMS', kind: 'lms' };
  return null;
}
