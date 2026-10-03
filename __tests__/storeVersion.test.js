import {
  compareVersions,
  isStoreUpdateAvailable,
  fetchStoreVersion,
  APP_STORE_URL,
} from '../src/utils/storeVersion';

describe('compareVersions', () => {
  it('같은 버전은 0', () => {
    expect(compareVersions('1.0.3', '1.0.3')).toBe(0);
  });

  it('패치 버전이 높으면 1', () => {
    expect(compareVersions('1.0.4', '1.0.3')).toBe(1);
    expect(compareVersions('1.0.3', '1.0.4')).toBe(-1);
  });

  it('⚠️ 문자열 비교의 함정: 1.0.10 은 1.0.9 보다 높다', () => {
    // 문자열로 비교하면 '1.0.10' < '1.0.9' 가 되어 업데이트 안내가 안 뜬다
    expect(compareVersions('1.0.10', '1.0.9')).toBe(1);
    expect(compareVersions('1.0.9', '1.0.10')).toBe(-1);
  });

  it('마이너·메이저도 올바르게 비교한다', () => {
    expect(compareVersions('1.1.0', '1.0.99')).toBe(1);
    expect(compareVersions('2.0.0', '1.99.99')).toBe(1);
  });

  it('자리수가 달라도 비교된다 (1.1 vs 1.1.0 은 같음)', () => {
    expect(compareVersions('1.1', '1.1.0')).toBe(0);
    expect(compareVersions('1.1.1', '1.1')).toBe(1);
  });

  it('값이 없으면 0 (업데이트 안내를 띄우지 않는 쪽으로 안전하게)', () => {
    expect(compareVersions(null, '1.0.3')).toBe(0);
    expect(compareVersions('1.0.3', undefined)).toBe(0);
  });
});

describe('isStoreUpdateAvailable', () => {
  it('스토어가 더 높을 때만 true', () => {
    expect(isStoreUpdateAvailable('1.0.3', '1.0.4')).toBe(true);
    expect(isStoreUpdateAvailable('1.0.3', '1.0.3')).toBe(false);
  });

  it('⚠️ 설치본이 더 높아도 안내하지 않는다 (TestFlight·개발 빌드 케이스)', () => {
    // 개발자 폰은 스토어보다 앞선 빌드가 깔려 있을 수 있다. 여기서 안내가 뜨면 혼란만 준다
    expect(isStoreUpdateAvailable('1.0.4', '1.0.3')).toBe(false);
  });

  it('버전을 모르면 안내하지 않는다', () => {
    expect(isStoreUpdateAvailable(null, '1.0.4')).toBe(false);
    expect(isStoreUpdateAvailable('1.0.3', null)).toBe(false);
  });
});

describe('fetchStoreVersion', () => {
  it('Apple 응답에서 버전과 릴리스 노트를 뽑는다', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        resultCount: 1,
        results: [{ version: '1.0.4', releaseNotes: '・修正しました' }],
      }),
    });
    const r = await fetchStoreVersion({ fetchImpl });
    expect(r).toEqual({ version: '1.0.4', releaseNotes: '・修正しました' });
  });

  it('앱이 조회되지 않으면 null', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ resultCount: 0, results: [] }),
    });
    expect(await fetchStoreVersion({ fetchImpl })).toBeNull();
  });

  it('네트워크가 실패해도 던지지 않고 null (업데이트 안내는 필수 기능이 아니다)', async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new Error('offline'));
    expect(await fetchStoreVersion({ fetchImpl })).toBeNull();
  });

  it('HTTP 오류도 null', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: false });
    expect(await fetchStoreVersion({ fetchImpl })).toBeNull();
  });
});

describe('스토어 링크', () => {
  it('itms-apps 스킴이어야 App Store 앱이 바로 열린다', () => {
    expect(APP_STORE_URL).toBe('itms-apps://apps.apple.com/jp/app/id6784875972');
  });
});
