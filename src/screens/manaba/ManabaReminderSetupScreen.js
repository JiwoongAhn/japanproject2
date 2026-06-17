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
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import Button from '../../components/Button';
import LoadingDots from '../../components/LoadingDots';
import { supabase } from '../../lib/supabase';
import {
  MANABA_LOGIN_URL,
  MANABA_REMINDER_URL,
  UNIPAS_USER_AGENT,
} from '../../constants/manaba';
import {
  DISABLE_AUTOCAPS_JS,
  saveCookies,
  getSavedCookieHeader,
  cookieKeyForUrl,
} from '../../utils/schoolCookies';

// 폴링 설정: 5초 간격으로 최대 3분(36회)까지 인증 여부 확인
const POLL_INTERVAL_MS = 5000;
const POLL_MAX_ATTEMPTS = 36;

// manaba 리마인더 페이지에서 "携帯メールアドレス" 입력칸을 찾아
// 화면 중앙으로 스크롤하고 파란 테두리로 강조한다. (HTML 구조 실측 전 best-effort)
// 못 찾아도 무해 — 페이지는 그대로 표시되고 사용자가 직접 찾을 수 있다.
const HIGHLIGHT_KEITAI_JS = `
(function() {
  try {
    var nodes = document.querySelectorAll('th, td, label, span, div, p');
    var labelEl = null;
    for (var i = 0; i < nodes.length; i++) {
      var t = (nodes[i].textContent || '');
      if (t.indexOf('携帯') !== -1 && t.indexOf('メール') !== -1 && t.length < 40) {
        labelEl = nodes[i];
        break;
      }
    }
    if (labelEl) {
      var row = labelEl.closest('tr') || labelEl.parentElement;
      var input = row
        ? row.querySelector('input[type=text], input[type=email], input:not([type])')
        : null;
      var target = input || labelEl;
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (input) {
        input.style.outline = '3px solid #3182F6';
        input.style.outlineOffset = '2px';
        input.style.backgroundColor = '#EBF3FE';
        input.style.borderRadius = '4px';
      }
    }
  } catch (e) {}
  true;
})();
true;
`;

