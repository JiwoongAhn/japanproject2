import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Dimensions,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { colors } from '../../constants/colors';
import { typography } from '../../constants/typography';
import { spacing, radius } from '../../constants/spacing';
import Button from '../../components/Button';
import PhoneMockup from '../../components/PhoneMockup';
import {
  MS_AUTH_REQUEST,
  MS_DISCOVERY,
  handleMicrosoftAuthResponse,
} from '../../lib/microsoftAuth';

// expo-auth-session이 OAuth 브라우저 세션을 올바르게 닫도록 등록
WebBrowser.maybeCompleteAuthSession();

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────
// 슬라이드 1 비주얼: 잠금화면에 푸시 알림이 뜬 모습 (왜 연결하는가)
// ─────────────────────────────────────────────────────────────
const PushNotificationMock = () => (
  <View style={mock.lockWrap}>
    <Text style={mock.lockTime}>9:41</Text>
    <Text style={mock.lockDate}>6月9日 月曜日</Text>

    <View style={mock.notifCard}>
      <View style={mock.notifHeader}>
        <View style={mock.appIcon}>
          <Ionicons name="notifications" size={12} color={colors.white} />
        </View>
        <Text style={mock.appName}>ユニパス</Text>
        <Text style={mock.notifTime}>今</Text>
      </View>
      <Text style={mock.notifTitle} numberOfLines={1}>
        【お知らせ】レポート提出について
      </Text>
      <Text style={mock.notifBody} numberOfLines={2}>
        新しいお知らせが届きました。タップして確認
      </Text>
    </View>
  </View>
);

// ─────────────────────────────────────────────────────────────
// 슬라이드 2 비주얼: 프라이버시 안심 (무엇을 / 정직하게)
// ─────────────────────────────────────────────────────────────
const PRIVACY_POINTS = [
  {
    icon: 'lock-closed',
    title: '読み取り専用',
    body: 'メールの閲覧のみ。送信・削除・編集はできません。',
  },
  {
    icon: 'mail-unread',
    title: 'お知らせの検知に使用',
    body: '受信メールを読み取る権限で、manabaからのお知らせを自動で検知します。それ以外には使いません。',
  },
  {
    icon: 'key',
    title: 'パスワードは保存しません',
    body: 'Microsoftの公式ログイン画面で安全に連携します。',
  },
];

const PrivacyVisual = () => (
  <View style={priv.wrap}>
    <View style={priv.shieldCircle}>
      <Ionicons name="shield-checkmark" size={40} color={colors.primary} />
    </View>
    <View style={priv.cards}>
      {PRIVACY_POINTS.map((p) => (
        <View key={p.title} style={priv.card}>
          <View style={priv.cardIcon}>
            <Ionicons name={p.icon} size={18} color={colors.primary} />
          </View>
          <View style={priv.cardText}>
            <Text style={priv.cardTitle}>{p.title}</Text>
            <Text style={priv.cardBody}>{p.body}</Text>
          </View>
        </View>
      ))}
    </View>
  </View>
);

// ─────────────────────────────────────────────────────────────
// 슬라이드 3 비주얼: 연결하기 (행동)
// ─────────────────────────────────────────────────────────────
const ConnectVisual = () => (
  <View style={conn.wrap}>
    <View style={conn.iconRow}>
      <View style={conn.iconCircle}>
        <Ionicons name="mail" size={32} color={colors.primary} />
      </View>
      <Ionicons name="arrow-forward" size={22} color={colors.gray400} style={conn.arrow} />
      <View style={[conn.iconCircle, conn.iconCircleAccent]}>
        <Ionicons name="notifications" size={32} color={colors.white} />
      </View>
    </View>
  </View>
);

