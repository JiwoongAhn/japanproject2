// 홈 「今週の時間割」 — 월~금 표에 과목과 교실까지. 누르면 時間割 화면으로 (2026-11-25 목업 「가」)
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors } from '../constants/colors';
import { spacing, radius } from '../constants/spacing';
import { typography } from '../constants/typography';
import { getCourseColorFor } from '../constants/courseColors';
import { getPeriodStartTimeStr, lastPeriodOf } from '../utils/timetable';

const DAYS = ['月', '火', '水', '木', '金'];

// todayCol: 0=月 … 4=金, 주말은 -1
export default function WeekTimetable({ courses, todayCol, university, onPress }) {
  if (courses.length === 0) return <Text style={styles.empty}>まだ授業が登録されていません</Text>;
  const periods = Array.from({ length: lastPeriodOf(courses) }, (_, i) => i + 1);
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} accessibilityRole="button" accessibilityLabel="時間割を見る">
      <View style={styles.row}>
        <View style={styles.periodCol} />
        {DAYS.map((d, i) => (
          <View key={d} style={[styles.day, i === todayCol && styles.dayToday]}>
            <Text style={[styles.dayText, i === todayCol && styles.dayTextToday]}>{d}</Text>
          </View>
        ))}
      </View>
      {periods.map((p) => (
        <View key={p} style={styles.row}>
          <View style={styles.periodCol}>
            <Text style={styles.period}>{p}</Text>
            <Text style={styles.time} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              {getPeriodStartTimeStr(p, university)}
            </Text>
          </View>
          {DAYS.map((d, i) => {
            const c = courses.find((x) => x.day_of_week === i && x.period === p);
            const color = c ? getCourseColorFor(c) : null;
            return (
              <View key={d} style={[styles.cell, i === todayCol && styles.cellToday, color && { backgroundColor: color.bg }]}>
                {c ? (
                  <>
                    <Text style={[styles.name, { color: color.text }]} numberOfLines={2}>{c.name}</Text>
                    {c.room ? <Text style={[styles.room, { color: color.text }]} numberOfLines={1}>{c.room}</Text> : null}
                  </>
                ) : null}
              </View>
            );
          })}
        </View>
      ))}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  empty: { ...typography.body2, color: colors.textSecondary, paddingHorizontal: spacing.sm, paddingBottom: spacing.sm },
  row: { flexDirection: 'row', gap: 3, marginBottom: 3 },
  periodCol: { width: 30, alignItems: 'center', justifyContent: 'center' },
  day: { flex: 1, alignItems: 'center', paddingVertical: spacing.xs, borderRadius: radius.sm },
  dayToday: { backgroundColor: colors.primary },
  dayText: { ...typography.small, color: colors.textSecondary },
  dayTextToday: { color: colors.white, fontWeight: '700' },
  period: { ...typography.small, fontWeight: '600', color: colors.textSecondary },
  time: { fontSize: 10, lineHeight: 13, color: colors.textSecondary },
  // 글자를 크게 쓰는 사람도 교실이 잘리지 않게 높이는 최소값만 정한다
  cell: { flex: 1, minHeight: 62, borderRadius: radius.sm, backgroundColor: colors.gray50, paddingHorizontal: spacing.xs, paddingVertical: 5 },
  cellToday: { backgroundColor: colors.primaryLight + '80' },
  name: { fontSize: 11, lineHeight: 14, fontWeight: '600' },
  room: { fontSize: 10, lineHeight: 13, fontWeight: '500', marginTop: 2 },
});
