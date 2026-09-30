import {
  classifyLoginFailure,
  getFailureCopy,
  buildFailureEntry,
  appendFailureLog,
  recordLoginFailure,
  readLoginFailures,
  MAX_FAILURE_LOGS,
  LOGIN_FAILURE_LOG_KEY,
} from '../../src/utils/loginDiagnostics';

// AsyncStorage 대역
const makeStorage = (initial = {}) => {
  const data = { ...initial };
  return {
    data,
    getItem: async (k) => (k in data ? data[k] : null),
    setItem: async (k, v) => { data[k] = v; },
  };
};

describe('classifyLoginFailure', () => {
  it('5xx는 학교 서버 장애로 본다', () => {
    expect(classifyLoginFailure({ statusCode: 503 })).toBe('server');
    expect(classifyLoginFailure({ statusCode: 500 })).toBe('server');
  });

  it('404/410은 페이지 변경으로 본다', () => {
    expect(classifyLoginFailure({ statusCode: 404 })).toBe('notfound');
  });

  it('iOS 에러 코드를 해석한다', () => {
    expect(classifyLoginFailure({ code: -1009 })).toBe('offline');
    expect(classifyLoginFailure({ code: -1001 })).toBe('timeout');
  });

  it('설명 문구로도 판별한다', () => {
    expect(classifyLoginFailure({ description: 'The Internet connection appears to be offline.' })).toBe('offline');
    expect(classifyLoginFailure({ description: 'The request timed out.' })).toBe('timeout');
  });

  it('알 수 없으면 unknown', () => {
    expect(classifyLoginFailure({})).toBe('unknown');
    expect(classifyLoginFailure()).toBe('unknown');
  });
});

describe('getFailureCopy', () => {
  it('④ 핵심: 서버 장애는 "앱 문제가 아니다"라고 분명히 말한다', () => {
    expect(getFailureCopy('server').message).toContain('アプリ側の問題ではありません');
  });

  it('혼잡은 시간을 두고 재시도하라고 안내한다', () => {
    expect(getFailureCopy('timeout').message).toContain('時間をおいて');
  });

  it('모든 분류가 제목과 본문을 가진다', () => {
    for (const kind of ['offline', 'timeout', 'server', 'notfound', 'unknown']) {
      const c = getFailureCopy(kind);
      expect(c.title).toBeTruthy();
      expect(c.message).toBeTruthy();
    }
  });
});

describe('buildFailureEntry', () => {
  it('URL에서 호스트만 뽑고 민감 정보는 담지 않는다', () => {
    const e = buildFailureEntry({
      url: 'https://kaedei.kokushikan.ac.jp/Portal/Login.aspx?user=abc',
      kind: 'timeout',
      at: new Date('2026-09-28T12:00:00Z'),
    });
    expect(e.host).toBe('kaedei.kokushikan.ac.jp');
    expect(e.kind).toBe('timeout');
    expect(e.at).toBe('2026-09-28T12:00:00.000Z');
    // 쿼리스트링·비밀번호가 새어나가지 않는지 확인
    expect(JSON.stringify(e)).not.toContain('user=abc');
  });

  it('URL이 없어도 터지지 않는다', () => {
    expect(buildFailureEntry({ kind: 'unknown' }).host).toBe('');
  });
});

describe('appendFailureLog', () => {
  it('최신 기록이 앞에 온다', () => {
    const r = appendFailureLog([{ at: 'old' }], { at: 'new' });
    expect(r[0].at).toBe('new');
  });

  it('최대 보관 수를 넘기지 않는다', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ at: String(i) }));
    expect(appendFailureLog(many, { at: 'new' })).toHaveLength(MAX_FAILURE_LOGS);
  });

  it('기존 값이 없어도 동작한다', () => {
    expect(appendFailureLog(null, { at: 'x' })).toHaveLength(1);
  });
});

describe('recordLoginFailure / readLoginFailures', () => {
  it('기록하고 다시 읽을 수 있다', async () => {
    const storage = makeStorage();
    await recordLoginFailure(storage, { host: 'a.jp', kind: 'timeout', at: '2026-09-28' });
    const read = await readLoginFailures(storage);
    expect(read).toHaveLength(1);
    expect(read[0].host).toBe('a.jp');
    expect(storage.data[LOGIN_FAILURE_LOG_KEY]).toBeTruthy();
  });

  it('저장된 값이 깨져 있어도 빈 배열을 돌려준다', async () => {
    const storage = makeStorage({ [LOGIN_FAILURE_LOG_KEY]: '{깨진 JSON' });
    await expect(readLoginFailures(storage)).resolves.toEqual([]);
  });

  it('스토리지가 실패해도 앱을 멈추지 않는다', async () => {
    const broken = { getItem: async () => { throw new Error('x'); }, setItem: async () => {} };
    await expect(recordLoginFailure(broken, {})).resolves.toBeNull();
  });
});
