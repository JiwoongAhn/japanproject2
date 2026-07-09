import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  SafeAreaView, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { colors } from '../../constants/colors';
import LoadingDots from '../../components/LoadingDots';
import { spacing, radius, shadow } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { getCategoryInfo } from '../../constants/boardCategories';
import { formatTimeAgo } from '../../utils/community';
import { getMyBookmarkedPosts, removeBookmark } from '../../utils/bookmarks';

// 관심글 저장(북마크)한 게시판 글 목록 화면 — 마이페이지에서 진입
export default function SavedPostsScreen({ navigation }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchSaved = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const data = await getMyBookmarkedPosts(user.id);
    setPosts(data);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => { fetchSaved(); }, [fetchSaved])
  );

  const handlePress = (post) => {
    navigation.navigate('Community', {
      screen: 'PostDetail',
      params: { postId: post.id },
    });
  };

  // 저장 해제 (길게 누르기)
  const handleRemove = (post) => {
    Alert.alert(
      '保存を解除',
      `「${post.title}」を保存済みから外しますか？`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '解除する',
          style: 'destructive',
          onPress: async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const ok = await removeBookmark(post.id, user.id);
            if (ok) {
              setPosts(prev => prev.filter(p => p.id !== post.id));
            } else {
              Alert.alert('お知らせ', '解除できませんでした。もう一度お試しください');
            }
          },
        },
      ]
    );
  };

  const renderPost = ({ item: post }) => {
    const cat = getCategoryInfo(post.category);
    const commentCount = post.post_comments?.[0]?.count ?? 0;
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => handlePress(post)}
        onLongPress={() => handleRemove(post)}
        activeOpacity={0.85}
        delayLongPress={500}
      >
        <View style={styles.cardTop}>
          <View style={[styles.catBadge, { backgroundColor: cat.color + '18' }]}>
            <Text style={[styles.catText, { color: cat.color }]}>{cat.label}</Text>
          </View>
          <Text style={styles.cardTime}>{formatTimeAgo(post.created_at)}</Text>
        </View>

        <Text style={styles.cardTitle} numberOfLines={2}>{post.title}</Text>
        {post.body ? (
          <Text style={styles.cardBody} numberOfLines={2}>{post.body}</Text>
        ) : null}

        <View style={styles.cardBottom}>
          <View style={styles.metaRow}>
            {(post.like_count ?? 0) > 0 && (
              <View style={styles.metaItem}>
                <Text style={styles.metaIcon}>♡</Text>
                <Text style={styles.metaText}>{post.like_count}</Text>
              </View>
            )}
            {commentCount > 0 && (
              <View style={styles.metaItem}>
                <Text style={styles.metaIcon}>💬</Text>
                <Text style={styles.metaText}>{commentCount}</Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            style={styles.removeBtn}
            onPress={() => handleRemove(post)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.removeBtnText}>保存解除</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* ── 헤더 ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>保存した投稿</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <LoadingDots fullscreen />
      ) : posts.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🔖</Text>
          <Text style={styles.emptyText}>保存した投稿はまだありません</Text>
          <Text style={styles.emptySubText}>気になる投稿を保存すると、ここでいつでも見返せます</Text>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={item => item.id}
          renderItem={renderPost}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.background,
  },
  backButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 28, color: colors.textPrimary, lineHeight: 32 },
  headerTitle: { ...typography.subtitle, color: colors.textPrimary },

  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxxl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    ...shadow.card,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  catBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  catText: { ...typography.small, fontWeight: '700' },
  cardTime: { ...typography.caption, color: colors.textDisabled },
  cardTitle: {
    ...typography.subtitle,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  cardBody: {
    ...typography.body2,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metaRow: { flexDirection: 'row', gap: spacing.md },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  metaIcon: { fontSize: 13, color: colors.textSecondary },
  metaText: { ...typography.caption, color: colors.textSecondary },
  removeBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.gray100,
    marginLeft: 'auto',
  },
  removeBtnText: { ...typography.captionStrong, color: colors.textSecondary },

  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
  },
  emptyEmoji: { fontSize: 48, marginBottom: spacing.lg },
  emptyText: {
    ...typography.subtitle,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  emptySubText: {
    ...typography.body2,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
