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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../../constants/colors';
import { typography } from '../../constants/typography';
import { spacing, radius } from '../../constants/spacing';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthProvider';
import Button from '../../components/Button';
import PhoneMockup from '../../components/PhoneMockup';
import { OPEN_MAIL_CONNECT_KEY } from '../../constants/onboardingFlags';
import { computeMockSize } from '../../utils/layout';

// === 슬라이드별 폰 화면 안에 들어갈 가짜 콘텐츠 ===

// 슬라이드 1: 시간표 (일괄추가)
const TimetableMock = () => (
  <View style={mockStyles.container}>
    <Text style={mockStyles.header}>時間割</Text>
    <View style={mockStyles.weekHeader}>
      {['月', '火', '水', '木', '金'].map((d) => (
        <Text key={d} style={mockStyles.weekDay}>{d}</Text>
      ))}
    </View>
    <View style={[mockStyles.cell, { backgroundColor: '#FEE2E2', top: 0, left: '0%' }]}>
      <Text style={mockStyles.cellText}>英語</Text>
    </View>
    <View style={[mockStyles.cell, { backgroundColor: '#DBEAFE', top: 0, left: '40%' }]}>
      <Text style={mockStyles.cellText}>数学</Text>
    </View>
    <View style={[mockStyles.cell, { backgroundColor: '#D1FAE5', top: 56, left: '20%' }]}>
      <Text style={mockStyles.cellText}>哲学</Text>
    </View>
    <View style={[mockStyles.cell, { backgroundColor: '#FEF3C7', top: 56, left: '60%' }]}>
      <Text style={mockStyles.cellText}>体育</Text>
    </View>
    <View style={[mockStyles.cell, { backgroundColor: '#EDE9FE', top: 112, left: '40%' }]}>
      <Text style={mockStyles.cellText}>歴史</Text>
    </View>
  </View>
);

// 슬라이드 2: manaba 통지 (잠금화면 푸시)
const ManabaPushMock = () => (
  <View style={mockStyles.lockWrap}>
    <Text style={mockStyles.lockTime}>9:41</Text>
    <Text style={mockStyles.lockDate}>6月9日 月曜日</Text>
    <View style={mockStyles.notifCard}>
      <View style={mockStyles.notifHeader}>
        <View style={mockStyles.appIcon}>
          <Ionicons name="notifications" size={12} color={colors.white} />
        </View>
        <Text style={mockStyles.appName}>ユニワン</Text>
        <Text style={mockStyles.notifTime}>今</Text>
      </View>
      <Text style={mockStyles.notifTitle} numberOfLines={1}>
        【お知らせ】休講のご連絡
      </Text>
      <Text style={mockStyles.notifBody} numberOfLines={2}>
        新しいお知らせが届きました。タップして確認
      </Text>
    </View>
  </View>
);

// 슬라이드 3: 과제 마감
const AssignmentMock = () => (
  <View style={mockStyles.container}>
    <Text style={mockStyles.header}>課題</Text>
    {/* 실제 과제 탭의 상태 배지(未提出/提出済/期限超過)와 문구를 일치시킨다(#6) */}
    {[
      { title: 'レポート提出', date: '明日 23:59', tag: '未提出', tagBg: '#FEF3C7', tagColor: '#D97706' },
      { title: '英語 単語テスト', date: '提出済み', tag: '提出済', tagBg: '#D1FAE5', tagColor: '#059669' },
      { title: 'プログラミング課題', date: '昨日 23:59', tag: '期限超過', tagBg: '#FEE2E2', tagColor: '#DC2626' },
    ].map((item, i) => (
      <View key={i} style={mockStyles.assignmentCard}>
        <View style={mockStyles.assignmentRow}>
          <Text style={mockStyles.assignmentTitle}>{item.title}</Text>
          <View style={[mockStyles.tag, { backgroundColor: item.tagBg }]}>
            <Text style={[mockStyles.tagText, { color: item.tagColor }]}>{item.tag}</Text>
          </View>
        </View>
        <Text style={mockStyles.assignmentDate}>📅 {item.date}</Text>
      </View>
    ))}
  </View>
);

