// LargeSecureStore 유닛 테스트 — 실제 모듈(src/lib/largeSecureStore)을 검사한다.
// (예전 파일은 클래스 복사본을 검사해서 실제 코드가 바뀌어도 잡지 못했다)
//
// 키체인(expo-secure-store)·AsyncStorage 는 메모리 가짜로, 암호화(aes-js)는 진짜를 쓴다.
// 가짜 키체인은 locked=true 로 "폰이 잠겨 키체인을 못 읽는 상태"를 흉내 낸다.
import aes from 'aes-js';
import { webcrypto } from 'crypto';
import {
  LargeSecureStore,
  KeychainUnavailableError,
  KEY_NAME_V1,
  KEY_NAME_V2,
} from '../../src/lib/largeSecureStore';

function fakeKeychain() {
  const kc = {
    data: {},
    accessible: {},
    locked: false,
    AFTER_FIRST_UNLOCK: 'AFTER_FIRST_UNLOCK',
    getItemAsync: jest.fn(async (key) => {
      if (kc.locked) throw new Error('User interaction is not allowed.');
      return kc.data[key] ?? null;
    }),
    setItemAsync: jest.fn(async (key, value, opts) => {
      if (kc.locked) throw new Error('User interaction is not allowed.');
      // 실제 키체인처럼 응답이 늦게 오는 상황(동시 생성 경쟁)을 만든다
      await new Promise((r) => setTimeout(r, 5));
      kc.data[key] = value;
      kc.accessible[key] = opts?.keychainAccessible ?? 'WHEN_UNLOCKED';
    }),
  };
  return kc;
}

function fakeStorage() {
  const st = {
    data: {},
    getItem: jest.fn(async (k) => st.data[k] ?? null),
    setItem: jest.fn(async (k, v) => { st.data[k] = v; }),
    removeItem: jest.fn(async (k) => { delete st.data[k]; }),
  };
  return st;
}

const randomBytes = (n) => webcrypto.getRandomValues(new Uint8Array(n));

function makeEnv() {
  const keychain = fakeKeychain();
  const storage = fakeStorage();
  const keyState = { key: null, lock: Promise.resolve() };
  const make = () => new LargeSecureStore({ secureStore: keychain, storage, aes, randomBytes, keyState });
  return { keychain, storage, keyState, make, store: make() };
}

describe('LargeSecureStore — 기본 저장/읽기', () => {
  test('L-01: setItem 후 getItem → 동일한 값 반환', async () => {
    const { store } = makeEnv();
    await store.setItem('k', 'hello');
    expect(await store.getItem('k')).toBe('hello');
  });

  test('L-02: 1500자 긴 문자열 setItem/getItem 왕복', async () => {
    const { store } = makeEnv();
    const long = 'x'.repeat(1500);
    await store.setItem('k', long);
    expect(await store.getItem('k')).toBe(long);
  });

  test('L-03: 일본어 유니코드 문자열 setItem/getItem 왕복', async () => {
    // ※ aes-js 의 utf8 변환은 이모지(4바이트 문자)를 지원하지 않는다(예전부터 동일). 세션·쿠키엔 이모지가 없다
    const { store } = makeEnv();
    await store.setItem('k', '国士舘大学のお知らせ・ｶﾀｶﾅ');
    expect(await store.getItem('k')).toBe('国士舘大学のお知らせ・ｶﾀｶﾅ');
  });

  test('L-04: setItem 후 removeItem 하면 getItem → null', async () => {
    const { store } = makeEnv();
    await store.setItem('k', 'v');
    await store.removeItem('k');
    expect(await store.getItem('k')).toBeNull();
  });

  test('L-05: 존재하지 않는 key getItem → null (키체인도 안 건드림)', async () => {
    const { store, keychain } = makeEnv();
    expect(await store.getItem('none')).toBeNull();
    expect(keychain.getItemAsync).not.toHaveBeenCalled();
  });

  test('L-06: 같은 key에 두 번 setItem → 최신 값 반환', async () => {
    const { store } = makeEnv();
    await store.setItem('k', 'a');
    await store.setItem('k', 'b');
    expect(await store.getItem('k')).toBe('b');
  });

  test('L-07: keyA 삭제 후 keyB getItem → 여전히 valueB', async () => {
    const { store } = makeEnv();
    await store.setItem('A', 'valueA');
    await store.setItem('B', 'valueB');
    await store.removeItem('A');
    expect(await store.getItem('B')).toBe('valueB');
  });

  test('L-08: 새 키는 잠금 중에도 읽히는 설정(AFTER_FIRST_UNLOCK)으로 v2 이름에 저장', async () => {
    const { store, keychain } = makeEnv();
    await store.setItem('k', 'v');
    expect(keychain.data[KEY_NAME_V2]).toMatch(/^[0-9a-f]{64}$/);
    expect(keychain.accessible[KEY_NAME_V2]).toBe('AFTER_FIRST_UNLOCK');
  });
});

