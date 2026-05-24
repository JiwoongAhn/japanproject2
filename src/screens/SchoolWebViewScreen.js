import React, { useRef, useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Alert,
  Share,
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

// [Phase B 임시] 시간표 표(table)의 HTML 구조를 뽑아 앱으로 보내는 스크립트
// innerText는 요일(가로 위치)이 사라져서, td 위치를 알 수 있는 HTML이 필요하다.
// '限目'(교시)이 들어있는 table 하나만 골라 outerHTML을 보낸다. (전체 페이지는 너무 큼)
// 카에데 MY時間割 파서 완성 후 제거 예정.
const EXTRACT_JS = `(function(){
  try {
    var tables = document.querySelectorAll('table');
    var target = null;
    for (var i = 0; i < tables.length; i++) {
      var t = tables[i].innerText || '';
      if (t.indexOf('限目') !== -1 && t.indexOf('シラバス') !== -1) { target = tables[i]; break; }
    }
    if (!target) {
      for (var j = 0; j < tables.length; j++) {
        if ((tables[j].innerText || '').indexOf('限目') !== -1) { target = tables[j]; break; }
      }
    }
    var html = target ? target.outerHTML : ('NO_TABLE_FOUND tables=' + tables.length);
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'extract', html: html, url: location.href }));
  } catch (e) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'extract', error: String(e) }));
  }
  true;
})();`;

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

  // WebView 내부 페이지 뒤로가기 (잘못 들어갔을 때 한 페이지 복귀)
  const handleWebBack = () => {
    if (canGoBack) webViewRef.current?.goBack();
  };

  // 모달 전체 닫기 — 터치 한 번에 시간표/홈으로 복귀
  const handleClose = () => {
    navigation.goBack();
  };

  // 사용자가 직접 로그인할 때 입력한 ID/PW 캡처 → 암호화 저장
  // + [Phase B 임시] 추출 결과 수신 → 공유시트로 내보내기
  const handleMessage = async (event) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'credentials' && msg.pw) {
        await saveCredentials(credKey, msg.id, msg.pw);
        setCreds({ id: msg.id, pw: msg.pw });
      } else if (msg.type === 'extract') {
        if (msg.error) {
          Alert.alert('抽出エラー', msg.error);
          return;
        }
        // 시간표 표 HTML을 공유시트로 — "コピー" 또는 メモ로 저장해 개발자에게 전달
        await Share.share({ message: `URL: ${msg.url}\n\n${msg.html}` });
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
      {/* 헤더: [閉じる + ‹뒤로] [제목] [ログアウト] */}
      <View style={styles.header}>
        <View style={styles.headerSide}>
          <TouchableOpacity onPress={handleClose} style={styles.textBtn}>
            <Text style={styles.closeText}>閉じる</Text>
          </TouchableOpacity>
          {canGoBack && (
            <TouchableOpacity onPress={handleWebBack} style={styles.headerBtn}>
              <Text style={styles.backIcon}>‹</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title ?? 'ページ'}
        </Text>
        <View style={[styles.headerSide, styles.headerSideRight]}>
          <TouchableOpacity onPress={handleLogout} style={styles.textBtn}>
            <Text style={styles.logoutText}>ログアウト</Text>
          </TouchableOpacity>
        </View>
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

      {/* [Phase B 임시] 추출 버튼 — MY時間割 페이지에서 눌러 화면 텍스트를 공유.
          파서 완성 후 제거 예정. */}
      {ready && (
        <TouchableOpacity
          style={styles.extractFab}
          onPress={() => webViewRef.current?.injectJavaScript(EXTRACT_JS)}
          activeOpacity={0.85}
        >
          <Text style={styles.extractFabText}>📋 抽出</Text>
        </TouchableOpacity>
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
    width: 32,
    alignItems: 'center',
  },
  headerSide: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerSideRight: {
    justifyContent: 'flex-end',
  },
  closeText: {
    fontSize: 15,
    color: colors.primary,
    fontWeight: '600',
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
  // [Phase B 임시] 추출 플로팅 버튼
  extractFab: {
    position: 'absolute',
    right: 16,
    bottom: 24,
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  extractFabText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
});
