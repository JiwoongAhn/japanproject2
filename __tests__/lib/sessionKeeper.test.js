import {
  raceWithTimeout,
  hasStoredSession,
  attachAutoRefresh,
  resolveBootOutcome,
  TIMED_OUT,
  SESSION_KEY_PATTERN,
  BOOT_MAX_ATTEMPTS,
} from '../../src/lib/sessionKeeper';

describe('raceWithTimeout', () => {
  it('제시간에 끝나면 결과를 그대로 돌려준다', async () => {
    const r = await raceWithTimeout(Promise.resolve({ data: { session: null } }), 50);
    expect(r).toEqual({ data: { session: null } });
  });

  it('시간을 넘기면 TIMED_OUT을 돌려준다', async () => {
    const never = new Promise(() => {});
    const r = await raceWithTimeout(never, 10);
    expect(r).toBe(TIMED_OUT);
  });

  it('promise가 실패해도 예외를 던지지 않고 TIMED_OUT으로 처리한다', async () => {
    const r = await raceWithTimeout(Promise.reject(new Error('network')), 50);
    expect(r).toBe(TIMED_OUT);
  });
});

describe('hasStoredSession', () => {
  it('Supabase 세션 키가 있으면 true', async () => {
    const storage = {
      getAllKeys: async () => ['welcome_seen', 'sb-abcdefg-auth-token', 'other'],
    };
    await expect(hasStoredSession(storage)).resolves.toBe(true);
  });

  it('세션 키가 없으면 false', async () => {
    const storage = { getAllKeys: async () => ['welcome_seen', 'privacy_consent'] };
    await expect(hasStoredSession(storage)).resolves.toBe(false);
  });

  it('스토리지 읽기가 실패해도 예외 없이 false', async () => {
    const storage = { getAllKeys: async () => { throw new Error('boom'); } };
    await expect(hasStoredSession(storage)).resolves.toBe(false);
  });

  it('키 패턴이 실제 Supabase 형식과 맞는다', () => {
    expect(SESSION_KEY_PATTERN.test('sb-abcdefghijk-auth-token')).toBe(true);
    expect(SESSION_KEY_PATTERN.test('sb--auth-token')).toBe(false);
    expect(SESSION_KEY_PATTERN.test('unipas_storage_enc_key')).toBe(false);
  });

  // supabase-js는 `sb-${URL호스트의 첫 조각}-auth-token`을 기본 저장 키로 쓴다.
  // 이 프로젝트의 실제 키로 검증해, 라이브러리가 규칙을 바꾸면 여기서 걸리게 한다.
  it('이 프로젝트의 실제 세션 키를 인식한다', () => {
    expect(SESSION_KEY_PATTERN.test('sb-rexnpusrxezuztxmkaex-auth-token')).toBe(true);
    // 세션 본체가 아닌 부속 키(PKCE 검증자 등)는 잡지 않는다
    expect(SESSION_KEY_PATTERN.test('sb-rexnpusrxezuztxmkaex-auth-token-code-verifier')).toBe(false);
  });
});

describe('attachAutoRefresh', () => {
  // AppState / supabase.auth를 가짜 객체로 대체해 호출 순서를 검증한다
  const makeFakes = () => {
    const calls = [];
    let handler = null;
    const appState = {
      addEventListener: (_evt, fn) => {
        handler = fn;
        return { remove: () => calls.push('remove') };
      },
    };
    const auth = {
      startAutoRefresh: () => calls.push('start'),
      stopAutoRefresh: () => calls.push('stop'),
    };
    return { calls, appState, auth, fire: (s) => handler(s) };
  };

  it('연결 즉시 자동갱신을 시작한다', () => {
    const { calls, appState, auth } = makeFakes();
    attachAutoRefresh({ appState, auth });
    expect(calls).toEqual(['start']);
  });

  it('백그라운드로 가면 멈추고, 돌아오면 다시 시작한다', () => {
    const { calls, appState, auth, fire } = makeFakes();
    attachAutoRefresh({ appState, auth });
    fire('background');
    fire('active');
    expect(calls).toEqual(['start', 'stop', 'start']);
  });

  it('cleanup하면 리스너를 제거하고 갱신을 멈춘다', () => {
    const { calls, appState, auth } = makeFakes();
    const cleanup = attachAutoRefresh({ appState, auth });
    cleanup();
    expect(calls).toEqual(['start', 'remove', 'stop']);
  });

  it('의존성이 없으면 아무 일도 하지 않는다 (웹/테스트 환경 방어)', () => {
    expect(() => attachAutoRefresh({})()).not.toThrow();
  });
});

describe('resolveBootOutcome', () => {
  const ok = { data: { session: {} } };

  it('세션 확인 성공 → session', () => {
    expect(resolveBootOutcome({ result: ok, stored: false, attempt: 0 })).toBe('session');
  });

  it('타임아웃 + 저장된 세션 없음 → logout (비로그인 확정)', () => {
    expect(resolveBootOutcome({ result: TIMED_OUT, stored: false, attempt: 0 })).toBe('logout');
  });

  it('타임아웃 + 저장된 세션 있음 → retry (로그아웃시키지 않음)', () => {
    expect(resolveBootOutcome({ result: TIMED_OUT, stored: true, attempt: 0 })).toBe('retry');
    expect(resolveBootOutcome({ result: TIMED_OUT, stored: true, attempt: 1 })).toBe('retry');
  });

  it('재시도를 다 써도 실패 + 저장된 세션 있음 → stalled (재시도 안내)', () => {
    const last = BOOT_MAX_ATTEMPTS - 1;
    expect(resolveBootOutcome({ result: TIMED_OUT, stored: true, attempt: last })).toBe('stalled');
  });

  it('⑥ 회귀 방지: 로그인된 사용자는 네트워크가 느려도 절대 logout이 되지 않는다', () => {
    for (let attempt = 0; attempt < BOOT_MAX_ATTEMPTS; attempt += 1) {
      const outcome = resolveBootOutcome({ result: TIMED_OUT, stored: true, attempt });
      expect(outcome).not.toBe('logout');
    }
  });
});