// 슬라이드 4: 수업 평가
const ReviewMock = () => (
  <View style={mockStyles.container}>
    <Text style={mockStyles.header}>授業評価</Text>
    {[
      { name: '経営学概論', prof: '田中先生', stars: 5, tag: '出席ゆるめ' },
      { name: '線形代数', prof: '佐藤先生', stars: 4, tag: 'テスト重視' },
      { name: '心理学入門', prof: '鈴木先生', stars: 4, tag: 'レポート多め' },
    ].map((item, i) => (
      <View key={i} style={mockStyles.reviewCard}>
        <View style={mockStyles.reviewTop}>
          <Text style={mockStyles.reviewName} numberOfLines={1}>{item.name}</Text>
          <Text style={mockStyles.reviewStars}>
            {'★'.repeat(item.stars)}<Text style={mockStyles.reviewStarOff}>{'★'.repeat(5 - item.stars)}</Text>
          </Text>
        </View>
        <View style={mockStyles.reviewBottom}>
          <Text style={mockStyles.reviewProf}>{item.prof}</Text>
          <View style={mockStyles.reviewTag}>
            <Text style={mockStyles.reviewTagText}>{item.tag}</Text>
          </View>
        </View>
      </View>
    ))}
  </View>
);

// 슬라이드 5: 익명 게시판
const CommunityMock = () => (
  <View style={mockStyles.container}>
    <Text style={mockStyles.header}>掲示板</Text>
    {[
      { cat: '雑談', title: '今日の昼ごはん何にする？', meta: '匿名 · 12分前 · 💬 8' },
      { cat: '質問', title: '線形代数のテスト範囲って…', meta: '匿名 · 1時間前 · 💬 23' },
      { cat: '情報', title: '学食メニュー更新されました', meta: '匿名 · 3時間前 · 💬 5' },
    ].map((item, i) => (
      <View key={i} style={mockStyles.postCard}>
        <View style={[mockStyles.catBadge, { backgroundColor: colors.primaryLight }]}>
          <Text style={mockStyles.catBadgeText}>{item.cat}</Text>
        </View>
        <Text style={mockStyles.postTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={mockStyles.postMeta}>{item.meta}</Text>
      </View>
    ))}
  </View>
);

// 슬라이드 6: 최초 1회 로그인 안내 (매번 로그인해야 하나? 불안 해소)
const OneTimeLoginMock = () => (
  <View style={mockStyles.oneTimeWrap}>
    <View style={mockStyles.oneTimeBadge}>
      <Ionicons name="lock-open" size={30} color={colors.white} />
    </View>
    <Text style={mockStyles.oneTimeStep}>最初の1回だけ</Text>
    <View style={mockStyles.oneTimeRow}>
      <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
      <Text style={mockStyles.oneTimeRowText}>manaba にログイン</Text>
    </View>
    <View style={mockStyles.oneTimeRow}>
      <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
      <Text style={mockStyles.oneTimeRowText}>kaede-i にログイン</Text>
    </View>
    <View style={mockStyles.oneTimeAfter}>
      <Ionicons name="sync" size={14} color={colors.gray500} />
      <Text style={mockStyles.oneTimeAfterText}>あとは自動でつながります</Text>
    </View>
  </View>
);

const SLIDES = [
  {
    title: '時間割は、コピペで一括登録',
    subtitle: '学校のシステムからコピーして貼り付けるだけ。\n1つずつ入力しなくても、まとめて取り込めます。',
    Mock: TimetableMock,
  },
  {
    title: 'manabaのお知らせを、\nスマホの通知に',
    subtitle: '休講・課題・重要連絡を見逃さない。\nメールを開かなくても、通知で届きます。',
    Mock: ManabaPushMock,
  },
  {
    title: '課題の締切、もう忘れない',
    subtitle: '提出期限が近い課題を一覧でお知らせ。\nうっかり忘れを防ぎます。',
    Mock: AssignmentMock,
  },
  {
    title: '授業のリアルな評判をチェック',
    subtitle: '履修する前に、先輩たちの授業評価を確認。\n自分でも評価を投稿できます。',
    Mock: ReviewMock,
  },
  {
    title: '匿名で、気軽につながる',
    subtitle: '同じ大学の仲間と、匿名の掲示板でおしゃべり。\n質問も雑談も気軽にどうぞ。',
    Mock: CommunityMock,
  },
  {
    title: '最初の1回だけ、ログイン',
    subtitle: 'manabaとkaede-iは、最初に一度ログインするだけ。\nあとは毎回ログインしなくても自動でつながります。',
    Mock: OneTimeLoginMock,
  },
];

export default function OnboardingScreen({ navigation, route }) {
  const { session, refreshProfile } = useAuth();
  // 마이페이지 "使い方をもう一度見る"로 열면 review=true → DB 안 건드리고 닫기만 한다.
  const isReview = route?.params?.review === true;
  const [index, setIndex] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const scrollRef = useRef(null);
  // 화면 폭은 모듈 로드 시점 고정값(Dimensions.get)이 아니라 훅으로 — 회전·분할화면에도 정확
  const { width: SCREEN_WIDTH } = useWindowDimensions();

  // 폰 목업 크기: "남는 공간에서 역산"한다.
  // 예전엔 240×492 고정이라 iPhone SE(가용 ≈313px)에서 180px 넘쳐 제목·버튼을 덮었다.
  // 큰 화면은 상한 240에 걸려 예전과 동일하게 그려진다.
  //
  // 측정 대상은 높이가 "확정된" 것만: 페이저(ScrollView, flex:1) 높이와 제목·부제 블록 높이.
  // (목업 영역 자체를 재면 웹처럼 슬라이드가 내용 크기인 환경에서 0으로 측정돼 영원히 안 그려진다)
  const [pagerH, setPagerH] = useState(0);
  const [textH, setTextH] = useState(0); // 슬라이드들 중 가장 높은 제목+부제 블록
  const onPagerLayout = (e) => {
    const { height } = e.nativeEvent.layout;
    setPagerH((prev) => (prev === height ? prev : height));
  };
  const onTextLayout = (e) => {
    const { height } = e.nativeEvent.layout;
    setTextH((prev) => (height > prev ? height : prev));
  };
  // 첫 렌더(측정 전)는 크기 0 → 목업을 안 그리고, 측정 직후 한 프레임 안에 맞는 크기로 그린다
  const mock = computeMockSize(pagerH - textH - spacing.lg, SCREEN_WIDTH - spacing.xl * 2);

  // 마지막 요약 슬라이드는 SLIDES 다음의 가상 인덱스로 취급
  const summaryIndex = SLIDES.length;
  const totalPages = SLIDES.length + 1;
  const isSummary = index === summaryIndex;
  const isFirst = index === 0;

  // 특정 페이지로 부드럽게 스크롤 이동
  const goToPage = (i) => {
    scrollRef.current?.scrollTo({ x: i * SCREEN_WIDTH, animated: true });
  };

  // "次へ" 버튼: 다음 페이지로 (요약 페이지 전까지)
  const handleAdvance = () => {
    if (finishing) return;
    if (index < summaryIndex) goToPage(index + 1);
  };

  const handleBack = () => {
    if (!isFirst) goToPage(index - 1);
  };

  const handleScrollEnd = (e) => {
    const newIndex = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setIndex(newIndex);
  };

  // 대기시간 단축: 요약 페이지에 도달하면 전달주소(토큰)를 백그라운드에서 미리 발급해 둔다.
  // mail-provision은 멱등이라, 이후 마나바 설정 화면이 다시 호출해도 즉시 반환돼 대기가 사라진다.
  const prewarmedRef = useRef(false);
  useEffect(() => {
    if (index !== summaryIndex || prewarmedRef.current || isReview) return;
    prewarmedRef.current = true;
    supabase.functions.invoke('mail-provision').catch(() => {});
  }, [index, summaryIndex]);

  // 온보딩 완료 처리: profiles.onboarding_completed = true → AppNavigator가 자동 전환.
  // openMailConnect=true 이면 홈 진입 시 manaba 연결 화면을 자동으로 열도록 플래그 저장.
  const handleFinish = async (openMailConnect = false) => {
    if (finishing) return;
    // 다시 보기 모드: 진행 상태를 저장하지 않고 그냥 닫는다.
    if (isReview) {
      navigation?.goBack();
      return;
    }
    if (!session?.user) return;
    setFinishing(true);

    if (openMailConnect) {
      await AsyncStorage.setItem(OPEN_MAIL_CONNECT_KEY, '1').catch(() => {});
    }

    const { error } = await supabase
      .from('profiles')
      .update({ onboarding_completed: true })
      .eq('id', session.user.id);

    if (error) {
      Alert.alert('エラー', '保存に失敗しました。もう一度お試しください。');
      setFinishing(false);
      return;
    }

    await refreshProfile();
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* 상단: 뒤로가기(첫 페이지에선 숨김) + 스킵 */}
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
          onPress={() => handleFinish(false)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.skipText}>{isReview ? '閉じる' : 'スキップ'}</Text>
        </TouchableOpacity>
      </View>

      {/* 가로 스크롤 슬라이드 (스와이프 가능) */}
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
          const Mock = slide.Mock;
          return (
            // 슬라이드 = 세로 ScrollView. 큰 화면은 내용이 페이저 높이(minHeight) 안에 들어와 스크롤이 없고,
            // 작은 화면에서 혹시 넘치면 잘리는 대신 세로 스크롤로 볼 수 있다.
            <ScrollView
              key={i}
              style={{ width: SCREEN_WIDTH, height: pagerH || undefined }}
              contentContainerStyle={[styles.slide, { minHeight: pagerH || undefined }]}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
            >
              <View style={styles.mockArea}>
                {mock.visible && (
                  <PhoneMockup width={mock.width}>
                    <Mock />
                  </PhoneMockup>
                )}
              </View>
              <View style={styles.textBlock} onLayout={onTextLayout}>
                <Text style={styles.title}>{slide.title}</Text>
                <Text style={styles.subtitle}>{slide.subtitle}</Text>
              </View>
            </ScrollView>
          );
        })}

        {/* 마지막 요약 페이지 — 작은 화면(320×568 등)에서 리스트가 접혀 넘칠 수 있어 세로 스크롤 허용 */}
        <ScrollView
          style={{ width: SCREEN_WIDTH, height: pagerH || undefined }}
          contentContainerStyle={[styles.summaryScroll, { minHeight: pagerH || undefined }]}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
        >
          <View style={styles.summaryArea}>
            <View style={styles.summaryBadge}>
              <Ionicons name="checkmark-done" size={40} color={colors.white} />
            </View>
            <Text style={styles.summaryTitle}>準備はこれだけ！</Text>
            <Text style={styles.summaryLead}>
              最初のログイン1回で、あとはおまかせ。{'\n'}
              時間割・課題・お知らせが自動でそろいます。
            </Text>
            <View style={styles.summaryList}>
              {[
                'コピペで時間割を一括登録',
                'manaba連携でお知らせをスマホ通知',
                '授業評価と匿名掲示板も使える',
              ].map((t) => (
                <View key={t} style={styles.summaryRow}>
                  <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                  <Text style={styles.summaryRowText}>{t}</Text>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </ScrollView>

      {/* 하단 고정: 인디케이터 + 버튼 */}
      <View style={styles.bottomArea}>
        <View style={styles.dots}>
          {Array.from({ length: totalPages }).map((_, i) => (
            <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>

        {isSummary ? (
          isReview ? (
            <Button title="閉じる" onPress={() => navigation?.goBack()} />
          ) : (
            <>
              <Button
                title="manaba通知を設定する"
                onPress={() => handleFinish(true)}
                loading={finishing}
              />
              <TouchableOpacity
                onPress={() => handleFinish(false)}
                style={styles.laterButton}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.laterText}>スキップして始める</Text>
              </TouchableOpacity>
              <Text style={styles.footnote}>
                manaba連携はあとでマイページからも設定できます。
              </Text>
            </>
          )
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
  skipText: {
    ...typography.body2,
    color: colors.gray500,
    fontWeight: '500',
  },

  scroll: { flex: 1 },
  slide: {
    // ScrollView 의 contentContainerStyle. width/minHeight 는 렌더 시 인라인 지정
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  mockArea: {
    // 남는 공간은 차지하되(grow) 내용보다 작아지지는 않는다(shrink 0) → 넘치면 슬라이드가 스크롤된다
    flexGrow: 1,
    flexShrink: 0,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.lg,
  },
  textBlock: { alignSelf: 'stretch' },
  title: {
    ...typography.title1,
    color: colors.gray900,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body1,
    color: colors.gray600,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 22,
  },

  // 요약 페이지
  // ScrollView 는 alignItems/padding 을 style 이 아니라 contentContainerStyle 로 받아야 한다(RN invariant)
  summaryScroll: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  summaryArea: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingBottom: spacing.xl,
  },
  summaryBadge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  summaryTitle: {
    ...typography.title1,
    color: colors.gray900,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  summaryLead: {
    ...typography.body1,
    color: colors.gray600,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  summaryList: { width: '100%', gap: spacing.sm },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.gray50,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  summaryRowText: {
    ...typography.body2,
    color: colors.gray800,
    flex: 1,
    fontWeight: '600',
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
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.gray300,
  },
  dotActive: {
    width: 20,
    backgroundColor: colors.primary,
  },
  laterButton: { alignItems: 'center', paddingVertical: spacing.md },
  laterText: { ...typography.bodyStrong, color: colors.gray600 },
  footnote: {
    ...typography.caption,
    color: colors.gray500,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});

// === 폰 목업 안 콘텐츠 스타일 ===
const mockStyles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 12, paddingTop: 8 },
  header: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.gray900,
    marginBottom: 12,
  },

  // 시간표
  weekHeader: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
    marginBottom: 8,
  },
  weekDay: { fontSize: 10, fontWeight: '600', color: colors.gray600 },
  cell: {
    position: 'absolute',
    width: '18%',
    height: 48,
    borderRadius: 6,
    padding: 4,
    marginLeft: 12,
    marginTop: 56,
  },
  cellText: { fontSize: 9, fontWeight: '700', color: colors.gray800 },

  // manaba 통지 (잠금화면)
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

  // 과제
  assignmentCard: {
    backgroundColor: colors.gray50,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  assignmentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  assignmentTitle: { fontSize: 11, fontWeight: '700', color: colors.gray900, flex: 1 },
  assignmentDate: { fontSize: 9, color: colors.gray600 },
  tag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  tagText: { fontSize: 8, fontWeight: '700' },

  // 수업 평가
  reviewCard: {
    backgroundColor: colors.gray50,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  reviewTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  reviewName: { fontSize: 11, fontWeight: '700', color: colors.gray900, flex: 1 },
  reviewStars: { fontSize: 11, color: '#F59E0B', letterSpacing: 1 },
  reviewStarOff: { color: colors.gray300 },
  reviewBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reviewProf: { fontSize: 9, color: colors.gray600 },
  reviewTag: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  reviewTagText: { fontSize: 8, fontWeight: '700', color: colors.primary },

  // 커뮤니티
  postCard: {
    backgroundColor: colors.gray50,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  catBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    marginBottom: 4,
  },
  catBadgeText: { fontSize: 8, fontWeight: '700', color: colors.primary },
  postTitle: { fontSize: 11, fontWeight: '700', color: colors.gray900, marginBottom: 3 },
  postMeta: { fontSize: 9, color: colors.gray500 },

  // 최초 1회 로그인
  oneTimeWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  oneTimeBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  oneTimeStep: { fontSize: 13, fontWeight: '800', color: colors.gray900, marginBottom: 12 },
  oneTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.gray50,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 6,
    width: '100%',
  },
  oneTimeRowText: { fontSize: 11, fontWeight: '700', color: colors.gray800 },
  oneTimeAfter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
  },
  oneTimeAfterText: { fontSize: 10, fontWeight: '600', color: colors.gray500 },
});