describe('LargeSecureStore — 아이폰 로그아웃 버그 회귀 방지 (2026-10-26)', () => {
  test('L-10: 앱 시작 시 키체인이 잠겨 있으면 null + "못 읽음" 기록 — 저장된 로그인 정보는 지우지 않는다', async () => {
    const env = makeEnv();
    await env.store.setItem('sb-x-auth-token', '{"access_token":"a"}');
    // 앱 재시작(메모리의 키 기억 없음) + 폰 잠김
    const fresh = makeEnv();
    Object.assign(fresh.keychain.data, env.keychain.data);
    Object.assign(fresh.storage.data, env.storage.data);
    fresh.keychain.locked = true;

    expect(await fresh.store.getItem('sb-x-auth-token')).toBeNull();
    expect(fresh.store.consumeReadFailure()).toBe(true);
    expect(fresh.store.consumeReadFailure()).toBe(false); // 한 번 읽으면 기록은 지워진다
    expect(fresh.storage.removeItem).not.toHaveBeenCalled();
    expect(fresh.storage.data['sb-x-auth-token']).toBeTruthy();

    // 잠금 해제 후 다시 읽으면 그대로 복원
    fresh.keychain.locked = false;
    expect(await fresh.store.getItem('sb-x-auth-token')).toBe('{"access_token":"a"}');
  });

  test('L-11: 잠긴 동안 새 키를 만들어 덮어쓰지 않는다 (옛 데이터를 못 푸는 일 방지)', async () => {
    const env = makeEnv();
    await env.store.setItem('k', 'v');
    const keyBefore = env.keychain.data[KEY_NAME_V2];
    const fresh = makeEnv();
    Object.assign(fresh.keychain.data, env.keychain.data);
    Object.assign(fresh.storage.data, env.storage.data);
    fresh.keychain.locked = true;
    await expect(fresh.store.setItem('k', 'v2')).rejects.toBeInstanceOf(KeychainUnavailableError);
    fresh.keychain.locked = false;
    expect(fresh.keychain.data[KEY_NAME_V2]).toBe(keyBefore);
    expect(await fresh.store.getItem('k')).toBe('v');
  });

  test('L-12: 한 번 읽은 키는 기억 → 사용 중 폰이 잠겨도(토큰 갱신 등) 읽기·쓰기가 된다', async () => {
    const { store, keychain } = makeEnv();
    await store.setItem('k', 'v');
    keychain.locked = true;
    await store.setItem('k', 'refreshed');
    expect(await store.getItem('k')).toBe('refreshed');
  });

  test('L-13: 처음 설치 직후 세션·쿠키 저장이 동시에 일어나도 키는 하나만 만든다', async () => {
    const { keychain, make } = makeEnv();
    const sessionStore = make();
    const cookieStore = make();
    await Promise.all([
      sessionStore.setItem('session', 'S'),
      cookieStore.setItem('cookie', 'C'),
      sessionStore.setItem('other', 'O'),
    ]);
    const keyWrites = keychain.setItemAsync.mock.calls.filter(([k]) => k === KEY_NAME_V2);
    expect(keyWrites).toHaveLength(1);
    // 기억을 비운(=앱 재시작) 새 인스턴스로도 셋 다 풀린다
    const restarted = new LargeSecureStore({
      secureStore: keychain, storage: sessionStore.deps.storage, aes, randomBytes,
    });
    expect(await restarted.getItem('session')).toBe('S');
    expect(await restarted.getItem('cookie')).toBe('C');
    expect(await restarted.getItem('other')).toBe('O');
  });

  test('L-14: 기존 사용자(옛 키 v1)는 그대로 읽히고, 키가 v2로 복사된다 — v1 은 지우지 않는다', async () => {
    const { keychain, storage, store } = makeEnv();
    // 옛 버전 앱이 만든 키·데이터를 재현
    const v1Hex = '11'.repeat(32);
    keychain.data[KEY_NAME_V1] = v1Hex;
    const legacy = new LargeSecureStore({
      secureStore: { ...keychain, getItemAsync: async (k) => (k === KEY_NAME_V1 ? v1Hex : null) },
      storage, aes, randomBytes,
    });
    await legacy.setItem('sb-x-auth-token', 'legacy-session');

    expect(await store.getItem('sb-x-auth-token')).toBe('legacy-session');
    expect(keychain.data[KEY_NAME_V2]).toBe(v1Hex);
    expect(keychain.accessible[KEY_NAME_V2]).toBe('AFTER_FIRST_UNLOCK');
    expect(keychain.data[KEY_NAME_V1]).toBe(v1Hex);
  });

  test('L-15: 다른 키로 잠긴(복구 불가) 데이터는 쓰레기 문자열 대신 null — 그리고 지우지 않는다', async () => {
    const a = makeEnv();
    await a.store.setItem('k', '{"access_token":"x"}');
    const b = makeEnv();
    await b.store.setItem('dummy', 'make-a-different-key');
    b.storage.data.k = a.storage.data.k;
    expect(await b.store.getItem('k')).toBeNull();
    expect(b.storage.data.k).toBeTruthy();
  });

  test('L-16: 키체인이 잠깐만 막혔다 풀리면(재시도 중 해제) 오류 없이 읽힌다', async () => {
    const env = makeEnv();
    await env.store.setItem('k', 'v');
    const fresh = makeEnv();
    Object.assign(fresh.keychain.data, env.keychain.data);
    Object.assign(fresh.storage.data, env.storage.data);
    let calls = 0;
    const real = fresh.keychain.getItemAsync.getMockImplementation();
    fresh.keychain.getItemAsync.mockImplementation(async (...args) => {
      calls += 1;
      if (calls === 1) throw new Error('User interaction is not allowed.');
      return real(...args);
    });
    expect(await fresh.store.getItem('k')).toBe('v');
    expect(fresh.store.consumeReadFailure()).toBe(false);
  });
});
