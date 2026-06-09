import React, { useRef, useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Alert,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { colors } from '../../constants/colors';
import UnofficialNotice from '../../components/UnofficialNotice';
import {
  DISABLE_AUTOCAPS_JS,
  saveCookies,
  getSavedCookieHeader,
  clearCookies,
  cookieKeyForUrl,
  credKeyForUrl,
  getCredentials,
  buildAutoFillJS,
} from '../../utils/schoolCookies';

const KAEDE_URL = 'https://kaedei.kokushikan.ac.jp';
import { MANABA_LOGIN_URL, MANABA_HOME_URL, MANABA_LOGOUT_URL, PARSE_NOTICES_JS, UNIPAS_USER_AGENT } from '../../constants/manaba';
import { clearCachedNotices } from '../../utils/manabaCache';
import {
  AUTO_RELOGIN_TIMEOUT_MS,
  canAttemptAutoRelogin,
  recordAutoReloginSuccess,
  recordAutoReloginFailure,
} from '../../utils/manabaSession';

// 로그인 성공 여부 판단: /ct/login·/ct/logout 이외의 manaba 페이지면 로그인 완료
// (/ct/logout을 제외하지 않으면 로그아웃 도중 다시 로그인 처리되어 홈으로 튕김)
const isLoggedIn = (url) =>
  url.includes('kokushikan.manaba.jp') &&
  !url.includes('/ct/login') &&
  !url.includes('/ct/logout');

export default function ManabaLoginScreen({ navigation }) {
  const webViewRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [ready, setReady] = useState(false);
  const [cookieHeader, setCookieHeader] = useState(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [autoRelogging, setAutoRelogging] = useState(false);
  // 현재 페이지 로드 사이클 내에서 한 번만 트리거하기 위한 가드 (연속 onLoadEnd 방지)
  const autoReloggedRef = useRef(false);
  // 타임아웃 타이머 핸들 — 자동 재로그인 트리거 시 시작, manaba 도착/언마운트 시 해제.
  const autoReloginTimerRef = useRef(null);
  const cookieKey = useMemo(() => cookieKeyForUrl(MANABA_LOGIN_URL), []);
  const kaedeCredKey = useMemo(() => credKeyForUrl(KAEDE_URL), []);

  // 마운트 시 저장된 쿠키 헤더를 불러온 뒤 WebView 렌더
  // 쿠키가 있으면 /ct/login 진입 시 서버가 /ct/home으로 보내 자동 파싱됨
  useEffect(() => {
    let mounted = true;
    getSavedCookieHeader(cookieKey).then((header) => {
      if (mounted) {
        setCookieHeader(header || null);
        setReady(true);
      }
    });
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
            `window.location.href = '${MANABA_LOGOUT_URL}';`
          );
          // 2) 기기에 저장된 쿠키 삭제 → 다음 실행 때 자동 로그인 방지
          await clearCookies(MANABA_LOGIN_URL, cookieKey);
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
    if (autoRelogging && navState.url.includes('kokushikan.manaba.jp')) {
      recordAutoReloginSuccess();
      resetAutoReloginLocal();
    }
    if (!loggedIn && isLoggedIn(navState.url)) {
      setLoggedIn(true);
      // 로그인 직후 쿠키 저장 (다음 실행 때 자동 로그인)
      saveCookies(MANABA_LOGIN_URL, cookieKey);
      // 로그인 성공 → manaba 홈으로 이동 (사용자가 manaba 기능을 그대로 사용)
      webViewRef.current?.injectJavaScript(
        `window.location.href = '${MANABA_HOME_URL}';`
      );
    }
  };

  // 📢 버튼: 현재 페이지에서 공지를 파싱해 목록 화면으로 (manaba 화면은 유지)
  const handleShowNotices = () => {
    setParsing(true);
    webViewRef.current?.injectJavaScript(PARSE_NOTICES_JS);
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

      if (msg.type === 'notices') {
        setParsing(false);
        // navigate(push) → 공지에서 뒤로가면 manaba로 복귀 (통째로 안 닫힘)
        navigation.navigate('ManabaNoticeList', {
          notices: msg.data,
          pageTitle: msg.pageTitle,
        });
      } else if (msg.type === 'error') {
        setParsing(false);
        Alert.alert('パース失敗', `お知らせの読み込みに失敗しました。\n${msg.message}`);
      }
    } catch (_) {}
  };

  // 페이지 로드 완료 — 쿠키 저장 + kaede 로그인 페이지 감지 시 자동 재로그인
  const handleLoadEnd = ({ nativeEvent }) => {
    setLoading(false);
    saveCookies(MANABA_LOGIN_URL, cookieKey);

    // manaba 쿠키 만료 시 kaede 로그인 페이지로 리디렉션됨 → 자동 재로그인
    const loadedUrl = nativeEvent?.url || '';
    if (loadedUrl.includes('kaedei.kokushikan.ac.jp') && !autoReloggedRef.current) {
      // 글로벌 정책 체크 — 누적 실패 + 쿨다운 (헬퍼가 판단)
      if (!canAttemptAutoRelogin()) {
        setAutoRelogging(false);
        Alert.alert(
          '自動ログインに失敗しました',
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
        Alert.alert(
          '自動ログインがタイムアウトしました',
          'ネットワーク状態を確認して、もう一度お試しください。'
        );
      }, AUTO_RELOGIN_TIMEOUT_MS);

      getCredentials(kaedeCredKey).then((creds) => {
        if (creds?.id && creds?.pw && webViewRef.current) {
          webViewRef.current.injectJavaScript(buildAutoFillJS(creds.id, creds.pw));
        } else {
          // 저장된 자격증명 없으면 오버레이/타이머 해제 (수동 로그인)
          if (autoReloginTimerRef.current) {
            clearTimeout(autoReloginTimerRef.current);
            autoReloginTimerRef.current = null;
          }
          setAutoRelogging(false);
        }
      });
    }
    // manaba 페이지 도달 = 자동 재로그인 성공 → 로컬+글로벌 모두 리셋
    if (loadedUrl.includes('kokushikan.manaba.jp')) {
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
          <TouchableOpacity onPress={handleShowNotices} style={styles.textBtn}>
            <Text style={styles.noticeText}>お知らせ</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout} style={styles.textBtn}>
            <Text style={styles.logoutText}>ログアウト</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 파싱 중 오버레이 */}
      {parsing && (
        <View style={styles.parsingOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.parsingText}>お知らせを読み込み中…</Text>
        </View>
      )}

      {/* 쿠키 만료 시 자동 재로그인 오버레이 */}
      {autoRelogging && (
        <View style={styles.parsingOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.parsingText}>自動ログイン中…</Text>
        </View>
      )}

      {/* 로딩 인디케이터 (쿠키 준비 중 + 페이지 로딩 중) */}
      {(loading || !ready) && !parsing && (
        <View style={styles.loadingBar}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      )}

      {/* 쿠키 헤더 준비 후에만 WebView 렌더 (세션 쿠키가 첫 요청에 실리도록) */}
      {ready && (
        <WebView
          ref={webViewRef}
          source={{
            uri: MANABA_LOGIN_URL,
            headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
          }}
          style={styles.webView}
          applicationNameForUserAgent={UNIPAS_USER_AGENT}
          injectedJavaScriptBeforeContentLoaded={DISABLE_AUTOCAPS_JS}
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

      {/* 비공식 앱 면책 고지 — 약관 컴플라이언스(투명성) */}
      <UnofficialNotice />
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
  noticeText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
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
