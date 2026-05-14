import React, { useState, useRef } from 'react';
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
import { colors } from '../../constants/colors';
import { typography } from '../../constants/typography';
import { spacing } from '../../constants/spacing';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthProvider';
import Button from '../../components/Button';
import PhoneMockup from '../../components/PhoneMockup';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// === 슬라이드별 폰 화면 안에 들어갈 가짜 콘텐츠 ===

// 슬라이드 1: 시간표
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

// 슬라이드 2: 과제 마감
const AssignmentMock = () => (
  <View style={mockStyles.container}>
    <Text style={mockStyles.header}>課題</Text>
    {[
      { title: 'レポート提出', date: '明日 23:59', tag: '緊急', tagBg: '#FEE2E2', tagColor: '#DC2626' },
      { title: '英語 単語テスト', date: '3日後', tag: 'もうすぐ', tagBg: '#FEF3C7', tagColor: '#D97706' },
      { title: 'プログラミング課題', date: '1週間後', tag: '余裕', tagBg: '#D1FAE5', tagColor: '#059669' },
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

// 슬라이드 3: 커뮤니티
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

const SLIDES = [
  {
    title: '時間割を、もっとスマートに',
    subtitle: '授業も空きコマも、ひと目で確認',
    Mock: TimetableMock,
  },
  {
    title: '課題の締切、もう忘れない',
    subtitle: '提出期限が近い課題を一覧で表示',
    Mock: AssignmentMock,
  },
  {
    title: '同じ大学の仲間とつながる',
    subtitle: '匿名で気軽に話せる学校専用コミュニティ',
    Mock: CommunityMock,
  },
];

export default function OnboardingScreen() {
  const { session, refreshProfile } = useAuth();
  const [index, setIndex] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const scrollRef = useRef(null);

  const isLast = index === SLIDES.length - 1;
  const isFirst = index === 0;

  // 특정 슬라이드로 부드럽게 스크롤 이동
  const goToSlide = (i) => {
    scrollRef.current?.scrollTo({ x: i * SCREEN_WIDTH, animated: true });
  };

  // "次へ" 버튼: 다음 슬라이드로, 마지막이면 완료
  const handleAdvance = () => {
    if (finishing) return;
    if (isLast) {
      handleFinish();
    } else {
      goToSlide(index + 1);
    }
  };

  // 뒤로가기 화살표: 이전 슬라이드로
  const handleBack = () => {
    if (!isFirst) goToSlide(index - 1);
  };

  // 스와이프/스크롤이 끝나면 현재 인덱스 갱신
  const handleScrollEnd = (e) => {
    const newIndex = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setIndex(newIndex);
  };

  // 온보딩 완료 처리: profiles.onboarding_completed = true → AppNavigator가 자동 전환
  const handleFinish = async () => {
    if (finishing || !session?.user) return;
    setFinishing(true);

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

      {/* 상단: 뒤로가기(첫 슬라이드에선 숨김) + 스킵 */}
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
          onPress={handleFinish}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.skipText}>スキップ</Text>
        </TouchableOpacity>
      </View>

      {/* 가로 스크롤 슬라이드 (스와이프 가능) */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScrollEnd}
        style={styles.scroll}
      >
        {SLIDES.map((slide, i) => {
          const Mock = slide.Mock;
          return (
            <View key={i} style={styles.slide}>
              <View style={styles.mockArea}>
                <PhoneMockup>
                  <Mock />
                </PhoneMockup>
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
        <Button
          title={isLast ? 'はじめる' : '次へ'}
          onPress={handleAdvance}
          loading={finishing}
        />
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
    width: SCREEN_WIDTH,
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  mockArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.lg,
  },
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
});
