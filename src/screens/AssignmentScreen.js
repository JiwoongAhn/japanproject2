import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { colors } from '../constants/colors';

// ── 상태별 디자인 설정 ─────────────────────────────────────────────────────
// 각 상태에 맞는 배지 색상, 텍스트를 한 곳에서 관리해요.
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

// ── D-day 계산 함수 ──────────────────────────────────────────────────────────
// dueDateStr: 'YYYY-MM-DD' 형식의 마감일
// 반환값: { label: 'D-3', color: ..., isUrgent: true/false }
function calcDday(dueDateStr) {
  const today = new Date();
  // 시간 부분 제거 — 날짜만 비교해요
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDateStr);
  due.setHours(0, 0, 0, 0);
  const diff = Math.round((due - today) / (1000 * 60 * 60 * 24));

  if (diff < 0)  return { label: `D+${Math.abs(diff)}`, color: colors.danger,  isUrgent: true };
  if (diff === 0) return { label: 'D-Day',               color: colors.danger,  isUrgent: true };
  if (diff <= 3)  return { label: `D-${diff}`,           color: colors.warning, isUrgent: true };
  return           { label: `D-${diff}`,                 color: colors.textSecondary, isUrgent: false };
}

// ── 목업 데이터 (가짜 데이터) ──────────────────────────────────────────
// 실제 Supabase 연결 전에 화면을 확인하기 위한 임시 데이터예요.
// status: 'pending'(미제출) | 'submitted'(완료) | 'overdue'(기한초과)
// ← 빈 상태 테스트: [] 로 바꾸면 빈 화면이 나와요
const MOCK_ASSIGNMENTS = [
  {
    id: '1',
    courseName: '経営学概論',
    title: '第3章 レポート提出',
    dueDate: '2026-04-15',
    status: 'pending',
  },
  {
    id: '2',
    courseName: '情報処理',
    title: 'Pythonプログラム課題①',
    dueDate: '2026-04-13',
    status: 'pending',
  },
  {
    id: '3',
    courseName: '英語コミュニケーション',
    title: 'スピーチ原稿の提出',
    dueDate: '2026-04-10',
    status: 'submitted',
  },
  {
    id: '4',
    courseName: '数学基礎',
    title: '演習問題プリント',
    dueDate: '2026-04-08',
    status: 'overdue',
  },
  {
    id: '5',
    courseName: '心理学入門',
    title: '授業感想文（400字以上）',
    dueDate: '2026-04-18',
    status: 'pending',
  },
  {
    id: '6',
    courseName: '統計学',
    title: '小テスト振り返りシート',
    dueDate: '2026-04-05',
    status: 'overdue',
  },
  {
    id: '7',
    courseName: '日本語表現',
    title: 'ビジネスメール作成課題',
    dueDate: '2026-04-12',
    status: 'submitted',
  },
  {
    id: '8',
    courseName: '法学概論',
    title: '判例レポート（800字）',
    dueDate: '2026-04-20',
    status: 'pending',
  },
];
// ───────────────────────────────────────────────────────────────────────

export default function AssignmentScreen({ navigation }) {
  const isEmpty = MOCK_ASSIGNMENTS.length === 0;

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

      {/* ── 빈 상태: 과제가 없을 때 ── */}
      {isEmpty ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>📝</Text>
          <Text style={styles.emptyTitle}>課題がありません</Text>
          <Text style={styles.emptySubtitle}>右上の「＋ 追加」から{'\n'}課題を登録してみよう</Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => navigation.navigate('AssignmentAdd')}
          >
            <Text style={styles.emptyButtonText}>＋ 課題を追加する</Text>
          </TouchableOpacity>
        </View>
      ) : (
      /* ── 과제 목록 ── */
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContent}>
        {MOCK_ASSIGNMENTS.map((assignment) => {
          const statusCfg = STATUS_CONFIG[assignment.status] ?? STATUS_CONFIG.pending;
          const dday = calcDday(assignment.dueDate);
          // 기한 초과 과제는 카드 왼쪽에 빨간 테두리 표시
          const isOverdue = assignment.status === 'overdue';
          return (
            <TouchableOpacity
              key={assignment.id}
              style={[styles.card, isOverdue && styles.cardOverdue]}
              activeOpacity={0.75}
            >
              {/* 카드 상단: 수업명 + 상태 배지 */}
              <View style={styles.cardHeader}>
                <Text style={styles.courseName}>{assignment.courseName}</Text>
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
                <Text style={styles.dueDate}>📅 {assignment.dueDate}</Text>
                <Text style={[styles.ddayLabel, { color: dday.color }]}>
                  {dday.label}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
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
    fontSize: 20,
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
    // 기본 그림자 (iOS)
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    // 기본 그림자 (Android)
    elevation: 1,
  },
  // 기한 초과 카드 — 왼쪽 빨간 테두리
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

  // 상태 배지 (예: 未提出 / 提出済 / 期限超過)
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
