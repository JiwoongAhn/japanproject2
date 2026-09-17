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
} from '../../utils/schoolCookies';

// kaede-i는 국사관 전용 학내 포털. 자동 재로그인은 이 학교에서만 동작한다.
const KAEDE_URL = 'https://kaedei.kokushikan.ac.jp';
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
  const kaedeCredKey = useMemo(() => credKeyForUrl(KAEDE_URL), []);

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
        onPress: async () => {
          // 1) 쿠키가 살아있는 상태에서 서버 로그아웃 URL로 이동 → 서버 세션 종료
          //    (manaba는 WebView 쿠키만 지워선 세션이 안 끊겨 다시 로그인 화면이 안 뜸)
          webViewRef.current?.injectJavaScript(
            `window.location.href = '${manabaUrls.logout}';`
          );
          // 2) 기기에 저장된 쿠키 삭제 → 다음 실행 때 자동 로그인 방지
          await clearCookies(manabaUrls.login, cookieKey);
          // 3) 홈 화면 공지 캐시도 비워 로그아웃 상태로 되돌림
          await clearCachedNotices();
          setCookieHeader(null);
          setLoggedIn(false);
        },
      },
    ]);
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

  // 페이지 이동 감지 — 로그인 완료 시 manaba 홈으로 이동 (자동 공지 파싱 X)
  const handleNavigationStateChange = (navState) => {
    setCanGoBack(navState.canGoBack);
    // 자동 재로그인 후 manaba로 돌아오면 로컬+글로벌 모두 성공 처리
    if (autoRelogging && hostOf(navState.url) === hostOf(manabaUrls.origin)) {
      recordAutoReloginSuccess();
      resetAutoReloginLocal();
    }
    if (!loggedIn && isLoggedIn(navState.url, manabaUrls.origin)) {
      setLoggedIn(true);
      // 로그인 직후 쿠키 저장 (다음 실행 때 자동 로그인)
      saveCookies(manabaUrls.login, cookieKey);
      // 로그인 성공 → manaba 홈으로 이동 (사용자가 manaba 기능을 그대로 사용)
      webViewRef.current?.injectJavaScript(
        `window.location.href = '${manabaUrls.home}';`
      );
    }
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
        saveCredentials(kaedeCredKey, msg.id, msg.pw);
        return;
      }
    } catch (_) {}
  };

  // 페이지 로드 완료 — 쿠키 저장 + kaede 로그인 페이지 감지 시 자동 재로그인
  const handleLoadEnd = ({ nativeEvent }) => {
    setLoading(false);
    saveCookies(manabaUrls.login, cookieKey);

    // manaba 쿠키 만료 시 kaede 로그인 페이지로 리디렉션됨 → 자동 재로그인
    const loadedUrl = nativeEvent?.url || '';

    // kaede 로그인 페이지면 항상 자격증명 캡처 훅을 주입.
    // (수동 로그인=값 저장 / 자동 채우기 제출=값 갱신. 훅은 __credHooked로 중복방지)
    // → 이게 있어야 manaba만 써도 kaede ID/PW가 저장돼 다음부터 자동 재로그인됨.
    if (loadedUrl.includes('kaedei.kokushikan.ac.jp')) {
      // [진단] kaede 로그인 페이지 도달 = manaba 세션 만료됨
      console.log('[MANABA-DIAG] kaede 로그인 페이지 감지(세션 만료) → 캡처 훅 주입');
      webViewRef.current?.injectJavaScript(CAPTURE_CREDENTIALS_JS);
    }
    if (loadedUrl.includes('kaedei.kokushikan.ac.jp') && !autoReloggedRef.current) {
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

      // 타임아웃 가드 — kaede 자동 제출 후 manaba로 돌아오지 않으면 실패로 기록
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

      getCredentials(kaedeCredKey).then((creds) => {
        if (creds?.id && creds?.pw && webViewRef.current) {
          // [진단] 경로 A-시도: 저장된 ID/PW로 자동 입력·제출
          console.log('[MANABA-DIAG] 저장된 ID/PW 있음 → 자동 입력 시도');
          webViewRef.current.injectJavaScript(buildAutoFillJS(creds.id, creds.pw));
        } else {
          // [진단] 경로 B: 저장된 자격증명이 없음 → 애초에 자동 시도 불가
          // (기존엔 조용히 넘어가 원인 파악 불가였음 → 안내 메시지 추가)
          console.log('[MANABA-DIAG] 저장된 ID/PW 없음 → 수동 로그인 필요(캡처 실패 의심)');
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
    }
    // manaba 페이지 도달 = 자동 재로그인 성공 → 로컬+글로벌 모두 리셋
    if (hostOf(loadedUrl) === hostOf(manabaUrls.origin)) {
      // [진단] manaba 도달 = 로그인 유지/자동 재로그인 성공
      console.log('[MANABA-DIAG] manaba 페이지 도달 → 성공(카운터 리셋)');
      recordAutoReloginSuccess();
      resetAutoReloginLocal();
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
