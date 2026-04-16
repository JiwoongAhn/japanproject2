import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from 'react-native';
import { colors } from '../../constants/colors';
import { BOARD_CATEGORIES, getCategoryInfo } from '../../constants/boardCategories';
import { supabase } from '../../lib/supabase';
import { formatTimeAgo } from '../../utils/community';

// 한 번에 로드하는 게시글 수
const PAGE_SIZE = 20;

// 전체 보기 탭 + 카테고리 탭 합치기
const ALL_TABS = [
  { key: 'all', label: '全体', color: colors.textSecondary },
  ...BOARD_CATEGORIES,
];

export default function PostListScreen({ navigation }) {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  // pageRef: 현재 로드된 페이지 (0부터 시작). 렌더링 트리거 없이 관리
  const pageRef = useRef(0);

  // Supabase에서 게시글 불러오기
  // reset=true면 처음부터 다시 로드 (카테고리/검색 변경, 새로고침)
  const fetchPosts = useCallback(async ({ reset = false } = {}) => {
    if (reset) {
      pageRef.current = 0;
    }

    const from = pageRef.current * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    if (reset) setLoading(true);
    else setLoadingMore(true);

    // 쿼리 빌드
    let query = supabase
      .from('posts')
      .select('*, post_comments(count)')
      .order('created_at', { ascending: false })
      .range(from, to);

    // 카테고리 필터 (서버 사이드)
    if (selectedCategory !== 'all') {
      query = query.eq('category', selectedCategory);
    }

    // 검색어 필터 (서버 사이드 ilike)
    const q = searchText.trim();
    if (q) {
      query = query.or(`title.ilike.%${q}%,body.ilike.%${q}%`);
    }

    const { data, error } = await query;

    if (!error && data) {
      setPosts(prev => reset ? data : [...prev, ...data]);
      setHasMore(data.length === PAGE_SIZE);
      pageRef.current += 1;
    }

    setLoading(false);
    setLoadingMore(false);
    setRefreshing(false);
  }, [selectedCategory, searchText]);

  // 카테고리 또는 검색어 변경 시 목록 리셋
  useEffect(() => {
    fetchPosts({ reset: true });
  }, [selectedCategory, searchText]);

  useEffect(() => {
    // PostCreate에서 돌아올 때마다 목록 새로고침
    const unsubscribe = navigation.addListener('focus', () => fetchPosts({ reset: true }));
    return unsubscribe;
  }, [navigation, fetchPosts]);

  // 당겨서 새로고침
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPosts({ reset: true });
  }, [fetchPosts]);

  // 더 보기 버튼
  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore) {
      fetchPosts({ reset: false });
    }
  }, [fetchPosts, loadingMore, hasMore]);

  return (
    <SafeAreaView style={styles.container}>

      {/* ── 상단 헤더 ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>掲示板</Text>
          <Text style={styles.headerSubtitle}>國士舘大学</Text>
        </View>
        <TouchableOpacity
          style={styles.postButton}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('PostCreate')}
        >
          <Text style={styles.postButtonText}>＋ 投稿する</Text>
        </TouchableOpacity>
      </View>

      {/* ── 카테고리 탭 (가로 스크롤 — 나중에 게시판 늘어나도 OK) ── */}
      <View style={styles.categoryTabBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryTabScroll}
        >
          {ALL_TABS.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={styles.categoryTab}
              onPress={() => setSelectedCategory(tab.key)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.categoryTabText,
                selectedCategory === tab.key && { color: colors.primary, fontWeight: '700' },
              ]}>
                {tab.label}
              </Text>
              {selectedCategory === tab.key && (
                <View style={styles.categoryIndicator} />
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ── 검색 바 ── */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="投稿を検索..."
            placeholderTextColor={colors.textDisabled}
            value={searchText}
            onChangeText={setSearchText}
            returnKeyType="search"
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => setSearchText('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
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
          {/* ── 검색 결과 카운트 ── */}
          {searchText.trim() !== '' && (
            <Text style={styles.searchResultCount}>
              「{searchText}」の検索結果
            </Text>
          )}

          {/* ── 게시글 없을 때 ── */}
          {posts.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>{searchText ? '🔍' : '📭'}</Text>
              <Text style={styles.emptyText}>
                {searchText ? '一致する投稿が見つかりません' : 'まだ投稿がありません'}
              </Text>
              {!searchText && (
                <Text style={styles.emptySubText}>最初の投稿者になりましょう！</Text>
              )}
            </View>
          ) : (
            <>
              {posts.map((post) => {
                const catInfo = getCategoryInfo(post.category);
                const commentCount = post.post_comments?.[0]?.count ?? 0;
                return (
                  <TouchableOpacity
                    key={post.id}
                    style={styles.postCard}
                    activeOpacity={0.7}
                    onPress={() => navigation.navigate('PostDetail', { postId: post.id })}
                  >
                    <View style={styles.postMeta}>
                      <View style={[styles.catBadge, { backgroundColor: catInfo.color + '18' }]}>
                        <Text style={[styles.catBadgeText, { color: catInfo.color }]}>{catInfo.label}</Text>
                      </View>
                      <Text style={styles.postAnon}>
                        {post.is_anonymous ? '匿名' : '実名'}
                      </Text>
                      <Text style={styles.postTime}>{formatTimeAgo(post.created_at)}</Text>
                    </View>

                    <Text style={styles.postTitle} numberOfLines={2}>{post.title}</Text>

                    {post.body ? (
                      <Text style={styles.postBody} numberOfLines={1}>{post.body}</Text>
                    ) : null}

                    <View style={styles.postFooter}>
                      <View style={styles.reactionItem}>
                        <Text style={styles.reactionIcon}>♡</Text>
                        <Text style={styles.reactionCount}>{post.like_count}</Text>
                      </View>
                      <View style={styles.reactionItem}>
                        <Text style={styles.reactionIcon}>□</Text>
                        <Text style={styles.reactionCount}>{commentCount}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}

              {/* ── 더 보기 버튼 ── */}
              {hasMore && (
                <TouchableOpacity
                  style={styles.loadMoreButton}
                  onPress={loadMore}
                  disabled={loadingMore}
                  activeOpacity={0.7}
                >
                  {loadingMore ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Text style={styles.loadMoreText}>もっと見る</Text>
                  )}
                </TouchableOpacity>
              )}
            </>
          )}

          <View style={{ height: 32 }} />
        </ScrollView>
      )}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: colors.surface,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  postButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  postButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },

  // 카테고리 탭 (가로 스크롤)
  categoryTabBar: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  categoryTabScroll: {
    paddingHorizontal: 4,
  },
  categoryTab: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    position: 'relative',
    alignItems: 'center',
  },
  categoryTabText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  categoryIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 8,
    right: 8,
    height: 2,
    backgroundColor: colors.primary,
    borderRadius: 1,
  },

  // 검색 바
  searchContainer: {
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 8,
  },
  searchIcon: {
    fontSize: 13,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
  },
  clearButton: {
    fontSize: 12,
    color: colors.textSecondary,
  },

  // 검색 결과 카운트
  searchResultCount: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 10,
  },

  // 게시글 목록
  listContent: {
    padding: 16,
  },
  postCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  postMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
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
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    lineHeight: 22,
    marginBottom: 4,
  },
  postBody: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: 12,
  },
  postFooter: {
    flexDirection: 'row',
    gap: 16,
  },
  reactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  reactionIcon: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  reactionCount: {
    fontSize: 13,
    color: colors.textSecondary,
  },

  // 더 보기 버튼
  loadMoreButton: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  loadMoreText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
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
});
