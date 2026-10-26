import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  useWindowDimensions,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
import { buildOnboardingCopy } from '../../utils/onboardingCopy';
import { findUniversityByEmail, getUniversityLinks } from '../../utils/university';
import {
  TimetableMock,
  ManabaPushMock,
  AssignmentMock,
  ReviewMock,
  CommunityMock,
  OneTimeLoginMock,
  MOCK_BACKGROUND,
} from './onboardingMocks';

// 슬라이드 key → 폰 목업 컴포넌트(실제 앱 화면을 축소한 그림, ./onboardingMocks).
// 문구·구성은 utils/onboardingCopy 가 학교 링크로 결정한다.
const MOCK_BY_KEY = {
  timetable: TimetableMock,
  manabaPush: ManabaPushMock,
  assignment: AssignmentMock,
  review: ReviewMock,
  community: CommunityMock,
  oneTimeLogin: OneTimeLoginMock,
};

export default function OnboardingScreen({ navigation, route }) {
  const { session, refreshProfile } = useAuth();
  // 마이페이지 "使い方をもう一度見る"로 열면 review=true → DB 안 건드리고 닫기만 한다.
  const isReview = route?.params?.review === true;
  // 내 학교에 실제로 있는 기능만 소개한다 (manaba/一括/포털 유무로 슬라이드·문구 분기)
  const university = useMemo(() => findUniversityByEmail(session?.user?.email), [session?.user?.email]);
  const copy = useMemo(() => buildOnboardingCopy(getUniversityLinks(university?.id)), [university]);
  const SLIDES = copy.slides;
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
          const Mock = MOCK_BY_KEY[slide.key];
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
                  <PhoneMockup width={mock.width} background={MOCK_BACKGROUND[slide.key]}>
                    <Mock
                      targets={slide.targets}
                      afterText={slide.afterText}
                      autoAdd={slide.autoAdd}
                      schoolName={university?.name}
                    />
                  </PhoneMockup>
                )}
              </View>
              <View style={styles.textBlock} onLayout={onTextLayout}>
                {/* 화면 폭이 좁으면(안드로이드·SE) 글자를 조금 줄여, 정해 둔 줄 수를 지킨다 (한 글자만 다음 줄로 넘어가는 것 방지) */}
                <Text
                  style={styles.title}
                  numberOfLines={slide.title.split('\n').length}
                  adjustsFontSizeToFit
                  minimumFontScale={0.75}
                >
                  {slide.title}
                </Text>
                <Text
                  style={styles.subtitle}
                  numberOfLines={slide.subtitle.split('\n').length}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                >
                  {slide.subtitle}
                </Text>
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
            <Text style={styles.summaryLead}>{copy.summaryLead}</Text>
            <View style={styles.summaryList}>
              {copy.summaryItems.map((t) => (
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
          ) : !copy.showMailConnectCta ? (
            // manaba 미사용 학교: 설정할 통지가 없으므로 단일 버튼으로 시작
            <Button title="始める" onPress={() => handleFinish(false)} loading={finishing} />
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
