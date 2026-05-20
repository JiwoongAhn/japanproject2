// 학교 사이트 WebView 공통 유틸 (kaede-i / manaba 공용)
//
// [자동 대문자 끄기]
//   injectedJavaScriptBeforeContentLoaded용 스크립트. input이 DOM에 생기는
//   순간부터 autocapitalize=none을 강제 → iOS 키보드 첫 글자 대문자 방지.
//
// [쿠키 영속] — react-native-webview 공식 문서 권장 방식
//   로그인 후 쿠키를 "name=value; ..." 문자열로 AES-256 암호화 저장(LargeSecureStore).
//   다음에 열 때 그 문자열을 WebView source의 headers.Cookie 로 첫 요청에 직접 실어
//   보냄 → 서버가 바로 로그인 상태로 인식. (CookieManager.set 주입의 타이밍/HttpOnly
//   문제를 회피)
//   ※ 비밀번호는 저장하지 않음. 쿠키만 저장 (CLAUDE.md 원칙 준수)
import CookieManager from '@react-native-cookies/cookies';
import { LargeSecureStore } from '../lib/supabase';

const store = new LargeSecureStore();

// URL에서 호스트 추출 ('https://kaedei.kokushikan.ac.jp/x' → 'kaedei.kokushikan.ac.jp')
function hostOf(url) {
  const m = (url || '').match(/^https?:\/\/([^/]+)/);
  return m ? m[1] : '';
}

// 입력칸 자동 대문자/자동수정 끄기 (injectedJavaScriptBeforeContentLoaded용)
// 학교 ID는 보통 소문자라 첫 글자 자동 대문자를 막는다.
export const DISABLE_AUTOCAPS_JS = `
(function(){
  function fix(){
    var els = document.querySelectorAll('input, textarea');
    for (var i = 0; i < els.length; i++) {
      els[i].setAttribute('autocapitalize','none');
      els[i].setAttribute('autocorrect','off');
      els[i].setAttribute('spellcheck','false');
    }
  }
  fix();
  // 동적으로 추가되는 input도 즉시 처리
  try {
    var mo = new MutationObserver(fix);
    mo.observe(document.documentElement || document, { childList: true, subtree: true });
  } catch (e) {}
  document.addEventListener('DOMContentLoaded', fix);
})();
true;
`;

// URL → 저장 키 (도메인별 분리)
// 예: 'https://kaedei.kokushikan.ac.jp' → 'cookies_kaedei.kokushikan.ac.jp'
export function cookieKeyForUrl(url) {
  return 'cookies_' + (hostOf(url) || 'unknown');
}

// 쿠키 헤더 문자열 → { name: value } 맵 (값에 '='가 있어도 첫 '='만 분리)
export function parseCookieHeader(header) {
  const map = {};
  if (!header) return map;
  header.split(';').forEach((part) => {
    const i = part.indexOf('=');
    if (i > 0) {
      const k = part.slice(0, i).trim();
      if (k) map[k] = part.slice(i + 1).trim();
    }
  });
  return map;
}

// 현재 WebView 쿠키(도메인 매칭 전체)를 읽어 기존 저장과 병합 후 암호화 저장.
// - getAll + get 둘 다 수집해 인증 쿠키 누락 방지 (get은 path '/'만 잡는 한계 보완)
// - 빈 값 쿠키는 제외 (로그인 페이지 재로드 시 유효 쿠키를 빈 값으로 덮어쓰기 방지)
// - 기존 저장과 병합 (이번에 안 잡힌 쿠키의 값을 유지)
export async function saveCookies(url, key) {
  try {
    const host = hostOf(url);
    const all = await CookieManager.getAll(true).catch(() => ({}));
    const got = await CookieManager.get(url, true).catch(() => ({}));

    const collected = {};
    const collect = (obj, requireDomainMatch) => {
      for (const n of Object.keys(obj || {})) {
        const c = obj[n];
        if (!c || c.value === '' || c.value == null) continue; // 빈 값 제외
        if (requireDomainMatch) {
          const dom = (c.domain || '').replace(/^\./, '');
          if (!(dom && host.endsWith(dom))) continue;
        }
        collected[c.name] = c.value;
      }
    };
    collect(all, true); // 전체에서 도메인 매칭
    collect(got, false); // get은 이미 해당 url 쿠키 → 그대로 반영

    // 기존 저장과 병합 (이번에 빠진 쿠키는 기존 값 유지)
    const prev = parseCookieHeader(await store.getItem(key));
    const finalMap = { ...prev, ...collected };

    const header = Object.keys(finalMap)
      .filter((n) => finalMap[n] !== '' && finalMap[n] != null)
      .map((n) => `${n}=${finalMap[n]}`)
      .join('; ');
    if (header) await store.setItem(key, header);
  } catch (_) {
    // 저장 실패는 무시 (다음 로드 때 재시도)
  }
}

