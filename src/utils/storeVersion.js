import { Platform } from 'react-native';

/** App Store 의 UniOne 앱 ID (eas.json 의 ascAppId 와 같은 값) */
export const APPLE_APP_ID = '6784875972';

/** 버튼을 누르면 열리는 스토어 주소. itms-apps:// 는 App Store 앱을 직접 띄운다 */
export const APP_STORE_URL = `itms-apps://apps.apple.com/jp/app/id${APPLE_APP_ID}`;
export const APP_STORE_WEB_URL = `https://apps.apple.com/jp/app/id${APPLE_APP_ID}`;
export const PLAY_STORE_URL = 'market://details?id=com.jiwoongahn.unione';
export const PLAY_STORE_WEB_URL =
  'https://play.google.com/store/apps/details?id=com.jiwoongahn.unione';

/**
 * '1.0.10' 과 '1.0.9' 를 올바르게 비교한다.
 * 문자열로 비교하면 '1.0.10' < '1.0.9' 가 되어버리므로 숫자 단위로 쪼갠다.
 *
 * @returns a > b 면 1, a < b 면 -1, 같으면 0
 */
export function compareVersions(a, b) {
  if (!a || !b) return 0;

  const toParts = (v) =>
    String(v)
      .trim()
      .split('.')
      .map((n) => parseInt(n, 10) || 0);

  const pa = toParts(a);
  const pb = toParts(b);
  const len = Math.max(pa.length, pb.length);

  for (let i = 0; i < len; i += 1) {
    const na = pa[i] ?? 0;
    const nb = pb[i] ?? 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

/** 설치된 버전보다 스토어 버전이 높을 때만 true */
export function isStoreUpdateAvailable(installedVersion, storeVersion) {
  if (!installedVersion || !storeVersion) return false;
  return compareVersions(storeVersion, installedVersion) > 0;
}

/**
 * Apple 공개 API 로 현재 App Store 에 올라간 버전을 읽는다.
 * 서버를 따로 둘 필요가 없고 인증도 필요 없다.
 *
 * Android(Play) 는 공개 조회 API 가 없어서 null 을 돌려준다.
 * 안드로이드 사용자는 OTA 배너로 커버하고, 네이티브 업데이트는 Play 자동 업데이트에 맡긴다.
 *
 * @returns {Promise<{version: string, releaseNotes: string} | null>}
 */
export async function fetchStoreVersion({ fetchImpl = fetch, timeoutMs = 5000 } = {}) {
  if (Platform.OS !== 'ios') return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // 쿼리에 시각을 붙여 Apple 쪽 캐시를 피한다
    const res = await fetchImpl(
      `https://itunes.apple.com/lookup?id=${APPLE_APP_ID}&country=jp&t=${Date.now()}`,
      { signal: controller.signal }
    );
    if (!res.ok) return null;

    const json = await res.json();
    const entry = json?.results?.[0];
    if (!entry?.version) return null;

    return {
      version: entry.version,
      releaseNotes: entry.releaseNotes || '',
    };
  } catch {
    // 네트워크 실패·타임아웃은 조용히 넘긴다. 업데이트 안내는 있으면 좋은 기능이지 필수가 아니다
    return null;
  } finally {
    clearTimeout(timer);
  }
}
