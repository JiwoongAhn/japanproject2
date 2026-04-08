import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../constants/colors';

// 홈 화면 — 추후 구현 (Phase 5)
// 오늘 수업 + 임박 과제 + 최근 공지 요약
export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>ホーム</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 18,
    color: colors.textSecondary,
  },
});
