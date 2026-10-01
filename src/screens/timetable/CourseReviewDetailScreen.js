import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  RefreshControl,
  Alert,
} from 'react-native';
import { colors, pastel } from '../../constants/colors';
import LoadingDots from '../../components/LoadingDots';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { supabase } from '../../lib/supabase';
import { deleteReview } from '../../utils/review';
import { reportContent, blockUser } from '../../utils/moderation';
import Card from '../../components/Card';
import AppTextInput from '../../components/AppTextInput';
import KeyboardAwareScrollView from '../../components/KeyboardAwareScrollView';
import {
  fetchCommentsByReviewIds,
  addComment,
  deleteComment,
  validateComment,
  COMMENT_MAX_LENGTH,
} from '../../utils/courseReviewComments';

// 별점 표시 컴포넌트
function StarRating({ rating, size = 14 }) {
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Text
          key={i}
          style={[styles.star, { fontSize: size, color: i <= Math.round(rating) ? pastel.yellow.accent : colors.gray200 }]}
        >
          ★
        </Text>
      ))}
    </View>
  );
}

// 작성 일시 포맷
function formatDate(isoString) {
  const d = new Date(isoString);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

export default function CourseReviewDetailScreen({ navigation, route }) {
  const { courseName, professorName } = route.params;

  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // 현재 로그인 사용자 ID (내 리뷰 판별용)
  const [currentUserId, setCurrentUserId] = useState(null);

  // ── 댓글 ──
  // 평가마다 댓글이 달린다. 평가 목록은 여러 개를 비교하며 훑는 화면이라
  // 댓글은 기본으로 접어 두고, 펼친 평가만 입력칸을 보여준다.
  const [commentsByReview, setCommentsByReview] = useState({}); // { reviewId: [댓글...] }
  const [expandedReviews, setExpandedReviews] = useState({});   // { reviewId: true }
  const [commentDrafts, setCommentDrafts] = useState({});       // { reviewId: 입력중 텍스트 }
  const [sendingReviewId, setSendingReviewId] = useState(null); // 전송 중인 평가 id

  const fetchReviews = useCallback(async () => {
    try {
      // 현재 유저 ID 취득 (내 리뷰 판별)
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id ?? null);

      let query = supabase
        .from('course_reviews')
        .select('*')
        .eq('course_name', courseName)
        .order('created_at', { ascending: false });

      if (professorName) {
        query = query.eq('professor_name', professorName);
      }

      const { data, error } = await query;
      if (error) throw error;
      const rows = data ?? [];
      setReviews(rows);

      // 댓글은 평가 전체를 한 번에 받아 묶는다(평가마다 따로 부르면 요청이 평가 수만큼 나간다).
      // 댓글 조회가 실패해도 평가 목록은 보여야 하므로 여기서 따로 삼킨다.
      try {
        setCommentsByReview(await fetchCommentsByReviewIds(rows.map(r => r.id)));
      } catch {
        setCommentsByReview({});
      }
    } catch {
      // 빈 상태로 표시
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [courseName, professorName]);

  // 내 리뷰 수정: 작성 폼을 편집 모드로 재사용
  const handleEditReview = useCallback((review) => {
    navigation.navigate('CourseReviewCreate', {
      courseName: review.course_name,
      professorName: review.professor_name ?? '',
      editMode: true,
      reviewId: review.id,
      initialRating: review.rating,
      initialComment: review.comment ?? '',
      initialTags: review.tags ?? [],
    });
  }, [navigation]);

  // 내 리뷰 삭제: Alert 확인 후 삭제 → 목록 갱신
  const handleDeleteReview = useCallback((review) => {
    Alert.alert(
      '評価を削除',
      'この評価を削除しますか？\nこの操作は取り消せません。',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除する',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteReview(review.id);
              setReviews(prev => prev.filter(r => r.id !== review.id));
            } catch {
              Alert.alert('お知らせ', '削除できませんでした。もう一度お試しください');
            }
          },
        },
      ]
    );
  }, []);

  // ··· 메뉴 (내 평가: 수정/삭제) — 게시판 상세와 동일 패턴
  const handleReviewMenu = useCallback((review) => {
    Alert.alert('評価の管理', '', [
      { text: '編集する', onPress: () => handleEditReview(review) },
      { text: '削除する', style: 'destructive', onPress: () => handleDeleteReview(review) },
      { text: 'キャンセル', style: 'cancel' },
    ]);
  }, [handleEditReview, handleDeleteReview]);

  // ··· 메뉴 (타인 평가: 신고/차단)
  // ── 댓글 핸들러 ──

  const toggleComments = useCallback((reviewId) => {
    setExpandedReviews(prev => ({ ...prev, [reviewId]: !prev[reviewId] }));
  }, []);

  const handleSendComment = useCallback(async (reviewId) => {
    const check = validateComment(commentDrafts[reviewId], sendingReviewId === reviewId);
    if (!check.ok) {
      // 빈 입력·전송 중은 조용히 무시한다(버튼이 비활성이라 보통 여기까지 오지 않는다).
      if (check.reason === 'tooLong') {
        Alert.alert('お知らせ', `コメントは${COMMENT_MAX_LENGTH}文字までです`);
      }
      return;
    }

    setSendingReviewId(reviewId);
    try {
      const created = await addComment(reviewId, check.body);
      // 목록 맨 아래에 바로 끼워 넣는다(다시 조회하면 화면이 깜빡이고 느리다)
      setCommentsByReview(prev => ({
        ...prev,
        [reviewId]: [...(prev[reviewId] ?? []), created],
      }));
      setCommentDrafts(prev => ({ ...prev, [reviewId]: '' }));
    } catch {
      Alert.alert('お知らせ', 'コメントを送信できませんでした。もう一度お試しください');
    } finally {
      setSendingReviewId(null);
    }
  }, [commentDrafts, sendingReviewId]);

  const handleDeleteComment = useCallback((reviewId, comment) => {
    Alert.alert('コメントを削除', 'このコメントを削除しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除する',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteComment(comment.id);
            setCommentsByReview(prev => ({
              ...prev,
              [reviewId]: (prev[reviewId] ?? []).filter(c => c.id !== comment.id),
            }));
          } catch {
            Alert.alert('お知らせ', '削除できませんでした。もう一度お試しください');
          }
        },
      },
    ]);
  }, []);

  // 남의 댓글 ⋯ 메뉴 — 통보·차단. 평가 쪽 메뉴와 같은 구성으로 맞춘다.
  const handleCommentReportMenu = useCallback((comment) => {
    const report = (reason) => async () => {
      const r = await reportContent('course_review_comment_reports', 'comment_id', comment.id, reason);
      if (r.ok) Alert.alert('通報完了', '通報を受け付けました。ありがとうございます。');
      else if (r.already) Alert.alert('通報済み', 'すでに通報しています');
      else Alert.alert('お知らせ', '通報できませんでした');
    };
    Alert.alert('コメント', '', [
      { text: '通報する', onPress: () => Alert.alert('通報する', '通報する理由を選択してください', [
        { text: '侮辱・嫌がらせ', onPress: report('insult') },
        { text: '暴言・脅迫', onPress: report('abuse') },
        { text: '誹謗中傷', onPress: report('defamation') },
        { text: 'キャンセル', style: 'cancel' },
      ]) },
      { text: 'このユーザーをブロック', style: 'destructive', onPress: () => Alert.alert(
        'ユーザーをブロック', 'このユーザーのコメントが表示されなくなります。', [
          { text: 'キャンセル', style: 'cancel' },
          { text: 'ブロック', style: 'destructive', onPress: async () => {
            const r = await blockUser(comment.user_id);
            if (r.ok) { Alert.alert('ブロックしました'); fetchReviews(); }
            else Alert.alert('お知らせ', 'ブロックできませんでした');
          } },
        ]) },
      { text: 'キャンセル', style: 'cancel' },
    ]);
  }, [fetchReviews]);

  const handleReviewReportMenu = useCallback((review) => {
    const report = (reason) => async () => {
      const r = await reportContent('course_review_reports', 'review_id', review.id, reason);
      if (r.ok) Alert.alert('通報完了', '通報を受け付けました。ありがとうございます。');
      else if (r.already) Alert.alert('通報済み', 'すでに通報しています');
      else Alert.alert('お知らせ', '通報できませんでした');
    };
    Alert.alert('評価', '', [
      { text: '通報する', onPress: () => Alert.alert('通報する', '通報する理由を選択してください', [
        { text: '侮辱・嫌がらせ', onPress: report('insult') },
        { text: '暴言・脅迫', onPress: report('abuse') },
        { text: '誹謗中傷', onPress: report('defamation') },
        { text: 'キャンセル', style: 'cancel' },
      ]) },
      { text: 'このユーザーをブロック', style: 'destructive', onPress: () => Alert.alert(
        'ユーザーをブロック', 'このユーザーの評価が表示されなくなります。', [
          { text: 'キャンセル', style: 'cancel' },
          { text: 'ブロック', style: 'destructive', onPress: async () => {
            const r = await blockUser(review.user_id);
            if (r.ok) { Alert.alert('ブロックしました'); fetchReviews(); }
            else Alert.alert('お知らせ', 'ブロックできませんでした');
          } },
        ]) },
      { text: 'キャンセル', style: 'cancel' },
    ]);
  }, [fetchReviews]);

  useEffect(() => {
    fetchReviews();
    const unsubscribe = navigation.addListener('focus', fetchReviews);
    return unsubscribe;
  }, [navigation, fetchReviews]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchReviews();
  }, [fetchReviews]);

  // 평균 별점
  const avgRating = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0;

  return (
    <SafeAreaView style={styles.container}>
      {/* ── 헤더 ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backButtonText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{courseName}</Text>
        <View style={styles.backButton} />
      </View>

      {loading ? (
        <LoadingDots fullscreen />
      ) : (
        <KeyboardAwareScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
        >
          {/* ── 수업 요약 카드 (1 thing — 평균 별점 강조) ── */}
          <Card style={styles.summaryCard}>
            <View style={styles.summaryLeft}>
              <Text style={styles.summaryCourse}>{courseName}</Text>
              {professorName ? (
                <Text style={styles.summaryProfessor}>{professorName}</Text>
              ) : null}
            </View>
            {reviews.length > 0 ? (
              <View style={styles.summaryRight}>
                <Text style={styles.summaryAvg}>{avgRating.toFixed(1)}</Text>
                <StarRating rating={avgRating} size={14} />
                <Text style={styles.summaryCount}>{reviews.length}件の評価</Text>
              </View>
            ) : null}
          </Card>

          {reviews.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>📝</Text>
              <Text style={styles.emptyText}>まだ評価がないみたい</Text>
              <Text style={styles.emptySubText}>最初の評価を書いてみよう</Text>
            </View>
          ) : (
            <>
              <Text style={styles.listLabel}>みんなの評価</Text>
              {reviews.map((review) => {
                const isMyReview = currentUserId && review.user_id === currentUserId;
                return (
                  <View key={review.id} style={styles.reviewCardWrap}>
                    <Card>
                      {/* 별점 + 날짜 + (내 리뷰면) 수정·삭제 */}
                      <View style={styles.cardTop}>
                        <StarRating rating={review.rating} size={14} />
                        <View style={styles.cardTopRight}>
                          <TouchableOpacity
                            style={styles.moreBtn}
                            onPress={() => (isMyReview ? handleReviewMenu(review) : handleReviewReportMenu(review))}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Text style={styles.moreBtnText}>⋯</Text>
                          </TouchableOpacity>
                          <Text style={styles.cardDate}>{formatDate(review.created_at)}</Text>
                        </View>
                      </View>

                      {/* 태그 */}
                      {review.tags && review.tags.length > 0 && (
                        <View style={styles.tagRow}>
                          {review.tags.map((tag, i) => (
                            <View key={i} style={styles.tag}>
                              <Text style={styles.tagText}>#{tag}</Text>
                            </View>
                          ))}
                        </View>
                      )}

                      {/* 코멘트 */}
                      {review.comment ? (
                        <Text style={styles.comment}>{review.comment}</Text>
                      ) : null}

                      {/* ── 댓글 ──
                          기본은 접어 둔다. 이 화면은 평가 여러 개를 비교하며 훑는 곳이라
                          전부 펼쳐져 있으면 길어져서 정작 평가를 읽기 어려워진다. */}
                      {(() => {
                        const comments = commentsByReview[review.id] ?? [];
                        const expanded = !!expandedReviews[review.id];
                        const draft = commentDrafts[review.id] ?? '';
                        const sending = sendingReviewId === review.id;
                        const canSend = validateComment(draft, sending).ok;
                        return (
                          <View style={styles.commentSection}>
                            <TouchableOpacity
                              style={styles.commentToggle}
                              onPress={() => toggleComments(review.id)}
                              activeOpacity={0.7}
                              accessibilityRole="button"
                              accessibilityLabel={expanded ? 'コメントを閉じる' : 'コメントを開く'}
                            >
                              <Text style={styles.commentToggleText}>
                                {comments.length > 0
                                  ? `💬 コメント ${comments.length}件`
                                  : '💬 コメントする'}
                              </Text>
                              <Text style={styles.commentToggleArrow}>{expanded ? '▴' : '▾'}</Text>
                            </TouchableOpacity>

                            {expanded && (
                              <View style={styles.commentBody}>
                                {comments.map((c) => {
                                  const isMine = currentUserId && c.user_id === currentUserId;
                                  return (
                                    <View key={c.id} style={styles.commentRow}>
                                      <View style={styles.commentTextWrap}>
                                        <Text style={styles.commentAuthor}>
                                          {isMine ? '自分' : '匿名'}
                                        </Text>
                                        <Text style={styles.commentBodyText}>{c.body}</Text>
                                      </View>
                                      <TouchableOpacity
                                        style={styles.commentMoreBtn}
                                        onPress={() => (isMine
                                          ? handleDeleteComment(review.id, c)
                                          : handleCommentReportMenu(c))}
                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                        accessibilityRole="button"
                                        accessibilityLabel={isMine ? 'コメントを削除' : 'コメントを通報'}
                                      >
                                        <Text style={styles.commentMoreText}>⋯</Text>
                                      </TouchableOpacity>
                                    </View>
                                  );
                                })}

                                <View style={styles.commentInputRow}>
                                  <AppTextInput
                                    style={styles.commentInput}
                                    value={draft}
                                    onChangeText={(v) => setCommentDrafts(prev => ({ ...prev, [review.id]: v }))}
                                    placeholder="コメントを入力…"
                                    placeholderTextColor={colors.textDisabled}
                                    maxLength={COMMENT_MAX_LENGTH}
                                    multiline
                                  />
                                  <TouchableOpacity
                                    style={[styles.commentSendBtn, !canSend && styles.commentSendBtnDisabled]}
                                    onPress={() => handleSendComment(review.id)}
                                    disabled={!canSend}
                                    activeOpacity={0.85}
                                  >
                                    <Text style={styles.commentSendText}>
                                      {sending ? '送信中' : '送信'}
                                    </Text>
                                  </TouchableOpacity>
                                </View>
                              </View>
                            )}
                          </View>
                        );
                      })()}
                    </Card>
                  </View>
                );
              })}
            </>
          )}

          <View style={{ height: 100 }} />
        </KeyboardAwareScrollView>
      )}

      {/* ── FAB ── */}
      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('CourseReviewCreate', { courseName, professorName })}
      >
        <Text style={styles.fabText}>＋ 評価を書く</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // ── 헤더 ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
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
    flex: 1,
    ...typography.subtitle,
    color: colors.textPrimary,
    textAlign: 'center',
    marginHorizontal: spacing.sm,
  },

  // ── 목록 ──
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  listLabel: {
    ...typography.captionStrong,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    marginTop: spacing.md,
    paddingLeft: spacing.xs,
  },

  // ── 수업 요약 카드 ──
  summaryCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLeft: {
    flex: 1,
    marginRight: spacing.md,
  },
  summaryCourse: {
    ...typography.title3,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  summaryProfessor: {
    ...typography.body2,
    color: colors.textSecondary,
  },
  summaryRight: {
    alignItems: 'flex-end',
  },
  summaryAvg: {
    ...typography.display,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  summaryCount: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },

  // ── 개별 리뷰 카드 ──
  reviewCardWrap: {
    marginBottom: spacing.md,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  cardTopRight: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  moreBtn: {
    paddingHorizontal: spacing.xs,
  },
  moreBtnText: {
    fontSize: 20,
    lineHeight: 20,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  starRow: {
    flexDirection: 'row',
    gap: 1,
  },
  star: {
    lineHeight: 18,
  },
  cardDate: {
    ...typography.small,
    color: colors.textDisabled,
  },

  // ── 태그 ──
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs + 2,
    marginBottom: spacing.md,
  },
  tag: {
    backgroundColor: pastel.sky.bg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  tagText: {
    ...typography.small,
    color: pastel.sky.accent,
    fontWeight: '600',
  },

  // ── 코멘트 ──
  comment: {
    ...typography.body2,
    color: colors.textPrimary,
    lineHeight: 22,
  },

  // ── 댓글 ──
  commentSection: {
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.gray100,
    paddingTop: spacing.sm,
  },
  commentToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  commentToggleText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  commentToggleArrow: {
    ...typography.caption,
    color: colors.textDisabled,
  },
  commentBody: {
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  commentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  commentTextWrap: {
    flex: 1,
  },
  commentAuthor: {
    ...typography.caption,
    color: colors.textDisabled,
    marginBottom: 2,
  },
  commentBodyText: {
    ...typography.body2,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  commentMoreBtn: {
    paddingLeft: spacing.sm,
  },
  commentMoreText: {
    ...typography.caption,
    color: colors.textDisabled,
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  commentInput: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body2,
    color: colors.textPrimary,
    maxHeight: 100,
  },
  commentSendBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  commentSendBtnDisabled: {
    opacity: 0.4,
  },
  commentSendText: {
    ...typography.captionStrong,
    color: colors.white,
  },

  // ── 빈 상태 ──
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.huge * 2,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: spacing.lg,
  },
  emptyText: {
    ...typography.subtitle,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  emptySubText: {
    ...typography.body2,
    color: colors.textSecondary,
  },

  // ── FAB ──
  fab: {
    position: 'absolute',
    bottom: spacing.xxl,
    right: spacing.xl,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md + 2,
    borderRadius: radius.pill,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  fabText: {
    color: colors.white,
    ...typography.bodyStrong,
    fontWeight: '700',
  },
});
