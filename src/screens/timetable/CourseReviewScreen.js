import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { colors, pastel } from '../../constants/colors';
import { spacing, radius, shadow } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { supabase } from '../../lib/supabase';
import Card from '../../components/Card';

// 별 표시
function StarRating({ rating }) {
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Text
          key={i}
          style={[styles.star, { color: i <= Math.round(rating) ? pastel.yellow.accent : colors.gray200 }]}
        >
          ★
        </Text>
      ))}
    </View>
  );
}

// course_reviews 배열을 과목명 기준으로 그룹화
function groupReviewsByCourse(reviews) {
  const map = {};
  reviews.forEach((r) => {
    const key = `${r.course_name}__${r.professor_name || ''}`;
    if (!map[key]) {
      map[key] = {
        courseName: r.course_name,
        professorName: r.professor_name || '',
        totalRating: 0,
        count: 0,
        tags: [],
        latestComment: r.comment || '',
      };
    }
    map[key].totalRating += r.rating;
    map[key].count += 1;
    // 태그 중복 없이 수집 (최대 5개 — 밀러 7±2 이내)
    (r.tags || []).forEach((tag) => {
      if (!map[key].tags.includes(tag) && map[key].tags.length < 5) {
        map[key].tags.push(tag);
      }
    });
  });

  return Object.values(map)
    .map((item) => ({
      ...item,
      avgRating: item.totalRating / item.count,
    }))
    .sort((a, b) => b.count - a.count);
}

export default function CourseReviewScreen({ navigation }) {
  const [searchText, setSearchText] = useState('');
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchReviews = useCallback(async () => {
    const { data, error } = await supabase
      .from('course_reviews')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setReviews(data);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    fetchReviews();
    const unsubscribe = navigation.addListener('focus', fetchReviews);
    return unsubscribe;
  }, [navigation, fetchReviews]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchReviews();
  }, [fetchReviews]);

  const grouped = groupReviewsByCourse(reviews).filter(
    (item) =>
      item.courseName.includes(searchText) ||
      item.professorName.includes(searchText)
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* ── 헤더 (보더 없는 토스 스타일) ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} activeOpacity={0.7}>
          <Text style={styles.backButtonText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>講義評価</Text>
        <View style={styles.backButton} />
      </View>

      {/* ── 검색바 ── */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="授業名・教員名で検索"
            placeholderTextColor={colors.textDisabled}
            value={searchText}
            onChangeText={setSearchText}
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => setSearchText('')} activeOpacity={0.7}>
              <Text style={styles.clearButton}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
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
          {grouped.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>{searchText ? '🔍' : '📝'}</Text>
              <Text style={styles.emptyText}>
                {searchText ? '該当する授業が見つからないみたい' : 'まだ講義評価がないみたい'}
              </Text>
              {!searchText && (
                <Text style={styles.emptySubText}>最初の評価を書いてみよう</Text>
              )}
            </View>
          ) : (
            <>
              <Text style={styles.listLabel}>
                {searchText ? `「${searchText}」の検索結果` : '人気の講義評価'}
              </Text>
              {grouped.map((item) => (
                <TouchableOpacity
                  key={`${item.courseName}__${item.professorName ?? ''}`}
                  activeOpacity={0.85}
                  onPress={() => navigation.navigate('CourseReviewDetail', {
                    courseName: item.courseName,
                    professorName: item.professorName,
                  })}
                  style={styles.cardWrap}
                >
                  <Card>
                    {/* 수업명 + 별점 */}
                    <View style={styles.cardHeader}>
                      <View style={styles.cardTitleArea}>
                        <Text style={styles.cardCourseName} numberOfLines={1}>{item.courseName}</Text>
                        {item.professorName ? (
                          <Text style={styles.cardProfessor} numberOfLines={1}>{item.professorName}</Text>
                        ) : null}
                      </View>
                      <View style={styles.ratingArea}>
                        <StarRating rating={item.avgRating} />
                        <View style={styles.ratingNumRow}>
                          <Text style={styles.ratingNumber}>{item.avgRating.toFixed(1)}</Text>
                          <Text style={styles.ratingCount}> ({item.count})</Text>
                        </View>
                      </View>
                    </View>

                    {/* 태그 */}
                    {item.tags.length > 0 && (
                      <View style={styles.tagRow}>
                        {item.tags.map((tag, i) => (
                          <View key={i} style={styles.tag}>
                            <Text style={styles.tagText}>#{tag}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* 최신 코멘트 미리보기 */}
                    {item.latestComment ? (
                      <Text style={styles.previewText} numberOfLines={2}>
                        "{item.latestComment}"
                      </Text>
                    ) : null}
                  </Card>
                </TouchableOpacity>
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
    ...typography.subtitle,
    color: colors.textPrimary,
  },

  // ── 검색바 ──
  searchContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    backgroundColor: colors.background,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
    ...shadow.soft,
  },
  searchIcon: {
    fontSize: 14,
  },
  searchInput: {
    flex: 1,
    ...typography.body2,
    color: colors.textPrimary,
  },
  clearButton: {
    ...typography.caption,
    color: colors.textSecondary,
    padding: spacing.xs,
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
    paddingLeft: spacing.xs,
  },

  // ── 카드 ──
  cardWrap: {
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  cardTitleArea: {
    flex: 1,
    marginRight: spacing.md,
  },
  cardCourseName: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  cardProfessor: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  ratingArea: {
    alignItems: 'flex-end',
  },
  starRow: {
    flexDirection: 'row',
    marginBottom: 2,
    gap: 1,
  },
  star: {
    fontSize: 13,
  },
  ratingNumRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  ratingNumber: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
  },
  ratingCount: {
    ...typography.small,
    color: colors.textSecondary,
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
  previewText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontStyle: 'italic',
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
