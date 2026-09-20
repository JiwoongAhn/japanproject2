/**
 * @jest-environment jsdom
 */
// manaba 자체 로그인 폼 / kaede 로그인 폼 실제 구조(2026-09-18 curl 실측) +
// 타 대학 LMS 제품별 폼(2026-09-20 curl 실측: WebClass·UNIPA·KONECO·CampusSquare·専修)에서
// 캡처·자동입력·프로브 스크립트가 그대로 동작하는지 확인한다.
// ※ 새 학교의 autoLoginHosts 를 채우기 전에 그 학교 폼 골격을 여기에 추가해 통과시킬 것.
jest.mock('@react-native-cookies/cookies', () => ({ get: jest.fn(), getAll: jest.fn(), set: jest.fn(), clearByName: jest.fn() }));
jest.mock('../../src/lib/supabase', () => ({ LargeSecureStore: class {} }));

import {
  CAPTURE_CREDENTIALS_JS,
  PROBE_LOGIN_FORM_JS,
  buildAutoFillJS,
} from '../../src/utils/schoolCookies';

// kokushikan.manaba.jp/ct/login (세션 없을 때 /ct/home 도 같은 폼)
const MANABA_FORM = `
<form action=login method="POST" utn>
  <input type="text" class="editable disableime" id="mainuserid" name="userid">
  <input type="password" class="editable disableime" name="password">
  <input type=submit id=login name=login value="ログイン">
  <input type="hidden" name="manaba-form" value="1">
  <input type=hidden name=SessionValue value="@1">
</form>`;

// kaedei.kokushikan.ac.jp/Login.aspx
const KAEDE_FORM = `
<form method="post" action="./Login.aspx" id="Form1">
  <input name="ctl00$MainContent$UserId" type="text" id="MainContent_UserId" class="login-text">
  <input name="ctl00$MainContent$Password" type="password" id="MainContent_Password" class="login-text">
  <input type="submit" name="ctl00$MainContent$LoginButton" value="ログイン">
  <input type="submit" name="ctl00$MainContent$ClearButton" value="クリア">
</form>`;

// kulms.kanagawa-u.ac.jp/webclass/login.php (東京農業 lms.nodai / 東京都市 webclass.tcu 동일 구조)
const WEBCLASS_FORM = `
<form action="/webclass/login.php" method="post">
  <input type="text" id="username" name="username" class="form-control">
  <input type="password" id="password" name="val" class="form-control">
  <input type="submit" id="LoginBtn" name="login" class="btn btn-primary" value="ログイン">
  <input type="hidden" name="token" value="x">
</form>`;

// portal.sa.dendai.ac.jp/uprx/…/Pky50101.xhtml (玉川 unitama /uprx/ 동일, PrimeFaces)
const UNIPA_FORM = `
<form id="loginForm" name="loginForm" method="post" action="/uprx/up/pk/pky501/Pky50101.xhtml">
  <input id="loginForm:userId" name="loginForm:userId" type="text" class="ui-inputfield ui-inputtext">
  <input id="loginForm:password" name="loginForm:password" type="password" class="ui-inputfield">
  <input id="loginForm:j_id_1k_input" name="loginForm:j_id_1k_input" type="checkbox">
  <button id="loginForm:loginButton" name="loginForm:loginButton" type="submit" class="ui-button"><span>LOGIN</span></button>
</form>`;

// koneco.komazawa-u.ac.jp (Drupal) — 제출 버튼이 input[type=image]
const KONECO_FORM = `
<form id="user-login-form" action="/portal?destination=/portal" method="post">
  <input type="text" id="edit-name" name="name" class="form-text">
  <input type="password" id="edit-pass" name="pass" class="form-text">
  <input type="image" id="edit-submit" name="op" alt="ログイン" src="/login.png" class="image-button js-form-submit form-submit">
</form>`;

