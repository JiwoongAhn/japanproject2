import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { colors, pastel } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { supabase } from '../../lib/supabase';
import Card from '../../components/Card';

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

  const fetchReviews = useCallback(async () => {
    try {
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
      setReviews(data ?? []);
    } catch {
      // 빈 상태로 표시
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [courseName, professorName]);

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
        <ActivityIndicator style={{ flex: 1 }} size="large" color={colors.primary} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
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
              {reviews.map((review) => (
                <View key={review.id} style={styles.reviewCardWrap}>
                  <Card>
                    {/* 별점 + 날짜 */}
                    <View style={styles.cardTop}>
                      <StarRating rating={review.rating} size={14} />
                      <Text style={styles.cardDate}>{formatDate(review.created_at)}</Text>
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
                  </Card>
                </View>
              ))}
            </>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>
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
    alignItems: 'center',
    marginBottom: spacing.md,
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
