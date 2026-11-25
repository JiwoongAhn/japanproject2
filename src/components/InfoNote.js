// 안내문 — 누를 수 없는 설명. 색 배경을 쓰지 않는다 (색 상자는 버튼만, 2026-11-25 결정)
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { spacing } from '../constants/spacing';
import { typography } from '../constants/typography';

export default function InfoNote({ children, style }) {
  return (
    <View style={[styles.row, style]}>
      <Ionicons name="information-circle-outline" size={18} color={colors.gray500} />
      <Text style={styles.text}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  text: { ...typography.caption, color: colors.gray700, flex: 1 },
});
