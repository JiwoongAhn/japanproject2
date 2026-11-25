// 학교 사이트 로그아웃 — 무엇을 지우고 무엇을 남기는지 (2026-11-25 사용자 결정)
jest.mock('../../src/utils/schoolCookies', () => ({
  cookieKeyForUrl: (u) => `cookies_${new URL(u).host}`,
  credKeyForUrl: (u) => `cred_${new URL(u).host}`,
  clearCookies: jest.fn(async () => {}),
  clearCredentials: jest.fn(async () => {}),
  clearAllWebCookies: jest.fn(async () => {}),
}));

import { clearAllWebCookies, clearCookies, clearCredentials } from '../../src/utils/schoolCookies';
import { universityLinks } from '../../src/constants/universityLinks';
import {
  clearAllSchoolSites, clearSavedLogin, clearSchoolSite, credHostsForLogout, logoutMessage, siteNameFor, storesCredentials,
} from '../../src/utils/schoolLogout';

const kokushikan = universityLinks.kokushikan;
const MANABA = 'https://kokushikan.manaba.jp/ct/login';
const KAEDE = 'https://kaedei.kokushikan.ac.jp';
const credKeys = () => clearCredentials.mock.calls.map(([k]) => k).sort();

beforeEach(() => jest.clearAllMocks());

describe('학교 사이트 로그아웃', () => {
  test('LO-01 manaba 로그아웃은 manaba 의 ID/PW 만 지운다 (kaede-i 는 남긴다)', async () => {
    await clearSavedLogin(MANABA, kokushikan);
    expect(credKeys()).toEqual(['cred_kokushikan.manaba.jp']);
  });

  test('LO-02 kaede-i 로그아웃은 kaede-i 의 ID/PW 만 지운다 (예전엔 manaba 까지 지웠다)', async () => {
    await clearSchoolSite(KAEDE, kokushikan);
    expect(credKeys()).toEqual(['cred_kaedei.kokushikan.ac.jp']);
    expect(clearCookies).toHaveBeenCalledTimes(1);
  });

  test('LO-03 앱 로그아웃은 전부 지운다 (같은 폰의 다음 사람이 앞 사람 manaba 를 못 열게)', async () => {
    await clearAllSchoolSites(kokushikan);
    expect(credKeys()).toEqual(['cred_kaedei.kokushikan.ac.jp', 'cred_kokushikan.manaba.jp']);
    expect(clearCookies.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(clearAllWebCookies).toHaveBeenCalledTimes(1);
  });

  test('LO-04 SSO 학교는 로그인 전용 호스트의 ID/PW 도 같이 지운다', () => {
    const links = { lmsUrl: 'https://lms.x.ac.jp', portalUrl: 'https://portal.x.ac.jp', autoLoginHosts: ['idp.x.ac.jp', 'portal.x.ac.jp'] };
    expect(credHostsForLogout('https://lms.x.ac.jp', links)).toEqual(['lms.x.ac.jp', 'idp.x.ac.jp']);
  });

  test('LO-05 안내 문구: ID/PW 를 저장하는 학교만 「ID・パスワードが削除」라고 말한다', () => {
    expect(storesCredentials(MANABA, kokushikan)).toBe(true);
    expect(logoutMessage(MANABA, kokushikan)).toContain('manabaのID・パスワードが削除されます');
    expect(logoutMessage(KAEDE, kokushikan)).toContain('kaede-iのID・パスワードが削除されます');
    const other = { lmsUrl: 'https://lms.y.ac.jp', lmsLabel: 'WebClass' };
    expect(logoutMessage('https://lms.y.ac.jp', other)).not.toContain('パスワード');
    expect(siteNameFor('https://lms.y.ac.jp', other)).toBe('WebClass');
  });

  test('LO-06 링크 정보가 없어도 죽지 않는다', async () => {
    await expect(clearAllSchoolSites(undefined)).resolves.toBeUndefined();
    expect(siteNameFor('https://z.jp', null)).toBe('学校サイト');
  });
});
