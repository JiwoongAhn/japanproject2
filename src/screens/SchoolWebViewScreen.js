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
import { colors } from '../constants/colors';
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
  clearCredentials,
  buildAutoFillJS,
  CAPTURE_CREDENTIALS_JS,
} from '../utils/schoolCookies';

// 범용 학교 사이트 WebView 화면 (kaede-i, 포털 등 재사용)
// route.params: { url, title, autoLogin? }
//
// autoLogin=true 이면 A방식 자동 로그인 활성:
//   - 저장된 ID/PW가 있으면 로그인 폼에 자동 입력 + 제출
//   - 저장된 게 없으면 사용자가 직접 로그인 → 입력값을 캡처해 암호화 저장(다음부터 자동)
//   ※ ID/PW는 기기 내 AES-256 저장, 서버 전송 없음
export default function SchoolWebViewScreen({ navigation, route }) {
  const { url, title, autoLogin = false } = route.params ?? {};
  const cookieKey = useMemo(() => cookieKeyForUrl(url), [url]);
  const credKey = useMemo(() => credKeyForUrl(url), [url]);
  const webViewRef = useRef(null);
  const autoFilledRef = useRef(false); // 자동 입력 1회만 시도
  const [loading, setLoading] = useState(true);
  const [canGoBack, setCanGoBack] = useState(false);
  const [ready, setReady] = useState(false);
  const [cookieHeader, setCookieHeader] = useState(null);
  const [creds, setCreds] = useState(null);

  // 마운트 시: 쿠키 복원(보조) + 저장된 자격증명 로드 → 그 후 WebView 렌더
  useEffect(() => {
    let mounted = true;
    (async () => {
      await restoreCookies(url, cookieKey);
      const header = await getSavedCookieHeader(cookieKey);
      const c = autoLogin ? await getCredentials(credKey) : null;
      if (mounted) {
        setCookieHeader(header || null);
        setCreds(c);
        setReady(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [url, cookieKey, credKey, autoLogin]);

  const handleNavStateChange = (navState) => {
    setCanGoBack(navState.canGoBack);
  };

  const handleBack = () => {
    if (canGoBack) {
      webViewRef.current?.goBack();
    } else {
      navigation.goBack();
    }
  };

  // 사용자가 직접 로그인할 때 입력한 ID/PW 캡처 → 암호화 저장
  const handleMessage = async (event) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'credentials' && msg.pw) {
        await saveCredentials(credKey, msg.id, msg.pw);
        setCreds({ id: msg.id, pw: msg.pw });
      }
    } catch (_) {}
  };

  // 페이지 로드 완료: 쿠키 저장 + (autoLogin이면) 캡처 hook + 자동 입력
  const handleLoadEnd = async () => {
    setLoading(false);
    await saveCookies(url, cookieKey);
    if (!autoLogin) return;
    // 항상 캡처 hook 주입 (수동/재로그인 시 자격증명 갱신)
    webViewRef.current?.injectJavaScript(CAPTURE_CREDENTIALS_JS);
    // 저장된 자격증명이 있으면 1회 자동 입력 + 제출
    if (creds && creds.pw && !autoFilledRef.current) {
      autoFilledRef.current = true;
      webViewRef.current?.injectJavaScript(buildAutoFillJS(creds.id, creds.pw));
    }
  };

  // 로그아웃: 쿠키 + 저장된 자격증명 삭제 후 로그인 페이지로
  const handleLogout = () => {
    Alert.alert(
      'ログアウト',
      'ログアウトしますか?\n（保存したログイン情報も削除されます）',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: 'ログアウト',
          style: 'destructive',
          onPress: async () => {
            await clearCookies(url, cookieKey);
            if (autoLogin) await clearCredentials(credKey);
            setCreds(null);
            setCookieHeader(null);
            autoFilledRef.current = false;
            webViewRef.current?.reload();
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.headerBtn}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title ?? 'ページ'}
        </Text>
        <TouchableOpacity onPress={handleLogout} style={styles.textBtn}>
          <Text style={styles.logoutText}>ログアウト</Text>
        </TouchableOpacity>
      </View>

      {/* 로딩 인디케이터 */}
      {(loading || !ready) && (
        <View style={styles.loadingBar}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      )}

      {/* 준비 완료 후에만 WebView 렌더 */}
      {ready && (
        <WebView
          ref={webViewRef}
          source={{
            uri: url,
            headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
          }}
          style={styles.webView}
          injectedJavaScriptBeforeContentLoaded={DISABLE_AUTOCAPS_JS}
          onNavigationStateChange={handleNavStateChange}
          onMessage={handleMessage}
          onLoadEnd={handleLoadEnd}
          onError={() => {
            setLoading(false);
            Alert.alert(
              '接続エラー',
              'ページに接続できませんでした。\nインターネット接続を確認してください。'
            );
          }}
          sharedCookiesEnabled
          domStorageEnabled
          javaScriptEnabled
        />
      )}
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
  headerBtn: {
    width: 40,
    alignItems: 'center',
  },
  backIcon: {
    fontSize: 28,
    color: colors.primary,
    lineHeight: 32,
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
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '600',
    color: colors.textPrimary,
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
});
