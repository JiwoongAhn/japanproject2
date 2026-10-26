// 실제 Supabase 클라이언트 + LargeSecureStore 로 "앱 재시작 시 키체인 잠김"을 재현한다.
// (2026-10-26 아이폰 "잘 쓰다가 대학 선택 화면으로" 버그 회귀 방지)
//
// 예전 코드: 키체인을 못 읽으면 저장된 세션을 지움 → 잠금 해제 후에도 로그아웃 상태
// 지금 코드: 세션을 지우지 않음 → 잠금 해제 후 다시 확인하면 그대로 로그인 상태
import aes from 'aes-js';
import { webcrypto } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { LargeSecureStore } from '../../src/lib/largeSecureStore';
import {
  resolveBootOutcome,
  isBootFailure,
  hasStoredSession,
  raceWithTimeout,
  shouldApplyAuthEvent,
} from '../../src/lib/sessionKeeper';

const URL = 'https://abcdefghijklmnop.supabase.co';
const STORAGE_KEY = 'sb-abcdefghijklmnop-auth-token';

function env() {
  const keychain = {
    data: {}, locked: false, AFTER_FIRST_UNLOCK: 'AFTER_FIRST_UNLOCK',
    getItemAsync: async (k) => { if (keychain.locked) throw new Error('User interaction is not allowed.'); return keychain.data[k] ?? null; },
    setItemAsync: async (k, v) => { if (keychain.locked) throw new Error('User interaction is not allowed.'); keychain.data[k] = v; },
  };
  const storage = {
    data: {},
    getItem: async (k) => storage.data[k] ?? null,
    setItem: async (k, v) => { storage.data[k] = v; },
    removeItem: async (k) => { delete storage.data[k]; },
    getAllKeys: async () => Object.keys(storage.data),
  };
  return { keychain, storage };
}

// 앱 1회 실행 = 새 저장소 인스턴스(메모리 기억 없음) + 새 Supabase 클라이언트
function launchApp({ keychain, storage }) {
  const store = new LargeSecureStore({
    secureStore: keychain, storage, aes,
    randomBytes: (n) => webcrypto.getRandomValues(new Uint8Array(n)),
  });
  const client = createClient(URL, 'anon-key', {
    auth: { storage: store, autoRefreshToken: false, persistSession: true, detectSessionInUrl: false },
  });
  return { store, client };
}

const now = Math.floor(Date.now() / 1000);
const SESSION = {
  access_token: 'header.payload.sig',
  refresh_token: 'refresh-abc',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: now + 3600,
  user: { id: 'u-1', aud: 'authenticated', email: 's00a000x@kokushikan.ac.jp' },
};

// AuthProvider.restoreSession 과 같은 판단 (타임아웃은 짧게)
async function bootOnce(client, storage, store, attempt = 0) {
  store.consumeReadFailure();
  const result = await raceWithTimeout(client.auth.getSession(), 2000);
  const readFailed = store.consumeReadFailure();
  const stored = isBootFailure(result, readFailed) ? await hasStoredSession(storage) : false;
  return { outcome: resolveBootOutcome({ result, stored, attempt, readFailed }), result };
}

describe('세션 유지 — 실제 Supabase 클라이언트', () => {
  const origError = console.error;
  beforeAll(() => { console.error = () => {}; }); // 라이브러리가 남기는 오류 로그(의도된 상황)는 숨긴다
  afterAll(() => { console.error = origError; });

  test('SP-01: 정상 재시작 → 로그인 유지', async () => {
    const e = env();
    const first = launchApp(e);
    await first.store.setItem(STORAGE_KEY, JSON.stringify(SESSION));

    const second = launchApp(e);
    const { outcome, result } = await bootOnce(second.client, e.storage, second.store);
    expect(outcome).toBe('session');
    expect(result.data.session.user.id).toBe('u-1');
  });

  test('SP-02: 폰 잠김 상태로 앱이 켜져도 로그아웃(대학 선택)으로 가지 않고, 세션도 지워지지 않는다', async () => {
    const e = env();
    await launchApp(e).store.setItem(STORAGE_KEY, JSON.stringify(SESSION));

    e.keychain.locked = true;
    const locked = launchApp(e);
    const { outcome } = await bootOnce(locked.client, e.storage, locked.store);
    expect(outcome).not.toBe('logout');
    expect(outcome).not.toBe('session'); // "세션 없음"으로 확정하지 않는다
    expect(e.storage.data[STORAGE_KEY]).toBeTruthy();

    // 잠금 해제 후 다시 확인(앱이 화면에 다시 나올 때 자동 재시도) → 로그인 그대로
    e.keychain.locked = false;
    const retry = await bootOnce(locked.client, e.storage, locked.store, 1);
    expect(retry.outcome).toBe('session');
    expect(retry.result.data.session.user.id).toBe('u-1');
  });

  test('SP-03: 앱 시작 알림(INITIAL_SESSION)이 세션 없이 와도 화면에 반영하지 않는다 — 진짜 로그아웃은 반영', () => {
    // 앱 시작 시 판단은 restoreSession(SP-01·02) 몫. Supabase 는 저장소를 못 읽어도 INITIAL_SESSION(null) 을 보낼 수 있다
    expect(shouldApplyAuthEvent('INITIAL_SESSION', null)).toBe(false);
    expect(shouldApplyAuthEvent('INITIAL_SESSION', SESSION)).toBe(true);
    expect(shouldApplyAuthEvent('SIGNED_OUT', null)).toBe(true);     // 사용자가 직접 로그아웃
    expect(shouldApplyAuthEvent('SIGNED_IN', SESSION)).toBe(true);
    expect(shouldApplyAuthEvent('TOKEN_REFRESHED', SESSION)).toBe(true);
  });
});