const SLIDES = [
  {
    title: '新しいお知らせを、\n見逃さない',
    subtitle: 'manabaのお知らせは、まず大学メールに届きます。\nメールを連携すると、届いた瞬間に通知でお知らせ。',
    Visual: () => (
      <PhoneMockup>
        <PushNotificationMock />
      </PhoneMockup>
    ),
  },
  {
    title: 'あなたのメールは、\n安全に',
    subtitle: '必要な範囲だけを、安心して使えるように。',
    Visual: PrivacyVisual,
  },
  {
    title: 'メールを連携して、\n通知を受け取る',
    subtitle: '最後にひとつ。Microsoftアカウントで連携します。',
    Visual: ConnectVisual,
  },
];

export default function MailConnectOnboardingScreen({ navigation, route }) {
  // 연결/스킵 완료 후 이동할 화면 (기본: manaba 모달)
  const nextRoute = route?.params?.next ?? 'Manaba';

  const [index, setIndex] = useState(0);
  const [connecting, setConnecting] = useState(false);
  const [done, setDone] = useState(false); // 연결 성공 → 완료 화면
  const scrollRef = useRef(null);

  const isLast = index === SLIDES.length - 1;
  const isFirst = index === 0;

  // Microsoft OAuth 요청 훅 (ProfileScreen과 동일 설정 공유)
  const [msRequest, msResponse, msPromptAsync] = AuthSession.useAuthRequest(
    MS_AUTH_REQUEST,
    MS_DISCOVERY,
  );

  // OAuth 응답 처리: 성공 → 완료 화면 / 취소 → 무시 / 실패 → 안내
  useEffect(() => {
    if (!msResponse) return;
    setConnecting(true);
    handleMicrosoftAuthResponse(msResponse, msRequest)
      .then(({ success, error }) => {
        if (success) {
          setDone(true);
        } else if (error !== 'cancelled') {
          Alert.alert('連携できませんでした', 'もう一度お試しください。');
        }
      })
      .finally(() => setConnecting(false));
  }, [msResponse]);

  const goToSlide = (i) => {
    scrollRef.current?.scrollTo({ x: i * SCREEN_WIDTH, animated: true });
  };

  const handleAdvance = () => {
    if (isLast) return;
    goToSlide(index + 1);
  };

  const handleBack = () => {
    if (!isFirst) goToSlide(index - 1);
  };

  const handleScrollEnd = (e) => {
    const newIndex = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setIndex(newIndex);
  };

  // manaba(또는 지정된 다음 화면)로 이동하며 이 모달을 교체
  const goNext = () => {
    if (navigation.replace) navigation.replace(nextRoute);
    else navigation.navigate(nextRoute);
  };

  const handleConnect = () => {
    if (connecting || !msRequest) return;
    msPromptAsync();
  };

  // ── 연결 완료 화면 ──
  if (done) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.doneWrap}>
          <View style={styles.doneCircle}>
            <Ionicons name="checkmark" size={48} color={colors.white} />
          </View>
          <Text style={styles.doneTitle}>連携が完了しました</Text>
          <Text style={styles.doneSubtitle}>
            これからは新しいお知らせを{'\n'}プッシュ通知でお届けします。
          </Text>
        </View>
        <View style={styles.bottomArea}>
          <Button title="manabaを開く" onPress={goNext} />
        </View>
      </SafeAreaView>
    );
  }

  // ── 슬라이드 화면 ──
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* 상단: 뒤로가기(첫 슬라이드에선 숨김) + 닫기 */}
      <View style={styles.topBar}>
        {isFirst ? (
          <View style={styles.backPlaceholder} />
        ) : (
          <TouchableOpacity
            onPress={handleBack}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chevron-back" size={26} color={colors.gray700} />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={goNext}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.skipText}>閉じる</Text>
        </TouchableOpacity>
      </View>

      {/* 가로 스크롤 슬라이드 */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScrollEnd}
        style={styles.scroll}
      >
        {SLIDES.map((slide, i) => {
          const Visual = slide.Visual;
          return (
            <View key={i} style={styles.slide}>
              <View style={styles.visualArea}>
                <Visual />
              </View>
              <Text style={styles.title}>{slide.title}</Text>
              <Text style={styles.subtitle}>{slide.subtitle}</Text>
            </View>
          );
        })}
      </ScrollView>

      {/* 하단 고정: 인디케이터 + 버튼 */}
      <View style={styles.bottomArea}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>

        {isLast ? (
          <>
            <Button
              title="Microsoftアカウントを連携"
              onPress={handleConnect}
              loading={connecting}
              disabled={!msRequest}
            />
            <TouchableOpacity
              onPress={goNext}
              style={styles.laterButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.laterText}>あとで</Text>
            </TouchableOpacity>
            <Text style={styles.footnote}>
              連携しなくても、アプリのすべての機能は使えます。{'\n'}
              設定からいつでも連携できます。
            </Text>
          </>
        ) : (
          <Button title="次へ" onPress={handleAdvance} />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },

  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    height: 44,
  },
  backPlaceholder: { width: 26 },
  skipText: { ...typography.body2, color: colors.gray500, fontWeight: '500' },

  scroll: { flex: 1 },
  slide: {
    width: SCREEN_WIDTH,
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  visualArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.lg,
    width: '100%',
  },
  title: {
    ...typography.title1,
    color: colors.gray900,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body2,
    color: colors.gray600,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },

  bottomArea: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
    paddingTop: spacing.sm,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginBottom: spacing.xl,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.gray300 },
  dotActive: { width: 20, backgroundColor: colors.primary },

  laterButton: { alignItems: 'center', paddingVertical: spacing.md },
  laterText: { ...typography.bodyStrong, color: colors.gray600 },
  footnote: {
    ...typography.caption,
    color: colors.gray500,
    textAlign: 'center',
    marginTop: spacing.xs,
  },

  // 완료 화면
  doneWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  doneCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  doneTitle: {
    ...typography.title2,
    color: colors.gray900,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  doneSubtitle: {
    ...typography.body1,
    color: colors.gray600,
    textAlign: 'center',
  },
});

