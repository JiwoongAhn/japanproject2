// AI 시간표 읽기 — 처음 한 번만 보여주는 안내·동의 (해외(미국) AI 로 보낸다는 사실 고지)
// 동의 기록은 기기에만 저장한다 (utils/aiTimetable AI_CONSENT_KEY)
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import BottomSheet from './BottomSheet';
import { colors } from '../constants/colors';
import { spacing, radius } from '../constants/spacing';
import { typography } from '../constants/typography';

const POINTS = [
  '読み取るのは、画面に表示された時間割の内容だけです',
  'ID・パスワードはUniOneに保存されません。ログインは大学のサイトで直接行います',
  '読み取った内容は保存前に必ず確認・修正できます',
];

export default function AiConsentModal({ visible, onAgree, onCancel }) {
  return (
    // 실수로 닫히지 않게 바깥을 눌러도 닫지 않는다
    <BottomSheet visible={!!visible} onClose={onCancel} dismissOnBackdrop={false} scrollable>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.body} bounces={false}>
            <Text style={styles.emoji}>🤖</Text>
            <Text style={styles.title}>AIで時間割を読み取ります</Text>
            {POINTS.map((p) => (
              <View key={p} style={styles.point}>
                <Text style={styles.check}>✓</Text>
                <Text style={styles.pointText}>{p}</Text>
              </View>
            ))}
            <Text style={styles.fine}>
              読み取りのため、画面の内容をAI（Anthropic社・米国）に送信します。送信した内容はUniOneのサーバーには保存されず、AIの学習にも使われません。詳しくはプライバシーポリシーをご覧ください。
            </Text>
          </ScrollView>
          <TouchableOpacity style={styles.cta} onPress={onAgree} activeOpacity={0.85} accessibilityRole="button">
            <Text style={styles.ctaText}>同意して始める</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ghost} onPress={onCancel} activeOpacity={0.7} accessibilityRole="button">
            <Text style={styles.ghostText}>あとで</Text>
          </TouchableOpacity>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0, flexShrink: 1 },
  body: { gap: spacing.md, paddingBottom: spacing.lg },
  emoji: { fontSize: 36 },
  title: { ...typography.title3, color: colors.textPrimary, marginBottom: spacing.xs },
  point: { flexDirection: 'row', gap: spacing.sm, backgroundColor: colors.gray50, borderRadius: radius.md, padding: spacing.md },
  check: { ...typography.bodyStrong, color: colors.success },
  pointText: { ...typography.body2, color: colors.textPrimary, flex: 1 },
  fine: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
  cta: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.lg, alignItems: 'center' },
  ctaText: { ...typography.bodyStrong, color: colors.white },
  ghost: { alignItems: 'center', paddingVertical: spacing.md },
  ghostText: { ...typography.body2, color: colors.textSecondary },
});
