import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { typography } from '../constants/typography';
import { spacing, radius } from '../constants/spacing';

/**
 * OTA 업데이트가 있을 때 홈 상단에 뜨는 배너.
 * 「今すぐ更新」을 누르면 앱 안에서 새 번들을 받아 재시작한다 — 스토어에 가지 않는다.
 *
 * 경고 배너(마나바 미완료)와 구분되도록 파란 계열을 쓴다. 이건 나쁜 소식이 아니다.
 */
export default function UpdateBanner({ onUpdate, onDismiss, applying, error }) {
  return (
    <View style={styles.banner}>
      <View style={styles.icon}>
        <Ionicons name="sparkles" size={20} color={colors.primary} />
      </View>

      <View style={styles.body}>
        <Text style={styles.title}>アップデートがあります</Text>
        <Text style={styles.text}>
          {error
            ? '更新に失敗しました。通信環境を確認してもう一度お試しください。'
            : '新しい機能と修正が利用できます。'}
        </Text>
      </View>

      {applying ? (
        <View style={styles.button}>
          <ActivityIndicator size="small" color="#FFFFFF" />
        </View>
      ) : (
        <TouchableOpacity
          style={styles.button}
          onPress={onUpdate}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="今すぐ更新"
        >
          <Text style={styles.buttonText}>{error ? '再試行' : '今すぐ更新'}</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={styles.close}
        onPress={onDismiss}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityRole="button"
        accessibilityLabel="閉じる"
      >
        <Ionicons name="close" size={16} color={colors.textDisabled} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: radius.lg,
    padding: spacing.md,
    paddingRight: spacing.xl,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  icon: {
    marginRight: spacing.sm,
  },
  body: {
    flex: 1,
    marginRight: spacing.sm,
  },
  title: {
    ...typography.body1,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  text: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  button: {
    minWidth: 84,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  buttonText: {
    ...typography.caption,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  close: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
  },
});
