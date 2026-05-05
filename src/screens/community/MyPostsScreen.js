import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  SafeAreaView, Alert, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { colors } from '../../constants/colors';
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

  // 화면 포커스 시 새로고침 (삭제/수정 후 돌아왔을 때 반영)
  // async 함수는 Promise를 반환하므로 useFocusEffect에 직접 넘기면 안 됨
  useFocusEffect(
    useCallback(() => { fetchMyPosts(); }, [fetchMyPosts])
  );

  // 게시글 삭제
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
              Alert.alert('エラー', '削除に失敗しました');
            } else {
              setPosts(prev => prev.filter(p => p.id !== post.id));
            }
          },
        },
      ]
    );
  };

  // 게시글 수정 (PostEdit 화면으로 이동)
  const handleEdit = (post) => {
    navigation.navigate('PostEdit', {
      postId: post.id,
      title: post.title,
      body: post.body ?? '',
    });
  };

  // 탭 → PostDetail 이동
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
        style={styles.postRow}
        onPress={() => handlePress(post)}
        onLongPress={() => handleDelete(post)}
        activeOpacity={0.75}
        delayLongPress={500}
      >
        {/* 카테고리 배지 */}
        <View style={[styles.catBadge, { backgroundColor: cat.color + '22' }]}>
          <Text style={[styles.catText, { color: cat.color }]}>{cat.label}</Text>
        </View>

        {/* 제목 + 메타 */}
        <View style={styles.postContent}>
          <Text style={styles.postTitle} numberOfLines={1}>{post.title}</Text>
          <Text style={styles.postMeta}>
            {formatTimeAgo(post.created_at)}
            {(post.like_count ?? 0) > 0 && `  ♡ ${post.like_count}`}
            {commentCount > 0 && `  💬 ${commentCount}`}
          </Text>
        </View>

        {/* 수정/삭제 버튼 */}
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
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 헤더 */}
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
          <Text style={styles.emptyText}>まだ投稿した記事がありません</Text>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={p => p.id}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
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
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 28, color: colors.textPrimary, lineHeight: 32 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },

  listContent: { paddingVertical: 8 },
  separator: { height: 1, backgroundColor: colors.border, marginLeft: 16 },

  postRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 10,
  },
  catBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    minWidth: 36,
    alignItems: 'center',
  },
  catText: { fontSize: 11, fontWeight: '700' },
  postContent: { flex: 1 },
  postTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 3,
  },
  postMeta: { fontSize: 11, color: colors.textDisabled },

  actions: { flexDirection: 'row', gap: 6 },
  editBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 7,
    backgroundColor: colors.primaryLight,
  },
  editBtnText: { fontSize: 12, fontWeight: '600', color: colors.primary },
  deleteBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 7,
    backgroundColor: '#FEE2E2',
  },
  deleteBtnText: { fontSize: 12, fontWeight: '600', color: colors.danger },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyEmoji: { fontSize: 40 },
  emptyText: { fontSize: 15, color: colors.textDisabled },
});
