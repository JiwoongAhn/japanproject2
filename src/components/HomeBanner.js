// 홈 상단 배너 공용 모양 — 흰 카드 + 진짜 버튼 (설정 미완료·업데이트가 같은 모양, 2026-11-25)
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import LoadingDots from './LoadingDots';
import { colors } from '../constants/colors';
import { typography } from '../constants/typography';
import { spacing, radius, shadow } from '../constants/spacing';

/**
 * @param {Function} onAction   버튼을 눌렀을 때
 * @param {Function} onDismiss  있으면 오른쪽 위에 × 표시
 * @param {boolean}  loading    버튼 안에 로딩 점 표시
 */
export default function HomeBanner({ icon, iconColor, title, text, action, onAction, onDismiss, loading = false }) {
  return (
    <View style={styles.banner}>
      <Ionicons name={icon} size={22} color={iconColor} style={styles.icon} />
      <View style={styles.body}>
        <Text style={[styles.title, onDismiss && styles.titleWithClose]}>{title}</Text>
        <Text style={styles.text}>{text}</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={onAction}
          disabled={loading}
          activeOpacity={0.85}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          accessibilityRole="button"
          accessibilityLabel={action}
        >
          {loading ? <LoadingDots size={6} color={colors.white} /> : <Text style={styles.buttonText}>{action}</Text>}
        </TouchableOpacity>
      </View>

      {onDismiss ? (
        <TouchableOpacity
          style={styles.close}
          onPress={onDismiss}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="閉じる"
        >
          <Ionicons name="close" size={18} color={colors.gray400} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginHorizontal: spacing.lg, // 홈의 다른 카드와 같은 좌우 여백
    marginBottom: spacing.md,
    ...shadow.card,
  },
  icon: { marginRight: spacing.sm, marginTop: 1 },
  body: { flex: 1, alignItems: 'flex-start' },
  title: { ...typography.body1, fontWeight: '700', color: colors.textPrimary, marginBottom: 2 },
  titleWithClose: { paddingRight: spacing.xl },
  text: { ...typography.caption, color: colors.gray600 },
  button: {
    minWidth: 96,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginTop: spacing.md,
  },
  buttonText: { ...typography.bodyStrong, fontWeight: '700', color: colors.white },
  close: { position: 'absolute', top: spacing.md, right: spacing.md },
});
