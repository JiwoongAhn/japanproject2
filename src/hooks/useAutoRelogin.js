// 학교 사이트 WebView 공용 자동 재로그인 훅
//
// ManabaLoginScreen 에서 실기 검증된 흐름(2026-09-18)을 그대로 추출한 것.
// 화면(manaba / 리마인더 설정 / 타교 LMS 인앱 브라우저)은 다음만 하면 된다:
//   1) onLoadEnd 마다 PROBE_LOGIN_FORM_JS 를 주입
//   2) onMessage 에서 type==='loginProbe' → handleProbe(msg), type==='credentials' → handleCredentials(msg)
//   3) "로그인된 상태"를 화면 나름의 기준으로 판정했으면 notifySuccess() 호출
//
// 판정 기준은 universityLinks[id].autoLoginHosts (utils/autoLoginPolicy). 목록에 없는 호스트의
// 로그인 폼(SSO IdP 등)에서는 캡처도 자동입력도 하지 않는다 → 사용자가 직접 로그인.
// ID/PW는 기기 내 AES-256 저장(LargeSecureStore)만, 서버 전송 없음.
import { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import {
  credKeyForUrl,
  getCredentials,
  saveCredentials,
  buildAutoFillJS,
  CAPTURE_CREDENTIALS_JS,
} from '../utils/schoolCookies';
import { isAutoLoginHost, hostOf } from '../utils/autoLoginPolicy';
import {
  AUTO_RELOGIN_TIMEOUT_MS,
  canAttemptAutoRelogin,
  recordAutoReloginSuccess,
  recordAutoReloginFailure,
} from '../utils/manabaSession';

const FAIL_TITLE = '自動ログインに失敗しました';
const FAIL_BODY = 'IDまたはパスワードが変わった可能性があります。手動でログインしてください。';

export function useAutoRelogin({ webViewRef, links, enabled = true }) {
  const [autoRelogging, setAutoRelogging] = useState(false);
  // 현재 페이지 로드 사이클 내에서 한 번만 트리거하기 위한 가드 (연속 onLoadEnd 방지)
  const autoReloggedRef = useRef(false);
  // 타임아웃 타이머 — 자동 제출 후 로그인 상태 도달 못 하면 실패 기록
  const timerRef = useRef(null);
  // 사용자가 ログアウト를 직접 눌렀으면 이 화면에 있는 동안은 자동 입력을 하지 않는다.
  // (로그인 폼을 인식하는 순간 다시 로그인해 버리면 로그아웃이 불가능해짐)
  const manualLogoutRef = useRef(false);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  // 언마운트 시 타이머 정리 (메모리 누수 방지)
  useEffect(() => clearTimer, []);

  // 로컬 상태 리셋 (오버레이, 사이클 가드, 타이머). 글로벌 카운터는 별도.
  const resetLocal = () => {
    setAutoRelogging(false);
    autoReloggedRef.current = false;
    clearTimer();
  };

  // 사용자가 로그인 폼에 입력·제출한 ID/PW 캡처 → 허용 호스트면 암호화 저장.
  // 반환: 저장했으면 true
  const handleCredentials = (msg) => {
    if (!enabled || !msg?.pw) return false;
    const formUrl = msg.host ? `https://${msg.host}` : '';
    if (!isAutoLoginHost(formUrl, links)) return false;
    console.log('[AUTOLOGIN] 로그인 폼 제출 감지 → ID/PW 저장:', hostOf(formUrl));
    saveCredentials(credKeyForUrl(formUrl), msg.id, msg.pw);
    return true;
  };

  // 프로브 결과 처리. 비밀번호 칸이 있는 페이지(=로그인 폼)만 여기서 다루고,
  // 없는 페이지는 화면이 판정한다. 반환: 로그인 폼이었으면 true
  const handleProbe = (msg) => {
    if (!msg?.hasPassword) return false;
    const loadedUrl = msg.url || '';

    if (!enabled || !isAutoLoginHost(loadedUrl, links)) {
      // SSO IdP 등 자동 입력 대상이 아닌 로그인 폼 → 사용자가 직접 로그인
      console.log('[AUTOLOGIN] 자동입력 비대상 로그인 폼:', hostOf(loadedUrl));
      return true;
    }
    // 로그인 폼이면 항상 캡처 훅 주입 (수동 로그인=저장 / 자동 제출=갱신. __credHooked 로 중복 방지)
    console.log('[AUTOLOGIN] 로그인 폼 감지:', hostOf(loadedUrl), '→ 캡처 훅 주입');
    webViewRef.current?.injectJavaScript(CAPTURE_CREDENTIALS_JS);

    if (manualLogoutRef.current) {
      console.log('[AUTOLOGIN] 사용자 로그아웃 직후 → 자동 입력 생략');
      return true;
    }
    if (autoReloggedRef.current) {
      // 자동 제출했는데 로그인 폼이 다시 떴다 = 서버가 거부(비밀번호 변경 등).
      // 타임아웃을 기다리지 않고 즉시 실패 처리해 오버레이를 걷고 수동 로그인으로 넘긴다.
      console.log('[AUTOLOGIN] 자동 제출 후 로그인 폼 재출현 → 즉시 실패 처리');
      clearTimer();
      recordAutoReloginFailure();
      setAutoRelogging(false);
      Alert.alert(FAIL_TITLE, FAIL_BODY);
      return true;
    }
    if (!canAttemptAutoRelogin()) {
      // 이번 세션에 이미 2번 자동 실패 → 쿨다운, 수동 로그인 유도
      console.log('[AUTOLOGIN] 쿨다운(이미 2회 실패) → 수동 로그인 유도');
      setAutoRelogging(false);
      Alert.alert(FAIL_TITLE, FAIL_BODY);
      return true;
    }
    autoReloggedRef.current = true;
    setAutoRelogging(true);

    // 타임아웃 가드 — 네트워크 멈춤/학교 서버 장애로 무한 대기 방지
    clearTimer();
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      recordAutoReloginFailure();
      setAutoRelogging(false);
      console.log('[AUTOLOGIN] 자동입력 후 로그인 미도달(타임아웃) → 실패 기록');
      Alert.alert(
        '自動ログインがタイムアウトしました',
        'ネットワーク状態を確認して、もう一度お試しください。'
      );
    }, AUTO_RELOGIN_TIMEOUT_MS);

    getCredentials(credKeyForUrl(loadedUrl)).then((creds) => {
      if (creds?.id && creds?.pw && webViewRef.current) {
        console.log('[AUTOLOGIN] 저장된 ID/PW 있음 → 자동 입력 시도');
        webViewRef.current.injectJavaScript(buildAutoFillJS(creds.id, creds.pw));
      } else {
        // 저장된 자격증명이 없음 → 첫 로그인이면 정상. 안내 후 수동 로그인으로.
        console.log('[AUTOLOGIN] 저장된 ID/PW 없음 → 수동 로그인 필요');
        clearTimer();
        setAutoRelogging(false);
        autoReloggedRef.current = false; // 수동 제출 후 폼 재출현을 '자동입력 거부'로 오판하지 않도록
        Alert.alert(
          '自動ログイン情報が見つかりません',
          '一度手動でログインすると、次回から自動でログインできます。'
        );
      }
    });
    return true;
  };

  // 화면이 "로그인된 상태"를 확인했을 때 호출 → 글로벌 카운터 리셋 + 오버레이 해제
  const notifySuccess = () => {
    recordAutoReloginSuccess();
    resetLocal();
  };

  return {
    autoRelogging,
    handleProbe,
    handleCredentials,
    notifySuccess,
    markManualLogout: () => { manualLogoutRef.current = true; },
    clearManualLogout: () => { manualLogoutRef.current = false; },
    isManualLogout: () => manualLogoutRef.current,
  };
}
