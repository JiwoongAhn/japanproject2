import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { colors, pastel } from '../constants/colors';
import { spacing, radius, shadow } from '../constants/spacing';
import { typography } from '../constants/typography';
import Card from '../components/Card';
import { supabase } from '../lib/supabase';
import { calcDday } from '../utils/assignment';

// 상태별 디자인 — pastel 토큰으로 부드럽게
const STATUS_CONFIG = {
  pending:   { label: '未提出',   bg: pastel.peach.bg,    text: pastel.peach.accent },
  submitted: { label: '提出済',   bg: pastel.mint.bg,     text: pastel.mint.accent },
  overdue:   { label: '期限超過', bg: pastel.rose.bg,     text: pastel.rose.accent },
};

// DB 상태와 마감일을 비교해 실제 표시 상태를 계산
function getDisplayStatus(assignment) {
  if (assignment.status === 'submitted') return 'submitted';
  if (assignment.status === 'overdue') return 'overdue';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(assignment.due_date);
  if (due < today) return 'overdue';
  return 'pending';
}

const FILTER_TABS = [
  { key: 'all',       label: '全体' },
  { key: 'pending',   label: '未提出' },
  { key: 'submitted', label: '提出済' },
  { key: 'overdue',   label: '期限超過' },
];

// 필터별 빈 상태 — 부드러운 실패 톤
const EMPTY_STATE = {
  all:       { emoji: '📝', title: 'まだ課題がないみたい',         subtitle: '右上の「＋ 追加」から\n登録してみよう',           showButton: true },
  pending:   { emoji: '🎉', title: '未提出の課題はありません',     subtitle: '全部提出済みです！お疲れ様！',                    showButton: false },
  submitted: { emoji: '📋', title: 'まだ提出した課題がありません', subtitle: 'タップで「提出済」に切り替えられます',            showButton: false },
  overdue:   { emoji: '✅', title: '期限超過の課題はありません',   subtitle: '全て期限内で提出できています！',                  showButton: false },
};

