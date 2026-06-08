import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from 'react-native';
import { colors } from '../../constants/colors';
import { spacing, radius, shadow } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { BOARD_CATEGORIES, getCategoryInfo } from '../../constants/boardCategories';
import { supabase } from '../../lib/supabase';
import { formatTimeAgo } from '../../utils/community';
import { getUniversityInfo } from '../../utils/university';

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
  const [universityName, setUniversityName] = useState('');

  // 로그인 유저의 대학 이름 가져오기
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user?.email) return;
      setUniversityName(getUniversityInfo(user.email).name);
    });
  }, []);
  // pageRef: 현재 로드된 페이지 (0부터 시작). 렌더링 트리거 없이 관리
  const pageRef = useRef(0);

  // Supabase에서 게시글 불러오기
  // reset=true면 처음부터 다시 로드 (카테고리/검색 변경, 새로고침)
  const fetchPosts = useCallback(async ({ reset = false } = {}) => {
    if (!universityName) return;

    if (reset) {
      pageRef.current = 0;
    }

    const from = pageRef.current * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    if (reset) setLoading(true);
    else setLoadingMore(true);

    let query = supabase
      .from('posts')
      .select('*, post_comments(count)')
      .eq('university', universityName)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (selectedCategory !== 'all') {
      query = query.eq('category', selectedCategory);
    }

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
  }, [selectedCategory, searchText, universityName]);

  useEffect(() => {
    fetchPosts({ reset: true });
  }, [selectedCategory, searchText, universityName]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => fetchPosts({ reset: true }));
    return unsubscribe;
  }, [navigation, fetchPosts]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPosts({ reset: true });
  }, [fetchPosts]);

  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore) {
      fetchPosts({ reset: false });
    }
  }, [fetchPosts, loadingMore, hasMore]);

  return (
    <SafeAreaView style={styles.container}>

      {/* ── 헤더 ── */}
      <View style={styles.header}>
        <View>
          {!!universityName && <Text style={styles.headerSubtitle}>{universityName}</Text>}
          <Text style={styles.headerTitle}>掲示板</Text>
        </View>
        <TouchableOpacity
          style={styles.postButton}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('PostCreate')}
        >
          <Text style={styles.postButtonText}>＋ 投稿</Text>
        </TouchableOpacity>
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

      {/* ── 카테고리 칩 (가로 스크롤) ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipScroll}
        style={styles.chipBar}
      >
        {ALL_TABS.map((tab) => {
          const active = selectedCategory === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setSelectedCategory(tab.key)}
              activeOpacity={0.75}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── 로딩 중 ── */}
      {loading ? (
        <ActivityIndicator style={{ flex: 1 }} size="large" color={colors.primary} />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          // 화면에 보이는 카드만 렌더(가상화) — 글이 쌓여도 스크롤 끊김 방지
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={11}
          removeClippedSubviews
          // 검색 중일 때만 결과 안내 텍스트를 리스트 상단에 표시
          ListHeaderComponent={
            searchText.trim() !== '' ? (
              <Text style={styles.searchResultCount}>
                「{searchText}」の検索結果
              </Text>
            ) : null
          }
          // 글이 하나도 없을 때 빈 상태 화면
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>{searchText ? '🔍' : '📭'}</Text>
              <Text style={styles.emptyText}>
                {searchText ? '一致する投稿が見つかりません' : 'まだ投稿がないみたい'}
              </Text>
              {!searchText && (
                <Text style={styles.emptySubText}>最初の投稿者になってみよう！</Text>
              )}
            </View>
          }
          // 더보기 버튼 + 하단 여백 (탭바 가림 방지)
          ListFooterComponent={
            <>
              {hasMore && posts.length > 0 && (
                <TouchableOpacity
                  style={styles.loadMoreButton}
                  onPress={loadMore}
                  disabled={loadingMore}
                  activeOpacity={0.8}
                >
                  {loadingMore ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Text style={styles.loadMoreText}>もっと見る</Text>
                  )}
                </TouchableOpacity>
              )}
              <View style={{ height: spacing.xxxl }} />
            </>
          }
          renderItem={({ item: post }) => {
            const catInfo = getCategoryInfo(post.category);
            const commentCount = post.post_comments?.[0]?.count ?? 0;
            const hasImage = post.image_urls?.length > 0;
            return (
              <TouchableOpacity
                style={styles.postCard}
                activeOpacity={0.85}
                onPress={() => navigation.navigate('PostDetail', { postId: post.id })}
              >
                <View style={styles.postRow}>
                  <View style={styles.postTextArea}>
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
                        <Text style={styles.reactionIcon}>💬</Text>
                        <Text style={styles.reactionCount}>{commentCount}</Text>
                      </View>
                    </View>
                  </View>

                  {hasImage && (
                    <View style={styles.thumbnailWrapper}>
                      <Image
                        source={{ uri: post.image_urls[0] }}
                        style={styles.thumbnail}
                      />
                      {post.image_urls.length > 1 && (
                        <View style={styles.thumbnailBadge}>
                          <Text style={styles.thumbnailBadgeText}>+{post.image_urls.length - 1}</Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
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
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    backgroundColor: colors.background,
  },
  headerSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  headerTitle: {
    ...typography.title2,
    color: colors.textPrimary,
  },
  postButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  postButtonText: {
    color: colors.white,
    ...typography.captionStrong,
  },

  // ── 검색 바 ──────────────────────────────────
  searchContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    gap: spacing.sm,
    ...shadow.soft,
  },
  searchIcon: {
    fontSize: 13,
  },
  searchInput: {
    flex: 1,
    ...typography.body2,
    color: colors.textPrimary,
    padding: 0,
  },
  clearButton: {
    fontSize: 12,
    color: colors.textSecondary,
  },

  // ── 카테고리 칩 ───────────────────────────────
  chipBar: {
    flexGrow: 0,
    marginBottom: spacing.sm,
  },
  chipScroll: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  chipActive: {
    backgroundColor: colors.gray900,
  },
  chipText: {
    ...typography.captionStrong,
    lineHeight: 22,
    textAlign: 'center',
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.white,
  },

  // ── 검색 결과 카운트 ──────────────────────────
  searchResultCount: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    paddingLeft: spacing.xs,
  },

  // ── 게시글 목록 ───────────────────────────────
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: 100,
  },
  postCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    ...shadow.card,
  },
  postRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  postTextArea: {
    flex: 1,
  },
  postMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
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
    ...typography.subtitle,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  postBody: {
    ...typography.body2,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  postFooter: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  reactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  reactionIcon: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  reactionCount: {
    ...typography.caption,
    color: colors.textSecondary,
  },

  // ── 썸네일 ────────────────────────────────────
  thumbnailWrapper: {
    width: 76,
    height: 76,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.gray100,
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  thumbnailBadge: {
    position: 'absolute',
    right: spacing.xs,
    bottom: spacing.xs,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  thumbnailBadgeText: {
    color: colors.white,
    ...typography.micro,
  },

  // ── 더 보기 버튼 ──────────────────────────────
  loadMoreButton: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.xs,
    ...shadow.soft,
  },
  loadMoreText: {
    ...typography.bodyStrong,
    color: colors.primary,
  },

  // ── 빈 상태 ───────────────────────────────────
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
    marginBottom: spacing.xs,
  },
  emptySubText: {
    ...typography.body2,
    color: colors.textSecondary,
  },
});
