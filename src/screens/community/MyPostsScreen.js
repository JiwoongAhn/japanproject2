import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  SafeAreaView, Alert, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { colors } from '../../constants/colors';
import { spacing, radius, shadow } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { getCategoryInfo } from '../../constants/boardCategories';
import { formatTimeAgo } from '../../utils/community';

// 내 게시글 전체 목록 화면
// 탭 → 상세 이동 / 길게 누르기 → 삭제
export default function MyPostsScreen({ navigation }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchMyPosts = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data } = await supabase
      .from('posts')
      .select('id, title, category, created_at, like_count, post_comments(count), body')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    setPosts(data ?? []);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => { fetchMyPosts(); }, [fetchMyPosts])
  );

  const handleDelete = (post) => {
    Alert.alert(
      '投稿を削除',
      `「${post.title}」を削除しますか？\nこの操作は取り消せません。`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除する',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.from('posts').delete().eq('id', post.id);
            if (error) {
              Alert.alert('お知らせ', '削除できませんでした。もう一度お試しください');
            } else {
              setPosts(prev => prev.filter(p => p.id !== post.id));
            }
          },
        },
      ]
    );
  };

  const handleEdit = (post) => {
    navigation.navigate('PostEdit', {
      postId: post.id,
      title: post.title,
      body: post.body ?? '',
    });
  };

  const handlePress = (post) => {
    navigation.navigate('Community', {
      screen: 'PostDetail',
      params: { postId: post.id },
    });
  };

  const renderItem = ({ item: post }) => {
    const cat = getCategoryInfo(post.category);
    const commentCount = post.post_comments?.[0]?.count ?? 0;

    return (
      <TouchableOpacity
        style={styles.postCard}
        onPress={() => handlePress(post)}
        onLongPress={() => handleDelete(post)}
        activeOpacity={0.85}
        delayLongPress={500}
      >
        <View style={styles.cardTop}>
          <View style={[styles.catBadge, { backgroundColor: cat.color + '18' }]}>
            <Text style={[styles.catText, { color: cat.color }]}>{cat.label}</Text>
          </View>
          <Text style={styles.postTime}>{formatTimeAgo(post.created_at)}</Text>
        </View>

        <Text style={styles.postTitle} numberOfLines={2}>{post.title}</Text>

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

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => handleEdit(post)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 4 }}
            >
              <Text style={styles.editBtnText}>編集</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={() => handleDelete(post)}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
            >
              <Text style={styles.deleteBtnText}>削除</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>投稿した掲示物</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <ActivityIndicator style={{ flex: 1 }} size="large" color={colors.primary} />
      ) : posts.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>📝</Text>
          <Text style={styles.emptyText}>まだ投稿した記事がないみたい</Text>
          <Text style={styles.emptySubText}>掲示板で最初の投稿を書いてみよう</Text>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={p => p.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  // ── 헤더 ────────────────────────────────────
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

  // ── 목록 ────────────────────────────────────
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xxxl,
  },
  postCard: {
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
  postTime: { ...typography.caption, color: colors.textDisabled },
  postTitle: {
    ...typography.subtitle,
    color: colors.textPrimary,
    marginBottom: spacing.md,
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

  actions: { flexDirection: 'row', gap: spacing.sm, marginLeft: 'auto' },
  editBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryLight,
  },
  editBtnText: { ...typography.captionStrong, color: colors.primary },
  deleteBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.dangerSoft,
  },
  deleteBtnText: { ...typography.captionStrong, color: colors.danger },

  // ── 빈 상태 ────────────────────────────────
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
  },
  emptySubText: {
    ...typography.body2,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
