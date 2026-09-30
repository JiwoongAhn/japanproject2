import React from 'react';
import { Text, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';
import { colors } from '../../constants/colors';
import { spacing } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import LoadingDots from '../../components/LoadingDots';

// 앱 시작 시 세션 확인 중에 표시되는 로딩 화면 (순수 UI)
// 세션 라우팅은 AppNavigator가 전담 — 여기서 navigation 로직 없음
//
// onRetry가 넘어오면 "접속 실패 + 재시도" 상태로 바뀐다.
// 네트워크가 느려 세션 확인이 실패했을 때, 로그아웃시키는 대신 이 화면을 보여준다.
export default function SplashScreen({ onRetry }) {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.logo}>ユニワン</Text>
      <Text style={styles.subtitle}>UniOne</Text>
      {onRetry ? (
        <>
          <Text style={styles.errorText}>
            接続できませんでした。{'\n'}通信環境をご確認ください。
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={onRetry} activeOpacity={0.8}>
            <Text style={styles.retryButtonText}>再試行</Text>
          </TouchableOpacity>
        </>
      ) : (
        <LoadingDots size={14} style={styles.loader} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    ...typography.title1,
    fontSize: 36,
    letterSpacing: -1,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.body1,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    marginBottom: spacing.huge,
  },
  loader: {
    marginTop: spacing.xl,
  },
  errorText: {
    ...typography.body2,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: spacing.md,
  },
  retryButton: {
    marginTop: spacing.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.huge,
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  retryButtonText: {
    ...typography.body1,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
