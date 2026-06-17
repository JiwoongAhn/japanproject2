import React from 'react';
import { Text, StyleSheet, SafeAreaView } from 'react-native';
import { colors } from '../../constants/colors';
import { spacing } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import LoadingDots from '../../components/LoadingDots';

// 앱 시작 시 세션 확인 중에 표시되는 로딩 화면 (순수 UI)
// 세션 라우팅은 AppNavigator가 전담 — 여기서 navigation 로직 없음
export default function SplashScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.logo}>ユニワン</Text>
      <Text style={styles.subtitle}>UniOne</Text>
      <LoadingDots size={14} style={styles.loader} />
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
});
