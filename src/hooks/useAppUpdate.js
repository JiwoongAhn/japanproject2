import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform, Linking } from 'react-native';
import * as Updates from 'expo-updates';
import { getAppVersion } from '../utils/appVersion';
import {
  fetchStoreVersion,
  isStoreUpdateAvailable,
  APP_STORE_URL,
  APP_STORE_WEB_URL,
  PLAY_STORE_URL,
  PLAY_STORE_WEB_URL,
} from '../utils/storeVersion';

/**
 * 앱 실행당 1회만 확인하기 위한 모듈 레벨 캐시.
 * HomeScreen 은 탭 전환으로 다시 마운트될 수 있어서, 가드가 없으면
 * 그때마다 OTA 확인 + Apple API 호출이 반복된다.
 * (앱을 완전히 종료하고 다시 켜면 모듈이 새로 로드되어 자연히 초기화된다)
 */
let sessionResult = null;

/**
 * 업데이트가 있는지 판단해서 홈 배너·모달에 넘겨주는 훅.
 *
 * 업데이트는 두 종류이고 유저가 할 일이 다르다.
 *  - 'ota'   : JS 코드만 바뀐 경우. 앱 안에서 즉시 적용 가능(스토어 안 감)
 *  - 'store' : 네이티브 바이너리가 바뀐 경우. iOS 는 앱이 자기를 설치할 수 없으므로
 *              App Store 제품 페이지를 열어주는 것이 한계다
 *
 * OTA 가 있으면 OTA 를 우선한다(더 빠르고 유저 손이 덜 간다).
 */
export function useAppUpdate() {
  // 'none' | 'ota' | 'store'
  const [kind, setKind] = useState(sessionResult?.kind ?? 'none');
  const [storeVersion, setStoreVersion] = useState(sessionResult?.storeVersion ?? null);
  const [releaseNotes, setReleaseNotes] = useState(sessionResult?.releaseNotes ?? '');
  // 이미 받아져서 재시작만 하면 되는 상태인지 (fetch 를 건너뛸 수 있다)
  const [otaPending, setOtaPending] = useState(sessionResult?.otaPending ?? false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  // 언마운트 후 setState 경고를 막는다
  const aliveRef = useRef(true);
  useEffect(() => () => { aliveRef.current = false; }, []);

  useEffect(() => {
    // 이번 실행에서 이미 확인했으면 네트워크를 다시 타지 않는다
    if (sessionResult) return undefined;

    let cancelled = false;

    (async () => {
      // ① OTA 먼저 확인한다 — 있으면 유저가 스토어까지 갈 필요가 없다
      try {
        // __DEV__ / Expo Go 에서는 OTA 가 비활성이라 호출 자체가 던진다
        if (Updates.isEnabled) {
          // expo-updates 는 기본값(ON_LOAD)으로 앱 실행 시 이미 새 번들을 받아둔다.
          // 그 경우 checkForUpdateAsync 는 "받을 것 없음"을 돌려주지만 실제로는
          // 적용 대기 상태이므로, isUpdatePending 을 먼저 본다.
          if (Updates.isUpdatePending) {
            sessionResult = { kind: 'ota', otaPending: true, storeVersion: null, releaseNotes: '' };
            if (!cancelled && aliveRef.current) {
              setOtaPending(true);
              setKind('ota');
            }
            return;
          }

          const result = await Updates.checkForUpdateAsync();
          if (result?.isAvailable) {
            sessionResult = { kind: 'ota', otaPending: false, storeVersion: null, releaseNotes: '' };
            if (!cancelled && aliveRef.current) setKind('ota');
            return;
          }
        }
      } catch {
        // OTA 확인 실패는 무시하고 스토어 확인으로 넘어간다
      }

      // ② OTA 가 없으면 스토어에 새 바이너리가 올라왔는지 확인한다
      const store = await fetchStoreVersion();
      const { version: installed } = getAppVersion();

      if (store && isStoreUpdateAvailable(installed, store.version)) {
        sessionResult = {
          kind: 'store',
          otaPending: false,
          storeVersion: store.version,
          releaseNotes: store.releaseNotes,
        };
        if (!cancelled && aliveRef.current) {
          setStoreVersion(store.version);
          setReleaseNotes(store.releaseNotes);
          setKind('store');
        }
      } else {
        sessionResult = { kind: 'none', otaPending: false, storeVersion: null, releaseNotes: '' };
      }
    })();

    return () => { cancelled = true; };
  }, []);

  /** OTA 적용: 새 번들을 받아서 앱을 재시작한다 (유저 체감 1~3초) */
  const applyOtaUpdate = useCallback(async () => {
    setApplying(true);
    setError(null);
    try {
      // 이미 받아둔 상태라면 다시 받을 필요 없이 재시작만 하면 된다
      if (!otaPending) {
        await Updates.fetchUpdateAsync();
      }
      await Updates.reloadAsync();
      // reloadAsync 가 성공하면 여기 아래는 실행되지 않는다 (앱이 재시작됨)
    } catch (e) {
      if (aliveRef.current) {
        setApplying(false);
        setError(e?.message || 'unknown');
      }
    }
  }, [otaPending]);

  /** 스토어 열기: itms-apps:// 가 막히면 https 로 떨어진다 */
  const openStore = useCallback(async () => {
    const deepLink = Platform.OS === 'ios' ? APP_STORE_URL : PLAY_STORE_URL;
    const webLink = Platform.OS === 'ios' ? APP_STORE_WEB_URL : PLAY_STORE_WEB_URL;
    try {
      await Linking.openURL(deepLink);
    } catch {
      try {
        await Linking.openURL(webLink);
      } catch {
        if (aliveRef.current) setError('store-open-failed');
      }
    }
  }, []);

  const dismiss = useCallback(() => setDismissed(true), []);

  return {
    // 이번 실행에서 닫았으면 숨긴다. 다음 실행 때 다시 뜬다 (강제 업데이트는 하지 않는다)
    updateKind: dismissed ? 'none' : kind,
    storeVersion,
    releaseNotes,
    applying,
    error,
    applyOtaUpdate,
    openStore,
    dismiss,
  };
}
