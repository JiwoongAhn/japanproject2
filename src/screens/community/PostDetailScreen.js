import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  Modal,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Dimensions,
} from 'react-native';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;
import { colors } from '../../constants/colors';
import { spacing, radius, shadow } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { getCategoryInfo } from '../../constants/boardCategories';
import { supabase } from '../../lib/supabase';
import { deleteImagesFromStorage } from '../../utils/imageUpload';

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
  const [liked, setLiked] = useState(false); // 내가 좋아요 눌렀는지
  const [currentUserId, setCurrentUserId] = useState(null);
  const [likedComments, setLikedComments] = useState({}); // { commentId: true/false }
  const [likingComment, setLikingComment] = useState(null); // 현재 좋아요 처리 중인 댓글 ID
  const [viewerIndex, setViewerIndex] = useState(null); // 풀스크린 이미지 인덱스 (null이면 닫힘)
  const scrollViewRef = useRef(null);

  // 게시글 + 댓글 + 내 좋아요 여부 한 번에 불러오기
  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setCurrentUserId(user.id);

    const [postRes, commentsRes, likeRes, commentLikesRes] = await Promise.all([
      supabase.from('posts').select('*').eq('id', postId).single(),
      supabase
        .from('post_comments')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: true }),
      user
        ? supabase.from('post_likes').select('id').eq('post_id', postId).eq('user_id', user.id).maybeSingle()
        : Promise.resolve({ data: null }),
      user
        ? supabase.from('comment_likes').select('comment_id').eq('user_id', user.id)
        : Promise.resolve({ data: [] }),
    ]);

    if (postRes.data) setPost(postRes.data);
    if (commentsRes.data) setComments(commentsRes.data);
    setLiked(!!likeRes.data);

    // 내가 좋아요한 댓글 ID를 { commentId: true } 형태로 저장
    const likedMap = {};
    (commentLikesRes.data ?? []).forEach(row => {
      likedMap[row.comment_id] = true;
    });
    setLikedComments(likedMap);

    setLoading(false);
  }, [postId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 좋아요 토글 (중복 방지: toggle_like RPC)
  const handleLike = async () => {
    if (liking || !post) return;
    setLiking(true);

    const { data: isNowLiked, error } = await supabase.rpc('toggle_like', { post_id: postId });

    if (!error) {
      setLiked(isNowLiked);
      setPost(prev => ({
        ...prev,
        like_count: isNowLiked
          ? (prev.like_count || 0) + 1
          : Math.max((prev.like_count || 0) - 1, 0),
      }));
    }
    setLiking(false);
  };

  // 댓글 좋아요 토글
  const handleCommentLike = async (commentId) => {
    if (likingComment === commentId) return;
    setLikingComment(commentId);

    const { data: isNowLiked, error } = await supabase.rpc('toggle_comment_like', { comment_id: commentId });

    if (!error) {
      setLikedComments(prev => ({ ...prev, [commentId]: isNowLiked }));
      setComments(prev => prev.map(c =>
        c.id === commentId
          ? { ...c, like_count: isNowLiked ? (c.like_count || 0) + 1 : Math.max((c.like_count || 0) - 1, 0) }
          : c
      ));
    }
    setLikingComment(null);
  };

  // ··· 메뉴 (내 글: 수정/삭제 / 타인 글: 신고)
  const handleMenu = () => {
    const isMyPost = post && currentUserId && post.user_id === currentUserId;
    if (isMyPost) {
      Alert.alert('投稿の管理', '', [
        {
          text: '編集する',
          onPress: () => navigation.navigate('PostEdit', {
            postId: post.id,
            title: post.title,
            body: post.body ?? '',
            imageUrls: post.image_urls ?? [],
          }),
        },
        {
          text: '削除する',
          style: 'destructive',
          onPress: handleDeletePost,
        },
        { text: 'キャンセル', style: 'cancel' },
      ]);
    } else {
      handleReport();
    }
  };

  // 내 게시글 삭제
  const handleDeletePost = () => {
    Alert.alert(
      '投稿を削除',
      'この投稿を削除しますか？\nこの操作は取り消せません。',
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
              // 삭제 성공 후 Storage 이미지도 정리
              if (post.image_urls?.length > 0) {
                await deleteImagesFromStorage(post.image_urls).catch(() => {});
              }
              navigation.goBack();
            }
          },
        },
      ]
    );
  };

  // 신고 기능
  const handleReport = () => {
    Alert.alert(
      '投稿を通報する',
      '通報する理由を選択してください',
      [
        {
          text: '侮辱・嫌がらせ',
          onPress: () => submitReport('insult'),
        },
        {
          text: '暴言・脅迫',
          onPress: () => submitReport('abuse'),
        },
        {
          text: '誹謗中傷',
          onPress: () => submitReport('defamation'),
        },
        { text: 'キャンセル', style: 'cancel' },
      ]
    );
  };

  const submitReport = async (reason) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      Alert.alert('エラー', 'ログインが必要です');
      return;
    }

    const { error } = await supabase
      .from('post_reports')
      .insert({ post_id: postId, user_id: user.id, reason });

    if (error) {
      if (error.code === '23505') {
        // UNIQUE 제약 위반 → 이미 신고한 게시글
        Alert.alert('通報済み', 'この投稿はすでに通報しています');
      } else {
        Alert.alert('エラー', `通報に失敗しました\n${error.message}`);
      }
    } else {
      Alert.alert('通報完了', '通報を受け付けました。ありがとうございます。');
    }
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
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
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
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backButtonText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>投稿</Text>
        <TouchableOpacity onPress={handleMenu} style={styles.reportButton}>
          <Text style={styles.reportButtonText}>···</Text>
        </TouchableOpacity>
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

            {/* 첨부 이미지 */}
            {post.image_urls && post.image_urls.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.imageRow}
              >
                {post.image_urls.map((url, idx) => (
                  <TouchableOpacity
                    key={idx}
                    activeOpacity={0.9}
                    onPress={() => setViewerIndex(idx)}
                  >
                    <Image source={{ uri: url }} style={styles.attachedImage} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {/* 좋아요 */}
            <View style={styles.postFooter}>
              <TouchableOpacity style={[styles.likeButton, liked && styles.likeButtonActive]} onPress={handleLike} activeOpacity={0.7}>
                <Text style={styles.likeIcon}>{liked ? '♥' : '♡'}</Text>
                <Text style={[styles.likeCount, liked && styles.likeCountActive]}>{post.like_count || 0}</Text>
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
              comments.map((comment, index) => {
                const isCommentLiked = !!likedComments[comment.id];
                return (
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
                    {/* 댓글 좋아요 버튼 */}
                    <TouchableOpacity
                      style={styles.commentLikeButton}
                      onPress={() => handleCommentLike(comment.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.commentLikeIcon, isCommentLiked && styles.commentLikeIconActive]}>
                        {isCommentLiked ? '♥' : '♡'}
                      </Text>
                      {(comment.like_count || 0) > 0 && (
                        <Text style={[styles.commentLikeCount, isCommentLiked && styles.commentLikeCountActive]}>
                          {comment.like_count}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                );
              })
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

      {/* 풀스크린 이미지 뷰어 */}
      <Modal
        visible={viewerIndex !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setViewerIndex(null)}
      >
        <View style={styles.viewerBackdrop}>
          <TouchableOpacity
            style={styles.viewerClose}
            onPress={() => setViewerIndex(null)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.viewerCloseText}>✕</Text>
          </TouchableOpacity>
          {viewerIndex !== null && post?.image_urls?.[viewerIndex] && (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              contentOffset={{ x: viewerIndex * SCREEN_WIDTH, y: 0 }}
            >
              {post.image_urls.map((url, idx) => (
                <View key={idx} style={styles.viewerPage}>
                  <Image
                    source={{ uri: url }}
                    style={styles.viewerImage}
                    resizeMode="contain"
                  />
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // ── 헤더 ────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.background,
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
    ...typography.subtitle,
    color: colors.textPrimary,
  },
  reportButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportButtonText: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 2,
  },

  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },

  // ── 게시글 카드 ──────────────────────────────
  postCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadow.card,
  },
  postMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  catBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  catBadgeText: {
    ...typography.small,
    fontWeight: '700',
  },
  postAnon: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  postTime: {
    ...typography.caption,
    color: colors.textDisabled,
    marginLeft: 'auto',
  },
  postTitle: {
    ...typography.title3,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  postBody: {
    ...typography.body1,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  imageRow: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  attachedImage: {
    width: 240,
    height: 240,
    borderRadius: radius.md,
    backgroundColor: colors.gray100,
  },
  viewerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
  },
  viewerClose: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 24,
    right: spacing.xl,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  viewerCloseText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '600',
  },
  viewerPage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.85,
  },
  postFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.gray100,
  },
  likeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.gray100,
  },
  likeButtonActive: {
    backgroundColor: colors.dangerSoft,
  },
  likeIcon: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  likeCount: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  likeCountActive: {
    color: colors.danger,
  },
  commentCountArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    paddingHorizontal: spacing.sm,
  },
  commentCountIcon: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  commentCountText: {
    ...typography.caption,
    color: colors.textSecondary,
  },

  // ── 댓글 섹션 ──────────────────────────────
  commentsSection: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow.card,
  },
  commentsLabel: {
    ...typography.captionStrong,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  emptyComments: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyCommentsText: {
    ...typography.body2,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  emptyCommentsSubText: {
    ...typography.caption,
    color: colors.textDisabled,
  },
  commentItem: {
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.gray100,
  },
  commentItemFirst: {
    borderTopWidth: 0,
    paddingTop: 0,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs + 2,
  },
  commentAuthor: {
    ...typography.captionStrong,
    color: colors.textSecondary,
  },
  commentTime: {
    ...typography.small,
    color: colors.textDisabled,
  },
  commentBody: {
    ...typography.body2,
    color: colors.textPrimary,
    marginBottom: spacing.xs + 2,
  },
  commentLikeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    paddingVertical: 2,
  },
  commentLikeIcon: {
    fontSize: 13,
    color: colors.textDisabled,
  },
  commentLikeIconActive: {
    color: colors.danger,
  },
  commentLikeCount: {
    ...typography.small,
    color: colors.textDisabled,
  },
  commentLikeCountActive: {
    color: colors.danger,
  },

  // ── 댓글 입력창 ────────────────────────────
  commentInputArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.gray100,
  },
  anonToggle: {
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing.xs,
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
    ...typography.body2,
    color: colors.textPrimary,
    backgroundColor: colors.gray100,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 1,
    maxHeight: 80,
  },
  sendButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.pill,
    minWidth: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: colors.textDisabled,
  },
  sendButtonText: {
    color: colors.white,
    ...typography.captionStrong,
  },

  // ── 빈 상태 ────────────────────────────────
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    ...typography.body1,
    color: colors.textSecondary,
  },
});
