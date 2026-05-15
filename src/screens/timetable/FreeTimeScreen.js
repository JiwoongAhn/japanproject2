import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { colors, pastel } from '../../constants/colors';
import { spacing, radius, shadow } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { useAuth } from '../../lib/AuthProvider';
import { getUniversityInfo } from '../../utils/university';
import Card from '../../components/Card';

const DAY_LABELS = ['月', '火', '水', '木', '金'];
const PERIOD_COL_WIDTH = 36;
// 화면 너비 기반 셀 크기 계산
// 32 = ScrollView padding (16 * 2), 32 = Card padding (16 * 2), 10 = gap*5
const SCREEN_WIDTH = Dimensions.get('window').width;
const CELL_WIDTH = Math.floor((SCREEN_WIDTH - 32 - 32 - PERIOD_COL_WIDTH - 10) / 5);

export default function FreeTimeScreen({ navigation }) {
  const scrollViewRef = useRef(null);
  const { session } = useAuth();

  // 학교별 교시 수에 맞게 그리드 동적 계산
  const universityInfo = getUniversityInfo(session?.user?.email);
  const periodCount = universityInfo?.periodRanges ? Object.keys(universityInfo.periodRanges).length : 6;
  const PERIODS = Array.from({ length: periodCount }, (_, i) => i + 1);
  // 교시 수가 많을수록 셀 높이를 줄여 화면에 맞게 조정
  const CELL_HEIGHT = periodCount <= 5 ? 54 : periodCount <= 6 ? 48 : periodCount <= 8 ? 40 : 34;

  const [myNickname, setMyNickname] = useState('');
  const [loading, setLoading] = useState(true);

  // 내 수업이 있는 칸 (회색)
  const [myClassSet, setMyClassSet] = useState(new Set());
  // 내가 선택한 공강 (파란색)
  const [selectedCells, setSelectedCells] = useState(new Set());

  // 친구 비교
  const [friendInput, setFriendInput] = useState('');
  const [comparing, setComparing] = useState(false);
  const [friendNickname, setFriendNickname] = useState('');
  // 친구와 겹치는 칸 (민트)
  const [commonCells, setCommonCells] = useState(new Set());

  const fetchMyData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [profileResult, coursesResult] = await Promise.all([
        supabase.from('profiles').select('nickname').eq('id', user.id).single(),
        supabase.from('courses').select('day_of_week, period').eq('user_id', user.id),
      ]);

      setMyNickname(profileResult.data?.nickname ?? '');

      const courses = coursesResult.data ?? [];
      const classSet = new Set(courses.map(c => `${c.day_of_week}-${c.period}`));
      setMyClassSet(classSet);

      // 학교별 교시 수 (stale 클로저 방지 위해 내부에서 재계산)
      const uniInfo = getUniversityInfo(user.email);
      const pc = uniInfo?.periodRanges ? Object.keys(uniInfo.periodRanges).length : 6;

      // 공강 칸을 기본 선택
      const freeSet = new Set();
      for (let day = 0; day <= 4; day++) {
        for (let period = 1; period <= pc; period++) {
          if (!classSet.has(`${day}-${period}`)) {
            freeSet.add(`${day}-${period}`);
          }
        }
      }
      setSelectedCells(freeSet);
    } catch {
      // 부드러운 실패 문구
      Alert.alert('お知らせ', 'うまく読み込めませんでした。もう一度お試しください');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMyData();
  }, [fetchMyData]);

  const toggleCell = useCallback((key) => {
    setSelectedCells(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setCommonCells(new Set());
    setFriendNickname('');
  }, []);

  const selectAll = () => {
    const allFree = new Set();
    for (let day = 0; day <= 4; day++) {
      for (const period of PERIODS) {
        if (!myClassSet.has(`${day}-${period}`)) allFree.add(`${day}-${period}`);
      }
    }
    setSelectedCells(allFree);
    setCommonCells(new Set());
    setFriendNickname('');
  };

  const clearAll = () => {
    setSelectedCells(new Set());
    setCommonCells(new Set());
    setFriendNickname('');
  };

  const handleCompare = async () => {
    const input = friendInput.trim();
    if (!input) return;

    setComparing(true);
    setCommonCells(new Set());
    setFriendNickname('');

    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, nickname, share_timetable')
        .eq('nickname', input)
        .single();

      if (profileError || !profile) {
        Alert.alert('お知らせ', `「${input}」というIDのユーザーが見つからないみたい`);
        return;
      }

      if (!profile.share_timetable) {
        Alert.alert(
          'お知らせ',
          `${profile.nickname}さんは時間割を公開していません。\n友達に時間割の公開をお願いしてみよう`
        );
        return;
      }

      const { data: friendCourses } = await supabase
        .from('courses')
        .select('day_of_week, period')
        .eq('user_id', profile.id);

      const friendClassSet = new Set((friendCourses ?? []).map(c => `${c.day_of_week}-${c.period}`));
      const friendFreeSet = new Set();
      for (let day = 0; day <= 4; day++) {
        for (const period of PERIODS) {
          if (!friendClassSet.has(`${day}-${period}`)) friendFreeSet.add(`${day}-${period}`);
        }
      }

      const common = new Set([...selectedCells].filter(k => friendFreeSet.has(k)));
      setCommonCells(common);
      setFriendNickname(profile.nickname);
    } catch {
      Alert.alert('お知らせ', 'うまく比較できませんでした。もう一度お試しください');
    } finally {
      setComparing(false);
    }
  };

  const getCellState = (day, period) => {
    const key = `${day}-${period}`;
    if (myClassSet.has(key)) return 'class';
    if (commonCells.has(key)) return 'common';
    if (selectedCells.has(key)) return 'selected';
    return 'empty';
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} activeOpacity={0.7}>
            <Text style={styles.backButtonText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>空き時間合わせ</Text>
          <View style={styles.backButton} />
        </View>
        <ActivityIndicator style={{ flex: 1 }} size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  const selectedCount = selectedCells.size;
  const commonCount = commonCells.size;

  return (
    <SafeAreaView style={styles.container}>
      {/* ── 헤더 ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} activeOpacity={0.7}>
          <Text style={styles.backButtonText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>空き時間合わせ</Text>
        <View style={styles.backButton} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          ref={scrollViewRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── 내 ID 카드 (primary 강조) ── */}
          {myNickname ? (
            <View style={styles.myIdCard}>
              <Text style={styles.myIdLabel}>あなたのID（友達に教えよう）</Text>
              <Text style={styles.myIdValue}>{myNickname}</Text>
            </View>
          ) : null}

          {/* ── 선택 그리드 ── */}
          <Card style={styles.gridSection}>
            <View style={styles.gridHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>空き時間を選択</Text>
                <Text style={styles.sectionSub}>
                  {selectedCount}コマ選択中
                  {friendNickname ? ` · ${friendNickname}と${commonCount}コマ共通` : ''}
                </Text>
              </View>
              <View style={styles.gridActions}>
                <TouchableOpacity style={styles.actionBtn} onPress={selectAll} activeOpacity={0.8}>
                  <Text style={styles.actionBtnText}>全選択</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, styles.actionBtnGhost]} onPress={clearAll} activeOpacity={0.8}>
                  <Text style={styles.actionBtnGhostText}>全解除</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* ── 범례 (밀러 3개) ── */}
            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
                <Text style={styles.legendText}>選択中</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: pastel.mint.accent }]} />
                <Text style={styles.legendText}>友達と共通</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.gray300 }]} />
                <Text style={styles.legendText}>授業あり</Text>
              </View>
            </View>

            {/* ── 그리드 ── */}
            <View style={styles.grid}>
              {/* 요일 헤더 */}
              <View style={styles.gridRow}>
                <View style={{ width: PERIOD_COL_WIDTH }} />
                {DAY_LABELS.map((d, i) => (
                  <View key={i} style={[styles.dayHeader, { width: CELL_WIDTH }]}>
                    <Text style={styles.dayHeaderText}>{d}</Text>
                  </View>
                ))}
              </View>

              {/* 교시 행 */}
              {PERIODS.map((period) => (
                <View key={period} style={styles.gridRow}>
                  <View style={[styles.periodLabel, { width: PERIOD_COL_WIDTH, height: CELL_HEIGHT }]}>
                    <Text style={styles.periodLabelText}>{period}</Text>
                  </View>

                  {[0, 1, 2, 3, 4].map((day) => {
                    const cellState = getCellState(day, period);
                    const key = `${day}-${period}`;
                    return (
                      <TouchableOpacity
                        key={day}
                        style={[
                          styles.cell,
                          { width: CELL_WIDTH, height: CELL_HEIGHT },
                          cellState === 'class'    && styles.cellClass,
                          cellState === 'selected' && styles.cellSelected,
                          cellState === 'common'   && styles.cellCommon,
                          cellState === 'empty'    && styles.cellEmpty,
                        ]}
                        onPress={() => cellState !== 'class' && toggleCell(key)}
                        disabled={cellState === 'class'}
                        activeOpacity={0.7}
                      >
                        {cellState === 'class' && (
                          <Text style={styles.cellClassText}>授業</Text>
                        )}
                        {cellState === 'common' && (
                          <Text style={styles.cellCommonText}>✓</Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>
          </Card>

          {/* ── 친구 비교 섹션 ── */}
          <Card style={styles.compareSection}>
            <Text style={styles.sectionTitle}>友達のIDを入力して比較</Text>
            <Text style={styles.sectionSub}>共通の空き時間が緑色で表示されます</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder="友達のIDを入力"
                placeholderTextColor={colors.textDisabled}
                value={friendInput}
                onChangeText={text => {
                  setFriendInput(text);
                  if (friendNickname) {
                    setFriendNickname('');
                    setCommonCells(new Set());
                  }
                }}
                onFocus={() => {
                  setTimeout(() => {
                    scrollViewRef.current?.scrollToEnd({ animated: true });
                  }, 300);
                }}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={[styles.compareBtn, (!friendInput.trim() || comparing) && styles.compareBtnDisabled]}
                onPress={handleCompare}
                disabled={!friendInput.trim() || comparing}
                activeOpacity={0.85}
              >
                {comparing
                  ? <ActivityIndicator size="small" color={colors.white} />
                  : <Text style={styles.compareBtnText}>比較</Text>
                }
              </TouchableOpacity>
            </View>

            {/* 비교 결과 배너 (부드러운 톤) */}
            {friendNickname && (
              <View style={[
                styles.resultBanner,
                commonCount > 0 ? styles.resultBannerSuccess : styles.resultBannerEmpty,
              ]}>
                <Text style={[
                  styles.resultBannerText,
                  commonCount > 0 ? styles.resultBannerTextSuccess : styles.resultBannerTextEmpty,
                ]}>
                  {commonCount > 0
                    ? `${friendNickname}さんと ${commonCount}コマ 共通の空き時間があります 🎉`
                    : `${friendNickname}さんとは共通の空き時間がなさそう 😢`
                  }
                </Text>
              </View>
            )}
          </Card>

          <View style={{ height: spacing.huge }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // ── 헤더 ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.background,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: 28,
    color: colors.textPrimary,
    lineHeight: 32,
  },
  headerTitle: {
    ...typography.subtitle,
    color: colors.textPrimary,
  },

  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.md,
  },

  // ── 내 ID 카드 ──
  myIdCard: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    ...shadow.card,
  },
  myIdLabel: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.85)',
    marginBottom: spacing.xs + 2,
  },
  myIdValue: {
    ...typography.title3,
    color: colors.white,
    fontWeight: '800',
    letterSpacing: 1,
  },

  // ── 그리드 섹션 ──
  gridSection: {
    // Card 컴포넌트가 padding 적용
  },
  gridHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
    marginBottom: 3,
  },
  sectionSub: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  gridActions: {
    flexDirection: 'row',
    gap: spacing.xs + 2,
  },
  actionBtn: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
  },
  actionBtnText: {
    ...typography.small,
    color: colors.primary,
    fontWeight: '700',
  },
  actionBtnGhost: {
    backgroundColor: colors.gray50,
  },
  actionBtnGhostText: {
    ...typography.small,
    color: colors.textSecondary,
    fontWeight: '600',
  },

  // ── 범례 ──
  legend: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    ...typography.small,
    color: colors.textSecondary,
  },

  // ── 그리드 ──
  grid: {
    gap: 2,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 2,
    alignItems: 'center',
  },
  dayHeader: {
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayHeaderText: {
    ...typography.captionStrong,
    color: colors.textSecondary,
  },
  periodLabel: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodLabelText: {
    ...typography.captionStrong,
    color: colors.textSecondary,
  },

  // ── 셀 상태 ──
  cell: {
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellEmpty: {
    backgroundColor: colors.gray50,
  },
  cellSelected: {
    backgroundColor: colors.primary,
  },
  cellCommon: {
    backgroundColor: pastel.mint.accent,
  },
  cellClass: {
    backgroundColor: colors.gray200,
  },
  cellClassText: {
    fontSize: 9,
    color: colors.textDisabled,
    fontWeight: '700',
  },
  cellCommonText: {
    fontSize: 16,
    color: colors.white,
    fontWeight: '800',
  },

  // ── 비교 섹션 ──
  compareSection: {
    // Card 컴포넌트가 padding 적용
  },
  inputRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  input: {
    flex: 1,
    backgroundColor: colors.gray50,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    ...typography.body2,
    color: colors.textPrimary,
  },
  compareBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 72,
  },
  compareBtnDisabled: {
    backgroundColor: colors.gray300,
  },
  compareBtnText: {
    color: colors.white,
    ...typography.bodyStrong,
    fontWeight: '700',
  },

  // ── 결과 배너 (부드러운 톤) ──
  resultBanner: {
    borderRadius: radius.md,
    padding: spacing.md,
  },
  resultBannerSuccess: {
    backgroundColor: pastel.mint.bg,
  },
  resultBannerEmpty: {
    backgroundColor: colors.gray50,
  },
  resultBannerText: {
    ...typography.caption,
    fontWeight: '600',
    textAlign: 'center',
  },
  resultBannerTextSuccess: {
    color: pastel.mint.accent,
  },
  resultBannerTextEmpty: {
    color: colors.textSecondary,
  },
});
