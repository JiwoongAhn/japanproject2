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
import {
  DISABLE_AUTOCAPS_JS,
  saveCookies,
  getSavedCookieHeader,
  clearCookies,
  cookieKeyForUrl,
} from '../../utils/schoolCookies';

const MANABA_LOGIN_URL = 'https://kokushikan.manaba.jp/ct/login';

// 로그인 성공 여부 판단: /ct/login 이외의 manaba 페이지면 로그인 완료
const isLoggedIn = (url) =>
  url.includes('kokushikan.manaba.jp') && !url.includes('/ct/login');

// 공지사항 페이지 URL (로그인 후 이동할 페이지)
const MANABA_HOME_URL = 'https://kokushikan.manaba.jp/ct/home';

// WebView에 주입하는 JS: 공지사항 리스트를 파싱해서 네이티브로 전달
const PARSE_NOTICES_JS = `
(function() {
  try {
    var notices = [];

    // manaba 홈 공지사항 셀렉터 (학교별로 다를 수 있음)
    // 1순위: .home-newsitem (신버전 manaba)
    // 2순위: table.stdlist tr (구버전 manaba)
    // 3순위: 전체 링크 목록 fallback
    var items = document.querySelectorAll('.home-newsitem');

    if (items.length === 0) {
      items = document.querySelectorAll('table.stdlist tr');
    }

    if (items.length === 0) {
      // fallback: 링크가 있는 li 항목들
      items = document.querySelectorAll('.contents-area li, .news-list li');
    }

    items.forEach(function(item, i) {
      if (i >= 30) return;
      var link = item.querySelector('a');
      if (!link) return;

      var title = link.textContent.trim();
      var href = link.getAttribute('href') || '';
      // 상대경로를 절대경로로 변환
      if (href && !href.startsWith('http')) {
        href = 'https://kokushikan.manaba.jp' + href;
      }

      // 날짜 추출 시도
      var date = '';
      var dateEl = item.querySelector('.date, .time, .post-date, td:first-child');
      if (dateEl) date = dateEl.textContent.trim();

      // 게시판/코스명 추출 시도
      var board = '';
      var boardEl = item.querySelector('.course-name, .board-name, td:nth-child(2)');
      if (boardEl) board = boardEl.textContent.trim();

      if (title) notices.push({ title, href, date, board });
    });

    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'notices',
      data: notices,
      pageTitle: document.title,
      currentUrl: window.location.href,
    }));
  } catch(e) {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'error',
      message: e.message,
    }));
  }
})();
true; // injectedJavaScript는 반드시 truthy 값으로 끝나야 함
`;

export default function ManabaLoginScreen({ navigation }) {
  const webViewRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [ready, setReady] = useState(false);
  const [cookieHeader, setCookieHeader] = useState(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const cookieKey = useMemo(() => cookieKeyForUrl(MANABA_LOGIN_URL), []);

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

  // 로그아웃: 쿠키 제거 후 로그인 페이지로
  const handleLogout = () => {
    Alert.alert('ログアウト', 'manabaからログアウトしますか?', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: 'ログアウト',
        style: 'destructive',
        onPress: async () => {
          await clearCookies(MANABA_LOGIN_URL, cookieKey);
          setCookieHeader(null);
          setLoggedIn(false);
          webViewRef.current?.reload();
        },
      },
    ]);
  };

  // 페이지 이동 감지 — 로그인 완료 시 manaba 홈으로 이동 (자동 공지 파싱 X)
  const handleNavigationStateChange = (navState) => {
    setCanGoBack(navState.canGoBack);
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

  // ‹ 버튼: WebView 내부 히스토리가 있으면 페이지 뒤로, 없으면 manaba 닫기
  const handleBack = () => {
    if (canGoBack) {
      webViewRef.current?.goBack();
    } else {
      navigation.goBack();
    }
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

  // 페이지 로드 완료 — 쿠키 저장만 (자동 공지 파싱은 제거, 📢 버튼으로 수동 실행)
  const handleLoadEnd = () => {
    setLoading(false);
    saveCookies(MANABA_LOGIN_URL, cookieKey);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
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
  backButton: {
    width: 40,
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
