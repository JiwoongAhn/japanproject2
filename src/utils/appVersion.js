import * as Application from 'expo-application';
import Constants from 'expo-constants';

/**
 * 폰에 실제로 설치된 네이티브 바이너리의 버전/빌드번호를 읽는다.
 *
 * app.json의 version을 읽으면 OTA로 내려온 JS 번들의 버전이 나오기 때문에
 * 「App Store에서 받은 실물 앱이 어느 빌드인가」는 알 수 없다.
 * 네이티브 값을 봐야 OTA 번들이 낡았는지 / 스토어 업데이트가 반영됐는지 구분된다.
 *
 * Expo Go·웹·테스트 환경에서는 네이티브 값이 없으므로 app.json 버전으로 대체한다.
 */
export function getAppVersion() {
  let version = null;
  let build = null;

  try {
    version = Application.nativeApplicationVersion || null;
    build = Application.nativeBuildVersion || null;
  } catch {
    // 네이티브 모듈이 연결되지 않은 환경(Expo Go·웹 등)
  }

  if (!version) {
    version = Constants.expoConfig?.version || null;
  }

  return { version, build };
}

/**
 * 마이페이지 하단에 그대로 출력할 문자열.
 * 예) 'バージョン 1.0.3 (11)' / 'バージョン 1.0.3'
 * 버전을 전혀 알 수 없으면 null을 돌려주고, 화면에서는 아무것도 그리지 않는다.
 */
export function getAppVersionLabel() {
  const { version, build } = getAppVersion();
  if (!version) return null;
  return build ? `バージョン ${version} (${build})` : `バージョン ${version}`;
}