// 저장된 쿠키 헤더 문자열 반환 (없으면 null) — WebView source headers.Cookie 용
export async function getSavedCookieHeader(key) {
  try {
    return await store.getItem(key);
  } catch (_) {
    return null;
  }
}

// 저장된 쿠키를 WKWebView 쿠키 저장소(WKHTTPCookieStore)에 직접 주입.
// iOS는 source.headers.Cookie가 불안정해서 CookieManager.set(useWebKit)으로 복원한다.
// 세션 쿠키가 앱 종료 시 사라지지 않도록 expires를 미래로 부여(영속화).
// 반환값: 저장돼 있던 헤더 문자열(없으면 null) — headers.Cookie 보조용으로도 사용.
export async function restoreCookies(url, key) {
  const header = await getSavedCookieHeader(key);
  if (!header) return null;
  const map = parseCookieHeader(header);
  const host = hostOf(url);
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  for (const name of Object.keys(map)) {
    try {
      await CookieManager.set(
        url,
        { name, value: map[name], domain: host, path: '/', expires },
        true // useWebKit(iOS) → WKHTTPCookieStore
      );
    } catch (_) {}
  }
  return header;
}

// 로그아웃: 저장 쿠키 삭제 + 해당 도메인 WebView 쿠키 제거
export async function clearCookies(url, key) {
  try {
    await store.removeItem(key);
  } catch (_) {}
  try {
    const host = hostOf(url);
    const all = await CookieManager.getAll(true).catch(() => ({}));
    for (const n of Object.keys(all || {})) {
      const dom = (all[n].domain || '').replace(/^\./, '');
      if (dom && host.endsWith(dom)) {
        await CookieManager.clearByName(url, all[n].name, true);
      }
    }
  } catch (_) {}
}

// ─────────────────────────────────────────────────────────────────────────────
// 자동 로그인용 자격증명 (A방식: ID/PW 기기 암호화 저장)
// ※ 사용자 동의 하에 적용. 기기 내 AES-256(LargeSecureStore) 저장, 서버 전송 절대 없음.
// ─────────────────────────────────────────────────────────────────────────────

export function credKeyForUrl(url) {
  return 'cred_' + (hostOf(url) || 'unknown');
}

export async function saveCredentials(key, id, pw) {
  try {
    await store.setItem(key, JSON.stringify({ id, pw }));
  } catch (_) {}
}

export async function getCredentials(key) {
  try {
    const raw = await store.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

export async function clearCredentials(key) {
  try {
    await store.removeItem(key);
  } catch (_) {}
}

// 로그인 폼에 저장된 ID/PW를 채우고 제출하는 JS (JSON.stringify로 특수문자 안전 처리)
export function buildAutoFillJS(id, pwVal) {
  return `
(function(){
  var pwEl = document.querySelector('input[type=password]');
  if (!pwEl) return;
  var form = pwEl.form;
  var texts = form ? form.querySelectorAll('input[type=text]') : [];
  function setVal(el, v){
    if (!el) return;
    el.value = v;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
  setVal(texts[0], ${JSON.stringify(id)});
  setVal(pwEl, ${JSON.stringify(pwVal)});
  var btn = form ? form.querySelector('input[type=submit], button[type=submit]') : null;
  if (btn) { btn.click(); } else if (form) { form.submit(); }
})();
true;
`;
}

// 사용자가 직접 로그인할 때 입력한 ID/PW를 캡처해 네이티브로 전달하는 JS
export const CAPTURE_CREDENTIALS_JS = `
(function(){
  var pwEl = document.querySelector('input[type=password]');
  if (!pwEl || !pwEl.form || pwEl.form.__credHooked) return;
  pwEl.form.__credHooked = true;
  pwEl.form.addEventListener('submit', function(){
    var texts = pwEl.form.querySelectorAll('input[type=text]');
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'credentials',
      id: texts[0] ? texts[0].value : '',
      pw: pwEl.value
    }));
  }, true);
})();
true;
`;