export default function ManabaReminderSetupScreen({ navigation, route }) {
  // 발급된 토큰 주소 ({token}@unipas.app) — 온보딩 화면에서 전달
  const address = route?.params?.address ?? '';

  const webViewRef = useRef(null);
  const pollTimerRef = useRef(null);

  const [ready, setReady] = useState(false);
  const [cookieHeader, setCookieHeader] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  // 화면 상태: setup(설정 중) | checking(확인 폴링) | done(완료) | timeout(시간초과)
  const [status, setStatus] = useState('setup');

  const cookieKey = useMemo(() => cookieKeyForUrl(MANABA_LOGIN_URL), []);

  // 저장된 manaba 쿠키 헤더를 불러온 뒤 WebView 렌더 (이미 로그인된 세션 재사용)
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

  // 언마운트 시 폴링 타이머 정리
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, []);

  const handleCopy = async () => {
    if (!address) return;
    await Clipboard.setStringAsync(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // 페이지 로드 완료 → 쿠키 갱신 + 携帯칸 강조
  const handleLoadEnd = ({ nativeEvent }) => {
    setLoading(false);
    saveCookies(MANABA_LOGIN_URL, cookieKey);
    // 리마인더 페이지에 도착했을 때만 강조 (로그인/리디렉션 페이지에선 실행 안 함)
    const url = nativeEvent?.url || '';
    if (url.includes('home_preferences_reminder')) {
      webViewRef.current?.injectJavaScript(HIGHLIGHT_KEITAI_JS);
    }
  };

  // "保存しました → 確認する" → verified_at 폴링 시작
  const startPolling = () => {
    setStatus('checking');
    let attempts = 0;

    const poll = async () => {
      attempts += 1;
      try {
        // mail-provision은 멱등 — 기존 토큰과 함께 현재 verified 상태를 돌려준다
        const { data } = await supabase.functions.invoke('mail-provision');
        if (data?.verified) {
          setStatus('done');
          return;
        }
      } catch (_) {
        // 네트워크 오류는 무시하고 다음 폴링에서 재시도
      }
      if (attempts >= POLL_MAX_ATTEMPTS) {
        setStatus('timeout');
        return;
      }
      pollTimerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
    };

    poll();
  };

  const handleClose = () => navigation.goBack();
  const handleDone = () => navigation.goBack();

  // ── 완료 화면 ──
  if (status === 'done') {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <View style={result.iconCircleDone}>
          <Ionicons name="checkmark" size={44} color={colors.white} />
        </View>
        <Text style={result.title}>通知の設定が完了しました！</Text>
        <Text style={result.body}>
          これからmanabaの新しいお知らせを{'\n'}通知でお届けします。
        </Text>
        <View style={result.bottom}>
          <Button title="ホームに戻る" onPress={handleDone} />
        </View>
      </SafeAreaView>
    );
  }

  // ── 시간초과 화면 (자동인증 미완 등으로 아직 확인 안 됨) ──
  if (status === 'timeout') {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <View style={result.iconCircleWait}>
          <Ionicons name="time-outline" size={44} color={colors.primary} />
        </View>
        <Text style={result.title}>確認に時間がかかっています</Text>
        <Text style={result.body}>
          設定が反映されるまで少し時間がかかる場合があります。{'\n'}
          マイページからいつでも状態を確認できます。
        </Text>
        <View style={result.bottom}>
          <Button title="閉じる" onPress={handleDone} />
          <TouchableOpacity onPress={startPolling} style={styles.retryBtn}>
            <Text style={styles.retryText}>もう一度確認する</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── 설정/확인 화면 (WebView) ──
  return (
    <SafeAreaView style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleClose} style={styles.textBtn}>
          <Text style={styles.closeText}>閉じる</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>リマインダ設定</Text>
        <View style={styles.headerRight} />
      </View>

      {/* 안내 배너: 携帯칸에 주소 입력 + 복사 */}
      <View style={banner.wrap}>
        <Text style={banner.guide}>
          <Text style={banner.bold}>「携帯メールアドレス」</Text>欄に下のアドレスを入力し、
          <Text style={banner.bold}>「保存」</Text>を押してください。
        </Text>
        <View style={banner.addressRow}>
          <Text style={banner.address} numberOfLines={1} selectable>
            {address}
          </Text>
          <TouchableOpacity
            style={banner.copyBtn}
            onPress={handleCopy}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={copied ? 'checkmark' : 'copy-outline'}
              size={15}
              color={colors.white}
            />
            <Text style={banner.copyText}>{copied ? 'コピー済み' : 'コピー'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 로딩 인디케이터 */}
      {(loading || !ready) && (
        <View style={styles.loadingBar}>
          <LoadingDots size={7} />
        </View>
      )}

      {/* manaba 리마인더 페이지 WebView (저장된 쿠키로 자동 로그인 상태) */}
      {ready && (
        <WebView
          ref={webViewRef}
          source={{
            uri: MANABA_REMINDER_URL,
            headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
          }}
          style={styles.webView}
          applicationNameForUserAgent={UNIPAS_USER_AGENT}
          injectedJavaScriptBeforeContentLoaded={DISABLE_AUTOCAPS_JS}
          onLoadEnd={handleLoadEnd}
          onError={() => {
            setLoading(false);
            Alert.alert(
              '接続エラー',
              'manabaに接続できませんでした。\nインターネット接続を確認してください。'
            );
          }}
          sharedCookiesEnabled
          domStorageEnabled
          javaScriptEnabled
        />
      )}

      {/* 하단 고정: manaba에서 저장 후 누르는 확인 버튼 */}
      <View style={styles.bottomArea}>
        <Button title="保存しました（確認する）" onPress={startPolling} />
        <Text style={styles.bottomHint}>
          ※ manabaの「保存」ボタンを押してから、こちらをタップしてください。
        </Text>
      </View>

      {/* 확인 폴링 오버레이 */}
      {status === 'checking' && (
        <View style={styles.overlay}>
          <LoadingDots />
          <Text style={styles.overlayText}>設定を確認しています…</Text>
          <Text style={styles.overlaySub}>少しお待ちください</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centerContainer: {
    flex: 1,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
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
  textBtn: { paddingHorizontal: 4, justifyContent: 'center' },
  closeText: { fontSize: 15, fontWeight: '600', color: colors.primary },
  headerTitle: { fontSize: 17, fontWeight: '600', color: colors.textPrimary },
  headerRight: { width: 44 },

  loadingBar: {
    height: 3,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  webView: { flex: 1 },

  bottomArea: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  bottomHint: {
    ...typography.caption,
    color: colors.gray500,
    textAlign: 'center',
    marginTop: spacing.xs,
  },

  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  overlayText: { ...typography.bodyStrong, color: colors.gray900 },
  overlaySub: { ...typography.caption, color: colors.gray500 },

  retryBtn: { alignItems: 'center', paddingVertical: spacing.md },
  retryText: { ...typography.bodyStrong, color: colors.primary },
});

// 안내 배너 스타일
const banner = StyleSheet.create({
  wrap: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  guide: { ...typography.body2, color: colors.gray800, lineHeight: 20 },
  bold: { fontWeight: '700', color: colors.primary },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.md,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    paddingVertical: spacing.xs,
  },
  address: { ...typography.body2, color: colors.gray900, flex: 1, fontWeight: '600' },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
  },
  copyText: { ...typography.caption, color: colors.white, fontWeight: '700' },
});

// 완료/대기 결과 화면 스타일
const result = StyleSheet.create({
  iconCircleDone: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  iconCircleWait: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    ...typography.title2,
    color: colors.gray900,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  body: { ...typography.body2, color: colors.gray600, textAlign: 'center' },
  bottom: {
    position: 'absolute',
    left: spacing.xl,
    right: spacing.xl,
    bottom: spacing.xxl,
  },
});
