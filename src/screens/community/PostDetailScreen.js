import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { colors } from '../../constants/colors';
import { getCategoryInfo } from '../../constants/boardCategories';
import { supabase } from '../../lib/supabase';

// 시간 경과 표시
function formatTimeAgo(timestamp) {
  const now = new Date();
  const past = new Date(timestamp);
  const diffMs = now - past;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'たった今';
  if (diffMins < 60) return `${diffMins}分前`;
  if (diffHours < 24) return `${diffHours}時間前`;
  return `${diffDays}日前`;
}

export default function PostDetailScreen({ navigation, route }) {
  const { postId } = route.params;

  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [liking, setLiking] = useState(false);
  const scrollViewRef = useRef(null);

  // 게시글 + 댓글 한 번에 불러오기
  const fetchData = useCallback(async () => {
    const [postRes, commentsRes] = await Promise.all([
      supabase.from('posts').select('*').eq('id', postId).single(),
      supabase
        .from('post_comments')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: true }),
    ]);

    if (postRes.data) setPost(postRes.data);
    if (commentsRes.data) setComments(commentsRes.data);
    setLoading(false);
  }, [postId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 좋아요 토글
  const handleLike = async () => {
    if (liking || !post) return;
    setLiking(true);

    const newCount = (post.like_count || 0) + 1;
    const { error } = await supabase
      .from('posts')
      .update({ like_count: newCount })
      .eq('id', postId);

    if (!error) {
      setPost(prev => ({ ...prev, like_count: newCount }));
    }
    setLiking(false);
  };

  // 댓글 작성
  const handleSubmitComment = async () => {
    if (!commentText.trim() || submitting) return;
    setSubmitting(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      Alert.alert('エラー', 'ログインが必要です');
      setSubmitting(false);
      return;
    }

    const { data, error } = await supabase
      .from('post_comments')
      .insert({
        post_id: postId,
        user_id: user.id,
        body: commentText.trim(),
        is_anonymous: isAnonymous,
      })
      .select()
      .single();

    if (error) {
      Alert.alert('エラー', 'コメントの投稿に失敗しました');
    } else {
      setComments(prev => [...prev, data]);
      setCommentText('');
      // 댓글 작성 후 스크롤 아래로
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator style={{ flex: 1 }} size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (!post) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>‹</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>投稿が見つかりません</Text>
        </View>
      </SafeAreaView>
    );
  }

  const catInfo = getCategoryInfo(post.category);

  return (
    <SafeAreaView style={styles.container}>

      {/* ── 헤더 ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>投稿</Text>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollViewRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >

          {/* ── 게시글 본문 ── */}
          <View style={styles.postCard}>
            {/* 카테고리 + 시간 */}
            <View style={styles.postMeta}>
              <View style={[styles.catBadge, { backgroundColor: catInfo.color + '18' }]}>
                <Text style={[styles.catBadgeText, { color: catInfo.color }]}>{catInfo.label}</Text>
              </View>
              <Text style={styles.postAnon}>
                {post.is_anonymous ? '匿名' : '実名'}
              </Text>
              <Text style={styles.postTime}>{formatTimeAgo(post.created_at)}</Text>
            </View>

            {/* 제목 */}
            <Text style={styles.postTitle}>{post.title}</Text>

            {/* 본문 */}
            {post.body ? (
              <Text style={styles.postBody}>{post.body}</Text>
            ) : null}

            {/* 좋아요 */}
            <View style={styles.postFooter}>
              <TouchableOpacity style={styles.likeButton} onPress={handleLike} activeOpacity={0.7}>
                <Text style={styles.likeIcon}>♡</Text>
                <Text style={styles.likeCount}>{post.like_count || 0}</Text>
              </TouchableOpacity>
              <View style={styles.commentCountArea}>
                <Text style={styles.commentCountIcon}>□</Text>
                <Text style={styles.commentCountText}>{comments.length}</Text>
              </View>
            </View>
          </View>

          {/* ── 댓글 목록 ── */}
          <View style={styles.commentsSection}>
            <Text style={styles.commentsLabel}>
              コメント {comments.length > 0 ? `${comments.length}件` : ''}
            </Text>

            {comments.length === 0 ? (
              <View style={styles.emptyComments}>
                <Text style={styles.emptyCommentsText}>まだコメントがありません</Text>
                <Text style={styles.emptyCommentsSubText}>最初のコメントを書いてみよう！</Text>
              </View>
            ) : (
              comments.map((comment, index) => (
                <View
                  key={comment.id}
                  style={[styles.commentItem, index === 0 && styles.commentItemFirst]}
                >
                  <View style={styles.commentHeader}>
                    <Text style={styles.commentAuthor}>
                      {comment.is_anonymous ? `匿名${index + 1}` : '実名'}
                    </Text>
                    <Text style={styles.commentTime}>{formatTimeAgo(comment.created_at)}</Text>
                  </View>
                  <Text style={styles.commentBody}>{comment.body}</Text>
                </View>
              ))
            )}
          </View>

          <View style={{ height: 24 }} />
        </ScrollView>

        {/* ── 댓글 입력창 ── */}
        <View style={styles.commentInputArea}>
          {/* 익명 토글 */}
          <TouchableOpacity
            style={styles.anonToggle}
            onPress={() => setIsAnonymous(!isAnonymous)}
            activeOpacity={0.7}
          >
            <View style={[styles.toggleDot, isAnonymous && styles.toggleDotOn]} />
            <Text style={[styles.anonLabel, isAnonymous && styles.anonLabelOn]}>匿名</Text>
          </TouchableOpacity>

          <TextInput
            style={styles.commentInput}
            placeholder="コメントを入力..."
            placeholderTextColor={colors.textDisabled}
            value={commentText}
            onChangeText={setCommentText}
            maxLength={200}
            multiline
          />
          <TouchableOpacity
            style={[styles.sendButton, !commentText.trim() && styles.sendButtonDisabled]}
            onPress={handleSubmitComment}
            disabled={!commentText.trim() || submitting}
          >
            {submitting
              ? <ActivityIndicator size="small" color="#FFFFFF" />
              : <Text style={styles.sendButtonText}>送信</Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // 헤더
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
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: 28,
    color: colors.textPrimary,
    lineHeight: 32,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  scrollContent: {
    padding: 16,
  },

  // 게시글 카드
  postCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  postMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  catBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  catBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  postAnon: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  postTime: {
    fontSize: 12,
    color: colors.textDisabled,
    marginLeft: 'auto',
  },
  postTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    lineHeight: 26,
    marginBottom: 10,
  },
  postBody: {
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 22,
    marginBottom: 16,
  },
  postFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  likeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  likeIcon: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  likeCount: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  commentCountArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  commentCountIcon: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  commentCountText: {
    fontSize: 13,
    color: colors.textSecondary,
  },

  // 댓글 섹션
  commentsSection: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
  },
  commentsLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 12,
  },
  emptyComments: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyCommentsText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  emptyCommentsSubText: {
    fontSize: 12,
    color: colors.textDisabled,
  },
  commentItem: {
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  commentItemFirst: {
    borderTopWidth: 0,
    paddingTop: 0,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  commentAuthor: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  commentTime: {
    fontSize: 11,
    color: colors.textDisabled,
  },
  commentBody: {
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 20,
  },

  // 댓글 입력창
  commentInputArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  anonToggle: {
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 4,
  },
  toggleDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: 'transparent',
  },
  toggleDotOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  anonLabel: {
    fontSize: 9,
    color: colors.textDisabled,
  },
  anonLabelOn: {
    color: colors.primary,
    fontWeight: '600',
  },
  commentInput: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
    backgroundColor: colors.background,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
    maxHeight: 80,
  },
  sendButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    minWidth: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: colors.textDisabled,
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  // 빈 상태 (게시글 없을 때)
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: colors.textSecondary,
  },
});
