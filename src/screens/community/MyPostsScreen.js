import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  SafeAreaView, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { colors, pastel } from '../../constants/colors';
import LoadingDots from '../../components/LoadingDots';
import { spacing, radius, shadow } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { getCategoryInfo } from '../../constants/boardCategories';
import { formatTimeAgo } from '../../utils/community';
import { getMyReviews, deleteReview } from '../../utils/review';

// 내 게시글 + 내가 쓴 수업평가 통합 목록 화면
// 탭으로 분리: 掲示板 | 講義評価
export default function MyPostsScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('posts'); // 'posts' | 'reviews'
  const [posts, setPosts] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    // 게시판 글 조회
    const { data: postData } = await supabase
      .from('posts')
      .select('id, title, category, created_at, like_count, post_comments(count), body')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    // 강의평가 조회
    let reviewData = [];
    try {
      reviewData = await getMyReviews(user.id);
    } catch {
      // 빈 상태로 폴백
    }

    setPosts(postData ?? []);
    setReviews(reviewData);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => { fetchAll(); }, [fetchAll])
  );

  // ── 게시판 글 핸들러 ─────────────────────────────────────────────

  const handleDeletePost = (post) => {
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

  const handleEditPost = (post) => {
    navigation.navigate('PostEdit', {
      postId: post.id,
      title: post.title,
      body: post.body ?? '',
    });
  };

  const handlePressPost = (post) => {
    navigation.navigate('Community', {
      screen: 'PostDetail',
      params: { postId: post.id },
    });
  };

  // ── 수업평가 핸들러 ──────────────────────────────────────────────

  const handleDeleteReview = (review) => {
    Alert.alert(
      '評価を削除',
      `「${review.course_name}」の評価を削除しますか？\nこの操作は取り消せません。`,
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
  };

  const handleEditReview = (review) => {
    // 시간표 스택의 CourseReviewCreate를 편집 모드로 열기
    navigation.navigate('Timetable', {
      screen: 'CourseReviewCreate',
      params: {
        courseName: review.course_name,
        professorName: review.professor_name ?? '',
        editMode: true,
        reviewId: review.id,
        initialRating: review.rating,
        initialComment: review.comment ?? '',
        initialTags: review.tags ?? [],
      },
    });
  };

  const handlePressReview = (review) => {
    navigation.navigate('Timetable', {
      screen: 'CourseReviewDetail',
      params: {
        courseName: review.course_name,
        professorName: review.professor_name ?? '',
      },
    });
  };

  // ── 렌더: 게시판 카드 ─────────────────────────────────────────────

  const renderPost = ({ item: post }) => {
    const cat = getCategoryInfo(post.category);
    const commentCount = post.post_comments?.[0]?.count ?? 0;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => handlePressPost(post)}
        onLongPress={() => handleDeletePost(post)}
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
              onPress={() => handleEditPost(post)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 4 }}
            >
              <Text style={styles.editBtnText}>編集</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={() => handleDeletePost(post)}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
            >
              <Text style={styles.deleteBtnText}>削除</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // ── 렌더: 강의평가 카드 ───────────────────────────────────────────

  const renderReview = ({ item: review }) => {
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => handlePressReview(review)}
        activeOpacity={0.85}
      >
        <View style={styles.cardTop}>
          {/* 강의평가 뱃지 */}
          <View style={styles.reviewBadge}>
            <Text style={styles.reviewBadgeText}>講義評価</Text>
          </View>
          <Text style={styles.cardTime}>{formatTimeAgo(review.created_at)}</Text>
        </View>

        {/* 과목명 */}
        <Text style={styles.cardTitle} numberOfLines={1}>{review.course_name}</Text>
        {review.professor_name ? (
          <Text style={styles.professorText} numberOfLines={1}>{review.professor_name}</Text>
        ) : null}

        {/* 별점 */}
        <View style={styles.starRow}>
          {[1, 2, 3, 4, 5].map(i => (
            <Text
              key={i}
              style={[styles.star, { color: i <= review.rating ? pastel.yellow.accent : colors.gray200 }]}
            >★</Text>
          ))}
        </View>

        {/* 코멘트 미리보기 */}
        {review.comment ? (
          <Text style={styles.reviewComment} numberOfLines={2}>{review.comment}</Text>
        ) : null}

        <View style={styles.cardBottom}>
          <View style={styles.metaRow} />
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => handleEditReview(review)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 4 }}
            >
              <Text style={styles.editBtnText}>編集</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={() => handleDeleteReview(review)}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
            >
              <Text style={styles.deleteBtnText}>削除</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // ── 빈 상태 ───────────────────────────────────────────────────────

  const renderEmpty = () => {
    if (activeTab === 'posts') {
      return (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>📝</Text>
          <Text style={styles.emptyText}>まだ投稿した記事がないみたい</Text>
          <Text style={styles.emptySubText}>掲示板で最初の投稿を書いてみよう</Text>
        </View>
      );
    }
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyEmoji}>⭐</Text>
        <Text style={styles.emptyText}>まだ講義評価を書いてないみたい</Text>
        <Text style={styles.emptySubText}>時間割から授業を選んで評価を書いてみよう</Text>
      </View>
    );
  };

  const activeData = activeTab === 'posts' ? posts : reviews;
  const renderItem = activeTab === 'posts' ? renderPost : renderReview;

  return (
    <SafeAreaView style={styles.container}>
      {/* ── 헤더 ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>投稿した内容</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* ── 탭 ── */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'posts' && styles.tabActive]}
          onPress={() => setActiveTab('posts')}
          activeOpacity={0.75}
        >
          <Text style={[styles.tabText, activeTab === 'posts' && styles.tabTextActive]}>
            掲示板
          </Text>
          {posts.length > 0 && (
            <View style={[styles.tabBadge, activeTab === 'posts' && styles.tabBadgeActive]}>
              <Text style={[styles.tabBadgeText, activeTab === 'posts' && styles.tabBadgeTextActive]}>
                {posts.length}
              </Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'reviews' && styles.tabActive]}
          onPress={() => setActiveTab('reviews')}
          activeOpacity={0.75}
        >
          <Text style={[styles.tabText, activeTab === 'reviews' && styles.tabTextActive]}>
            講義評価
          </Text>
          {reviews.length > 0 && (
            <View style={[styles.tabBadge, activeTab === 'reviews' && styles.tabBadgeActive]}>
              <Text style={[styles.tabBadgeText, activeTab === 'reviews' && styles.tabBadgeTextActive]}>
                {reviews.length}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* ── 콘텐츠 ── */}
      {loading ? (
        <LoadingDots style={{ flex: 1 }} />
      ) : activeData.length === 0 ? (
        renderEmpty()
      ) : (
        <FlatList
          data={activeData}
          keyExtractor={item => item.id}
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

  // ── 탭 ─────────────────────────────────────
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
    gap: spacing.lg,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    ...typography.body2,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  tabTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  tabBadge: {
    backgroundColor: colors.gray200,
    borderRadius: radius.pill,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  tabBadgeActive: {
    backgroundColor: colors.primaryLight,
  },
  tabBadgeText: {
    ...typography.small,
    color: colors.textSecondary,
    fontWeight: '700',
    lineHeight: 14,
  },
  tabBadgeTextActive: {
    color: colors.primary,
  },

  // ── 목록 ────────────────────────────────────
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
  // 강의평가 전용 뱃지
  reviewBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: pastel.yellow.bg,
  },
  reviewBadgeText: {
    ...typography.small,
    color: pastel.yellow.accent,
    fontWeight: '700',
  },
  cardTime: { ...typography.caption, color: colors.textDisabled },
  cardTitle: {
    ...typography.subtitle,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  professorText: {
    ...typography.body2,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  starRow: {
    flexDirection: 'row',
    gap: 1,
    marginBottom: spacing.sm,
  },
  star: {
    fontSize: 14,
    lineHeight: 18,
  },
  reviewComment: {
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
    textAlign: 'center',
  },
  emptySubText: {
    ...typography.body2,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
