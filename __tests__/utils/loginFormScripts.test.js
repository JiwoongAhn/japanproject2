/**
 * @jest-environment jsdom
 */
// manaba 자체 로그인 폼 / kaede 로그인 폼 실제 구조(2026-09-18 curl 실측)에서
// 캡처·자동입력·프로브 스크립트가 그대로 동작하는지 확인한다.
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

function setup(html) {
  document.body.innerHTML = html;
  const messages = [];
  window.ReactNativeWebView = { postMessage: (s) => messages.push(JSON.parse(s)) };
  // jsdom 은 실제 제출(네비게이션)을 못 하므로 submit 이벤트만 잡고 막는다
  const submits = [];
  document.querySelector('form').addEventListener('submit', (e) => { submits.push(1); e.preventDefault(); });
  return { messages, submits };
}
const run = (js) => new Function(js)();

describe.each([
  ['manaba 자체 폼', MANABA_FORM],
  ['kaede 폼', KAEDE_FORM],
])('%s', (_name, html) => {
  test('프로브: 비밀번호 칸 있음 → hasPassword=true', () => {
    const { messages } = setup(html);
    run(PROBE_LOGIN_FORM_JS);
    expect(messages[0]).toMatchObject({ type: 'loginProbe', hasPassword: true });
  });

  test('캡처: 사용자가 입력 후 ログイン 누르면 id/pw/host 전달', () => {
    const { messages } = setup(html);
    run(CAPTURE_CREDENTIALS_JS);
    document.querySelector('input[type=text]').value = 'k1234567';
    document.querySelector('input[type=password]').value = 'p@ss';
    document.querySelector('input[type=submit]').click(); // 네이티브 submit 이벤트 발생
    const cred = messages.find((m) => m.type === 'credentials');
    expect(cred).toMatchObject({ id: 'k1234567', pw: 'p@ss' });
    expect(typeof cred.host).toBe('string');
  });

  test('캡처 훅은 두 번 주입해도 한 번만 걸림', () => {
    const { messages } = setup(html);
    run(CAPTURE_CREDENTIALS_JS);
    run(CAPTURE_CREDENTIALS_JS);
    document.querySelector('input[type=password]').value = 'x';
    document.querySelector('input[type=submit]').click();
    expect(messages.filter((m) => m.type === 'credentials')).toHaveLength(1);
  });

  test('자동입력: 저장된 ID/PW를 채우고 첫 번째 submit 버튼을 누른다', () => {
    const { submits } = setup(html);
    run(buildAutoFillJS('k1234567', "p'\"<>&"));
    expect(document.querySelector('input[type=text]').value).toBe('k1234567');
    expect(document.querySelector('input[type=password]').value).toBe("p'\"<>&");
    expect(submits).toHaveLength(1);
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
