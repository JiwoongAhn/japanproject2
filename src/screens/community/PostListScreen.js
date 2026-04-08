import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../constants/colors';

// 커뮤니티 게시판 화면 — 추후 구현 (Phase 5)
export default function PostListScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>掲示板</Text>
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
