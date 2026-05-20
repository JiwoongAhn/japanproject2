// schoolCookies 순수 로직 검증
// CookieManager(네이티브) 와 LargeSecureStore(암호화 저장)를 mock으로 대체

jest.mock('@react-native-cookies/cookies', () => ({
  get: jest.fn(),
  getAll: jest.fn(),
  set: jest.fn(),
  clearByName: jest.fn(),
}));

// LargeSecureStore를 메모리 저장소로 mock
jest.mock('../../src/lib/supabase', () => {
  const mem = {};
  return {
    __mem: mem,
    LargeSecureStore: class {
      async getItem(k) {
        return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null;
      }
      async setItem(k, v) {
        mem[k] = v;
      }
      async removeItem(k) {
        delete mem[k];
      }
    },
  };
});

import CookieManager from '@react-native-cookies/cookies';
import {
  cookieKeyForUrl,
  saveCookies,
  getSavedCookieHeader,
  restoreCookies,
  clearCookies,
  parseCookieHeader,
  DISABLE_AUTOCAPS_JS,
  credKeyForUrl,
  saveCredentials,
  getCredentials,
  clearCredentials,
  buildAutoFillJS,
  CAPTURE_CREDENTIALS_JS,
} from '../../src/utils/schoolCookies';
import { __mem } from '../../src/lib/supabase';

const KAEDE = 'https://kaedei.kokushikan.ac.jp';

beforeEach(() => {
  jest.clearAllMocks();
  Object.keys(__mem).forEach((k) => delete __mem[k]);
  // 기본값: 빈 객체
  CookieManager.get.mockResolvedValue({});
  CookieManager.getAll.mockResolvedValue({});
});

describe('cookieKeyForUrl', () => {
  test('호스트 기반 키 생성', () => {
    expect(cookieKeyForUrl(KAEDE)).toBe('cookies_kaedei.kokushikan.ac.jp');
  });
  test('빈/잘못된 URL은 unknown', () => {
    expect(cookieKeyForUrl('')).toBe('cookies_unknown');
  });
});

describe('parseCookieHeader', () => {
  test('값에 = 가 있어도 첫 = 만 분리 (kaede SSO 형태)', () => {
    const m = parseCookieHeader('SSO=TIME=9:38&KEY=abc; ASP.NET_SessionId=z23');
    expect(m.SSO).toBe('TIME=9:38&KEY=abc');
    expect(m['ASP.NET_SessionId']).toBe('z23');
  });
  test('null/빈 입력은 빈 맵', () => {
    expect(parseCookieHeader(null)).toEqual({});
  });
});

describe('saveCookies', () => {
  test('getAll(도메인 매칭) + get 을 합쳐 저장, 타 도메인 제외', async () => {
    CookieManager.getAll.mockResolvedValue({
      SSO: { name: 'SSO', value: 'tok', domain: '.kokushikan.ac.jp' },
      foreign: { name: 'foreign', value: 'x', domain: 'example.com' }, // 제외
    });
    CookieManager.get.mockResolvedValue({
      ASPSESS: { name: 'ASP.NET_SessionId', value: 'sess' },
    });
    const key = cookieKeyForUrl(KAEDE);

    await saveCookies(KAEDE, key);

    expect(await getSavedCookieHeader(key)).toBe('SSO=tok; ASP.NET_SessionId=sess');
  });

  test('빈 값 쿠키는 제외', async () => {
    CookieManager.getAll.mockResolvedValue({
      SSO: { name: 'SSO', value: 'tok', domain: '.kokushikan.ac.jp' },
      sess: { name: 'ASP.NET_SessionId', value: '', domain: '.kokushikan.ac.jp' },
    });
    const key = cookieKeyForUrl(KAEDE);

    await saveCookies(KAEDE, key);

    expect(await getSavedCookieHeader(key)).toBe('SSO=tok');
  });

  test('★핵심: 로그인 페이지의 빈 SessionId가 기존 유효 세션을 덮어쓰지 않음', async () => {
    const key = cookieKeyForUrl(KAEDE);

    // 1) 로그인 성공: SSO + 유효 SessionId 저장
    CookieManager.getAll.mockResolvedValue({
      SSO: { name: 'SSO', value: 'tok1', domain: '.kokushikan.ac.jp' },
      sess: { name: 'ASP.NET_SessionId', value: 'good', domain: '.kokushikan.ac.jp' },
    });
    await saveCookies(KAEDE, key);
    expect(await getSavedCookieHeader(key)).toBe('SSO=tok1; ASP.NET_SessionId=good');

    // 2) 로그인 페이지 재로드: SSO 갱신되지만 SessionId 는 빈 값
    CookieManager.getAll.mockResolvedValue({
      SSO: { name: 'SSO', value: 'tok2', domain: '.kokushikan.ac.jp' },
      sess: { name: 'ASP.NET_SessionId', value: '', domain: '.kokushikan.ac.jp' },
    });
    await saveCookies(KAEDE, key);

    // SSO 는 갱신, SessionId 는 기존 'good' 유지 (빈 값으로 안 덮음)
    expect(await getSavedCookieHeader(key)).toBe('SSO=tok2; ASP.NET_SessionId=good');
  });

  test('잡힌 쿠키가 전혀 없으면 기존 유지 (헤더 보존)', async () => {
    const key = cookieKeyForUrl(KAEDE);
    CookieManager.getAll.mockResolvedValue({
      SSO: { name: 'SSO', value: 'tok', domain: '.kokushikan.ac.jp' },
    });
    await saveCookies(KAEDE, key);
    expect(await getSavedCookieHeader(key)).toBe('SSO=tok');

    // 빈 수집 → 기존 유지
    CookieManager.getAll.mockResolvedValue({});
    CookieManager.get.mockResolvedValue({});
    await saveCookies(KAEDE, key);
    expect(await getSavedCookieHeader(key)).toBe('SSO=tok');
  });
});

