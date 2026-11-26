// manaba 통지 메일의 「보낸 사람」과 「본문 링크」가 진짜 manaba 인지 가린다 (mail-inbound 가 사용)
//
// 2026-11-26 점검에서 고친 것: 예전에는 글자 끝만 봐서(endsWith('manaba.jp'))
//   fakemanaba.jp 처럼 아무나 살 수 있는 주소도 통과했고, 링크는 https://manaba.jp.evil.com/… 도 통과했다.
//   그 링크를 앱에서 열면 저장된 manaba 로그인 쿠키가 그 사이트로 갈 수 있었다.
// → 주소를 점(.) 단위로 나눠서 「manaba.jp 자신이거나 그 하위 주소」만 인정한다.

const SENDER_DOMAINS = ['manaba.jp', 'ace.toyo.ac.jp'];
const LINK_HOSTS = ['manaba.jp', 'www.ace.toyo.ac.jp'];

function isUnder(host, base) {
  return host === base || host.endsWith('.' + base);
}

/** 보낸 사람 주소(예: no-reply@kokushikan.manaba.jp)가 manaba 쪽인지 */
export function isAllowedSender(fromAddress) {
  const addr = String(fromAddress || '').trim().toLowerCase();
  const at = addr.lastIndexOf('@');
  if (at < 1) return false;
  const domain = addr.slice(at + 1);
  return SENDER_DOMAINS.some((d) => isUnder(domain, d));
}

/** 링크의 주소(host)가 manaba 쪽인지. 사용자 이름·포트·다른 형식(http 외)은 거절 */
export function isManabaLink(url) {
  const m = String(url || '').match(/^https?:\/\/([^/?#]*)/i);
  if (!m) return false;
  const host = m[1].toLowerCase();
  if (!/^[a-z0-9.-]+$/.test(host)) return false; // @(사용자 이름)·:(포트) 등이 섞이면 거절
  return LINK_HOSTS.some((h) => isUnder(host, h));
}

/** 본문 HTML 에서 manaba 공지 링크를 찾는다 (manaba 쪽 링크만, 처음 것 하나) */
export function extractManabaUrl(html) {
  const all = String(html || '').match(/https?:\/\/[^\s"'<>]+/gi) || [];
  return all.find((u) => isManabaLink(u)) ?? null;
}
