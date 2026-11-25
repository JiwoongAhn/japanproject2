// 학교 사이트 로그아웃 — 사용자가 ログアウト를 누르면 저장된 ID·비밀번호까지 지운다 (2026-11-25 사용자 결정)
//   예전: manaba 로그아웃은 ID/PW 가 남아 다시 열면 자동 로그인 / kaede-i 는 manaba 것까지 지움 /
//         앱 로그아웃은 아무것도 안 지워 같은 폰의 다음 사람에게 앞 사람 manaba 가 열릴 수 있었다
import { clearAllWebCookies, clearCookies, clearCredentials, cookieKeyForUrl, credKeyForUrl } from './schoolCookies';
import { autoLoginHostsFor, hostOf } from './autoLoginPolicy';

// 이 학교에서 앱이 여는 사이트 주소들 (중복 제거)
export function schoolSiteUrls(links) {
  return [...new Set([links?.manabaUrl, links?.portalUrl, links?.lmsUrl, links?.timetableUrl].filter(Boolean))];
}

// 지금 보고 있는 사이트에서 로그아웃할 때 ID/PW 를 지울 호스트 목록
//   = 이 사이트 + SSO(로그인만 담당하는 다른 호스트). 같은 학교의 "다른 서비스"(예: manaba ↔ kaede-i)는 건드리지 않는다
export function credHostsForLogout(url, links) {
  const here = hostOf(url);
  const otherServices = new Set(schoolSiteUrls(links).map(hostOf).filter((h) => h !== here));
  const hosts = [here, ...autoLoginHostsFor(links)].filter((h) => h && !otherServices.has(h));
  return [...new Set(hosts)];
}

// 확인 창에 쓸 사이트 이름
export function siteNameFor(url, links) {
  const h = hostOf(url);
  const is = (u) => !!u && hostOf(u) === h;
  if (is(links?.manabaUrl)) return 'manaba';
  if (is(links?.portalUrl)) return links.portalLabel || '学校サイト';
  if (is(links?.lmsUrl)) return links.lmsLabel || '学校サイト';
  if (is(links?.timetableUrl)) return links.portalLabel || '学校サイト';
  return '学校サイト';
}

// 이 사이트의 ID/PW 를 앱이 저장하는가 (저장하지 않는 학교에 「ID가 삭제됩니다」라고 안내하지 않기 위해)
export function storesCredentials(url, links) {
  return credHostsForLogout(url, links).some((h) => autoLoginHostsFor(links).includes(h));
}

export function logoutMessage(url, links) {
  return storesCredentials(url, links)
    ? `ログアウトすると、この端末に保存されている${siteNameFor(url, links)}のID・パスワードが削除されます。次回から自動ではログインされません。`
    : 'ログアウトすると、この端末に保存されているログイン状態が削除されます。次回は改めてログインが必要です。';
}

// 이 사이트의 저장된 ID/PW 만 지운다
export async function clearSavedLogin(url, links) {
  for (const h of credHostsForLogout(url, links)) await clearCredentials(credKeyForUrl(`https://${h}`));
}

// 한 사이트에서 로그아웃: ID/PW + 로그인 상태(쿠키)
export async function clearSchoolSite(url, links, cookieKey = cookieKeyForUrl(url)) {
  await clearSavedLogin(url, links);
  await clearCookies(url, cookieKey);
}

// 전부 지우기: 앱 로그아웃·退会·「ログイン情報をリセット」
export async function clearAllSchoolSites(links) {
  for (const url of schoolSiteUrls(links)) await clearCookies(url, cookieKeyForUrl(url));
  const hosts = new Set([...schoolSiteUrls(links).map(hostOf), ...autoLoginHostsFor(links)]);
  for (const h of hosts) if (h) await clearCredentials(credKeyForUrl(`https://${h}`));
  await clearAllWebCookies();
}
