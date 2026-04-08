import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { colors } from '../../constants/colors';

// 앱 시작 시 세션 확인 중에 표시되는 로딩 화면 (순수 UI)
// 세션 라우팅은 AppNavigator가 전담 — 여기서 navigation 로직 없음
export default function SplashScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.logo}>ユニパス</Text>
      <Text style={styles.subtitle}>Unipas</Text>
      <ActivityIndicator
        size="large"
        color={colors.primary}
        style={styles.loader}
      />
    </View>
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
    fontSize: 36,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 8,
    marginBottom: 40,
  },
  loader: {
    marginTop: 20,
  },
});
