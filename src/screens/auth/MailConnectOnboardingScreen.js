import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  useWindowDimensions,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { colors } from '../../constants/colors';
import { typography } from '../../constants/typography';
import { spacing, radius } from '../../constants/spacing';
import Button from '../../components/Button';
import PhoneMockup from '../../components/PhoneMockup';
import LoadingDots from '../../components/LoadingDots';
import { supabase } from '../../lib/supabase';
import { computeMockSize } from '../../utils/layout';

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
        <Text style={mock.appName}>ユニワン</Text>
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
    icon: 'key',
    title: 'パスワードは不要',
    body: 'manabaのリマインダ設定にアドレスを追加するだけ。アプリがパスワードを預かることはありません。',
  },
  {
    icon: 'mail-unread',
    title: 'manabaのお知らせだけ',
    body: 'manabaのリマインダ通知だけが届きます。その他のメールは受け取りません。',
  },
  {
    icon: 'power',
    title: 'いつでも停止できます',
    body: 'manabaのリマインダ設定からアドレスを削除すれば、すぐに通知を止められます。',
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
    subtitle: 'メールを開かなくても大丈夫。\n新しいお知らせは、通知でお届けします。',
    // mockWidth: 화면 컴포넌트가 가용 공간에서 역산한 목업 폭 (OnboardingScreen 과 동일 방식)
    Visual: ({ mockWidth }) => (
      <PhoneMockup width={mockWidth}>
        <PushNotificationMock />
      </PhoneMockup>
    ),
    usesMockup: true,
  },
  {
    title: 'あなたのメールは、\n安全に',
    subtitle: '必要な範囲だけを、安心して使えるように。',
    Visual: PrivacyVisual,
  },
  {
    title: 'manabaの設定で、\n通知を受け取る',
    subtitle: 'manabaのリマインダ設定に、あなた専用アドレスを追加します。',
    Visual: ConnectVisual,
  },
];

