// 게시글 좋아요·댓글 수 표시 (목록·홈·내 글·저장한 글 공통)
// 2026-10-21 사용자: 아이콘이 너무 작다 / 좋아요=빨강 하트, 댓글=다른 색 → 청록 말풍선
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { spacing } from '../constants/spacing';
import { typography } from '../constants/typography';

export default function PostReactions({ likeCount = 0, commentCount = 0, hideZero = false, size = 17, style }) {
  const showLike = !hideZero || likeCount > 0;
  const showComment = !hideZero || commentCount > 0;
  if (!showLike && !showComment) return null;
  return (
    <View style={[styles.row, style]}>
      {showLike && (
        <View style={styles.item} accessibilityLabel={`いいね ${likeCount}`}>
          <Ionicons name="heart" size={size} color={colors.like} />
          <Text style={[styles.count, { color: colors.like }]}>{likeCount}</Text>
        </View>
      )}
      {showComment && (
        <View style={styles.item} accessibilityLabel={`コメント ${commentCount}`}>
          <Ionicons name="chatbubble" size={size - 1} color={colors.comment} />
          <Text style={[styles.count, { color: colors.comment }]}>{commentCount}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  item: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  count: { ...typography.captionStrong },
});
