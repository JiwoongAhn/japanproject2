// 홈 「今日の時間割」 — 오늘 수업을 시간순으로. 끝난 수업은 흐리게, 지금·다음 수업을 표시한다
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors } from '../constants/colors';
import { spacing, radius } from '../constants/spacing';
import { typography } from '../constants/typography';
import { getCourseColorFor } from '../constants/courseColors';
import { getCourseStatus, getPeriodStartTimeStr } from '../utils/timetable';

const BADGE = {
  進行中: { label: '授業中', bg: colors.successSoft, text: '#087A4B' },
  次の授業: { label: '次', bg: colors.primaryLight, text: colors.primary },
};

export default function TodayClasses({ courses, nowMin, university, emptyText, onPress }) {
  if (courses.length === 0) return <Text style={styles.empty}>{emptyText}</Text>;
  return courses.map((c, i) => {
    const status = getCourseStatus(c.period, nowMin, courses, university);
    const badge = BADGE[status];
    return (
      <TouchableOpacity
        key={c.id}
        style={[styles.row, i > 0 && styles.rowBorder, i === courses.length - 1 && styles.rowLast, status === '終了' && styles.done]}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <Text style={styles.time}>{getPeriodStartTimeStr(c.period, university)}</Text>
        <View style={[styles.bar, { backgroundColor: getCourseColorFor(c).accent }]} />
        <View style={styles.texts}>
          <Text style={styles.name} numberOfLines={1}>{c.name}</Text>
          <Text style={styles.sub} numberOfLines={1}>{c.period}限{c.room ? `　${c.room}` : ''}</Text>
        </View>
        {badge ? (
          <View style={[styles.badge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.badgeText, { color: badge.text }]}>{badge.label}</Text>
          </View>
        ) : null}
      </TouchableOpacity>
    );
  });
}

const styles = StyleSheet.create({
  empty: { ...typography.body2, color: colors.textSecondary },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.gray100 },
  rowLast: { paddingBottom: 0 },
  done: { opacity: 0.5 },
  time: { ...typography.caption, color: colors.textSecondary, width: 42, fontVariant: ['tabular-nums'] },
  bar: { width: 4, height: 36, borderRadius: 2 },
  texts: { flex: 1 },
  name: { ...typography.bodyStrong, color: colors.textPrimary },
  sub: { ...typography.caption, color: colors.textSecondary },
  badge: { borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  badgeText: { ...typography.small, fontWeight: '700' },
});