export default function AssignmentScreen({ navigation }) {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('all');

  const fetchAssignments = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('assignments')
        .select('*, courses(name)')
        .order('due_date');

      if (error) throw error;
      setAssignments(data ?? []);
    } catch {
      Alert.alert('お知らせ', '課題を読み込めませんでした');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAssignments();
    const unsubscribe = navigation.addListener('focus', fetchAssignments);
    return unsubscribe;
  }, [navigation, fetchAssignments]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAssignments();
  }, [fetchAssignments]);

  // 카드 탭 → 제출 상태 토글
  const handleToggleStatus = async (assignment) => {
    const currentDisplay = getDisplayStatus(assignment);
    const newStatus = currentDisplay === 'submitted' ? 'pending' : 'submitted';

    setAssignments(prev =>
      prev.map(a => a.id === assignment.id ? { ...a, status: newStatus } : a)
    );

    const { error } = await supabase
      .from('assignments')
      .update({ status: newStatus })
      .eq('id', assignment.id);

    if (error) {
      setAssignments(prev =>
        prev.map(a => a.id === assignment.id ? { ...a, status: assignment.status } : a)
      );
      Alert.alert('お知らせ', '状態を更新できませんでした');
    }
  };

  const handleDeleteAssignment = (assignment) => {
    Alert.alert(
      '課題を削除',
      `「${assignment.title}」を削除しますか？`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除する',
          style: 'destructive',
          onPress: async () => {
            setAssignments(prev => prev.filter(a => a.id !== assignment.id));
            const { error } = await supabase
              .from('assignments')
              .delete()
              .eq('id', assignment.id);
            if (error) {
              fetchAssignments();
              Alert.alert('お知らせ', '削除できませんでした');
            }
          },
        },
      ]
    );
  };

  const filteredAssignments = selectedFilter === 'all'
    ? assignments
    : assignments.filter(a => getDisplayStatus(a) === selectedFilter);

  const isEmpty = !loading && filteredAssignments.length === 0;
  const emptyInfo = EMPTY_STATE[selectedFilter] ?? EMPTY_STATE.all;

  return (
    <SafeAreaView style={styles.container}>

      {/* 상단 헤더 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>課題</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate('AssignmentAdd')}
          activeOpacity={0.85}
        >
          <Text style={styles.addButtonText}>＋ 追加</Text>
        </TouchableOpacity>
      </View>

      {/* 필터 칩 */}
      <View style={styles.filterBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {FILTER_TABS.map(tab => {
            const active = selectedFilter === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setSelectedFilter(tab.key)}
                activeOpacity={0.75}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <ActivityIndicator style={{ flex: 1 }} size="large" color={colors.primary} />
      ) : isEmpty ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>{emptyInfo.emoji}</Text>
          <Text style={styles.emptyTitle}>{emptyInfo.title}</Text>
          <Text style={styles.emptySubtitle}>{emptyInfo.subtitle}</Text>
          {emptyInfo.showButton && (
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => navigation.navigate('AssignmentAdd')}
              activeOpacity={0.85}
            >
              <Text style={styles.emptyButtonText}>＋ 課題を追加する</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
        >
          <Text style={styles.hint}>タップで状態切替 / ···で削除</Text>

          {filteredAssignments.map((assignment) => {
            const displayStatus = getDisplayStatus(assignment);
            const statusCfg = STATUS_CONFIG[displayStatus] ?? STATUS_CONFIG.pending;
            const dday = calcDday(assignment.due_date);
            const courseName = assignment.courses?.name || '未登録';

            return (
              <TouchableOpacity
                key={assignment.id}
                activeOpacity={0.85}
                onPress={() => handleToggleStatus(assignment)}
                style={styles.cardWrap}
              >
                <Card padding="lg" radius="lg">
                  {/* 상단: 수업명 + 상태 배지 + ···버튼 */}
                  <View style={styles.cardHeader}>
                    <Text style={styles.courseName} numberOfLines={1}>{courseName}</Text>
                    <View style={styles.cardHeaderRight}>
                      <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg }]}>
                        <Text style={[styles.statusText, { color: statusCfg.text }]}>
                          {statusCfg.label}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.moreButton}
                        onPress={() => handleDeleteAssignment(assignment)}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                      >
                        <Text style={styles.moreButtonText}>···</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <Text style={styles.title} numberOfLines={2}>{assignment.title}</Text>

                  {/* 하단: 마감일 + D-day */}
                  <View style={styles.cardFooter}>
                    <Text style={styles.dueDate}>📅 {assignment.due_date}</Text>
                    <Text style={[styles.ddayLabel, { color: dday.color }]}>
                      {dday.label}
                    </Text>
                  </View>
                </Card>
              </TouchableOpacity>
            );
          })}

          <View style={{ height: spacing.xxxl }} />
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

  // 헤더 — 토스 큰 제목
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.background,
  },
  headerTitle: {
    ...typography.title2,
    color: colors.textPrimary,
  },
  addButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  addButtonText: {
    color: colors.white,
    ...typography.captionStrong,
  },

  // 필터 칩 바
  filterBar: {
    backgroundColor: colors.background,
    paddingBottom: spacing.sm,
  },
  filterScroll: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    marginRight: spacing.sm,
  },
  chipActive: {
    backgroundColor: colors.primary,
  },
  chipText: {
    ...typography.bodyStrong,
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.white,
  },

  // 빈 상태
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: 60,
  },
  emptyEmoji: {
    fontSize: 56,
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    ...typography.title3,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptySubtitle: {
    ...typography.body2,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xxxl,
  },
  emptyButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
  },
  emptyButtonText: {
    color: colors.white,
    ...typography.bodyStrong,
  },

  // 안내 힌트
  hint: {
    ...typography.micro,
    color: colors.textDisabled,
    textAlign: 'center',
    marginBottom: spacing.md,
  },

  // 목록
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: 84,
  },
  cardWrap: {
    marginBottom: spacing.md,
  },

  // 카드 내부
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  courseName: {
    ...typography.caption,
    color: colors.textSecondary,
    flex: 1,
    marginRight: spacing.sm,
  },
  statusBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  statusText: {
    ...typography.captionStrong,
  },
  moreButton: {
    paddingHorizontal: spacing.xs,
  },
  moreButtonText: {
    fontSize: 18,
    color: colors.textSecondary,
    fontWeight: '600',
    letterSpacing: 1,
  },

  title: {
    ...typography.subtitle,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },

  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dueDate: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  ddayLabel: {
    ...typography.captionStrong,
  },
});
