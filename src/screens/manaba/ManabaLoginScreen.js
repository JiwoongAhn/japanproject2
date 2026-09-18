import React, { useRef, useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { colors } from '../../constants/colors';
import LoadingDots from '../../components/LoadingDots';
import UnofficialNotice from '../../components/UnofficialNotice';
import {
  DISABLE_AUTOCAPS_JS,
  saveCookies,
  getSavedCookieHeader,
  restoreCookies,
  clearCookies,
  cookieKeyForUrl,
  credKeyForUrl,
  getCredentials,
  saveCredentials,
  buildAutoFillJS,
  CAPTURE_CREDENTIALS_JS,
  PROBE_LOGIN_FORM_JS,
} from '../../utils/schoolCookies';

// 자동 재로그인(ID/PW 기기 저장 + 자동 입력)을 허용하는 로그인 폼 호스트.
// - 내 학교 manaba 자체 폼 (국사관 manaba는 세션이 끊기면 같은 URL에 자체 ID/PW 폼을 띄움 — 2026-09-18 실측)
// - kaede-i (국사관 학내 포털, 예전엔 manaba 만료 시 여기로 튕긴다고 가정했었음)
// SSO 학교(Microsoft/SAML IdP)는 다단계 폼이라 자동 입력 대상에서 제외한다.
const KAEDE_HOST = 'kaedei.kokushikan.ac.jp';
import {
  DEFAULT_MANABA_ORIGIN,
  manabaOriginFrom,
  manabaUrlsFor,
  supportsManaba,
  UNIPAS_USER_AGENT,
} from '../../constants/manaba';
import { findUniversityByEmail, getUniversityLinks } from '../../utils/university';
import { useAuth } from '../../lib/AuthProvider';

// manaba는 PC용 레이아웃이라 viewport에 user-scalable=no / maximum-scale=1 이 설정되어 있음.
// 페이지 로드 후 해당 제약을 제거해 핀치줌을 허용한다 (iOS + Android 공통).
const ENABLE_PINCH_ZOOM_JS = `
(function() {
  var meta = document.querySelector('meta[name="viewport"]');
  if (meta) {
    var content = meta.getAttribute('content') || '';
    content = content.replace(/user-scalable\s*=\s*no/gi, 'user-scalable=yes');
    content = content.replace(/maximum-scale\s*=\s*1(\.0)?/gi, 'maximum-scale=5.0');
    meta.setAttribute('content', content);
  }
})();
true;
`;
import { clearCachedNotices } from '../../utils/manabaCache';
import {
  AUTO_RELOGIN_TIMEOUT_MS,
  canAttemptAutoRelogin,
  recordAutoReloginSuccess,
  recordAutoReloginFailure,
} from '../../utils/manabaSession';

// URL에서 호스트만 뽑는다 (학교별 manaba 판별용)
const hostOf = (url) => (String(url || '').match(/^https?:\/\/([^/]+)/) || [])[1] || '';

// 로그인 성공 여부 판단: 로그인/로그아웃 페이지 이외의 manaba 페이지면 로그인 완료
// (/ct/logout을 제외하지 않으면 로그아웃 도중 다시 로그인 처리되어 홈으로 튕김)
// 학교마다 manaba 호스트가 다르므로 내 학교 origin과 비교한다.
// SSO 학교(大東=Microsoft, 亜細亜·東洋=SAML IdP)는 다른 호스트로 갔다가 돌아오므로 호스트 비교로 자연히 대기.
// 東洋 ToyoNet-ACE 는 같은 호스트에 /local/login 이 있어 '/ct/login' 만 제외하면 오판 → '/login' 전체 제외.
const isLoggedIn = (url, origin) =>
  !!origin &&
  hostOf(url) === hostOf(origin) &&
  !/\/login(\b|[/?#])/.test(url) &&
  !url.includes('/ct/logout');

export default function ManabaLoginScreen({ navigation, route }) {
  const webViewRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [ready, setReady] = useState(false);
  const [cookieHeader, setCookieHeader] = useState(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [autoRelogging, setAutoRelogging] = useState(false);
  // 현재 페이지 로드 사이클 내에서 한 번만 트리거하기 위한 가드 (연속 onLoadEnd 방지)
  const autoReloggedRef = useRef(false);
  // 타임아웃 타이머 핸들 — 자동 재로그인 트리거 시 시작, manaba 도착/언마운트 시 해제.
  const autoReloginTimerRef = useRef(null);
  // 사용자가 ログアウト를 직접 눌렀으면 이 화면에 있는 동안은 자동 입력을 하지 않는다.
  // (로그인 폼을 인식하는 순간 다시 로그인해 버리면 로그아웃이 불가능해짐)
  // 화면을 닫았다 다시 열면 ref가 초기화되므로 그때는 자동 로그인 대상.
  const manualLogoutRef = useRef(false);
  // 내 학교의 manaba 주소를 결정한다.
  // 우선순위: 화면 진입 시 넘겨받은 university → 로그인 이메일로 판정 → (없으면) 국사관.
  // 학교마다 서브도메인이 다르므로(kokushikan/daito/asia-u …) 이걸 안 하면
  // 타 학교 학생이 국사관 manaba 로그인 화면을 보게 된다.
  const { session } = useAuth();
  const manabaUrls = useMemo(() => {
    const fromRoute = route?.params?.university;
    const universityId =
      fromRoute?.id ?? fromRoute ?? findUniversityByEmail(session?.user?.email)?.id;
    const origin =
      manabaOriginFrom(getUniversityLinks(universityId)?.manabaUrl) ?? DEFAULT_MANABA_ORIGIN;
    return manabaUrlsFor(origin);
  }, [route?.params?.university, session?.user?.email]);

  const cookieKey = useMemo(() => cookieKeyForUrl(manabaUrls.login), [manabaUrls.login]);
  // 자동 입력을 시도할 호스트 목록 (저장 키는 credKeyForUrl로 호스트별 분리)
  const isAutoLoginHost = (url) => {
    const h = hostOf(url);
    return !!h && (h === hostOf(manabaUrls.origin) || h === KAEDE_HOST);
  };

  // 최후 방어선: manaba를 쓰지 않는 학교에서 이 화면에 들어오면 즉시 되돌린다.
  // (위 manabaUrls는 크래시 방지용으로 국사관을 폴백하므로, 게이트가 없으면
  //  타 학교 학생이 국사관 manaba 서버에 접속하게 된다)
  const universityUsesManaba = useMemo(() => {
    const fromRoute = route?.params?.university;
    const universityId =
      fromRoute?.id ?? fromRoute ?? findUniversityByEmail(session?.user?.email)?.id;
    return supportsManaba(getUniversityLinks(universityId)?.manabaUrl);
  }, [route?.params?.university, session?.user?.email]);

  useEffect(() => {
    if (universityUsesManaba) return;
    Alert.alert(
      'ご利用の大学では未対応です',
      'この機能はmanabaを利用している大学のみご利用いただけます。\n順次対応を進めています。',
      [{ text: '閉じる', onPress: () => navigation.goBack() }],
      { cancelable: false }
    );
  }, [universityUsesManaba, navigation]);

  // 마운트 시 저장된 쿠키를 복원한 뒤 WebView 렌더
  // - restoreCookies: WKWebView 쿠키 저장소에 직접 주입 + 만료일 7일 부여
  //   (세션 쿠키가 앱 종료/내부 리디렉션에도 살아남도록 영속화 — iOS headers.Cookie 불안정 보완)
  // - getSavedCookieHeader: 첫 요청 headers.Cookie 보조용
  // 쿠키가 있으면 /ct/login 진입 시 서버가 /ct/home으로 보내 자동 파싱됨
  useEffect(() => {
    let mounted = true;
    (async () => {
      await restoreCookies(manabaUrls.login, cookieKey);
      const header = await getSavedCookieHeader(cookieKey);
      if (mounted) {
        setCookieHeader(header || null);
        setReady(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [cookieKey]);

  // 언마운트 시 자동 재로그인 타이머가 떠 있다면 정리 (메모리 누수 방지)
  useEffect(() => {
    return () => {
      if (autoReloginTimerRef.current) {
        clearTimeout(autoReloginTimerRef.current);
        autoReloginTimerRef.current = null;
      }
    };
  }, []);

  // 로그아웃: 쿠키 제거 후 로그인 페이지로
  const handleLogout = () => {
    Alert.alert('ログアウト', 'manabaからログアウトしますか?', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: 'ログアウト',
        style: 'destructive',
        onPress: () => {
          manualLogoutRef.current = true;
          // 쿠키가 살아있는 상태에서 서버 로그아웃 URL로 이동 → 서버 세션 종료.
          // (manaba는 WebView 쿠키만 지워선 세션이 안 끊겨 다시 로그인 화면이 안 뜸)
          // 나머지 정리(쿠키·캐시 삭제)는 /ct/logout 도착을 프로브로 확인한 뒤 finishLogout에서.
          // ⚠️ 여기서 state(cookieHeader 등)를 바꾸면 WebView source가 바뀌어 즉시 재로드되고,
          //    진행 중이던 로그아웃 요청이 취소돼 "로그아웃이 안 되는" 경합이 생겼음(2026-09-18 실기).
          webViewRef.current?.injectJavaScript(
            `window.location.href = '${manabaUrls.logout}';`
          );
        },
      },
    ]);
  };

  // 서버 로그아웃 완료(/ct/logout 도착) 후 정리 → 로그인 폼으로 이동
  const finishLogout = async () => {
    // 1) 기기에 저장된 쿠키 삭제 → 다음 실행 때 자동 로그인 방지
    await clearCookies(manabaUrls.login, cookieKey);
    // 2) 홈 화면 공지 캐시도 비워 로그아웃 상태로 되돌림
    await clearCachedNotices();
    setLoggedIn(false);
    // 3) /ct/logout 페이지는 거의 빈 화면이라 로그인 폼으로 보내준다
    //    (manualLogoutRef가 켜져 있어 자동 입력은 하지 않음)
    webViewRef.current?.injectJavaScript(`window.location.href = '${manabaUrls.login}';`);
  };

  // 자동 재로그인 로컬 상태 리셋 (오버레이, 사이클 ref, 타이머).
  // 글로벌 카운터는 별도로 헬퍼의 recordSuccess/Failure로 갱신.
  const resetAutoReloginLocal = () => {
    setAutoRelogging(false);
    autoReloggedRef.current = false;
    if (autoReloginTimerRef.current) {
      clearTimeout(autoReloginTimerRef.current);
      autoReloginTimerRef.current = null;
    }
  };

  // 페이지 이동 감지 — 뒤로가기 버튼 표시용.
  // 로그인 성공/실패 판정은 URL이 아니라 페이지 로드 후 프로브(비밀번호 칸 유무)로 한다.
  // (manaba는 세션이 끊겨도 /ct/home URL 그대로 로그인 폼을 띄우므로 URL만으론 오판)
  const handleNavigationStateChange = (navState) => {
    setCanGoBack(navState.canGoBack);
  };

  // ‹ 버튼: WebView 내부 페이지 한 단계 뒤로
  const handleWebBack = () => {
    if (canGoBack) webViewRef.current?.goBack();
  };

  // 閉じる 버튼: manaba 모달 전체를 터치 한 번에 닫고 복귀
  const handleClose = () => {
    navigation.goBack();
  };

  // WebView에서 파싱 결과를 수신
  const handleMessage = (event) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);

      // 사용자가 kaede 로그인 폼에 입력·제출한 ID/PW를 캡처해 암호화 저장.
      // → 다음 세션 만료 시 자동 재로그인(buildAutoFillJS)에 사용. 서버 전송 없음.
      if (msg.type === 'credentials' && msg.pw) {
        const formUrl = msg.host ? `https://${msg.host}` : '';
        if (isAutoLoginHost(formUrl)) {
          console.log('[MANABA-DIAG] 로그인 폼 제출 감지 → ID/PW 저장:', msg.host);
          saveCredentials(credKeyForUrl(formUrl), msg.id, msg.pw);
        }
        return;
      }
      if (msg.type === 'loginProbe') {
        handleLoginProbe(msg);
        return;
      }
    } catch (_) {}
  };

  // 페이지 로드 완료 → 이 페이지가 로그인 폼인지 프로브로 물어본다 (결과는 handleLoginProbe)
  const handleLoadEnd = () => {
    setLoading(false);
    webViewRef.current?.injectJavaScript(PROBE_LOGIN_FORM_JS);
  };

  // 프로브 결과 처리 — 두 갈래
  //   (1) 비밀번호 칸 있음 = 로그인 폼 (manaba 자체 폼 / kaede 폼)
  //       → 캡처 훅 주입(수동 로그인 시 ID/PW 저장) + 저장된 ID/PW가 있으면 자동 입력·제출
  //   (2) 비밀번호 칸 없음 + 내 학교 manaba 호스트 = 로그인된 상태
  //       → 성공 처리(카운터 리셋), 쿠키 저장, /login에 머물러 있으면 홈으로
  const handleLoginProbe = (msg) => {
    const loadedUrl = msg.url || '';

    // 로그아웃 페이지 도착 = 서버 세션 종료 완료 → 정리 후 로그인 폼으로
    if (manualLogoutRef.current && loadedUrl.includes('/ct/logout')) {
      console.log('[MANABA-DIAG] /ct/logout 도착 → 쿠키·캐시 정리 후 로그인 폼으로');
      finishLogout();
      return;
    }

    if (msg.hasPassword) {
      if (!isAutoLoginHost(loadedUrl)) {
        // SSO IdP 등 자동 입력 대상이 아닌 로그인 폼 → 사용자가 직접 로그인
        console.log('[MANABA-DIAG] 자동입력 비대상 로그인 폼:', hostOf(loadedUrl));
        return;
      }
      const credKey = credKeyForUrl(loadedUrl);
      // 로그인 폼이면 항상 자격증명 캡처 훅을 주입.
      // (수동 로그인=값 저장 / 자동 채우기 제출=값 갱신. 훅은 __credHooked로 중복방지)
      console.log('[MANABA-DIAG] 로그인 폼 감지(세션 만료):', hostOf(loadedUrl), '→ 캡처 훅 주입');
      webViewRef.current?.injectJavaScript(CAPTURE_CREDENTIALS_JS);

      if (manualLogoutRef.current) {
        console.log('[MANABA-DIAG] 사용자 로그아웃 직후 → 자동 입력 생략');
        return;
      }
      if (autoReloggedRef.current) {
        // 자동 제출했는데 로그인 폼이 다시 떴다 = 서버가 거부(비밀번호 변경 등).
        // 15초 타임아웃을 기다리지 않고 즉시 실패 처리해 오버레이를 걷고 수동 로그인으로 넘긴다.
        console.log('[MANABA-DIAG] 자동 제출 후 로그인 폼 재출현 → 즉시 실패 처리');
        if (autoReloginTimerRef.current) {
          clearTimeout(autoReloginTimerRef.current);
          autoReloginTimerRef.current = null;
        }
        recordAutoReloginFailure();
        setAutoRelogging(false);
        Alert.alert(
          '自動ログインに失敗しました',
          'IDまたはパスワードが変わった可能性があります。手動でログインしてください。'
        );
        return;
      }

      // 글로벌 정책 체크 — 누적 실패 + 쿨다운 (헬퍼가 판단)
      if (!canAttemptAutoRelogin()) {
        // [진단] 경로 A-쿨다운: 이번 세션에 이미 2번 자동 실패 → 포기
        console.log('[MANABA-DIAG] 쿨다운(이미 2회 실패) → 수동 로그인 유도');
        setAutoRelogging(false);
        Alert.alert(
          '自動ログインに失敗しました', // [診断A] 2回失敗して手動へ
          'IDまたはパスワードが変わった可能性があります。手動でログインしてください。'
        );
        return;
      }
      autoReloggedRef.current = true;
      setAutoRelogging(true);

      // 타임아웃 가드 — 자동 제출 후 manaba 로그인 상태에 도달하지 않으면 실패로 기록
      // (네트워크 멈춤/학교 서버 장애로 무한 대기 방지)
      if (autoReloginTimerRef.current) clearTimeout(autoReloginTimerRef.current);
      autoReloginTimerRef.current = setTimeout(() => {
        autoReloginTimerRef.current = null;
        recordAutoReloginFailure();
        setAutoRelogging(false);
        // [진단] 경로 A-실패: 자동 입력·제출했지만 manaba 도달 실패 (비번틀림/폼불일치/네트워크)
        console.log('[MANABA-DIAG] 자동입력 후 manaba 미도달(타임아웃) → 실패 기록');
        Alert.alert(
          '自動ログインがタイムアウトしました', // [診断A] 自動入力したが失敗
          'ネットワーク状態を確認して、もう一度お試しください。'
        );
      }, AUTO_RELOGIN_TIMEOUT_MS);

      getCredentials(credKey).then((creds) => {
        if (creds?.id && creds?.pw && webViewRef.current) {
          // [진단] 경로 A-시도: 저장된 ID/PW로 자동 입력·제출
          console.log('[MANABA-DIAG] 저장된 ID/PW 있음 → 자동 입력 시도');
          webViewRef.current.injectJavaScript(buildAutoFillJS(creds.id, creds.pw));
        } else {
          // [진단] 경로 B: 저장된 자격증명이 없음 → 애초에 자동 시도 불가 (첫 로그인이면 정상)
          console.log('[MANABA-DIAG] 저장된 ID/PW 없음 → 수동 로그인 필요');
          if (autoReloginTimerRef.current) {
            clearTimeout(autoReloginTimerRef.current);
            autoReloginTimerRef.current = null;
          }
          setAutoRelogging(false);
          Alert.alert(
            '自動ログイン情報が見つかりません', // [診断B] 保存された認証情報なし
            '一度手動でログインすると、次回から自動でログインできます。'
          );
        }
      });
      return;
    }

    // 비밀번호 칸 없음 → 내 학교 manaba 페이지면 로그인된 상태
    if (isLoggedIn(loadedUrl, manabaUrls.origin)) {
      // [진단] manaba 도달 = 로그인 유지/자동 재로그인 성공
      console.log('[MANABA-DIAG] manaba 로그인 상태 확인 → 성공(카운터 리셋)');
      recordAutoReloginSuccess();
      resetAutoReloginLocal();
      // 로그인 직후 쿠키 저장 (다음 실행 때 자동 로그인)
      saveCookies(manabaUrls.login, cookieKey);
      if (!loggedIn) setLoggedIn(true); // 면책 고지 숨김 (단방향)
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={handleClose} style={styles.textBtn}>
            <Text style={styles.closeText}>閉じる</Text>
          </TouchableOpacity>
          {canGoBack && (
            <TouchableOpacity onPress={handleWebBack} style={styles.backButton}>
              <Text style={styles.backIcon}>‹</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.headerTitle}>manaba</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={handleLogout} style={styles.textBtn}>
            <Text style={styles.logoutText}>ログアウト</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 쿠키 만료 시 자동 재로그인 오버레이 */}
      {autoRelogging && (
        <View style={styles.parsingOverlay}>
          <LoadingDots />
          <Text style={styles.parsingText}>自動ログイン中…</Text>
        </View>
      )}

      {/* 로딩 인디케이터 (쿠키 준비 중 + 페이지 로딩 중) */}
      {(loading || !ready) && (
        <View style={styles.loadingBar}>
          <LoadingDots size={7} />
        </View>
      )}

      {/* 쿠키 헤더 준비 후에만 WebView 렌더 (세션 쿠키가 첫 요청에 실리도록) */}
      {ready && (
        <WebView
          ref={webViewRef}
          source={{
            uri: manabaUrls.login,
            headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
          }}
          style={styles.webView}
          applicationNameForUserAgent={UNIPAS_USER_AGENT}
          injectedJavaScriptBeforeContentLoaded={DISABLE_AUTOCAPS_JS}
          injectedJavaScript={ENABLE_PINCH_ZOOM_JS}
          scalesPageToFit={true}
          onNavigationStateChange={handleNavigationStateChange}
          onMessage={handleMessage}
          onLoadEnd={handleLoadEnd}
          onError={() => {
            setLoading(false);
            Alert.alert('接続エラー', 'manabaに接続できませんでした。\nインターネット接続を確認してください。');
          }}
          // 쿠키·캐시 유지 (같은 세션 재사용)
          sharedCookiesEnabled
          domStorageEnabled
          javaScriptEnabled
        />
      )}

      {/* 비공식 앱 면책 고지 — 로그인 전(처음 로그인 화면)에만 표시, 로그인 후 숨김 */}
      {!loggedIn && <UnofficialNotice />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  closeText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
  },
  backButton: {
    width: 32,
    alignItems: 'center',
  },
  backIcon: {
    fontSize: 28,
    color: colors.primary,
    lineHeight: 32,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  textBtn: {
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  loadingBar: {
    height: 3,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  webView: {
    flex: 1,
  },
  parsingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  parsingText: {
    fontSize: 15,
    color: colors.textSecondary,
  },
});
