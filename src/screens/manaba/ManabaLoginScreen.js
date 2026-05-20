import React, { useRef, useState } from 'react';
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

  // 페이지 이동 감지 — 로그인 완료 시 공지 페이지로 이동
  const handleNavigationStateChange = (navState) => {
    if (!loggedIn && isLoggedIn(navState.url)) {
      setLoggedIn(true);
      // 로그인 성공 → 공지 홈으로 이동
      webViewRef.current?.injectJavaScript(
        `window.location.href = '${MANABA_HOME_URL}';`
      );
    }
  };

  // WebView에서 파싱 결과를 수신
  const handleMessage = (event) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);

      if (msg.type === 'notices') {
        setParsing(false);
        navigation.replace('ManabaNoticeList', {
          notices: msg.data,
          pageTitle: msg.pageTitle,
        });
      } else if (msg.type === 'error') {
        setParsing(false);
        Alert.alert('パース失敗', `お知らせの読み込みに失敗しました。\n${msg.message}`);
      }
    } catch (_) {}
  };

  // 페이지 로드 완료 — 공지 홈이면 파싱 실행
  const handleLoadEnd = ({ nativeEvent }) => {
    setLoading(false);
    const url = nativeEvent.url;

    if (url.includes('/ct/home') || url.includes('/ct/top')) {
      setParsing(true);
      webViewRef.current?.injectJavaScript(PARSE_NOTICES_JS);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>manaba ログイン</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* 파싱 중 오버레이 */}
      {parsing && (
        <View style={styles.parsingOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.parsingText}>お知らせを読み込み中…</Text>
        </View>
      )}

      {/* 로딩 인디케이터 */}
      {loading && !parsing && (
        <View style={styles.loadingBar}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      )}

      <WebView
        ref={webViewRef}
        source={{ uri: MANABA_LOGIN_URL }}
        style={styles.webView}
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
    color: colors.text,
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
