import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

import { colors, pastel } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import Card from '../../components/Card';
import { supabase } from '../../lib/supabase';
import { buildCourseRows } from '../../utils/timetable';

// 요일별 파스텔 매핑 — 한 화면에서 5±2색 이내 유지
const DAY_PASTEL = ['mint', 'peach', 'sky', 'lavender', 'yellow', 'pink'];
const DAY_LABEL = ['月', '火', '水', '木', '金', '土'];
// 편집 모달의 요일 선택지 — courses는 月~金(0~4)만 허용
const EDIT_DAYS = [0, 1, 2, 3, 4];
const EDIT_PERIODS = [1, 2, 3, 4, 5, 6, 7, 8];

function getDayPastel(day) {
  return DAY_PASTEL[day] ?? 'rose';
}

function getDayLabel(day) {
  return DAY_LABEL[day] ?? '?';
}

export default function BulkAddPreviewScreen({ navigation, route }) {
  const parseResult = route?.params?.parseResult ?? { parsed: [], unparsed: [] };
  const defaultTerm = route?.params?.defaultTerm ?? 'spring';

  // 미리보기 항목 — 편집/추가가 가능하도록 state로 관리
  const [items, setItems] = useState(() => parseResult.parsed ?? []);
  // 기본 선택: confidence='high'(요일·교시 확실)인 항목 모두 체크
  const [selected, setSelected] = useState(() => {
    const set = new Set();
    (parseResult.parsed ?? []).forEach((item, idx) => {
      if (item.confidence === 'high') set.add(idx);
    });
    return set;
  });
  const [saving, setSaving] = useState(false);
  // 편집 모달 상태 — null이면 닫힘. index===-1이면 신규 추가
  const [editing, setEditing] = useState(null);

  const toggle = (idx) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const selectedCount = selected.size;

  // ── 편집/추가 ──────────────────────────────
  const openEdit = (idx) => {
    const it = items[idx];
    setEditing({ index: idx, name: it.name ?? '', day: it.day ?? null, period: it.period ?? null });
  };

  const openAdd = () => {
    setEditing({ index: -1, name: '', day: null, period: null });
  };

  const closeEdit = () => setEditing(null);

  const saveEdit = () => {
    const name = (editing.name ?? '').trim();
    if (!name) {
      Alert.alert('お知らせ', '科目名を入力してください');
      return;
    }
    const { index, day, period } = editing;
    // 요일·교시가 모두 채워지면 신뢰도 high(자동 체크 대상)
    const confidence = (day != null && period != null) ? 'high' : 'low';

    if (index === -1) {
      // 신규 추가 — 새 항목은 자동으로 체크
      const newIdx = items.length;
      setItems((prev) => [...prev, { name, day, period, term: defaultTerm, professor: null, confidence }]);
      setSelected((prev) => new Set(prev).add(newIdx));
    } else {
      // 기존 항목 수정 — 교수/학기 등 기존 값 보존
      setItems((prev) => prev.map((it, i) => (i === index ? { ...it, name, day, period, confidence } : it)));
      if (confidence === 'high') setSelected((prev) => new Set(prev).add(index));
    }
    setEditing(null);
  };

  const handleConfirm = async () => {
    if (selectedCount === 0 || saving) return;
    setSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('お知らせ', 'ログインが必要です');
        setSaving(false);
        return;
      }

      // 체크된 항목만 추출
      const selectedItems = items.filter((_, idx) => selected.has(idx));

      // 기존 시간표를 불러와 중복 칸(같은 요일+교시) 검사에 사용
      const { data: existing, error: fetchError } = await supabase
        .from('courses')
        .select('day_of_week, period')
        .eq('user_id', user.id);

      if (fetchError) {
        Alert.alert('お知らせ', '時間割の確認に失敗しました。もう一度お試しください');
        setSaving(false);
        return;
      }

      // 파서 항목 → DB 행으로 변환 (불가·중복 항목은 skipped로 분리)
      const { rows, skipped } = buildCourseRows(selectedItems, user.id, existing || []);

      if (rows.length === 0) {
        setSaving(false);
        // 추가할 새 수업이 없음(이미 전부 등록됨/정보 부족) → 막다른 OK 대신
        // "원래 화면으로 돌아가시겠습니까?" 확인 → 시간표 첫 화면으로 복귀
        Alert.alert(
          '追加できる授業がありません',
          'すべての授業がすでに時間割に登録されています。\n元の画面に戻りますか?',
          [
            { text: 'キャンセル', style: 'cancel' },
            { text: '元の画面に戻る', onPress: () => navigation.popToTop() },
          ]
        );
        return;
      }

      const { error: insertError } = await supabase.from('courses').insert(rows);

      if (insertError) {
        Alert.alert('お知らせ', '授業をうまく保存できませんでした。もう一度お試しください');
        setSaving(false);
        return;
      }

      // 성공 — 건너뛴 항목이 있으면 함께 안내한 뒤 시간표로 복귀
      const message = skipped.length > 0
        ? `${rows.length}件を追加しました\n（${skipped.length}件は重複・情報不足のためスキップ）`
        : `${rows.length}件を追加しました`;

      Alert.alert('完了', message, [
        // popToTop: 입력·미리보기 화면을 모두 닫고 시간표 첫 화면으로 한 번에 복귀
        { text: 'OK', onPress: () => navigation.popToTop() },
      ]);
    } catch (e) {
      Alert.alert('お知らせ', '予期せぬエラーが発生しました。もう一度お試しください');
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* ── 헤더 ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Text style={styles.headerBack}>← 戻る</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>確認 ({selectedCount}件)</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {items.map((item, idx) => {
          const isLow = item.confidence === 'low';
          const isSelected = selected.has(idx);
          const hasSlot = item.day != null && item.period != null;
          const dayPastelKey = item.day != null ? getDayPastel(item.day) : 'rose';
          const dayBg = pastel[dayPastelKey]?.bg ?? colors.gray100;
          const dayAccent = pastel[dayPastelKey]?.accent ?? colors.textSecondary;

          return (
            <View key={idx} style={{ marginBottom: spacing.sm }}>
              <Card pastel={isLow ? 'rose' : undefined} padding="lg">
                <View style={styles.row}>
                  {/* 체크박스 */}
                  <TouchableOpacity
                    onPress={() => toggle(idx)}
                    activeOpacity={0.7}
                    style={styles.checkboxTouch}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <View style={[styles.checkbox, isSelected && styles.checkboxOn]}>
                      {isSelected ? <Text style={styles.checkboxMark}>✓</Text> : null}
                    </View>
                  </TouchableOpacity>

                  {/* 본문 — 탭하면 편집 */}
                  <TouchableOpacity
                    style={styles.body}
                    activeOpacity={0.7}
                    onPress={() => openEdit(idx)}
                  >
                    {/* 요일·교시 배지 라인 */}
                    <View style={styles.badgeRow}>
                      {hasSlot ? (
                        <>
                          <View style={[styles.dayBadge, { backgroundColor: dayBg }]}>
                            <Text style={[styles.dayBadgeText, { color: dayAccent }]}>
                              {getDayLabel(item.day)}
                            </Text>
                          </View>
                          <Text style={styles.periodLabel}>{item.period}限目</Text>
                        </>
                      ) : (
                        <View style={[styles.dayBadge, { backgroundColor: colors.gray100 }]}>
                          <Text style={[styles.dayBadgeText, { color: colors.textSecondary }]}>
                            未割当
                          </Text>
                        </View>
                      )}

                      <Text style={[styles.editHint, isLow && styles.editHintWarn]}>
                        {isLow ? '⚠ タップで修正' : '✎ 編集'}
                      </Text>
                    </View>

                    {/* 과목명 */}
                    <Text style={styles.courseName} numberOfLines={2}>
                      {item.name}
                    </Text>

                    {/* 교수명 */}
                    {item.professor ? (
                      <View style={styles.metaRow}>
                        <Text style={styles.metaText}>{item.professor}</Text>
                      </View>
                    ) : null}
                  </TouchableOpacity>
                </View>
              </Card>
            </View>
          );
        })}

        {items.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>📭</Text>
            <Text style={styles.emptyText}>解析できる授業がありませんでした</Text>
          </View>
        ) : null}

        {/* 수동 추가 */}
        <TouchableOpacity style={styles.addManualBtn} onPress={openAdd} activeOpacity={0.8}>
          <Text style={styles.addManualText}>＋ 手動で追加</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ── 하단 fixed ── */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          onPress={handleConfirm}
          activeOpacity={0.85}
          disabled={selectedCount === 0 || saving}
          style={[
            styles.primaryButton,
            (selectedCount === 0 || saving) && styles.primaryButtonDisabled,
          ]}
        >
          <Text style={styles.primaryButtonText}>
            {saving ? '追加中...' : `${selectedCount}件を時間割に追加する`}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── 편집/추가 모달 ── */}
      <Modal
        visible={editing !== null}
        transparent
        animationType="slide"
        onRequestClose={closeEdit}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {editing?.index === -1 ? '授業を追加' : '授業を編集'}
            </Text>

            <Text style={styles.modalLabel}>科目名</Text>
            <TextInput
              style={styles.modalInput}
              value={editing?.name ?? ''}
              onChangeText={(t) => setEditing((e) => ({ ...e, name: t }))}
              placeholder="例: 経営学概論"
              placeholderTextColor={colors.textDisabled}
              maxLength={30}
            />

            <Text style={styles.modalLabel}>曜日</Text>
            <View style={styles.chipWrap}>
              {EDIT_DAYS.map((d) => {
                const active = editing?.day === d;
                return (
                  <TouchableOpacity
                    key={d}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setEditing((e) => ({ ...e, day: d }))}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {DAY_LABEL[d]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.modalLabel}>時限</Text>
            <View style={styles.chipWrap}>
              {EDIT_PERIODS.map((p) => {
                const active = editing?.period === p;
                return (
                  <TouchableOpacity
                    key={p}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setEditing((e) => ({ ...e, period: p }))}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {p}限
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={closeEdit} activeOpacity={0.8}>
                <Text style={styles.modalCancelText}>キャンセル</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={saveEdit} activeOpacity={0.85}>
                <Text style={styles.modalSaveText}>保存</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>
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
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  headerBack: {
    ...typography.body2,
    color: colors.textSecondary,
    minWidth: 64,
  },
  headerTitle: {
    ...typography.subtitle,
    color: colors.textPrimary,
  },
  headerRight: {
    minWidth: 64,
  },

  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },

  // 행 레이아웃
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkboxTouch: {
    paddingRight: spacing.md,
    paddingTop: 2,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.gray300,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxMark: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 16,
  },

  body: {
    flex: 1,
  },

  // 배지 라인
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  dayBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  dayBadgeText: {
    ...typography.captionStrong,
  },
  periodLabel: {
    ...typography.captionStrong,
    color: colors.textSecondary,
  },
  editHint: {
    ...typography.micro,
    color: colors.textDisabled,
    marginLeft: 'auto',
  },
  editHintWarn: {
    color: pastel.rose.accent,
  },

  // 과목명·메타
  courseName: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  metaText: {
    ...typography.caption,
    color: colors.textSecondary,
  },

  // 빈 상태
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.huge,
  },
  emptyEmoji: {
    fontSize: 40,
    marginBottom: spacing.md,
  },
  emptyText: {
    ...typography.body2,
    color: colors.textSecondary,
  },

  // 수동 추가 버튼
  addManualBtn: {
    marginTop: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  addManualText: {
    ...typography.bodyStrong,
    color: colors.primary,
  },

  // 하단 바
  bottomBar: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.gray100,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    backgroundColor: colors.gray300,
  },
  primaryButtonText: {
    ...typography.subtitle,
    color: colors.white,
  },

  // ── 편집 모달 ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.xl,
    paddingBottom: spacing.huge,
  },
  modalTitle: {
    ...typography.subtitle,
    color: colors.textPrimary,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  modalLabel: {
    ...typography.captionStrong,
    color: colors.textSecondary,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  modalInput: {
    ...typography.body1,
    color: colors.textPrimary,
    backgroundColor: colors.gray50,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.gray50,
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
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.gray100,
    alignItems: 'center',
  },
  modalCancelText: {
    ...typography.bodyStrong,
    color: colors.textSecondary,
  },
  modalSaveBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  modalSaveText: {
    ...typography.bodyStrong,
    color: colors.white,
  },
});
