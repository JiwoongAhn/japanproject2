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
import { colors } from '../constants/colors';
import { supabase } from '../lib/supabase';
import { calcDday } from '../utils/assignment';

// ── 상태별 디자인 설정 ─────────────────────────────────────────────────────
const STATUS_CONFIG = {
  pending: {
    label: '未提出',
    bg: '#FFF3E0',
    text: colors.warning,
  },
  submitted: {
    label: '提出済',
    bg: '#E8F8F0',
    text: colors.success,
  },
  overdue: {
    label: '期限超過',
    bg: '#FDE8E8',
    text: colors.danger,
  },
};

// DB 상태(pending/submitted/overdue)와 마감일을 비교해 실제 표시 상태를 계산
// → pending인데 마감일이 지났으면 overdue로 표시
function getDisplayStatus(assignment) {
  if (assignment.status === 'submitted') return 'submitted';
  if (assignment.status === 'overdue') return 'overdue';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(assignment.due_date);
  if (due < today) return 'overdue';
  return 'pending';
}

// 필터 탭 설정
const FILTER_TABS = [
  { key: 'all',      label: '全体' },
  { key: 'pending',  label: '未提出' },
  { key: 'submitted', label: '提出済' },
  { key: 'overdue',  label: '期限超過' },
];

// 필터 탭별 빈 상태 메시지
const EMPTY_STATE = {
  all:       { emoji: '📝', title: '課題がありません',          subtitle: '右上の「＋ 追加」から\n課題を登録してみよう', showButton: true },
  pending:   { emoji: '🎉', title: '未提出の課題はありません',   subtitle: '全部提出済みです！お疲れ様！', showButton: false },
  submitted: { emoji: '📋', title: 'まだ提出した課題がありません', subtitle: 'タップで「提出済」に切り替えられます', showButton: false },
  overdue:   { emoji: '✅', title: '期限超過の課題はありません',  subtitle: '全て期限内で提出できています！', showButton: false },
};

