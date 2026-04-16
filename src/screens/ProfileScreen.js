import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  Switch,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../constants/colors';
import { supabase } from '../lib/supabase';
import { universities } from '../constants/universities';
import { getCategoryInfo } from '../constants/boardCategories';
import { formatTimeAgo } from '../utils/community';

// 요일 강조 색상 선택지
const HIGHLIGHT_COLORS = [
  { label: 'ブルー',   value: '#3182F6' },
  { label: 'グリーン', value: '#05C072' },
  { label: 'パープル', value: '#A855F7' },
  { label: 'オレンジ', value: '#F97316' },
  { label: 'レッド',   value: '#EF4444' },
];

export const TODAY_COLOR_KEY = 'unipas_today_highlight_color';

export default function ProfileScreen({ navigation }) {
  const [userEmail, setUserEmail]           = useState('');
  const [nickname, setNickname]             = useState('');
  const [universityName, setUniversityName] = useState('');
  const [loading, setLoading]               = useState(true);
  const [loggingOut, setLoggingOut]         = useState(false);
  const [todayColor, setTodayColor]         = useState(HIGHLIGHT_COLORS[0].value);
  const [myPosts, setMyPosts]               = useState([]);
  const [postsLoading, setPostsLoading]     = useState(false);
  const [shareTimetable, setShareTimetable] = useState(false); // 공강맞추기 공개 여부
  const [userId, setUserId]                 = useState(null);

  const fetchProfile = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setUserEmail(user.email ?? '');
      setUserId(user.id);

      // 대학 이름 추출 (이메일 도메인에서)
      const domainPart = user.email?.split('@')?.[1]?.split('.')?.[0] ?? '';
      const uni = universities.find(u => u.id === domainPart) ?? universities[0];
      setUniversityName(uni.name);

      // 닉네임 + 공강 공유 설정 조회
      const { data: profile } = await supabase
        .from('profiles')
        .select('nickname, share_timetable')
        .eq('id', user.id)
        .maybeSingle();
      setNickname(profile?.nickname ?? '');
      setShareTimetable(profile?.share_timetable ?? false);

      // 저장된 오늘 강조 색상 불러오기
      const saved = await AsyncStorage.getItem(TODAY_COLOR_KEY);
      if (saved) setTodayColor(saved);

      // 내가 올린 게시글 불러오기
      setPostsLoading(true);
      const { data: posts } = await supabase
        .from('posts')
        .select('id, title, category, created_at, like_count, comment_count')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);
      setMyPosts(posts ?? []);
    } catch {
      // 조용히 실패
    } finally {
      setLoading(false);
      setPostsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // 공강맞추기 공개 여부 토글
  const handleShareTimetableToggle = async (value) => {
    if (!userId) return;
    setShareTimetable(value);
    await supabase
      .from('profiles')
      .update({ share_timetable: value })
      .eq('id', userId);
  };

  // 오늘 강조 색상 변경
  const handleColorChange = async (colorValue) => {
    setTodayColor(colorValue);
    await AsyncStorage.setItem(TODAY_COLOR_KEY, colorValue);
  };

  // 로그아웃
  const handleLogout = () => {
    Alert.alert(
      'ログアウト',
      'ログアウトしますか？',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: 'ログアウト',
          style: 'destructive',
          onPress: async () => {
            setLoggingOut(true);
            await supabase.auth.signOut();
            // AppNavigator가 session=null 감지 후 AuthStack으로 자동 이동
          },
        },
      ]
    );
  };

  // 게시글 탭 → 게시글 상세로 이동
  const handlePostPress = (post) => {
    navigation.navigate('Community', {
      screen: 'PostDetail',
      params: { postId: post.id },
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator style={{ flex: 1 }} size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  // 이메일에서 학적번호 추출 (@ 앞부분)
  const studentId = userEmail.split('@')[0]?.toUpperCase() ?? '';
  const avatarLetter = studentId[0] ?? 'U';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* ── 헤더 ── */}
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>マイページ</Text>
        </View>

        {/* ── 프로필 카드 ── */}
        <View style={styles.profileCard}>
          <View style={[styles.avatar, { backgroundColor: colors.primaryLight }]}>
            <Text style={styles.avatarText}>{avatarLetter}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.nickname}>{nickname || studentId}</Text>
            <Text style={styles.university}>{universityName}</Text>
            <Text style={styles.studentId}>{studentId}</Text>
          </View>
        </View>

        {/* ── 계정 정보 ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>アカウント情報</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>大学</Text>
              <Text style={styles.infoValue}>{universityName}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>学籍番号</Text>
              <Text style={styles.infoValue}>{studentId}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>メールアドレス</Text>
              <Text style={styles.infoValue} numberOfLines={1}>{userEmail}</Text>
            </View>
          </View>
        </View>

        {/* ── 내가 올린 게시글 ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>投稿した掲示物</Text>

          {postsLoading ? (
            <ActivityIndicator style={{ paddingVertical: 24 }} color={colors.primary} />
          ) : myPosts.length === 0 ? (
            <View style={styles.emptyPostsCard}>
              <Text style={styles.emptyPostsEmoji}>📝</Text>
              <Text style={styles.emptyPostsText}>まだ投稿した記事がありません</Text>
            </View>
          ) : (
            <View style={styles.postListCard}>
              {myPosts.map((post, idx) => {
                const cat = getCategoryInfo(post.category);
                return (
                  <React.Fragment key={post.id}>
                    {idx > 0 && <View style={styles.divider} />}
                    <TouchableOpacity
                      style={styles.postRow}
                      onPress={() => handlePostPress(post)}
                      activeOpacity={0.75}
                    >
                      {/* 카테고리 배지 */}
                      <View style={[styles.categoryBadge, { backgroundColor: cat.color + '22' }]}>
                        <Text style={[styles.categoryText, { color: cat.color }]}>{cat.label}</Text>
                      </View>

                      {/* 제목 + 날짜 */}
                      <View style={styles.postContent}>
                        <Text style={styles.postTitle} numberOfLines={1}>{post.title}</Text>
                        <Text style={styles.postMeta}>
                          {formatTimeAgo(post.created_at)}
                          {post.like_count > 0 && `  ♡ ${post.like_count}`}
                          {post.comment_count > 0 && `  💬 ${post.comment_count}`}
                        </Text>
                      </View>

                      <Text style={styles.chevron}>›</Text>
                    </TouchableOpacity>
                  </React.Fragment>
                );
              })}
            </View>
          )}
        </View>

        {/* ── 공강맞추기 공유 설정 ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>空き時間合わせ設定</Text>
          <View style={styles.infoCard}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleInfo}>
                <Text style={styles.toggleLabel}>時間割を公開する</Text>
                <Text style={styles.toggleHint}>
                  ONにすると、友達があなたの空き時間を確認できます
                </Text>
              </View>
              <Switch
                value={shareTimetable}
                onValueChange={handleShareTimetableToggle}
                trackColor={{ false: colors.border, true: colors.primary + '80' }}
                thumbColor={shareTimetable ? colors.primary : colors.textDisabled}
              />
            </View>
          </View>
        </View>

        {/* ── 표시 설정 — 오늘 요일 강조 색상 ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>表示設定</Text>
          <View style={styles.infoCard}>
            <Text style={styles.settingLabel}>今日の曜日ハイライト色</Text>
            <View style={styles.colorRow}>
              {HIGHLIGHT_COLORS.map((c) => (
                <TouchableOpacity
                  key={c.value}
                  style={[
                    styles.colorCircle,
                    { backgroundColor: c.value },
                    todayColor === c.value && styles.colorCircleSelected,
                  ]}
                  onPress={() => handleColorChange(c.value)}
                  activeOpacity={0.8}
                >
                  {todayColor === c.value && (
                    <Text style={styles.colorCheck}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.settingHint}>時間割の今日の曜日列に反映されます</Text>
          </View>
        </View>

        {/* ── 로그아웃 ── */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
            disabled={loggingOut}
            activeOpacity={0.8}
          >
            {loggingOut
              ? <ActivityIndicator color={colors.danger} />
              : <Text style={styles.logoutText}>ログアウト</Text>
            }
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingBottom: 24,
  },

  // 페이지 헤더
  pageHeader: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: colors.surface,
    marginBottom: 8,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  // 프로필 카드
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginBottom: 8,
    gap: 16,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.primary,
  },
  profileInfo: {
    flex: 1,
  },
  nickname: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 3,
  },
  university: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  studentId: {
    fontSize: 12,
    color: colors.textDisabled,
  },

  // 섹션
  section: {
    marginHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
    paddingLeft: 4,
  },

  // 정보 카드
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  infoLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    maxWidth: '60%',
    textAlign: 'right',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },

  // 게시글 목록
  emptyPostsCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyPostsEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  emptyPostsText: {
    fontSize: 14,
    color: colors.textDisabled,
  },
  postListCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
  },
  postRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  categoryBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    minWidth: 36,
    alignItems: 'center',
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '700',
  },
  postContent: {
    flex: 1,
  },
  postTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  postMeta: {
    fontSize: 11,
    color: colors.textDisabled,
  },
  chevron: {
    fontSize: 18,
    color: colors.textDisabled,
    lineHeight: 22,
  },

  // 공강 공유 토글
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
  },
  toggleInfo: {
    flex: 1,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 3,
  },
  toggleHint: {
    fontSize: 12,
    color: colors.textDisabled,
    lineHeight: 16,
  },

  // 표시 설정
  settingLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    paddingTop: 14,
    marginBottom: 12,
  },
  colorRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
  },
  colorCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorCircleSelected: {
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  colorCheck: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  settingHint: {
    fontSize: 11,
    color: colors.textDisabled,
    paddingBottom: 14,
  },

  // 로그아웃 버튼
  logoutButton: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.danger + '60',
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.danger,
  },
});
