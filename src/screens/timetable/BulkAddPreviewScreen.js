import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
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

function getDayPastel(day) {
  return DAY_PASTEL[day] ?? 'rose';
}

function getDayLabel(day) {
  return DAY_LABEL[day] ?? '?';
}

export default function BulkAddPreviewScreen({ navigation, route }) {
  const parseResult = route?.params?.parseResult ?? { parsed: [], unparsed: [] };
  const items = parseResult.parsed ?? [];

  // 기본 선택: confidence='high'인 항목 모두 체크
  const initialSelected = useMemo(() => {
    const set = new Set();
    items.forEach((item, idx) => {
      if (item.confidence === 'high') set.add(idx);
    });
    return set;
  }, [items]);

  const [selected, setSelected] = useState(initialSelected);
  const [saving, setSaving] = useState(false);

  const toggle = (idx) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const selectedCount = selected.size;

  const handleLowConfidenceTap = () => {
    Alert.alert('お知らせ', '後で対応します');
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
        Alert.alert('お知らせ', '追加できる授業がありませんでした\n（すでに登録済み、または情報が不足しています）');
        setSaving(false);
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
          const dayPastelKey = item.day != null ? getDayPastel(item.day) : 'rose';
          const dayBg = pastel[dayPastelKey]?.bg ?? colors.gray100;
          const dayAccent = pastel[dayPastelKey]?.accent ?? colors.textSecondary;

          const cardInner = (
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

              {/* 본문 */}
              <View style={styles.body}>
                {/* 요일·교시 배지 라인 */}
                <View style={styles.badgeRow}>
                  {item.day != null && item.period != null ? (
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

                  {isLow ? (
                    <Text style={styles.lowHint}>⚠ タップで修正</Text>
                  ) : null}
                </View>

                {/* 과목명 */}
                <Text style={styles.courseName} numberOfLines={2}>
                  {item.name}
                </Text>

                {/* 교수명 + 학점 */}
                {(item.professor || item.credit) ? (
                  <View style={styles.metaRow}>
                    {item.professor ? (
                      <Text style={styles.metaText}>{item.professor}</Text>
                    ) : null}
                    {item.credit ? (
                      <Text style={styles.metaCredit}>[{item.credit}]</Text>
                    ) : null}
                  </View>
                ) : null}
              </View>
            </View>
          );

          if (isLow) {
            return (
              <TouchableOpacity
                key={idx}
                onPress={handleLowConfidenceTap}
                activeOpacity={0.8}
                style={{ marginBottom: spacing.sm }}
              >
                <Card pastel="rose" padding="lg">
                  {cardInner}
                </Card>
              </TouchableOpacity>
            );
          }

          return (
            <View key={idx} style={{ marginBottom: spacing.sm }}>
              <Card padding="lg">{cardInner}</Card>
            </View>
          );
        })}

        {items.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>📭</Text>
            <Text style={styles.emptyText}>解析できる授業がありませんでした</Text>
          </View>
        ) : null}
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
  lowHint: {
    ...typography.micro,
    color: pastel.rose.accent,
    marginLeft: 'auto',
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
  metaCredit: {
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
});