// portal.takushoku-u.ac.jp/campusweb/top.do (CampusSquare) — type=button + JS 제출(exec가 hidden 세팅 후 form.submit)
const CAMPUSSQUARE_FORM = `
<form action="/campusweb/login.do" method="post">
  <input type="radio" name="lang" id="jpn" value="1" onclick="submitLoginForm('login.do')">
  <input type="text" name="userId" id="userId" class="input">
  <input type="password" name="password" id="password" class="input">
  <input type="hidden" name="buttonName" value="">
  <input type="button" id="loginButton" class="decorate" value="ログイン" onclick="return exec('login',this,null)">
</form>`;

// ris.acc.senshu-u.ac.jp/kyougaku/indexSP.jsp — 버튼이 폼 밖의 <a onclick=goLogin()>
const SENSHU_FORM = `
<form name="CMA010SCT01Form" method="POST" action="/kyougaku/CMA010SCT01EventAction.do" onsubmit="return isDoubleSendCheck(this);">
  <input type="text" name="txtUsrId" id="userid">
  <input type="password" name="pwdPsw" id="password">
</form>
<p><a href="javascript:void(0);" data-role="button" class="gray_button_large" onclick="goLogin();">ログイン</a></p>`;

// asia.ex-tic.com / doshisha.ex-tic.com /auth/session (亜細亜 manaba·同志社 e-class 의 SSO IdP)
const EXTIC_FORM = `
<form id="login" action="/auth/session" method="post">
  <input type="text" id="identifier" name="identifier" class="form-control">
  <input type="password" id="password" name="password" class="form-control">
  <button type="submit" class="btn btn-info">次へ</button>
</form>`;

// slink.secioss.com/pub/login.cgi (東洋 ToyoNet-ACE 의 SSO IdP) — 맨 앞에 display:none 인 dummy 텍스트칸(자동입력 함정)
const SECIOSS_FORM = `
<style>.login_dummy_input{display:none;}</style>
<form id="login" action="login.cgi" method="post">
  <input type="text" id="dummy" name="dummy" class="login_dummy_input">
  <input type="text" id="username_input" name="username">
  <input type="password" id="password_input" name="password">
  <button type="submit" id="login_button" class="login_button">Login</button>
  <button type="button" id="other">Other</button>
</form>`;

function setup(html) {
  document.body.innerHTML = html;
  const messages = [];
  window.ReactNativeWebView = { postMessage: (s) => messages.push(JSON.parse(s)) };
  // jsdom 은 실제 제출(네비게이션)을 못 하므로 submit 이벤트만 잡고 막는다
  const submits = [];
  document.querySelector('form').addEventListener('submit', (e) => { submits.push(1); e.preventDefault(); });
  // jsdom 은 input[type=image] 클릭→제출을 구현하지 않는다(실제 브라우저는 제출) → 클릭을 제출로 간주
  document.querySelectorAll('input[type=image]').forEach((el) =>
    el.addEventListener('click', (e) => { submits.push('image'); e.preventDefault(); })
  );
  // JS 제출형 폼(拓殖 exec / 専修 goLogin)의 페이지 함수 스텁 — 올바른 컨트롤이 눌렸는지 확인용
  window.exec = () => { submits.push('exec'); return false; };
  window.goLogin = () => { submits.push('goLogin'); return false; };
  return { messages, submits };
}
const run = (js) => new Function(js)();

// 각 폼의 진짜 ID 칸 = 비밀번호 칸 바로 앞 텍스트칸 (secioss 의 dummy 함정 제외)
const idInput = () => {
  const inputs = [...document.querySelectorAll('input')];
  const pwIdx = inputs.findIndex((i) => i.type === 'password');
  return inputs.slice(0, pwIdx).reverse().find((i) => i.type === 'text');
};

// 각 폼에서 "사용자가 누르는 로그인 컨트롤"
const clickLogin = () => {
  const el =
    document.querySelector('input[type=submit], button[type=submit], input[type=image]') ||
    document.querySelector('input[type=button], a[onclick]');
  el.click();
};

