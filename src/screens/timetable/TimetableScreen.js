import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../constants/colors';

// 시간표 화면 — 추후 구현 (Phase 2)
export default function TimetableScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>時間割</Text>
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
