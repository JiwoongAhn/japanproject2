/**
 * 마이페이지 하단 버전 표시 로직 테스트
 *
 * 핵심은 「네이티브 바이너리 버전을 우선 쓰고, 없으면 app.json으로 떨어진다」는 것.
 * 이게 뒤집히면 OTA 번들 버전이 표시되어 실기 진단에서 오판하게 된다.
 */

function loadWithMocks({ nativeVersion, nativeBuild, configVersion }) {
  jest.resetModules();
  jest.doMock('expo-application', () => ({
    nativeApplicationVersion: nativeVersion,
    nativeBuildVersion: nativeBuild,
  }));
  jest.doMock('expo-constants', () => ({
    __esModule: true,
    default: { expoConfig: configVersion ? { version: configVersion } : null },
  }));
  return require('../src/utils/appVersion');
}

describe('getAppVersionLabel', () => {
  it('네이티브 버전과 빌드번호가 둘 다 있으면 괄호까지 표시한다', () => {
    const { getAppVersionLabel } = loadWithMocks({
      nativeVersion: '1.0.3',
      nativeBuild: '11',
      configVersion: '1.0.4',
    });
    expect(getAppVersionLabel()).toBe('バージョン 1.0.3 (11)');
  });

  it('OTA로 app.json 버전이 더 높아도 네이티브 버전을 우선한다', () => {
    const { getAppVersion } = loadWithMocks({
      nativeVersion: '1.0.2',
      nativeBuild: '10',
      configVersion: '1.0.3',
    });
    expect(getAppVersion().version).toBe('1.0.2');
  });

  it('빌드번호가 없으면 버전만 표시한다', () => {
    const { getAppVersionLabel } = loadWithMocks({
      nativeVersion: '1.0.3',
      nativeBuild: null,
      configVersion: null,
    });
    expect(getAppVersionLabel()).toBe('バージョン 1.0.3');
  });

  it('네이티브 값이 없으면(Expo Go·웹) app.json 버전으로 대체한다', () => {
    const { getAppVersionLabel } = loadWithMocks({
      nativeVersion: null,
      nativeBuild: null,
      configVersion: '1.0.3',
    });
    expect(getAppVersionLabel()).toBe('バージョン 1.0.3');
  });

  it('버전을 전혀 알 수 없으면 null을 돌려준다(화면에 아무것도 안 그림)', () => {
    const { getAppVersionLabel } = loadWithMocks({
      nativeVersion: null,
      nativeBuild: null,
      configVersion: null,
    });
    expect(getAppVersionLabel()).toBeNull();
  });

  it('expo-application 접근이 던져도 앱이 죽지 않고 app.json으로 떨어진다', () => {
    jest.resetModules();
    jest.doMock('expo-application', () => ({
      get nativeApplicationVersion() {
        throw new Error('native module not linked');
      },
    }));
    jest.doMock('expo-constants', () => ({
      __esModule: true,
      default: { expoConfig: { version: '1.0.3' } },
    }));
    const { getAppVersionLabel } = require('../src/utils/appVersion');
    expect(getAppVersionLabel()).toBe('バージョン 1.0.3');
  });
});
