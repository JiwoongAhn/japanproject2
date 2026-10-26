import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { UNIPAS_USER_AGENT, manabaOriginFrom, manabaUrlsFor } from '../../constants/manaba';
import {
  DISABLE_AUTOCAPS_JS,
  saveCookies,
  getSavedCookieHeader,
  restoreCookies,
  cookieKeyForUrl,
  PROBE_LOGIN_FORM_JS,
} from '../../utils/schoolCookies';
import { useAutoRelogin } from '../../hooks/useAutoRelogin';
import { hostOf } from '../../utils/autoLoginPolicy';
import { findUniversityByEmail, getUniversityLinks } from '../../utils/university';
import { useAuth } from '../../lib/AuthProvider';
import { colors } from '../../constants/colors';
import LoadingDots from '../../components/LoadingDots';

// manaba 공지 원문도 PC용 레이아웃이므로 핀치줌 제약 제거
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

// 통지 원문(manaba)을 로그인 상태로 연다 (2026-10-21 실기: 홈에선 로그인돼 있는데 여기선 로그인 폼이 떴음)
//   ManabaLoginScreen 과 같은 세션 처리: 저장 쿠키 복원 → 첫 요청에 쿠키 헤더 → 로드마다 로그인 폼 프로브
//   → 폼이면 자동 재로그인(useAutoRelogin) → 로그인 후 manaba 가 홈으로 보내면 원래 통지로 한 번 되돌린다
export default function ManabaNoticeDetailScreen({ route, navigation }) {
  const { url, title } = route.params ?? {};
  const [loading, setLoading] = useState(true);
  const webViewRef = useRef(null);
  const { session } = useAuth();
  const links = useMemo(
    () => getUniversityLinks(findUniversityByEmail(session?.user?.email)?.id),
    [session?.user?.email]
  );
  const manabaUrls = useMemo(() => {
    const origin = manabaOriginFrom(links?.manabaUrl);
    return origin ? manabaUrlsFor(origin) : null;
  }, [links]);
  const cookieKey = useMemo(
    () => (manabaUrls ? cookieKeyForUrl(manabaUrls.login) : ''),
    [manabaUrls]
  );
  const relogin = useAutoRelogin({ webViewRef, links });
  // 쿠키 준비 전에는 WebView 를 그리지 않는다 (세션 쿠키가 첫 요청에 실리도록)
  const [ready, setReady] = useState(!manabaUrls);
  const [cookieHeader, setCookieHeader] = useState(null);
  const sawLoginFormRef = useRef(false); // 이 화면에서 로그인 폼을 거쳤는지
  const returnedRef = useRef(false);     // 원래 통지로 되돌리기는 한 번만

  useEffect(() => {
    if (!manabaUrls) return undefined;
    let mounted = true;
    (async () => {
      try {
        await restoreCookies(manabaUrls.login, cookieKey);
        const header = await getSavedCookieHeader(cookieKey);
        if (mounted) setCookieHeader(header || null);
      } catch {
        // 복원 실패해도 열기는 한다 (로그인 폼이 뜨면 자동 재로그인)
      }
      if (mounted) setReady(true);
    })();
    return () => {
      mounted = false;
    };
  }, [manabaUrls, cookieKey]);

  const handleLoadEnd = () => {
    setLoading(false);
    if (manabaUrls) webViewRef.current?.injectJavaScript(PROBE_LOGIN_FORM_JS);
  };

  const handleMessage = (event) => {
    let msg;
    try {
      msg = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }
    if (msg.type === 'credentials') {
      relogin.handleCredentials(msg);
      return;
    }
    if (msg.type !== 'loginProbe' || !manabaUrls) return;
    if (msg.hasPassword) sawLoginFormRef.current = true;
    if (relogin.handleProbe(msg)) return; // 로그인 폼 → 훅이 자동 입력
    const loadedUrl = msg.url || '';
    if (hostOf(loadedUrl) !== hostOf(manabaUrls.origin) || /\/login(\b|[/?#])/.test(loadedUrl)) return;
    // 로그인된 manaba 페이지 → 쿠키 저장(다음엔 바로 열림)
    relogin.notifySuccess();
    saveCookies(manabaUrls.login, cookieKey);
    // 로그인을 거친 뒤 홈 등으로 보내졌으면 원래 통지로 되돌린다
    if (sawLoginFormRef.current && !returnedRef.current && url && !loadedUrl.startsWith(url)) {
      returnedRef.current = true;
      webViewRef.current?.injectJavaScript(`window.location.href = ${JSON.stringify(url)}; true;`);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title || 'お知らせ'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {/* 원문 URL이 없는 공지(메일 본문만 있는 푸시 등) → 빈 WebView 대신 안내 */}
      {url ? (
        <>
          {relogin.autoRelogging && (
            <View style={styles.reloginOverlay}>
              <LoadingDots />
              <Text style={styles.reloginText}>自動ログイン中…</Text>
            </View>
          )}
          {(loading || !ready) && (
            <View style={styles.loadingBar}>
              <LoadingDots size={7} />
            </View>
          )}
          {ready && (
          <WebView
            ref={webViewRef}
            source={{ uri: url, headers: cookieHeader ? { Cookie: cookieHeader } : undefined }}
            style={styles.webView}
            applicationNameForUserAgent={UNIPAS_USER_AGENT}
            injectedJavaScriptBeforeContentLoaded={DISABLE_AUTOCAPS_JS}
            injectedJavaScript={ENABLE_PINCH_ZOOM_JS}
            scalesPageToFit={true}
            onLoadEnd={handleLoadEnd}
            onMessage={handleMessage}
            onError={() => setLoading(false)}
            sharedCookiesEnabled
            domStorageEnabled
            javaScriptEnabled
          />
          )}
        </>
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🔗</Text>
          <Text style={styles.emptyText}>元のリンクがありません</Text>
          <Text style={styles.emptySubText}>
            この通知には開けるページがありません。{'\n'}
            manabaのホームで直接ご確認ください。
          </Text>
        </View>
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
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
    marginHorizontal: 8,
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
  reloginOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 10,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  reloginText: {
    fontSize: 15,
    color: colors.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 44,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  emptySubText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
