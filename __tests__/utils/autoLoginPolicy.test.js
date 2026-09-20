// __tests__/utils/autoLoginPolicy.test.js
// 자동 로그인 허용 정책 — 학교 링크 객체의 autoLoginHosts 로만 판정한다.
import {
  hostOf,
  autoLoginHostsFor,
  isAutoLoginHost,
  supportsAutoLogin,
  lmsEntryFor,
} from '../../src/utils/autoLoginPolicy';

const KOK = { autoLoginHosts: ['kokushikan.manaba.jp', 'kaedei.kokushikan.ac.jp'] };

describe('hostOf', () => {
  it('P-01: URL에서 호스트만 뽑고 소문자로 정규화한다', () => {
    expect(hostOf('https://Kaedei.Kokushikan.ac.jp/Main/MyTimeTable.aspx')).toBe('kaedei.kokushikan.ac.jp');
    expect(hostOf('http://a.b?x=1')).toBe('a.b');
    expect(hostOf('https://a.b#frag')).toBe('a.b');
  });
  it('P-02: URL이 아니면 빈 문자열', () => {
    expect(hostOf('')).toBe('');
    expect(hostOf(null)).toBe('');
    expect(hostOf('about:blank')).toBe('');
  });
});

describe('autoLoginHostsFor / supportsAutoLogin', () => {
  it('P-03: 배열이 없거나 links가 없으면 빈 배열 = 자동입력 미지원', () => {
    expect(autoLoginHostsFor(undefined)).toEqual([]);
    expect(autoLoginHostsFor({})).toEqual([]);
    expect(autoLoginHostsFor({ autoLoginHosts: 'x' })).toEqual([]);
    expect(supportsAutoLogin({})).toBe(false);
    expect(supportsAutoLogin({ autoLoginHosts: [] })).toBe(false);
    expect(supportsAutoLogin(KOK)).toBe(true);
  });
});

describe('isAutoLoginHost', () => {
  it('P-04: 목록에 있는 호스트의 URL만 허용 (대소문자 무시)', () => {
    expect(isAutoLoginHost('https://kokushikan.manaba.jp/ct/home', KOK)).toBe(true);
    expect(isAutoLoginHost('https://KAEDEI.kokushikan.ac.jp/Login.aspx', KOK)).toBe(true);
  });
  it('P-05: 서브도메인·다른 호스트·SSO IdP(미등록)는 거부', () => {
    expect(isAutoLoginHost('https://login.kaedei.kokushikan.ac.jp/', KOK)).toBe(false);
    expect(isAutoLoginHost('https://evil.example/kaedei.kokushikan.ac.jp', KOK)).toBe(false);
    expect(isAutoLoginHost('https://login.microsoftonline.com/', KOK)).toBe(false);
  });
  it('P-06: 목록이 없는 학교는 어떤 URL도 거부 (쿠키 영속만)', () => {
    expect(isAutoLoginHost('https://kulms.kanagawa-u.ac.jp/', {})).toBe(false);
    expect(isAutoLoginHost('https://kulms.kanagawa-u.ac.jp/', undefined)).toBe(false);
  });
  it('P-07: SSO IdP 호스트를 명시하면 그 폼도 허용', () => {
    const asia = { autoLoginHosts: ['asia-u.manaba.jp', 'asia.ex-tic.com'] };
    expect(isAutoLoginHost('https://asia.ex-tic.com/auth/login', asia)).toBe(true);
  });
});

describe('lmsEntryFor', () => {
  it('P-08: manaba 우선 → lmsUrl → null', () => {
    expect(lmsEntryFor({ manabaUrl: 'https://m/ct/login', lmsUrl: 'https://l' })).toEqual({
      url: 'https://m/ct/login', label: 'manaba', kind: 'manaba',
    });
    expect(lmsEntryFor({ manabaUrl: '', lmsUrl: 'https://l', lmsLabel: 'WebClass' })).toEqual({
      url: 'https://l', label: 'WebClass', kind: 'lms',
    });
    expect(lmsEntryFor({ manabaUrl: '', lmsUrl: '' })).toBeNull();
    expect(lmsEntryFor(undefined)).toBeNull();
  });
});
