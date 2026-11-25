// 「ホームの表示」 — 홈에 무엇을 보여줄지 켜고 끄기 (홈 맨 아래·マイページ에서 연다)
import React from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity } from 'react-native';
import BottomSheet from './BottomSheet';
import Button from './Button';
import { colors } from '../constants/colors';
import { spacing, radius, shadow } from '../constants/spacing';
import { typography } from '../constants/typography';
import { useHomeDisplay } from '../hooks/useHomeDisplay';

const MODES = [
  { key: 'today', label: '今日' },
  { key: 'week', label: '1週間' },
  { key: 'off', label: '表示しない' },
];

// usesManaba: manaba 를 쓰지 않는 학교에는 「manabaのお知らせ」 줄을 숨긴다
export default function HomeDisplaySheet({ visible, onClose, usesManaba = true }) {
  const [display, setDisplay] = useHomeDisplay();
  const rows = [
    { key: 'shortcuts', label: '講義評価・掲示板のボタン' },
    usesManaba && { key: 'notices', label: 'manabaのお知らせ' },
    { key: 'board', label: '掲示板の新着' },
    { key: 'school', label: '学校情報' },
  ].filter(Boolean);

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text style={styles.title}>ホームの表示</Text>
      <Text style={styles.hint}>表示するものを選べます</Text>
      <Text style={styles.label}>時間割</Text>
      <View style={styles.segment}>
        {MODES.map((m) => {
          const on = display.timetable === m.key;
          return (
            <TouchableOpacity
              key={m.key}
              style={[styles.segmentItem, on && styles.segmentOn]}
              onPress={() => setDisplay({ timetable: m.key })}
              activeOpacity={0.8}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={`時間割 ${m.label}`}
            >
              <Text style={[styles.segmentText, on && styles.segmentTextOn]} numberOfLines={1}>{m.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {rows.map((r) => {
        const value = display[r.key];
        return (
          <View key={r.key} style={styles.row}>
            <Text style={[styles.label, styles.rowLabel]}>{r.label}</Text>
            <Switch
              value={value}
              onValueChange={(on) => setDisplay({ [r.key]: on })}
              trackColor={{ false: colors.gray300, true: colors.primary }}
              thumbColor={colors.white}
              accessibilityLabel={r.label}
            />
          </View>
        );
      })}
      <Button title="完了" onPress={onClose} style={styles.done} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title3, color: colors.textPrimary },
  hint: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.lg },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.md, gap: spacing.md,
    borderTopWidth: 1, borderTopColor: colors.gray100,
  },
  label: { ...typography.body1, color: colors.textPrimary },
  rowLabel: { flex: 1 },
  segment: {
    flexDirection: 'row', backgroundColor: colors.gray100, borderRadius: radius.md,
    padding: spacing.xs, marginTop: spacing.sm, marginBottom: spacing.md,
  },
  segmentItem: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 40, borderRadius: radius.sm },
  segmentOn: { backgroundColor: colors.surface, ...shadow.card, shadowOpacity: 0.1 },
  segmentText: { ...typography.captionStrong, color: colors.textSecondary },
  segmentTextOn: { color: colors.textPrimary },
  done: { marginTop: spacing.lg },
});