export default function MailConnectOnboardingScreen({ navigation, route }) {
  // 연결/스킵 완료 후 이동할 화면 (기본: manaba 모달)
  const nextRoute = route?.params?.next ?? 'Manaba';
  // 설정 모드: 이미 한 번 설정을 시작한 사용자가 마이페이지에서 다시 들어온 경우.
  // 인트로 슬라이드를 건너뛰고 곧바로 주소/설정 안내로 진입한다(최초 1회 외 인트로 반복 방지).
  const settingsMode = route?.params?.mode === 'settings';

  const [index, setIndex] = useState(0);
  const [provisioning, setProvisioning] = useState(false);
  const [address, setAddress] = useState(null); // 발급된 전달주소 → 가이드 화면 표시
  const [copied, setCopied] = useState(false);
  // 설정 모드에서 주소 발급 대기 중 인트로 깜빡임을 막기 위한 로딩 플래그
  const [autoLoading, setAutoLoading] = useState(settingsMode);
  // 사용자가 "使い方をもう一度見る"를 눌러 인트로를 다시 볼 때만 true (가이드 위에 인트로 표시)
  const [showIntro, setShowIntro] = useState(false);
  const scrollRef = useRef(null);
  // 화면 폭은 모듈 로드 시점 고정값이 아니라 훅으로
  const { width: SCREEN_WIDTH } = useWindowDimensions();

  // 폰 목업 크기: "남는 공간에서 역산" (OnboardingScreen 과 동일 방식).
  // 예전엔 240×492 고정이라 작은 iPhone 에서 제목·버튼을 덮었다.
  // 높이가 확정된 페이저(ScrollView) 높이와 제목·부제 블록 높이만 측정한다.
  const [pagerH, setPagerH] = useState(0);
  const [textH, setTextH] = useState(0);
  const onPagerLayout = (e) => {
    const { height } = e.nativeEvent.layout;
    setPagerH((prev) => (prev === height ? prev : height));
  };
  const onTextLayout = (e) => {
    const { height } = e.nativeEvent.layout;
    setTextH((prev) => (height > prev ? height : prev));
  };
  const mock = computeMockSize(
    pagerH - textH - spacing.lg - spacing.xl, // visualArea 의 위·아래 패딩 제외
    SCREEN_WIDTH - spacing.xl * 2
  );

  const isLast = index === SLIDES.length - 1;
  const isFirst = index === 0;

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

  // 전달주소 발급 → 가이드 화면으로 전환
  const handleProvision = async () => {
    if (provisioning) return;
    setProvisioning(true);
    try {
      const { data, error } = await supabase.functions.invoke('mail-provision');
      if (error || !data?.address) {
        Alert.alert('発行できませんでした', 'もう一度お試しください。');
        return;
      }
      setAddress(data.address);
      setShowIntro(false); // (재열람 중이었다면) 인트로 종료하고 가이드로 복귀
    } catch (e) {
      Alert.alert('発行できませんでした', 'もう一度お試しください。');
    } finally {
      setProvisioning(false);
    }
  };

  // 설정 모드로 진입하면 인트로 없이 곧바로 주소를 발급(멱등)해 가이드 화면을 연다
  useEffect(() => {
    if (!settingsMode) return;
    let alive = true;
    (async () => {
      await handleProvision();
      if (alive) setAutoLoading(false); // 성공=가이드 표시 / 실패=인트로로 폴백
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 인트로 캐러셀의 닫기/あとで — 재열람 중이면 가이드로 복귀, 최초 흐름이면 다음 화면으로
  const handleCloseCarousel = () => {
    if (showIntro) setShowIntro(false);
    else goNext();
  };

  // 가이드에서 "사용법 다시 보기" — 인트로 캐러셀을 처음부터 다시 보여줌
  const handleReplayIntro = () => {
    setIndex(0);
    setShowIntro(true);
  };

  const handleCopy = async () => {
    if (!address) return;
    await Clipboard.setStringAsync(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // manaba 리마인더 설정 WebView 화면으로 이동 (발급된 주소 전달)
  const handleOpenReminderSetup = () => {
    navigation.navigate('ManabaReminderSetup', { address });
  };

  // ── 설정 모드: 주소 발급 대기 로딩 (인트로 깜빡임 방지) ──
  if (autoLoading && !showIntro && !address) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <LoadingDots fullscreen />
      </SafeAreaView>
    );
  }

  // ── 주소 발급 후: manaba 리마인더 설정 안내 화면 (인트로 재열람 중이면 아래 캐러셀 표시) ──
  if (address && !showIntro) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <ScrollView contentContainerStyle={guide.scroll}>
          <Text style={guide.heading}>通知を受け取る設定</Text>
          <Text style={guide.lead}>
            manabaの「リマインダ設定」に、下のアドレスを追加します。
          </Text>

          {/* 안심 문구 — 파스워드 불필요 / 마나바 공지만 / 언제든 정지 */}
          <View style={guide.safeCard}>
            {[
              { icon: 'key', text: 'パスワードは不要。アドレスを追加するだけ。' },
              { icon: 'mail-unread', text: 'manabaのお知らせだけが届きます。' },
              { icon: 'power', text: 'いつでも設定から停止できます。' },
            ].map((p) => (
              <View key={p.text} style={guide.safeRow}>
                <Ionicons name={p.icon} size={16} color={colors.primary} />
                <Text style={guide.safeText}>{p.text}</Text>
              </View>
            ))}
          </View>

          {/* ① 토큰주소 + 복사 */}
          <Text style={guide.stepLabel}>① あなた専用アドレス</Text>
          <View style={guide.addressBox}>
            <Text style={guide.addressText} numberOfLines={1} selectable>
              {address}
            </Text>
            <TouchableOpacity
              style={guide.copyButton}
              onPress={handleCopy}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name={copied ? 'checkmark' : 'copy-outline'}
                size={16}
                color={colors.white}
              />
              <Text style={guide.copyText}>{copied ? 'コピー済み' : 'コピー'}</Text>
            </TouchableOpacity>
          </View>

          {/* ② 설정 페이지 안내 */}
          <Text style={guide.stepLabel}>② manabaの「携帯メールアドレス」欄に貼り付け</Text>
          <Text style={guide.stepDesc}>
            ログイン済みのまま、manabaのリマインダ設定ページが開きます。{'\n'}
            上のアドレスを<Text style={guide.strong}>「携帯メールアドレス」</Text>欄に貼り付けて、manabaの<Text style={guide.strong}>「保存」</Text>を押してください。
          </Text>
          <Text style={guide.noteBox}>
            💡 通知はこのアプリにまとめて届きます。{'\n'}
            すでにmanabaに他のメールを登録していると、同じ通知がメールとアプリの両方に届くことがあります。アプリの通知だけにしたい場合は、manabaの「メールアドレス」欄を空にしてください。
          </Text>

          <View style={guide.hintRow}>
            <Ionicons name="time-outline" size={16} color={colors.gray500} />
            <Text style={guide.hintText}>
              設定が確認されると、マイページに ✅ が表示されます。
            </Text>
          </View>
        </ScrollView>

        <View style={styles.bottomArea}>
          <Button title="manaba設定を開く" onPress={handleOpenReminderSetup} />
          {/* #8: 설정을 마쳤거나 나중에 할 때 홈으로 바로 돌아가는 버튼.
              기존엔 작은 텍스트 링크라 누르기 어려웠다(실기 피드백) →
              큰 secondary 버튼으로 승격해 탭 영역을 넓혔다. 모달을 닫아 홈 탭으로 복귀한다. */}
          <Button
            title="ホームに戻る"
            variant="secondary"
            onPress={() => navigation.goBack()}
            style={styles.homeButton}
          />
          <TouchableOpacity
            onPress={handleReplayIntro}
            style={styles.laterButtonTight}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.laterTextSub}>使い方をもう一度見る</Text>
          </TouchableOpacity>
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
          onPress={handleCloseCarousel}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.skipText}>{showIntro ? '戻る' : '閉じる'}</Text>
        </TouchableOpacity>
      </View>

      {/* 가로 스크롤 슬라이드 */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScrollEnd}
        onLayout={onPagerLayout}
        style={styles.scroll}
      >
        {SLIDES.map((slide, i) => {
          const Visual = slide.Visual;
          // 목업 슬라이드는 측정 전(크기 0)이나 공간 부족 시 목업을 그리지 않는다
          const hideVisual = slide.usesMockup && !mock.visible;
          return (
            // 슬라이드 = 세로 ScrollView. 큰 화면은 내용이 페이저 높이(minHeight) 안에 들어와 스크롤이 없고,
            // 작은 화면(SE·320)에서 카드 등이 넘치면 잘리는 대신 세로 스크롤로 볼 수 있다.
            <ScrollView
              key={i}
              style={{ width: SCREEN_WIDTH, height: pagerH || undefined }}
              contentContainerStyle={[styles.slide, { minHeight: pagerH || undefined }]}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
            >
              <View style={styles.visualArea}>
                {!hideVisual && <Visual mockWidth={mock.width} />}
              </View>
              <View style={styles.textBlock} onLayout={onTextLayout}>
                <Text style={styles.title}>{slide.title}</Text>
                <Text style={styles.subtitle}>{slide.subtitle}</Text>
              </View>
            </ScrollView>
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
              title="転送アドレスを発行"
              onPress={handleProvision}
              loading={provisioning}
            />
            <TouchableOpacity
              onPress={handleCloseCarousel}
              style={styles.laterButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.laterText}>{showIntro ? '戻る' : 'あとで'}</Text>
            </TouchableOpacity>
            <Text style={styles.footnote}>
              設定しなくても、アプリのすべての機能は使えます。{'\n'}
              マイページからいつでも設定できます。
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
    // ScrollView 의 contentContainerStyle. width/minHeight 는 렌더 시 인라인 지정
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  visualArea: {
    // 남는 공간은 차지하되(grow) 내용보다 작아지지는 않는다(shrink 0) → 넘치면 슬라이드가 스크롤된다
    flexGrow: 1,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    width: '100%',
  },
  textBlock: { alignSelf: 'stretch' },
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
  homeButton: { marginTop: spacing.sm },
  laterButtonTight: { alignItems: 'center', paddingVertical: spacing.xs },
  laterTextSub: { ...typography.body2, color: colors.gray500 },
  footnote: {
    ...typography.caption,
    color: colors.gray500,
    textAlign: 'center',
    marginTop: spacing.xs,
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

// ── 전달주소 가이드 화면 스타일 ──
const guide = StyleSheet.create({
  scroll: { padding: spacing.xl, paddingBottom: spacing.lg },
  heading: { ...typography.title2, fontSize: 24, color: colors.gray900, marginBottom: spacing.xs },
  lead: { fontSize: 16, color: colors.gray600, lineHeight: 24, marginBottom: spacing.lg },
  stepLabel: { fontSize: 17, fontWeight: '800', color: colors.gray900, marginBottom: spacing.sm },
  stepDesc: {
    fontSize: 16,
    color: colors.gray700,
    lineHeight: 25,
    marginBottom: spacing.md,
  },
  // 안심 문구 카드
  safeCard: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  safeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  safeText: { fontSize: 14, color: colors.gray800, fontWeight: '600', flex: 1, lineHeight: 20 },
  strong: { fontWeight: '800', color: colors.primary },
  noteBox: {
    fontSize: 13,
    color: colors.gray700,
    lineHeight: 20,
    backgroundColor: colors.gray50,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.xl,
  },
  addressBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray50,
    borderRadius: radius.lg,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    paddingVertical: spacing.xs,
    marginBottom: spacing.xl,
  },
  addressText: { ...typography.body2, color: colors.gray900, flex: 1, fontWeight: '600' },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  copyText: { ...typography.caption, color: colors.white, fontWeight: '700' },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  hintText: { ...typography.caption, color: colors.gray500, flex: 1 },
});
