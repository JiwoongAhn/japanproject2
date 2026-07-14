import { resolveAuthGate } from '../../src/utils/authRoute';

// 모든 게이트가 통과된 "정상 로그인 완료" 기본 입력
const base = {
  loading: false,
  welcomeSeen: true,
  consented: true,
  pushPrimingDone: true,
  session: { user: { id: 'u1' } },
  profile: { nickname: 'ゆうき', onboarding_completed: true },
};

describe('resolveAuthGate — 로딩/확인중', () => {
  test('세션 확인 중(loading)이면 splash', () => {
    expect(resolveAuthGate({ ...base, loading: true })).toBe('splash');
  });
  test('welcomeSeen 미확인(null)이면 splash', () => {
    expect(resolveAuthGate({ ...base, welcomeSeen: null })).toBe('splash');
  });
  test('consented 미확인(null)이면 splash', () => {
    expect(resolveAuthGate({ ...base, consented: null })).toBe('splash');
  });
  test('pushPrimingDone 미확인(null)이면 splash', () => {
    expect(resolveAuthGate({ ...base, pushPrimingDone: null })).toBe('splash');
  });
});

describe('resolveAuthGate — 로그인 이전 게이트', () => {
  test('환영 미시청이면 welcome (세션 유무 무관)', () => {
    expect(resolveAuthGate({ ...base, welcomeSeen: false })).toBe('welcome');
    expect(resolveAuthGate({ ...base, welcomeSeen: false, session: null })).toBe('welcome');
  });
  test('동의 전이면 consent', () => {
    expect(resolveAuthGate({ ...base, consented: false })).toBe('consent');
  });
  test('환영이 동의보다 먼저', () => {
    expect(resolveAuthGate({ ...base, welcomeSeen: false, consented: false })).toBe('welcome');
  });
  test('비로그인이면 auth', () => {
    expect(resolveAuthGate({ ...base, session: null })).toBe('auth');
  });
});

describe('resolveAuthGate — ⭐ 핵심 가드: 로그인+프로필 로딩 중', () => {
  // 이 케이스가 이번 버그의 핵심. 예전엔 여기서 'main'으로 떨어져 온보딩을 건너뜀.
  test('세션은 있는데 profile이 아직 null이면 main이 아니라 splash', () => {
    expect(resolveAuthGate({ ...base, profile: null })).toBe('splash');
  });
  test('profile이 undefined여도 splash', () => {
    expect(resolveAuthGate({ ...base, profile: undefined })).toBe('splash');
  });
});

describe('resolveAuthGate — 신규 회원 흐름', () => {
  // 트리거로 갓 생성된 신규 프로필: 닉네임 null, onboarding_completed false
  const fresh = { nickname: null, onboarding_completed: false };

  test('닉네임 없고 프리퍼미션 안 봤으면 pushPriming', () => {
    expect(resolveAuthGate({ ...base, profile: fresh, pushPrimingDone: false })).toBe('pushPriming');
  });
  test('닉네임 없고 프리퍼미션은 봤으면 nickname', () => {
    expect(resolveAuthGate({ ...base, profile: fresh, pushPrimingDone: true })).toBe('nickname');
  });
  test('닉네임 설정 후 온보딩 미완료면 onboarding', () => {
    expect(
      resolveAuthGate({ ...base, profile: { nickname: 'ゆうき', onboarding_completed: false } })
    ).toBe('onboarding');
  });
  test('닉네임+온보딩 완료면 main', () => {
    expect(resolveAuthGate(base)).toBe('main');
  });
});

describe('resolveAuthGate — 순서 우선권', () => {
  test('로딩이 로그인 이전 게이트보다 우선', () => {
    expect(resolveAuthGate({ ...base, loading: true, welcomeSeen: false })).toBe('splash');
  });
  test('환영/동의가 프로필 상태보다 우선', () => {
    expect(resolveAuthGate({ ...base, welcomeSeen: false, profile: null })).toBe('welcome');
  });
  test('프로필 로딩 가드가 온보딩 판정보다 우선 (profile null이면 온보딩 아님)', () => {
    expect(resolveAuthGate({ ...base, profile: null, pushPrimingDone: false })).toBe('splash');
  });
});
