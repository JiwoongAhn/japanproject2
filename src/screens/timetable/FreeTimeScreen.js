import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { colors } from '../../constants/colors';

// 요일 레이블
const DAY_LABELS = ['月', '火', '水', '木', '金'];
// 교시 목록 (1~6교시)
const PERIODS = [1, 2, 3, 4, 5, 6];
// 교시 열 너비
const PERIOD_COL_WIDTH = 36;
// 화면 너비 기반으로 셀 너비 계산
// 32 = ScrollView padding (16 * 2)
// 28 = gridSection card padding (14 * 2)
// 10 = gap:2 × 5칸 사이 공간
const SCREEN_WIDTH = Dimensions.get('window').width;
const CELL_WIDTH = Math.floor((SCREEN_WIDTH - 32 - 28 - PERIOD_COL_WIDTH - 10) / 5);
const CELL_HEIGHT = 48;

export default function FreeTimeScreen({ navigation }) {
  const [myNickname, setMyNickname] = useState('');
  const [loading, setLoading] = useState(true);

  // 내 수업이 있는 칸 (회색 - 선택 불가)
  const [myClassSet, setMyClassSet] = useState(new Set());
  // 내가 선택한 공강 칸 (파란색)
  const [selectedCells, setSelectedCells] = useState(new Set());

  // 친구 비교
  const [friendInput, setFriendInput] = useState('');
  const [comparing, setComparing] = useState(false);
  const [friendNickname, setFriendNickname] = useState('');
  // 친구와 겹치는 칸 (초록색)
  const [commonCells, setCommonCells] = useState(new Set());

  // ── 내 시간표 불러와서 수업/공강 초기화 ─────────────────────────
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
      // 수업 있는 칸 세트
      const classSet = new Set(courses.map(c => `${c.day_of_week}-${c.period}`));
      setMyClassSet(classSet);

      // 공강 칸을 기본으로 선택 (내 시간표 기준 자동 채우기)
      const freeSet = new Set();
      for (let day = 0; day <= 4; day++) {
        for (const period of PERIODS) {
          if (!classSet.has(`${day}-${period}`)) {
            freeSet.add(`${day}-${period}`);
          }
        }
      }
      setSelectedCells(freeSet);
    } catch (e) {
      Alert.alert('エラー', '読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMyData();
  }, [fetchMyData]);

  // 셀 탭 → 선택/해제 토글
  const toggleCell = useCallback((key) => {
    setSelectedCells(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    // 비교 결과 초기화
    setCommonCells(new Set());
    setFriendNickname('');
  }, []);

  // 전체 선택 / 전체 해제
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

  // ── 친구 아이디로 비교 ──────────────────────────────────────────
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
        Alert.alert('見つかりません', `「${input}」というIDのユーザーが見つかりませんでした`);
        return;
      }

      // 친구가 시간표 공개를 OFF로 설정한 경우 비교 불가
      if (!profile.share_timetable) {
        Alert.alert(
          '非公開',
          `${profile.nickname}さんは時間割を公開していません。\n友達に時間割の公開をお願いしてください。`
        );
        return;
      }

      const { data: friendCourses } = await supabase
        .from('courses')
        .select('day_of_week, period')
        .eq('user_id', profile.id);

      // 친구의 공강 계산
      const friendClassSet = new Set((friendCourses ?? []).map(c => `${c.day_of_week}-${c.period}`));
      const friendFreeSet = new Set();
      for (let day = 0; day <= 4; day++) {
        for (const period of PERIODS) {
          if (!friendClassSet.has(`${day}-${period}`)) friendFreeSet.add(`${day}-${period}`);
        }
      }

      // 내가 선택한 공강 ∩ 친구 공강 = 공통 공강
      const common = new Set([...selectedCells].filter(k => friendFreeSet.has(k)));
      setCommonCells(common);
      setFriendNickname(profile.nickname);
    } catch {
      Alert.alert('エラー', '比較に失敗しました');
    } finally {
      setComparing(false);
    }
  };

  // ── 셀 상태 결정 ────────────────────────────────────────────────
  const getCellState = (day, period) => {
    const key = `${day}-${period}`;
    if (myClassSet.has(key)) return 'class';       // 내 수업
    if (commonCells.has(key)) return 'common';     // 친구와 겹침
    if (selectedCells.has(key)) return 'selected'; // 내가 선택한 공강
    return 'empty';                                  // 선택 안 함
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>空き時間合わせ</Text>
          <View style={{ width: 36 }} />
        </View>
        <ActivityIndicator style={{ flex: 1 }} size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  const selectedCount = selectedCells.size;
  const commonCount = commonCells.size;

  return (
    <SafeAreaView style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>空き時間合わせ</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* ── 내 ID 카드 ── */}
        {myNickname ? (
          <View style={styles.myIdCard}>
            <Text style={styles.myIdLabel}>あなたのID（友達に教えよう）</Text>
            <Text style={styles.myIdValue}>{myNickname}</Text>
          </View>
        ) : null}

        {/* ── 선택 그리드 ── */}
        <View style={styles.gridSection}>
          {/* 섹션 헤더 + 버튼 */}
          <View style={styles.gridHeaderRow}>
            <View>
              <Text style={styles.sectionTitle}>空き時間を選択</Text>
              <Text style={styles.sectionSub}>
                {selectedCount}コマ選択中
                {friendNickname ? ` · ${friendNickname}と${commonCount}コマ共通` : ''}
              </Text>
            </View>
            <View style={styles.gridActions}>
              <TouchableOpacity style={styles.actionBtn} onPress={selectAll}>
                <Text style={styles.actionBtnText}>全選択</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, styles.actionBtnGhost]} onPress={clearAll}>
                <Text style={styles.actionBtnGhostText}>全解除</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 범례 */}
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
              <Text style={styles.legendText}>選択中</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#05C072' }]} />
              <Text style={styles.legendText}>友達と共通</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.border }]} />
              <Text style={styles.legendText}>授業あり</Text>
            </View>
          </View>

          {/* 그리드 */}
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
                {/* 교시 레이블 */}
                <View style={[styles.periodLabel, { width: PERIOD_COL_WIDTH }]}>
                  <Text style={styles.periodLabelText}>{period}</Text>
                </View>

                {/* 요일별 셀 */}
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
        </View>

        {/* ── 친구 ID 입력 및 비교 ── */}
        <View style={styles.compareSection}>
          <Text style={styles.sectionTitle}>友達のIDを入力して比較</Text>
          <Text style={styles.sectionSub}>友達のIDを入力すると、共通の空き時間が緑色で表示されます</Text>
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
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={[styles.compareBtn, (!friendInput.trim() || comparing) && styles.compareBtnDisabled]}
              onPress={handleCompare}
              disabled={!friendInput.trim() || comparing}
              activeOpacity={0.8}
            >
              {comparing
                ? <ActivityIndicator size="small" color="#FFF" />
                : <Text style={styles.compareBtnText}>比較</Text>
              }
            </TouchableOpacity>
          </View>

          {/* 비교 결과 요약 */}
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
                  : `${friendNickname}さんと共通の空き時間がありません 😢`
                }
              </Text>
            </View>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
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
    paddingVertical: 14,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  scrollContent: {
    padding: 16,
    gap: 12,
  },

  // 내 ID 카드
  myIdCard: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  myIdLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 6,
  },
  myIdValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1,
  },

  // 그리드 섹션
  gridSection: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
  },
  gridHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 3,
  },
  sectionSub: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  gridActions: {
    flexDirection: 'row',
    gap: 6,
  },
  actionBtn: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  actionBtnGhost: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionBtnGhostText: {
    fontSize: 12,
    color: colors.textSecondary,
  },

  // 범례
  legend: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 11,
    color: colors.textSecondary,
  },

  // 그리드
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
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  periodLabel: {
    height: CELL_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodLabelText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },

  // 그리드 셀 상태
  cell: {
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellEmpty: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cellSelected: {
    backgroundColor: colors.primary,
  },
  cellCommon: {
    backgroundColor: '#05C072',
  },
  cellClass: {
    backgroundColor: colors.border,
  },
  cellClassText: {
    fontSize: 9,
    color: colors.textDisabled,
    fontWeight: '600',
  },
  cellCommonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '800',
  },

  // 비교 섹션
  compareSection: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    marginBottom: 10,
  },
  input: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.textPrimary,
  },
  compareBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 64,
  },
  compareBtnDisabled: {
    backgroundColor: colors.textDisabled,
  },
  compareBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  // 결과 배너
  resultBanner: {
    borderRadius: 10,
    padding: 12,
  },
  resultBannerSuccess: {
    backgroundColor: '#05C072' + '18',
  },
  resultBannerEmpty: {
    backgroundColor: colors.background,
  },
  resultBannerText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  resultBannerTextSuccess: {
    color: '#05C072',
  },
  resultBannerTextEmpty: {
    color: colors.textSecondary,
  },
});