// ── 슬라이드 1: 잠금화면 푸시 목업 스타일 ──
const mock = StyleSheet.create({
  lockWrap: {
    flex: 1,
    backgroundColor: '#EAF1FB',
    alignItems: 'center',
    paddingTop: 18,
    paddingHorizontal: 12,
  },
  lockTime: { fontSize: 44, fontWeight: '300', color: colors.gray900, letterSpacing: -1 },
  lockDate: { fontSize: 12, fontWeight: '600', color: colors.gray600, marginBottom: 28 },
  notifCard: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 14,
    padding: 10,
  },
  notifHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  appIcon: {
    width: 18,
    height: 18,
    borderRadius: 5,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  appName: { fontSize: 10, fontWeight: '700', color: colors.gray700, flex: 1 },
  notifTime: { fontSize: 9, color: colors.gray500 },
  notifTitle: { fontSize: 11, fontWeight: '700', color: colors.gray900, marginBottom: 2 },
  notifBody: { fontSize: 10, color: colors.gray600, lineHeight: 14 },
});

// ── 슬라이드 2: 프라이버시 카드 스타일 ──
const priv = StyleSheet.create({
  wrap: { width: '100%', alignItems: 'center' },
  shieldCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  cards: { width: '100%', gap: spacing.sm },
  card: {
    flexDirection: 'row',
    backgroundColor: colors.gray50,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: 'flex-start',
  },
  cardIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  cardText: { flex: 1 },
  cardTitle: { ...typography.bodyStrong, color: colors.gray900, marginBottom: 2 },
  cardBody: { ...typography.caption, color: colors.gray600 },
});

// ── 슬라이드 3: 연결 일러스트 스타일 ──
const conn = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  iconRow: { flexDirection: 'row', alignItems: 'center' },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleAccent: { backgroundColor: colors.primary },
  arrow: { marginHorizontal: spacing.lg },
});
