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
import { colors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';

// 별 표시 렌더링
function StarRating({ rating }) {
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Text key={i} style={[styles.star, { color: i <= Math.round(rating) ? '#F59E0B' : colors.border }]}>
          ★
        </Text>
      ))}
    </View>
  );
}

// course_reviews 배열을 과목명 기준으로 그룹화
// 반환: [{ courseName, professorName, avgRating, count, tags, latestComment }]
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
    // 태그 중복 없이 수집 (최대 5개)
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
    .sort((a, b) => b.count - a.count); // 평가 수 많은 순 정렬
}

export default function CourseReviewScreen({ navigation }) {
  const [searchText, setSearchText] = useState('');
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Supabase에서 강의평가 불러오기
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
    // CourseReviewCreate에서 돌아올 때마다 목록 새로고침
    const unsubscribe = navigation.addListener('focus', fetchReviews);
    return unsubscribe;
  }, [navigation, fetchReviews]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchReviews();
  }, [fetchReviews]);

  // 과목별 그룹화 + 검색 필터
  const grouped = groupReviewsByCourse(reviews).filter(
    (item) =>
      item.courseName.includes(searchText) ||
      item.professorName.includes(searchText)
  );

  return (
    <SafeAreaView style={styles.container}>

      {/* ── 헤더 ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>講義評価</Text>
        <View style={{ width: 36 }} />
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
            <TouchableOpacity onPress={() => setSearchText('')}>
              <Text style={styles.clearButton}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── 로딩 중 ── */}
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
            // 빈 상태 (데이터 없거나 검색 결과 없음)
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>{searchText ? '🔍' : '📝'}</Text>
              <Text style={styles.emptyText}>
                {searchText ? '該当する授業が見つかりません' : 'まだ講義評価がありません'}
              </Text>
              {!searchText && (
                <Text style={styles.emptySubText}>最初の評価を書いてみよう！</Text>
              )}
            </View>
          ) : (
            <>
              <Text style={styles.listLabel}>
                {searchText ? `「${searchText}」の検索結果` : '人気の講義評価'}
              </Text>
              {grouped.map((item, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.reviewCard}
                  activeOpacity={0.75}
                >
                  {/* 수업명 + 별점 */}
                  <View style={styles.cardHeader}>
                    <View style={styles.cardTitleArea}>
                      <Text style={styles.cardCourseName}>{item.courseName}</Text>
                      {item.professorName ? (
                        <Text style={styles.cardProfessor}>{item.professorName}</Text>
                      ) : null}
                    </View>
                    <View style={styles.ratingArea}>
                      <StarRating rating={item.avgRating} />
                      <Text style={styles.ratingNumber}>{item.avgRating.toFixed(1)}</Text>
                      <Text style={styles.ratingCount}>({item.count}件)</Text>
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
                </TouchableOpacity>
              ))}
            </>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {/* ── 평가 작성 FAB 버튼 ── */}
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
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  // 검색바
  searchContainer: {
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchIcon: {
    fontSize: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
  },
  clearButton: {
    fontSize: 12,
    color: colors.textSecondary,
    padding: 4,
  },

  // 목록
  listContent: {
    padding: 16,
  },
  listLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 12,
  },

  // 강의평가 카드
  reviewCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  cardTitleArea: {
    flex: 1,
    marginRight: 12,
  },
  cardCourseName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 3,
  },
  cardProfessor: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  ratingArea: {
    alignItems: 'flex-end',
  },
  starRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  star: {
    fontSize: 12,
  },
  ratingNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  ratingCount: {
    fontSize: 11,
    color: colors.textSecondary,
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
  previewText: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    fontStyle: 'italic',
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
