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
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { colors } from '../../constants/colors';
import { calculateFreePeriods } from '../../utils/timetable';

// 요일 레이블 (dayIndex 0=月 ~ 4=金)
const DAY_LABELS = ['月', '火', '水', '木', '金'];

// 교시별 시간 문자열 (국사관대학 기준)
const PERIOD_TIME_MAP = {
  1: '9:00 ~ 10:30',
  2: '10:45 ~ 12:15',
  3: '12:55 ~ 14:25',
  4: '14:40 ~ 16:10',
  5: '16:25 ~ 17:55',
  6: '18:10 ~ 19:40',
  7: '19:55 ~ 21:25',
  8: '21:40 ~ 23:10',
};

export default function FreeTimeScreen({ navigation }) {
  const [myNickname, setMyNickname] = useState('');      // 내 닉네임 (화면 상단 표시용)
  const [myFreePeriods, setMyFreePeriods] = useState([]); // 내 공강 목록
  const [loading, setLoading] = useState(true);           // 초기 로딩

  const [friendInput, setFriendInput] = useState('');    // 친구 ID 입력값
  const [comparing, setComparing] = useState(false);     // 비교 중 로딩
  const [friendResult, setFriendResult] = useState(null); // { friendNickname, commonPeriods }

  // ── 내 공강 시간 불러오기 ───────────────────────────────────────
  const fetchMyData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 프로필 조회와 수업 목록 조회는 서로 독립적이므로 병렬 실행
      const [profileResult, coursesResult] = await Promise.all([
        supabase.from('profiles').select('nickname').eq('id', user.id).single(),
        supabase.from('courses').select('day_of_week, period').eq('user_id', user.id),
      ]);

      if (coursesResult.error) throw coursesResult.error;

      setMyNickname(profileResult.data?.nickname ?? '');
      setMyFreePeriods(calculateFreePeriods(coursesResult.data ?? []));
    } catch (e) {
      Alert.alert('エラー', '空き時間の読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMyData();
  }, [fetchMyData]);

  // ── 친구 ID로 공통 공강 비교 ───────────────────────────────────
  const handleCompare = async () => {
    const input = friendInput.trim();
    if (!input) return;

    setComparing(true);
    setFriendResult(null);
    try {
      // 1. 닉네임으로 친구 프로필 검색
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, nickname')
        .eq('nickname', input)
        .single();

      if (profileError || !profile) {
        Alert.alert('見つかりません', `「${input}」というIDのユーザーが見つかりませんでした`);
        return;
      }

      // 2. 친구의 수업 목록 조회
      const { data: friendCourses, error: coursesError } = await supabase
        .from('courses')
        .select('day_of_week, period')
        .eq('user_id', profile.id);

      if (coursesError) throw coursesError;

      // 3. 친구의 공강 계산 후 내 공강과 교집합 추출
      const friendFree = calculateFreePeriods(friendCourses ?? []);
      const myFreeSet = new Set(myFreePeriods.map(p => `${p.day}-${p.period}`));
      const commonPeriods = friendFree.filter(p => myFreeSet.has(`${p.day}-${p.period}`));

      setFriendResult({ friendNickname: profile.nickname, commonPeriods });
    } catch (e) {
      Alert.alert('エラー', '比較に失敗しました。もう一度お試しください');
    } finally {
      setComparing(false);
    }
  };

  // ── 렌더링 ─────────────────────────────────────────────────────
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

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>読み込み中...</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

          {/* ── 내 ID 표시 (친구에게 알려줄 ID) ── */}
          {myNickname ? (
            <View style={styles.myIdCard}>
              <Text style={styles.myIdLabel}>あなたのID（友達に教えよう）</Text>
              <Text style={styles.myIdValue}>{myNickname}</Text>
            </View>
          ) : null}

          {/* ── 내 공강 시간 ── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>自分の空き時間</Text>
            <Text style={styles.sectionSubtitle}>
              今学期の空きコマ一覧（{myFreePeriods.length}コマ）
            </Text>

            {myFreePeriods.length === 0 ? (
              <View style={styles.noFreeWrap}>
                <Text style={styles.noFreeText}>空きコマがありません</Text>
              </View>
            ) : (
              <View style={styles.periodList}>
                {myFreePeriods.map((item, i) => (
                  <View key={i} style={styles.periodItem}>
                    <View style={styles.periodDayBadge}>
                      <Text style={styles.periodDayText}>{DAY_LABELS[item.day]}</Text>
                    </View>
                    <View style={styles.periodInfo}>
                      <Text style={styles.periodLabel}>{item.period}限</Text>
                      <Text style={styles.periodTime}>{PERIOD_TIME_MAP[item.period]}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* ── 친구 ID 입력 ── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>友達の時間割と比べる</Text>
            <Text style={styles.sectionSubtitle}>友達のIDを入力して共通の空き時間を探そう</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder="友達のID を入力"
                placeholderTextColor={colors.textDisabled}
                value={friendInput}
                onChangeText={text => {
                  setFriendInput(text);
                  // 입력값이 바뀌면 이전 결과 초기화
                  if (friendResult) setFriendResult(null);
                }}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={[styles.addButton, (!friendInput.trim() || comparing) && styles.addButtonDisabled]}
                activeOpacity={0.8}
                onPress={handleCompare}
                disabled={!friendInput.trim() || comparing}
              >
                {comparing
                  ? <ActivityIndicator size="small" color="#FFF" />
                  : <Text style={styles.addButtonText}>検索</Text>
                }
              </TouchableOpacity>
            </View>
          </View>

          {/* ── 비교 결과 ── */}
          {friendResult && (
            <View style={styles.section}>
              <View style={styles.resultHeader}>
                <Text style={styles.sectionTitle}>
                  {friendResult.friendNickname}との共通空き時間
                </Text>
                <View style={styles.countChip}>
                  <Text style={styles.countChipText}>{friendResult.commonPeriods.length}コマ</Text>
                </View>
              </View>

              {friendResult.commonPeriods.length > 0 ? (
                <>
                  <Text style={styles.sectionSubtitle}>この時間に一緒に集まれるよ！</Text>
                  {friendResult.commonPeriods.map((item, i) => (
                    <View key={i} style={styles.commonPeriodCard}>
                      <View style={styles.commonDayBadge}>
                        <Text style={styles.commonDayText}>{DAY_LABELS[item.day]}</Text>
                      </View>
                      <View style={styles.commonInfo}>
                        <Text style={styles.commonPeriodLabel}>{item.period}限</Text>
                        <Text style={styles.commonPeriodTime}>{PERIOD_TIME_MAP[item.period]}</Text>
                      </View>
                      <Text style={styles.matchMark}>✓</Text>
                    </View>
                  ))}
                </>
              ) : (
                <View style={styles.noMatch}>
                  <Text style={styles.noMatchEmoji}>😢</Text>
                  <Text style={styles.noMatchText}>共通の空き時間が見つかりませんでした</Text>
                </View>
              )}
            </View>
          )}

          {/* 검색 전 안내 */}
          {!friendResult && !comparing && (
            <View style={styles.emptyGuide}>
              <Text style={styles.emptyGuideEmoji}>📅</Text>
              <Text style={styles.emptyGuideText}>友達のIDを入力して{'\n'}空き時間を比べてみよう</Text>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // 헤더
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

  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: colors.textSecondary,
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

  // 섹션 공통
  section: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 14,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  countChip: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },

  // 내 공강 목록
  periodList: {
    gap: 8,
  },
  periodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: 12,
  },
  periodDayBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodDayText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  periodInfo: {
    flex: 1,
  },
  periodLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  periodTime: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  noFreeWrap: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  noFreeText: {
    fontSize: 13,
    color: colors.textSecondary,
  },

  // 친구 ID 입력
  inputRow: {
    flexDirection: 'row',
    gap: 8,
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
  addButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 60,
  },
  addButtonDisabled: {
    backgroundColor: colors.textDisabled,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  // 공통 공강 카드
  commonPeriodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.primaryLight,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  commonDayBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commonDayText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  commonInfo: {
    flex: 1,
  },
  commonPeriodLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  commonPeriodTime: {
    fontSize: 12,
    color: colors.primary,
    opacity: 0.8,
    marginTop: 2,
  },
  matchMark: {
    fontSize: 18,
    color: colors.primary,
    fontWeight: '700',
  },

  // 매치 없음
  noMatch: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  noMatchEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  noMatchText: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  // 빈 안내
  emptyGuide: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyGuideEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyGuideText: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
