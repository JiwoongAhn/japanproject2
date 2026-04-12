import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
} from 'react-native';
import { colors } from '../../constants/colors';

// ── 내 공강 시간 (목업) ─────────────────────────────────────────
const MY_FREE_PERIODS = [
  { day: '火', period: 2, time: '10:45 ~ 12:15' },
  { day: '木', period: 3, time: '12:55 ~ 14:25' },
  { day: '木', period: 4, time: '14:40 ~ 16:10' },
];

// ── 친구 비교 결과 (목업) ───────────────────────────────────────
const MOCK_COMPARISON = {
  friendName: '田中くん',
  commonPeriods: [
    { day: '月', period: 4, time: '14:40 ~ 16:10' },
    { day: '水', period: 5, time: '16:25 ~ 17:55' },
  ],
};

const DAY_LABELS = { '月': '月', '火': '火', '水': '水', '木': '木', '金': '金' };

export default function FreeTimeScreen({ navigation }) {
  const [friendId, setFriendId] = useState('');
  const [showResult, setShowResult] = useState(true); // 목업이므로 기본으로 결과 표시

  return (
    <SafeAreaView style={styles.container}>

      {/* ── 헤더 ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>空き時間合わせ</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* ── 내 공강 시간 ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>自分の空き時間</Text>
          <Text style={styles.sectionSubtitle}>今学期の空きコマ一覧</Text>
          <View style={styles.periodList}>
            {MY_FREE_PERIODS.map((item, i) => (
              <View key={i} style={styles.periodItem}>
                <View style={styles.periodDayBadge}>
                  <Text style={styles.periodDayText}>{item.day}</Text>
                </View>
                <View style={styles.periodInfo}>
                  <Text style={styles.periodLabel}>{item.period}限</Text>
                  <Text style={styles.periodTime}>{item.time}</Text>
                </View>
              </View>
            ))}
          </View>
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
              value={friendId}
              onChangeText={setFriendId}
            />
            <TouchableOpacity
              style={[styles.addButton, !friendId && styles.addButtonDisabled]}
              activeOpacity={0.8}
              onPress={() => setShowResult(true)}
              disabled={!friendId}
            >
              <Text style={styles.addButtonText}>追加</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── 비교 결과 ── */}
        {showResult && (
          <View style={styles.section}>
            <View style={styles.resultHeader}>
              <Text style={styles.sectionTitle}>
                {MOCK_COMPARISON.friendName}との共通空き時間
              </Text>
              <View style={styles.countChip}>
                <Text style={styles.countChipText}>{MOCK_COMPARISON.commonPeriods.length}コマ</Text>
              </View>
            </View>
            <Text style={styles.sectionSubtitle}>この時間に一緒に集まれるよ！</Text>

            {MOCK_COMPARISON.commonPeriods.map((item, i) => (
              <View key={i} style={styles.commonPeriodCard}>
                <View style={styles.commonDayBadge}>
                  <Text style={styles.commonDayText}>{item.day}</Text>
                </View>
                <View style={styles.commonInfo}>
                  <Text style={styles.commonPeriodLabel}>{item.period}限</Text>
                  <Text style={styles.commonPeriodTime}>{item.time}</Text>
                </View>
                <Text style={styles.matchEmoji}>✓</Text>
              </View>
            ))}

            {MOCK_COMPARISON.commonPeriods.length === 0 && (
              <View style={styles.noMatch}>
                <Text style={styles.noMatchEmoji}>😢</Text>
                <Text style={styles.noMatchText}>共通の空き時間が見つかりませんでした</Text>
              </View>
            )}
          </View>
        )}

        {/* 공강 없을 때 안내 */}
        {!showResult && (
          <View style={styles.emptyGuide}>
            <Text style={styles.emptyGuideEmoji}>📅</Text>
            <Text style={styles.emptyGuideText}>友達のIDを入力して{'\n'}空き時間を比べてみよう</Text>
          </View>
        )}

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

  scrollContent: {
    padding: 16,
    gap: 12,
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
  matchEmoji: {
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