export default function AssignmentScreen({ navigation }) {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('all');

  // Supabase에서 과제 목록 불러오기
  const fetchAssignments = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('assignments')
        .select('*, courses(name)')
        .order('due_date');

      if (error) throw error;
      setAssignments(data ?? []);
    } catch {
      Alert.alert('エラー', '課題の読み込みに失敗しました');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAssignments();
    // AssignmentAdd에서 돌아올 때마다 목록 새로고침
    const unsubscribe = navigation.addListener('focus', fetchAssignments);
    return unsubscribe;
  }, [navigation, fetchAssignments]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAssignments();
  }, [fetchAssignments]);

  // 카드 탭 → 제출 상태 토글 (미제출/기한초과 → 제출완료, 제출완료 → 미제출)
  const handleToggleStatus = async (assignment) => {
    const currentDisplay = getDisplayStatus(assignment);
    const newStatus = currentDisplay === 'submitted' ? 'pending' : 'submitted';

    // 즉시 UI 반영 (낙관적 업데이트)
    setAssignments(prev =>
      prev.map(a => a.id === assignment.id ? { ...a, status: newStatus } : a)
    );

    const { error } = await supabase
      .from('assignments')
      .update({ status: newStatus })
      .eq('id', assignment.id);

    if (error) {
      // 실패 시 원래 상태로 복구
      setAssignments(prev =>
        prev.map(a => a.id === assignment.id ? { ...a, status: assignment.status } : a)
      );
      Alert.alert('エラー', '状態の更新に失敗しました');
    }
  };

  // 카드 길게 누르기 → 삭제 확인 Alert
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
            // 즉시 UI에서 제거
            setAssignments(prev => prev.filter(a => a.id !== assignment.id));
            const { error } = await supabase
              .from('assignments')
              .delete()
              .eq('id', assignment.id);
            if (error) {
              // 실패 시 목록 다시 불러오기
              fetchAssignments();
              Alert.alert('エラー', '削除に失敗しました');
            }
          },
        },
      ]
    );
  };

  // 선택된 필터로 과제 목록 필터링
  const filteredAssignments = selectedFilter === 'all'
    ? assignments
    : assignments.filter(a => getDisplayStatus(a) === selectedFilter);

  const isEmpty = !loading && filteredAssignments.length === 0;
  const emptyInfo = EMPTY_STATE[selectedFilter] ?? EMPTY_STATE.all;

  return (
    <SafeAreaView style={styles.container}>

      {/* ── 상단 헤더 ── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>課題</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate('AssignmentAdd')}
        >
          <Text style={styles.addButtonText}>＋ 追加</Text>
        </TouchableOpacity>
      </View>

      {/* ── 필터 탭 ── */}
      <View style={styles.filterTabBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterTabScroll}>
          {FILTER_TABS.map(tab => (
            <TouchableOpacity
              key={tab.key}
              style={styles.filterTab}
              onPress={() => setSelectedFilter(tab.key)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.filterTabText,
                selectedFilter === tab.key && { color: colors.primary, fontWeight: '700' },
              ]}>
                {tab.label}
              </Text>
              {selectedFilter === tab.key && <View style={styles.filterTabIndicator} />}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ── 로딩 중 ── */}
      {loading ? (
        <ActivityIndicator style={{ flex: 1 }} size="large" color={colors.primary} />
      ) : isEmpty ? (
        /* ── 빈 상태: 필터별 다른 메시지 ── */
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>{emptyInfo.emoji}</Text>
          <Text style={styles.emptyTitle}>{emptyInfo.title}</Text>
          <Text style={styles.emptySubtitle}>{emptyInfo.subtitle}</Text>
          {emptyInfo.showButton && (
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => navigation.navigate('AssignmentAdd')}
            >
              <Text style={styles.emptyButtonText}>＋ 課題を追加する</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        /* ── 과제 목록 ── */
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
        >
          {/* 탭으로 제출 상태 전환, 길게 누르면 삭제 안내 */}
          <Text style={styles.hint}>タップで状態切替 / 長押しで削除</Text>

          {filteredAssignments.map((assignment) => {
            const displayStatus = getDisplayStatus(assignment);
            const statusCfg = STATUS_CONFIG[displayStatus] ?? STATUS_CONFIG.pending;
            const dday = calcDday(assignment.due_date);
            const courseName = assignment.courses?.name || '未登録';
            const isOverdue = displayStatus === 'overdue';

            return (
              <TouchableOpacity
                key={assignment.id}
                style={[styles.card, isOverdue && styles.cardOverdue]}
                activeOpacity={0.75}
                onPress={() => handleToggleStatus(assignment)}
                onLongPress={() => handleDeleteAssignment(assignment)}
                delayLongPress={500}
              >
                {/* 카드 상단: 수업명 + 상태 배지 */}
                <View style={styles.cardHeader}>
                  <Text style={styles.courseName}>{courseName}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg }]}>
                    <Text style={[styles.statusText, { color: statusCfg.text }]}>
                      {statusCfg.label}
                    </Text>
                  </View>
                </View>

                {/* 과제 제목 */}
                <Text style={styles.title} numberOfLines={2}>{assignment.title}</Text>

                {/* 카드 하단: 마감일 + D-day */}
                <View style={styles.cardFooter}>
                  <Text style={styles.dueDate}>📅 {assignment.due_date}</Text>
                  <Text style={[styles.ddayLabel, { color: dday.color }]}>
                    {dday.label}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}

          <View style={{ height: 32 }} />
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  addButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },

  // 필터 탭
  filterTabBar: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterTabScroll: {
    paddingHorizontal: 4,
  },
  filterTab: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    position: 'relative',
    alignItems: 'center',
  },
  filterTabText: {
    fontSize: 16,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  filterTabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 8,
    right: 8,
    height: 2,
    backgroundColor: colors.primary,
    borderRadius: 1,
  },

  // 빈 상태 화면
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 60,
  },
  emptyEmoji: {
    fontSize: 56,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  emptyButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 13,
    borderRadius: 24,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  // 안내 힌트
  hint: {
    fontSize: 11,
    color: colors.textDisabled,
    textAlign: 'center',
    marginBottom: 12,
    marginTop: 4,
  },

  // 목록 컨테이너
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 32,
  },

  // 과제 카드
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  cardOverdue: {
    borderLeftWidth: 3,
    borderLeftColor: colors.danger,
  },

  // 카드 상단 행: 수업명 + 상태 배지
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  courseName: {
    fontSize: 12,
    color: colors.textSecondary,
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },

  // 과제 제목
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 10,
    lineHeight: 21,
  },

  // 카드 하단 행: 마감일 + D-day
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dueDate: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  ddayLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
});
