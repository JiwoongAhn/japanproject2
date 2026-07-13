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
  credKeyForUrl,
  getCredentials,
  buildAutoFillJS,
} from '../../utils/schoolCookies';
import {
  AUTO_RELOGIN_TIMEOUT_MS,
  canAttemptAutoRelogin,
  recordAutoReloginSuccess,
  recordAutoReloginFailure,
} from '../../utils/manabaSession';

// 세션 만료 시 manaba가 리디렉션하는 학교 SSO(kaede) 주소 — ManabaLoginScreen과 동일
const KAEDE_URL = 'https://kaedei.kokushikan.ac.jp';

// 폴링 설정: 3초 간격으로 최대 6분(120회)까지 인증 여부 확인.
// manaba 인증코드 메일이 서버 도착까지 3~5분 걸리는 사례를 실측(2026-07-09)했기에
// 넉넉히 대기한다. (예전 3분은 코드 도착 전에 타임아웃돼 사용자가 코드를 못 받았음)
// 코드는 도착 즉시 폰 푸시로도 전달되므로, 이 화면을 계속 보고 있지 않아도 된다.
const POLL_INTERVAL_MS = 3000;
const POLL_MAX_ATTEMPTS = 120;

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
  // 자동 재로그인용: 사이클 내 1회 트리거 가드 / 타임아웃 타이머 / 리마인더 유도 1회 가드
  const autoReloggedRef = useRef(false);
  const autoReloginTimerRef = useRef(null);
  const redirectedToReminderRef = useRef(false);

  const [ready, setReady] = useState(false);
  const [cookieHeader, setCookieHeader] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  // 세션 만료로 kaede 자동 재로그인 진행 중 (오버레이 표시용)
  const [autoRelogging, setAutoRelogging] = useState(false);
  // manaba가 보낸 6자리 인증코드 (서버 폴링으로 수신)
  const [pendingCode, setPendingCode] = useState(null);
  // 화면 상태:
  //   setup(주소 입력·저장) | waitingCode(코드 대기 폴링) | code(코드 표시·입력 유도)
  //   | checking(인증완료 폴링) | done(완료) | timeout(시간초과)
  const [status, setStatus] = useState('setup');
  const isCodeStep = status === 'code';

  const cookieKey = useMemo(() => cookieKeyForUrl(MANABA_LOGIN_URL), []);
  const kaedeCredKey = useMemo(() => credKeyForUrl(KAEDE_URL), []);

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

  // 언마운트 시 폴링·재로그인 타이머 정리
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
      if (autoReloginTimerRef.current) clearTimeout(autoReloginTimerRef.current);
    };
  }, []);

  // 화면 진입 시 서버에 이미 도착한 인증코드/인증여부를 1회 확인.
  // 메일이 늦게 도착해 이전 폴링이 끝난 뒤 다시 들어온 경우에도 곧바로 코드를 보여준다.
  // (pending_code가 없으면 아무 일도 안 하고 정상 설정 흐름 유지)
  useEffect(() => {
    if (!ready) return;
    let alive = true;
    (async () => {
      try {
        const { data } = await supabase.functions.invoke('mail-provision');
        if (!alive || !data) return;
        if (data.verified) {
          setStatus('done');
        } else if (data.pendingCode) {
          setPendingCode(data.pendingCode);
          setStatus('code');
        }
      } catch (_) {
        // 네트워크 오류는 무시 — 사용자가 버튼으로 다시 확인 가능
      }
    })();
    return () => {
      alive = false;
    };
  }, [ready]);

  // 설정 단계 동안 백그라운드로 인증코드 도착을 자동 감지한다.
  // 사용자가 manaba에 주소를 붙여넣고 "保存"만 눌러 두면, 이 화면을 벗어나지 않아도
  // (버튼을 따로 누르지 않아도) 코드가 도착하는 즉시 자동으로 code 단계로 전환된다.
  // status가 setup이 아닐 땐(수동 폴링/코드표시 등) 이중 폴링을 피하려 멈춘다.
  useEffect(() => {
    if (!ready || status !== 'setup') return;
    let alive = true;
    let timer = null;
    const tick = async () => {
      try {
        const { data } = await supabase.functions.invoke('mail-provision');
        if (!alive) return;
        if (data?.verified) { setStatus('done'); return; }
        if (data?.pendingCode) {
          setPendingCode(data.pendingCode);
          setStatus('code');
          return;
        }
      } catch (_) {
        // 네트워크 오류는 무시하고 다음 주기에 재시도
      }
      if (alive) timer = setTimeout(tick, POLL_INTERVAL_MS);
    };
    timer = setTimeout(tick, POLL_INTERVAL_MS);
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [ready, status]);

  // 자동 재로그인 로컬 상태 리셋 (오버레이·사이클 ref·타이머). 글로벌 카운터는 헬퍼로 별도 갱신.
  const resetAutoReloginLocal = () => {
    setAutoRelogging(false);
    autoReloggedRef.current = false;
    if (autoReloginTimerRef.current) {
      clearTimeout(autoReloginTimerRef.current);
      autoReloginTimerRef.current = null;
    }
  };

  const handleCopy = async () => {
    // 코드 단계에서는 인증코드를, 그 전에는 전달주소를 복사
    const value = isCodeStep ? pendingCode : address;
    if (!value) return;
    await Clipboard.setStringAsync(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // 페이지 로드 완료 → 쿠키 갱신 + (세션 만료 시)자동 재로그인 + 리마인더 페이지 유도·강조
  const handleLoadEnd = ({ nativeEvent }) => {
    setLoading(false);
    saveCookies(MANABA_LOGIN_URL, cookieKey);
    const url = nativeEvent?.url || '';

    // ① 세션 만료 → kaede SSO 로그인 페이지로 튕김 → 저장된 자격증명으로 자동 재로그인
    if (url.includes('kaedei.kokushikan.ac.jp') && !autoReloggedRef.current) {
      // 글로벌 정책(누적 실패 2회 + 5분 쿨다운) 위반이면 자동 시도 중단 → 수동 로그인 폼 노출
      if (!canAttemptAutoRelogin()) {
        setAutoRelogging(false);
        Alert.alert(
          '自動ログインに失敗しました',
          'IDまたはパスワードが変わった可能性があります。\n画面のフォームから手動でログインしてください。'
        );
        return;
      }
      autoReloggedRef.current = true;
      setAutoRelogging(true);

      // 타임아웃 가드 — 자동 제출 후 manaba로 돌아오지 않으면 실패로 기록 (무한 대기 방지)
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
          // 저장된 자격증명 없음 → 오버레이·타이머 해제하고 수동 로그인에 맡김
          if (autoReloginTimerRef.current) {
            clearTimeout(autoReloginTimerRef.current);
            autoReloginTimerRef.current = null;
          }
          setAutoRelogging(false);
        }
      });
      return;
    }

    // ② manaba 페이지 도달 (로그인 폼 제외)
    if (url.includes('kokushikan.manaba.jp') && !url.includes('/ct/login')) {
      // 자동 재로그인이 진행 중이었다면 성공 처리 (로컬+글로벌 리셋)
      if (autoRelogging) recordAutoReloginSuccess();
      resetAutoReloginLocal();

      if (url.includes('home_preferences_reminder')) {
        // 리마인더 페이지 도착 → 携帯칸 강조
        webViewRef.current?.injectJavaScript(HIGHLIGHT_KEITAI_JS);
      } else if (!redirectedToReminderRef.current) {
        // 로그인 후 manaba 홈 등 다른 페이지에 떨어졌으면 리마인더 페이지로 1회 유도
        redirectedToReminderRef.current = true;
        webViewRef.current?.injectJavaScript(
          `window.location.href = '${MANABA_REMINDER_URL}';`
        );
      }
    }
  };

  // 공통 폴링 헬퍼: mail-provision을 반복 호출하며 onData로 종료 여부를 판단한다.
  // onData가 true를 반환하면 폴링 종료. 최대 횟수 초과 시 timeout 처리.
  const runPolling = (onData) => {
    let attempts = 0;
    const poll = async () => {
      attempts += 1;
      try {
        // mail-provision은 멱등 — 토큰·verified·pendingCode를 함께 돌려준다
        const { data } = await supabase.functions.invoke('mail-provision');
        if (data && onData(data)) return;
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

  // ① "コードを受け取る（確認）" → manaba가 서버로 보낸 인증코드가 도착할 때까지 폴링
  const startCodePolling = () => {
    setStatus('waitingCode');
    runPolling((data) => {
      if (data.verified) { setStatus('done'); return true; }   // 이미 인증완료된 경우
      if (data.pendingCode) {
        setPendingCode(data.pendingCode);
        setStatus('code');
        return true;
      }
      return false;
    });
  };

  // ② "入力しました（確認）" → 학생이 코드 입력 후 manaba 認証完了 메일로 verified 세팅될 때까지 폴링
  const startVerifyPolling = () => {
    setStatus('checking');
    runPolling((data) => {
      if (data.verified) { setStatus('done'); return true; }
      // 코드가 재발송돼 갱신됐으면 최신 코드로 표시 갱신 (폴링은 계속)
      if (data.pendingCode && data.pendingCode !== pendingCode) {
        setPendingCode(data.pendingCode);
      }
      return false;
    });
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
        <Text style={result.title}>認証コードがまだ届いていません</Text>
        <Text style={result.body}>
          manabaからのメールは数分遅れて届くことがあります。{'\n'}
          manabaで「保存」を押したことを確認し、{'\n'}
          下のボタンをもう一度押してお待ちください。
        </Text>
        <View style={result.bottom}>
          <TouchableOpacity onPress={startCodePolling} style={styles.retryPrimary}>
            <Text style={styles.retryPrimaryText}>もう一度確認する</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDone} style={styles.retryBtn}>
            <Text style={styles.retryText}>閉じる</Text>
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

      {/* 코드 단계: manaba에서 받은 6자리 인증코드를 크게 표시 + 복사 */}
      {isCodeStep ? (
        <View style={codeBox.wrap}>
          <Text style={codeBox.title}>認証コードが届きました 📬</Text>
          <Text style={codeBox.guide}>
            下の<Text style={codeBox.bold}>6桁のコード</Text>をコピーして、manaba画面の
            <Text style={codeBox.bold}>「携帯メールアドレス」認証</Text>欄に入力してください。
          </Text>
          <View style={codeBox.codeRow}>
            <Text style={codeBox.code} selectable>
              {(pendingCode ?? '').split('').join(' ')}
            </Text>
            <TouchableOpacity
              style={codeBox.copyBtn}
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
      ) : (
        /* 설정 단계: 携帯칸에 주소 입력 + 복사 안내 */
        <View style={banner.wrap}>
          <Text style={banner.title}>「携帯メールアドレス」欄に貼り付け</Text>
          <Text style={banner.guide}>
            下のアドレスをコピーして、下の画面の
            <Text style={banner.bold}>「携帯メールアドレス」</Text>欄に貼り付け、
            <Text style={banner.bold}>「保存」</Text>を押してください。
          </Text>
          <Text style={banner.note}>
            ※ 普段お使いのメールはそのまま。この欄に追加するだけです。
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
      )}

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

      {/* 하단 고정: 단계별 확인 버튼 */}
      <View style={styles.bottomArea}>
        {isCodeStep ? (
          <>
            <Button title="入力しました（確認）" onPress={startVerifyPolling} />
            <Text style={styles.bottomHint}>
              ※ manaba画面でコードを入力し「認証」を押してから、こちらをタップしてください。
            </Text>
          </>
        ) : (
          <>
            <Button title="保存しました（確認する）" onPress={startCodePolling} />
            <Text style={styles.bottomHint}>
              ※ manabaの「保存」ボタンを押してから、こちらをタップしてください。
            </Text>
          </>
        )}
      </View>

      {/* 폴링 오버레이 (코드 대기 / 인증완료 확인) */}
      {(status === 'waitingCode' || status === 'checking') && (
        <View style={styles.overlay}>
          <LoadingDots />
          <Text style={styles.overlayText}>
            {status === 'waitingCode'
              ? '認証コードを待っています…'
              : '設定を確認しています…'}
          </Text>
          <Text style={styles.overlaySub}>
            {status === 'waitingCode'
              ? 'メールの到着まで数分かかることがあります。\nコードが届いたら通知でお知らせします 🔔'
              : '少しお待ちください'}
          </Text>
        </View>
      )}

      {/* 세션 만료 자동 재로그인 오버레이 */}
      {autoRelogging && (
        <View style={styles.overlay}>
          <LoadingDots />
          <Text style={styles.overlayText}>自動ログイン中…</Text>
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
  overlaySub: { ...typography.caption, color: colors.gray500, textAlign: 'center', lineHeight: 18 },

  retryBtn: { alignItems: 'center', paddingVertical: spacing.md },
  retryText: { ...typography.bodyStrong, color: colors.gray500 },
  retryPrimary: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  retryPrimaryText: { ...typography.bodyStrong, color: colors.white },
});

// 안내 배너 스타일
const banner = StyleSheet.create({
  wrap: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  title: { fontSize: 16, fontWeight: '800', color: colors.gray900 },
  guide: { fontSize: 14, color: colors.gray800, lineHeight: 21 },
  bold: { fontWeight: '800', color: colors.primary },
  note: { fontSize: 12, color: colors.gray600, lineHeight: 17 },
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

// 인증코드 표시 배너 스타일
const codeBox = StyleSheet.create({
  wrap: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  title: { fontSize: 16, fontWeight: '800', color: colors.gray900 },
  guide: { fontSize: 14, color: colors.gray800, lineHeight: 21 },
  bold: { fontWeight: '800', color: colors.primary },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.md,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    paddingVertical: spacing.sm,
  },
  code: {
    flex: 1,
    fontSize: 28,
    fontWeight: '800',
    color: colors.gray900,
    letterSpacing: 2,      // split(' ')로 벌린 자간 + 추가 간격으로 읽기 쉽게
    textAlign: 'center',
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
  },
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
