import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../constants/colors';

// 과제 화면 — 추후 구현 (Phase 3)
export default function AssignmentScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>課題</Text>
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
