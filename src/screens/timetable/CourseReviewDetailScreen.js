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
import { colors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';

// 별점 표시 컴포넌트
function StarRating({ rating, size = 14 }) {
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Text
          key={i}
          style={[styles.star, { fontSize: size, color: i <= Math.round(rating) ? '#F59E0B' : colors.border }]}
        >
          ★
        </Text>
      ))}
    </View>
  );
}

// 작성 일시 포맷 (예: 2026年4月13日)
function formatDate(isoString) {
  const d = new Date(isoString);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

export default function CourseReviewDetailScreen({ navigation, route }) {
  const { courseName, professorName } = route.params;

  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // 해당 수업의 전체 리뷰 불러오기
  const fetchReviews = useCallback(async () => {
    try {
      let query = supabase
        .from('course_reviews')
        .select('*')
        .eq('course_name', courseName)
        .order('created_at', { ascending: false });

      // 교수명이 있으면 교수명으로도 필터
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
    // 리뷰 작성 후 돌아오면 새로고침
    const unsubscribe = navigation.addListener('focus', fetchReviews);
    return unsubscribe;
  }, [navigation, fetchReviews]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchReviews();
  }, [fetchReviews]);

  // 평균 별점 계산
  const avgRating = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0;

  return (
    <SafeAreaView style={styles.container}>

      {/* ── 헤더 ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{courseName}</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* ── 수업 요약 카드 ── */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryLeft}>
          <Text style={styles.summaryCourse}>{courseName}</Text>
          {professorName ? (
            <Text style={styles.summaryProfessor}>{professorName}</Text>
          ) : null}
        </View>
        {reviews.length > 0 && (
          <View style={styles.summaryRight}>
            <StarRating rating={avgRating} size={16} />
            <Text style={styles.summaryAvg}>{avgRating.toFixed(1)}</Text>
            <Text style={styles.summaryCount}>{reviews.length}件の評価</Text>
          </View>
        )}
      </View>

      {/* ── 리뷰 목록 ── */}
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
          {reviews.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>📝</Text>
              <Text style={styles.emptyText}>まだ評価がありません</Text>
              <Text style={styles.emptySubText}>最初の評価を書いてみよう！</Text>
            </View>
          ) : (
            reviews.map((review) => (
              <View key={review.id} style={styles.reviewCard}>
                {/* 별점 + 날짜 */}
                <View style={styles.cardTop}>
                  <StarRating rating={review.rating} size={13} />
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
              </View>
            ))
          )}

          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {/* ── 평가 작성 FAB ── */}
      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('CourseReviewCreate')}
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
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    marginHorizontal: 8,
  },

  // 수업 요약 카드
  summaryCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  summaryLeft: {
    flex: 1,
    marginRight: 12,
  },
  summaryCourse: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 3,
  },
  summaryProfessor: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  summaryRight: {
    alignItems: 'flex-end',
  },
  summaryAvg: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 2,
  },
  summaryCount: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // 리뷰 목록
  listContent: {
    padding: 16,
  },

  // 개별 리뷰 카드
  reviewCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  starRow: {
    flexDirection: 'row',
    gap: 2,
  },
  star: {
    lineHeight: 18,
  },
  cardDate: {
    fontSize: 12,
    color: colors.textDisabled,
  },

  // 태그
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  tag: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '500',
  },

  // 코멘트
  comment: {
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 20,
  },

  // 빈 상태
  emptyState: {
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 6,
  },
  emptySubText: {
    fontSize: 13,
    color: colors.textDisabled,
  },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 28,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  fabText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
