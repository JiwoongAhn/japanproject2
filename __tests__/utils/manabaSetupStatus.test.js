import {
  resolveManabaSetupStage,
  shouldShowSetupBanner,
  getSetupBannerCopy,
} from '../../src/utils/manabaSetupStatus';

describe('resolveManabaSetupStage', () => {
  const base = { usesManaba: true, hasSubscription: true, verifiedAt: '2026-09-21T05:32:49Z', pushTokenCount: 1 };

  it('manaba를 쓰지 않는 학교는 판정 대상이 아니다', () => {
    expect(resolveManabaSetupStage({ ...base, usesManaba: false })).toBe('not-applicable');
  });

  it('아직 시작 안 함 → none', () => {
    expect(resolveManabaSetupStage({ ...base, hasSubscription: false })).toBe('none');
  });

  it('주소만 발급받고 전달 확인 전 → pending (통지가 오지 않는 상태)', () => {
    expect(resolveManabaSetupStage({ ...base, verifiedAt: null })).toBe('pending');
  });

  it('전달은 확인됐지만 푸시 토큰이 없음 → no-push', () => {
    expect(resolveManabaSetupStage({ ...base, pushTokenCount: 0 })).toBe('no-push');
  });

  it('전부 갖춰지면 ready', () => {
    expect(resolveManabaSetupStage(base)).toBe('ready');
  });

  // 실제 운영 DB에서 확인된 7명의 상태를 그대로 재현한 회귀 테스트
  it('⑤ 회귀: 실제 이용자 7명 중 통지가 오는 사람은 2명뿐이었음을 재현', () => {
    const users = [
      { name: 'アンジー', hasSubscription: true, verifiedAt: '2026-09-21', pushTokenCount: 1 },
      { name: 'かえちん', hasSubscription: true, verifiedAt: '2026-09-21', pushTokenCount: 1 },
      { name: 'sanda', hasSubscription: true, verifiedAt: null, pushTokenCount: 1 },
      { name: 'だにい', hasSubscription: true, verifiedAt: null, pushTokenCount: 1 },
      { name: 'ジュン', hasSubscription: true, verifiedAt: null, pushTokenCount: 2 },
      { name: 'うす', hasSubscription: true, verifiedAt: null, pushTokenCount: 0 },
      { name: 'e2eテスター', hasSubscription: true, verifiedAt: null, pushTokenCount: 0 },
    ];
    const stages = users.map((u) => resolveManabaSetupStage({ usesManaba: true, ...u }));
    expect(stages.filter((s) => s === 'ready')).toHaveLength(2);
    // 나머지 5명은 전부 배너로 구제된다
    expect(stages.filter((s) => shouldShowSetupBanner(s))).toHaveLength(5);
  });
});

describe('shouldShowSetupBanner', () => {
  it('pending / no-push 에서만 배너를 띄운다', () => {
    expect(shouldShowSetupBanner('pending')).toBe(true);
    expect(shouldShowSetupBanner('no-push')).toBe(true);
  });

  it('정상·미시작·비대상 학교에는 배너를 띄우지 않는다', () => {
    expect(shouldShowSetupBanner('ready')).toBe(false);
    expect(shouldShowSetupBanner('none')).toBe(false);
    expect(shouldShowSetupBanner('not-applicable')).toBe(false);
  });
});

describe('getSetupBannerCopy', () => {
  it('pending 문구에는 "통지가 도착하지 않는다"는 사실이 들어간다', () => {
    const copy = getSetupBannerCopy('pending');
    expect(copy.title).toContain('あと1ステップ');
    expect(copy.body).toContain('通知は届きません');
    expect(copy.action).toBeTruthy();
  });

  it('no-push 문구는 단말 통지 설정을 가리킨다', () => {
    const copy = getSetupBannerCopy('no-push');
    expect(copy.body).toContain('端末の通知');
  });

  it('배너 대상이 아니면 null', () => {
    expect(getSetupBannerCopy('ready')).toBeNull();
    expect(getSetupBannerCopy('none')).toBeNull();
  });
});
