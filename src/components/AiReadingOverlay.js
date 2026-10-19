// AI 시간표 읽는 중 화면 (약 10초) — 멈춘 것처럼 보이지 않게 전체를 덮고 안내한다
import React from 'react';
import { Modal, View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { colors } from '../constants/colors';
import { spacing, radius } from '../constants/spacing';
import { typography } from '../constants/typography';

export default function AiReadingOverlay({ visible }) {
  return (
    <Modal visible={!!visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.dim}>
        <View style={styles.box} accessibilityLiveRegion="polite">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.title}>時間割を読み取っています</Text>
          <Text style={styles.sub}>10秒ほどかかります{'\n'}この画面のままお待ちください</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  dim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: spacing.xxl },
  box: { backgroundColor: colors.surface, borderRadius: radius.xl, paddingVertical: spacing.xxl, paddingHorizontal: spacing.xxl, alignItems: 'center', gap: spacing.md, minWidth: 240 },
  title: { ...typography.subtitle, color: colors.textPrimary },
  sub: { ...typography.caption, color: colors.textSecondary, textAlign: 'center' },
});