describe.each([
  ['manaba 자체 폼', MANABA_FORM],
  ['kaede 폼', KAEDE_FORM],
  ['WebClass 폼(神奈川·農業·都市)', WEBCLASS_FORM],
  ['UNIPA 폼(電機·玉川)', UNIPA_FORM],
  ['KONECO 폼(駒澤, image 버튼)', KONECO_FORM],
  ['CampusSquare 폼(拓殖, JS 제출)', CAMPUSSQUARE_FORM],
  ['専修 폼(버튼이 폼 밖)', SENSHU_FORM],
  ['ex-tic SSO 폼(亜細亜·同志社)', EXTIC_FORM],
  ['secioss SSO 폼(東洋, dummy 함정)', SECIOSS_FORM],
])('%s', (_name, html) => {
  test('프로브: 비밀번호 칸 있음 → hasPassword=true', () => {
    const { messages } = setup(html);
    run(PROBE_LOGIN_FORM_JS);
    expect(messages[0]).toMatchObject({ type: 'loginProbe', hasPassword: true });
  });

  test('캡처: 사용자가 입력 후 ログイン 누르면 id/pw/host 전달', () => {
    const { messages } = setup(html);
    run(CAPTURE_CREDENTIALS_JS);
    idInput().value = 'k1234567';
    document.querySelector('input[type=password]').value = 'p@ss';
    clickLogin(); // 네이티브 submit 이벤트 또는 JS 제출 버튼 click
    const cred = messages.find((m) => m.type === 'credentials');
    expect(cred).toMatchObject({ id: 'k1234567', pw: 'p@ss' });
    expect(typeof cred.host).toBe('string');
  });

  test('캡처 훅은 두 번 주입해도 한 번만 걸림', () => {
    const { messages } = setup(html);
    run(CAPTURE_CREDENTIALS_JS);
    run(CAPTURE_CREDENTIALS_JS);
    document.querySelector('input[type=password]').value = 'x';
    clickLogin();
    expect(messages.filter((m) => m.type === 'credentials')).toHaveLength(1);
  });

  test('자동입력: 저장된 ID/PW를 채우고 그 폼의 로그인 컨트롤을 정확히 1회 누른다', () => {
    const { submits } = setup(html);
    run(buildAutoFillJS('k1234567', "p'\"<>&"));
    expect(idInput().value).toBe('k1234567');
    expect(document.querySelector('input[type=password]').value).toBe("p'\"<>&");
    expect(submits).toHaveLength(1); // submit 이벤트 1회 또는 exec/goLogin 1회
  });

  test('캡처: 비밀번호 칸에서 Enter 를 눌러도 잡힌다', () => {
    const { messages } = setup(html);
    run(CAPTURE_CREDENTIALS_JS);
    idInput().value = 'id1';
    const pw = document.querySelector('input[type=password]');
    pw.value = 'pw1';
    pw.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(messages.find((m) => m.type === 'credentials')).toMatchObject({ id: 'id1', pw: 'pw1' });
  });

  test('자동입력: 함정(dummy) 텍스트칸에는 값을 넣지 않는다', () => {
    setup(html);
    run(buildAutoFillJS('k1234567', 'pw'));
    const dummy = document.querySelector('#dummy');
    if (dummy) expect(dummy.value).toBe('');
  });

  test('자동입력 제출도 캡처 훅에 잡혀 값이 갱신된다', () => {
    const { messages } = setup(html);
    run(CAPTURE_CREDENTIALS_JS);
    run(buildAutoFillJS('newid', 'newpw'));
    expect(messages.find((m) => m.type === 'credentials')).toMatchObject({ id: 'newid', pw: 'newpw' });
  });
});

test('프로브: 로그인된 manaba 홈(비밀번호 칸 없음) → hasPassword=false', () => {
  const { messages } = setup('<form><input type="text" name="q"></form><div>コース一覧</div>');
  run(PROBE_LOGIN_FORM_JS);
  expect(messages[0]).toMatchObject({ type: 'loginProbe', hasPassword: false });
});
