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
  PROBE_LOGIN_FORM_JS,
} from '../../utils/schoolCookies';
// 자동 재로그인(ID/PW 기기 저장 + 자동 입력)은 공용 훅. 허용 호스트는 universityLinks.autoLoginHosts.
import { useAutoRelogin } from '../../hooks/useAutoRelogin';
import { hostOf } from '../../utils/autoLoginPolicy';
import {
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
  // 내 학교의 manaba 주소를 결정한다.
  // 우선순위: 화면 진입 시 넘겨받은 university → 로그인 이메일로 판정.
  // 학교마다 서브도메인이 다르므로(kokushikan/daito/asia-u …) 이걸 안 하면
  // 타 학교 학생이 국사관 manaba 로그인 화면을 보게 된다. manaba 미사용 학교는 null(WebView 미렌더).
  const { session } = useAuth();
  const links = useMemo(() => {
    const fromRoute = route?.params?.university;
    const universityId =
      fromRoute?.id ?? fromRoute ?? findUniversityByEmail(session?.user?.email)?.id;
    return getUniversityLinks(universityId);
  }, [route?.params?.university, session?.user?.email]);
  const manabaUrls = useMemo(() => {
    const origin = manabaOriginFrom(links?.manabaUrl);
    return origin ? manabaUrlsFor(origin) : null;
  }, [links]);

  const cookieKey = useMemo(
    () => (manabaUrls ? cookieKeyForUrl(manabaUrls.login) : ''),
    [manabaUrls]
  );
  // 자동 재로그인 공용 훅 (허용 호스트 = links.autoLoginHosts: manaba 자체 폼 / kaede-i / SSO IdP)
  const relogin = useAutoRelogin({ webViewRef, links });

  // 최후 방어선: manaba를 쓰지 않는 학교에서 이 화면에 들어오면 즉시 되돌린다.
  const universityUsesManaba = supportsManaba(links?.manabaUrl);

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
    if (!manabaUrls) return undefined;
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
  }, [manabaUrls, cookieKey]);

  // 로그아웃: 쿠키 제거 후 로그인 페이지로
  const handleLogout = () => {
    Alert.alert('ログアウト', 'manabaからログアウトしますか?', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: 'ログアウト',
        style: 'destructive',
        onPress: () => {
          relogin.markManualLogout();
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

  // WebView 메시지 수신 — 자격증명 캡처 / 로그인 폼 프로브
  const handleMessage = (event) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'credentials') {
        relogin.handleCredentials(msg); // 허용 호스트의 폼이면 ID/PW 암호화 저장
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
  //   (1) 비밀번호 칸 있음 = 로그인 폼 → 훅이 캡처 훅 주입 + 저장된 ID/PW 자동 입력·제출
  //   (2) 비밀번호 칸 없음 + 내 학교 manaba 호스트 = 로그인된 상태
  //       → 성공 처리(카운터 리셋), 쿠키 저장
  const handleLoginProbe = (msg) => {
    const loadedUrl = msg.url || '';

    // 로그아웃 페이지 도착 = 서버 세션 종료 완료 → 정리 후 로그인 폼으로
    if (relogin.isManualLogout() && loadedUrl.includes('/ct/logout')) {
      console.log('[MANABA-DIAG] /ct/logout 도착 → 쿠키·캐시 정리 후 로그인 폼으로');
      finishLogout();
      return;
    }

    if (relogin.handleProbe(msg)) return; // 로그인 폼이었음 (훅이 처리)

    // 비밀번호 칸 없음 → 내 학교 manaba 페이지면 로그인된 상태
    if (isLoggedIn(loadedUrl, manabaUrls.origin)) {
      console.log('[MANABA-DIAG] manaba 로그인 상태 확인 → 성공(카운터 리셋)');
      relogin.notifySuccess();
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
      {relogin.autoRelogging && (
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
      {ready && manabaUrls && (
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