describe('restoreCookies (CookieManager.set 직접 주입)', () => {
  test('저장된 각 쿠키를 set(useWebKit, expires)로 주입', async () => {
    const key = cookieKeyForUrl(KAEDE);
    CookieManager.getAll.mockResolvedValue({
      SSO: { name: 'SSO', value: 'tok', domain: '.kokushikan.ac.jp' },
      sess: { name: 'ASP.NET_SessionId', value: 'good', domain: '.kokushikan.ac.jp' },
    });
    await saveCookies(KAEDE, key);

    CookieManager.set.mockResolvedValue(true);
    const header = await restoreCookies(KAEDE, key);

    expect(header).toBe('SSO=tok; ASP.NET_SessionId=good');
    expect(CookieManager.set).toHaveBeenCalledTimes(2);
    const firstArg = CookieManager.set.mock.calls[0];
    expect(firstArg[0]).toBe(KAEDE);
    expect(firstArg[1].name).toBe('SSO');
    expect(firstArg[1].value).toBe('tok');
    expect(firstArg[1].expires).toBeTruthy(); // 영속화 (만료일 부여)
    expect(firstArg[2]).toBe(true); // useWebKit(iOS)
  });

  test('저장이 없으면 set 호출 없이 null', async () => {
    const r = await restoreCookies(KAEDE, cookieKeyForUrl(KAEDE));
    expect(r).toBeNull();
    expect(CookieManager.set).not.toHaveBeenCalled();
  });
});

describe('clearCookies (로그아웃)', () => {
  test('저장 헤더 삭제 + 해당 도메인 쿠키 clearByName, 타 도메인 유지', async () => {
    const key = cookieKeyForUrl(KAEDE);
    CookieManager.getAll.mockResolvedValue({
      SSO: { name: 'SSO', value: 'tok', domain: '.kokushikan.ac.jp' },
    });
    await saveCookies(KAEDE, key);
    expect(await getSavedCookieHeader(key)).toBe('SSO=tok');

    CookieManager.getAll.mockResolvedValue({
      SSO: { name: 'SSO', value: 'tok', domain: '.kokushikan.ac.jp' },
      foreign: { name: 'foreign', value: 'y', domain: 'manaba.jp' },
    });
    await clearCookies(KAEDE, key);

    expect(await getSavedCookieHeader(key)).toBeNull();
    expect(CookieManager.clearByName).toHaveBeenCalledWith(KAEDE, 'SSO', true);
    expect(CookieManager.clearByName).not.toHaveBeenCalledWith(KAEDE, 'foreign', true);
  });
});

describe('자격증명 (A방식 자동 로그인)', () => {
  test('credKeyForUrl: 호스트 기반', () => {
    expect(credKeyForUrl(KAEDE)).toBe('cred_kaedei.kokushikan.ac.jp');
  });
  test('save → get 왕복', async () => {
    const key = credKeyForUrl(KAEDE);
    await saveCredentials(key, 'myid', 'mypw');
    expect(await getCredentials(key)).toEqual({ id: 'myid', pw: 'mypw' });
  });
  test('clear 후 null', async () => {
    const key = credKeyForUrl(KAEDE);
    await saveCredentials(key, 'a', 'b');
    await clearCredentials(key);
    expect(await getCredentials(key)).toBeNull();
  });
  test('저장 없으면 null', async () => {
    expect(await getCredentials(credKeyForUrl(KAEDE))).toBeNull();
  });
});

describe('buildAutoFillJS', () => {
  test('id/pw 포함 + 특수문자 JSON 안전 + truthy 종료', () => {
    const js = buildAutoFillJS("my'id", 'pw"&=x');
    expect(js).toContain(JSON.stringify("my'id"));
    expect(js).toContain(JSON.stringify('pw"&=x'));
    expect(js).toContain('input[type=password]');
    expect(js.trim().endsWith('true;')).toBe(true);
  });
});

describe('CAPTURE_CREDENTIALS_JS', () => {
  test('credentials 타입으로 postMessage', () => {
    expect(CAPTURE_CREDENTIALS_JS).toContain("type: 'credentials'");
    expect(CAPTURE_CREDENTIALS_JS).toContain('ReactNativeWebView.postMessage');
  });
});

describe('DISABLE_AUTOCAPS_JS', () => {
  test('autocapitalize 설정 + MutationObserver + truthy 종료', () => {
    expect(DISABLE_AUTOCAPS_JS).toContain("setAttribute('autocapitalize','none')");
    expect(DISABLE_AUTOCAPS_JS).toContain('MutationObserver');
    expect(DISABLE_AUTOCAPS_JS.trim().endsWith('true;')).toBe(true);
  });
});
