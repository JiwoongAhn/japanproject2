import {
  resolveManabaSetupStage,
  shouldShowSetupBanner,
  getSetupBannerCopy,
  getSetupSheetCopy,
  shouldPromptSetup,
  resolvePushAction,
  SETUP_PROMPT_INTERVAL_MS,
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
  it('미시작 / pending / no-push 에서 배너를 띄운다 (2026-10-29 미시작 추가)', () => {
    expect(shouldShowSetupBanner('none')).toBe(true);
    expect(shouldShowSetupBanner('pending')).toBe(true);
    expect(shouldShowSetupBanner('no-push')).toBe(true);
  });

  it('정상·비대상 학교에는 배너를 띄우지 않는다', () => {
    expect(shouldShowSetupBanner('ready')).toBe(false);
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

  it('미시작이면 「まだ終わっていない設定」 안내', () => {
    expect(getSetupBannerCopy('none').title).toBe('まだ終わっていない設定があります');
  });

  it('배너 대상이 아니면 null', () => {
    expect(getSetupBannerCopy('ready')).toBeNull();
    expect(getSetupBannerCopy('not-applicable')).toBeNull();
  });
});

// 2026-10-29 실사용 국사관 23명: 미시작 6 · 중간 8 · 알림 꺼짐 5 · 정상 4
describe('shouldPromptSetup — 앱을 열 때 안내 창', () => {
  it('SP-01 앱을 새로 켜면 미완료 3단계 모두 띄운다', () => {
    for (const stage of ['none', 'pending', 'no-push']) {
      expect(shouldPromptSetup({ stage, coldStart: true, backgroundedMs: 0 })).toBe(true);
    }
  });
  it('SP-02 정상·비대상 학교는 새로 켜도 띄우지 않는다', () => {
    expect(shouldPromptSetup({ stage: 'ready', coldStart: true })).toBe(false);
    expect(shouldPromptSetup({ stage: 'not-applicable', coldStart: true })).toBe(false);
  });
  it('SP-03 탭 이동·잠깐 다른 앱(30분 미만)은 다시 띄우지 않는다', () => {
    expect(shouldPromptSetup({ stage: 'none', coldStart: false, backgroundedMs: 0 })).toBe(false);
    expect(shouldPromptSetup({ stage: 'none', coldStart: false, backgroundedMs: SETUP_PROMPT_INTERVAL_MS - 1000 })).toBe(false);
  });
  it('SP-04 30분 이상 비웠다 돌아오면 다시 띄운다', () => {
    expect(SETUP_PROMPT_INTERVAL_MS).toBe(30 * 60 * 1000);
    expect(shouldPromptSetup({ stage: 'pending', coldStart: false, backgroundedMs: SETUP_PROMPT_INTERVAL_MS })).toBe(true);
  });
});

describe('getSetupSheetCopy — 단계별 안내 창', () => {
  it('SP-10 미시작: ①이 지금 단계, 버튼은 manaba 통지 설정', () => {
    const c = getSetupSheetCopy('none');
    expect(c.title).toBe('まだ終わっていない設定があります');
    expect(c.steps).toEqual(['now', 'todo', 'todo']);
    expect(c.action).toBe('manaba通知を設定する');
  });
  it('SP-11 중간: ①완료 ②지금, 버튼은 설정 계속', () => {
    const c = getSetupSheetCopy('pending');
    expect(c.steps).toEqual(['done', 'now', 'todo']);
    expect(c.action).toBe('設定をつづける');
  });
  it('SP-12 알림 꺼짐(거부됨): 설정 앱을 여는 버튼 + 방법 안내', () => {
    const c = getSetupSheetCopy('no-push', 'settings');
    expect(c.action).toBe('設定アプリを開く');
    expect(c.guide.text).toContain('通知を許可');
  });
  it('SP-13 알림 꺼짐(아직 안 물어봄): 허용 팝업 버튼', () => {
    const c = getSetupSheetCopy('no-push', 'ask');
    expect(c.action).toBe('通知をオンにする');
    expect(c.guide).toBeNull();
  });
  it('SP-14 정상이면 안내 창 없음', () => {
    expect(getSetupSheetCopy('ready')).toBeNull();
  });
});

describe('resolvePushAction — 「通知をオンにする」가 할 일', () => {
  it('SP-20 허용됨 → 조용히 등록', () => {
    expect(resolvePushAction({ status: 'granted', canAskAgain: true })).toBe('register');
  });
  it('SP-21 아직 안 물어봄 → 허용 팝업', () => {
    expect(resolvePushAction({ status: 'undetermined', canAskAgain: true })).toBe('ask');
    expect(resolvePushAction(null)).toBe('ask');
  });
  it('SP-22 거부됨(iOS 는 다시 못 물어봄) → 설정 앱', () => {
    expect(resolvePushAction({ status: 'denied', canAskAgain: false })).toBe('settings');
  });
});
