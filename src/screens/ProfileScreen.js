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
  TextInput,
  Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../constants/colors';
import { typography } from '../constants/typography';
import { spacing, radius, shadow } from '../constants/spacing';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthProvider';
import { getUniversityInfo } from '../utils/university';
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
  const { refreshProfile } = useAuth();
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
  // 닉네임 변경 모달
  const [nicknameModalVisible, setNicknameModalVisible] = useState(false);
  const [newNickname, setNewNickname]                   = useState('');
  const [savingNickname, setSavingNickname]             = useState(false);

  const fetchProfile = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setUserEmail(user.email ?? '');
      setUserId(user.id);

      // 대학 이름 추출
      setUniversityName(getUniversityInfo(user.email).name);

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
        .select('id, title, category, created_at, like_count, post_comments(count)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(6); // 5개 초과 여부 확인용으로 6개 조회
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

  // MyPosts에서 돌아왔을 때 게시글 목록만 재조회
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', async () => {
      if (!userId) return;
      const { data: posts } = await supabase
        .from('posts')
        .select('id, title, category, created_at, like_count, post_comments(count)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(6);
      setMyPosts(posts ?? []);
    });
    return unsubscribe;
  }, [navigation, userId]);

  // 닉네임 변경
  const handleNicknameEdit = () => {
    setNewNickname(nickname);
    setNicknameModalVisible(true);
  };

  const handleNicknameSave = async () => {
    const trimmed = newNickname.trim();
    if (trimmed.length < 2 || trimmed.length > 10 || /\s/.test(trimmed)) {
      Alert.alert('エラー', 'ニックネームは2〜10文字で入力してください（スペース不可）');
      return;
    }
    if (trimmed === nickname) {
      setNicknameModalVisible(false);
      return;
    }

    setSavingNickname(true);
    try {
      // 중복 확인
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('nickname', trimmed)
        .maybeSingle();

      if (existing) {
        Alert.alert('重複', `「${trimmed}」はすでに使われています`);
        return;
      }

      const { error } = await supabase
        .from('profiles')
        .update({ nickname: trimmed })
        .eq('id', userId);

      if (error) {
        Alert.alert('エラー', '変更に失敗しました');
        return;
      }

      setNickname(trimmed);
      setNicknameModalVisible(false);
      // AuthProvider 프로필 상태도 최신으로 동기화
      await refreshProfile();
    } catch {
      Alert.alert('エラー', '通信エラーが発生しました');
    } finally {
      setSavingNickname(false);
    }
  };

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

  // 탈퇴 (2단계 확인)
  const handleDeleteAccount = () => {
    Alert.alert(
      '退会する',
      '退会すると、時間割・課題・投稿などすべてのデータが削除されます。\n本当に退会しますか？',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '退会する',
          style: 'destructive',
          onPress: () => {
            // 2단계 최종 확인
            Alert.alert(
              '本当に退会しますか？',
              'この操作は取り消せません。すべてのデータが完全に削除されます。',
              [
                { text: 'キャンセル', style: 'cancel' },
                {
                  text: '退会する',
                  style: 'destructive',
                  onPress: confirmDeleteAccount,
                },
              ]
            );
          },
        },
      ]
    );
  };

  const confirmDeleteAccount = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/delete-account`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );
      const result = await res.json();

      if (!res.ok || result.error) {
        Alert.alert('エラー', '退会処理に失敗しました。しばらくしてからもう一度お試しください。');
        return;
      }

      // 계정 삭제 성공 → 세션 정리 → 자동으로 로그인 화면 이동
      await supabase.auth.signOut();
    } catch (e) {
      Alert.alert('エラー', `通信エラーが発生しました。\n${e.message}`);
    }
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
            // scope: 'local' → 서버 요청 실패해도 로컬 세션 강제 삭제
            await supabase.auth.signOut({ scope: 'local' });
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
            <Text style={styles.nickname} numberOfLines={1}>{nickname || studentId}</Text>
            <Text style={styles.university}>{universityName}</Text>
            <Text style={styles.studentId}>{studentId}</Text>
          </View>
          <TouchableOpacity style={styles.editButton} onPress={handleNicknameEdit} activeOpacity={0.7}>
            <Text style={styles.editButtonText}>編集</Text>
          </TouchableOpacity>
        </View>

        {/* ── 닉네임 변경 모달 ── */}
        <Modal
          visible={nicknameModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setNicknameModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>ニックネームを変更</Text>
              <TextInput
                style={styles.modalInput}
                value={newNickname}
                onChangeText={setNewNickname}
                autoFocus
                maxLength={10}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="2〜10文字"
                placeholderTextColor={colors.textDisabled}
              />
              <Text style={styles.modalHint}>空き時間合わせで友達があなたを検索するIDになります</Text>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalBtnCancel]}
                  onPress={() => setNicknameModalVisible(false)}
                >
                  <Text style={styles.modalBtnCancelText}>キャンセル</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalBtnSave]}
                  onPress={handleNicknameSave}
                  disabled={savingNickname}
                >
                  {savingNickname
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={styles.modalBtnSaveText}>保存</Text>
                  }
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

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
          {/* 섹션 타이틀 + 전체보기 버튼 */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>投稿した掲示物</Text>
            {myPosts.length > 0 && (
              <TouchableOpacity
                onPress={() => navigation.navigate('MyPosts')}
                activeOpacity={0.7}
              >
                <Text style={styles.seeAllText}>すべて見る ›</Text>
              </TouchableOpacity>
            )}
          </View>

          {postsLoading ? (
            <ActivityIndicator style={{ paddingVertical: 24 }} color={colors.primary} />
          ) : myPosts.length === 0 ? (
            <View style={styles.emptyPostsCard}>
              <Text style={styles.emptyPostsEmoji}>📝</Text>
              <Text style={styles.emptyPostsText}>まだ投稿した記事がありません</Text>
            </View>
          ) : (
            <View style={styles.postListCard}>
              {myPosts.slice(0, 5).map((post, idx) => {
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
                          {(post.post_comments?.[0]?.count ?? 0) > 0 && `  💬 ${post.post_comments[0].count}`}
                        </Text>
                      </View>

                      <Text style={styles.chevron}>›</Text>
                    </TouchableOpacity>
                  </React.Fragment>
                );
              })}
              {/* 5개 초과 시 전체보기 행 */}
              {myPosts.length > 5 && (
                <>
                  <View style={styles.divider} />
                  <TouchableOpacity
                    style={styles.seeAllRow}
                    onPress={() => navigation.navigate('MyPosts')}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.seeAllRowText}>投稿をすべて見る</Text>
                    <Text style={styles.chevron}>›</Text>
                  </TouchableOpacity>
                </>
              )}
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

        {/* ── 개인정보처리방침 + 탈퇴 ── */}
        <View style={styles.footerLinks}>
          <TouchableOpacity
            onPress={() => navigation.navigate('PrivacyPolicy')}
            activeOpacity={0.7}
          >
            <Text style={styles.footerLinkText}>プライバシーポリシー</Text>
          </TouchableOpacity>
          <Text style={styles.footerDivider}>|</Text>
          <TouchableOpacity onPress={handleDeleteAccount} activeOpacity={0.7}>
            <Text style={styles.deleteAccountText}>退会する</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 100 }} />
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
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },

  // 페이지 헤더 (회색 배경 위에 바로)
  pageHeader: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    marginBottom: spacing.xs,
  },
  pageTitle: {
    ...typography.title2,
    color: colors.textPrimary,
  },

  // 프로필 카드 (흰색 카드)
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
    borderRadius: radius.lg,
    gap: spacing.lg,
    ...shadow.card,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...typography.title2,
    fontWeight: '800',
    color: colors.primary,
  },
  profileInfo: {
    flex: 1,
  },
  nickname: {
    ...typography.subtitle,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 3,
  },
  editButton: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
  },
  editButtonText: {
    ...typography.body2,
    fontWeight: '700',
    color: colors.primary,
  },
  university: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  studentId: {
    ...typography.small,
    fontWeight: '400',
    color: colors.textDisabled,
  },

  // 섹션
  section: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    paddingLeft: spacing.xs,
  },
  sectionTitle: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  seeAllText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
  seeAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 1,
  },
  seeAllRowText: {
    ...typography.body2,
    color: colors.primary,
    fontWeight: '600',
  },

  // 정보 카드
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    ...shadow.card,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md + 2,
  },
  infoLabel: {
    ...typography.body2,
    color: colors.textSecondary,
  },
  infoValue: {
    ...typography.body2,
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
    borderRadius: radius.lg,
    paddingVertical: spacing.xxxl,
    alignItems: 'center',
    ...shadow.card,
  },
  emptyPostsEmoji: {
    fontSize: 32,
    marginBottom: spacing.sm,
  },
  emptyPostsText: {
    ...typography.body2,
    color: colors.textDisabled,
  },
  postListCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadow.card,
  },
  postRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm + 2,
  },
  categoryBadge: {
    borderRadius: radius.sm - 2,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    minWidth: 36,
    alignItems: 'center',
  },
  categoryText: {
    ...typography.small,
    fontWeight: '700',
  },
  postContent: {
    flex: 1,
  },
  postTitle: {
    ...typography.body2,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  postMeta: {
    ...typography.small,
    fontWeight: '400',
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
    paddingVertical: spacing.md + 2,
    gap: spacing.md,
  },
  toggleInfo: {
    flex: 1,
  },
  toggleLabel: {
    ...typography.body2,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 3,
  },
  toggleHint: {
    ...typography.small,
    fontWeight: '400',
    color: colors.textDisabled,
  },

  // 표시 설정
  settingLabel: {
    ...typography.body2,
    fontWeight: '600',
    color: colors.textPrimary,
    paddingTop: spacing.md + 2,
    marginBottom: spacing.md,
  },
  colorRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.sm + 2,
  },
  colorCircle: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorCircleSelected: {
    borderWidth: 3,
    borderColor: colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  colorCheck: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '800',
  },
  settingHint: {
    ...typography.small,
    fontWeight: '400',
    color: colors.textDisabled,
    paddingBottom: spacing.md + 2,
  },

  // 닉네임 변경 모달
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxl,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xxl,
    width: '100%',
    maxWidth: 360,
  },
  modalTitle: {
    ...typography.subtitle,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  modalInput: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.md + 2,
    ...typography.body2,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  modalHint: {
    ...typography.small,
    fontWeight: '400',
    color: colors.textDisabled,
    marginBottom: spacing.xl,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.sm + 2,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: spacing.md + 2,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  modalBtnCancel: {
    backgroundColor: colors.background,
  },
  modalBtnCancelText: {
    ...typography.body2,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  modalBtnSave: {
    backgroundColor: colors.primary,
  },
  modalBtnSaveText: {
    ...typography.body2,
    fontWeight: '700',
    color: colors.white,
  },

  // 로그아웃 버튼
  logoutButton: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.danger + '60',
  },
  logoutText: {
    ...typography.body1,
    fontWeight: '600',
    color: colors.danger,
  },

  // 개인정보처리방침 + 탈퇴 링크
  footerLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.xs,
    paddingVertical: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerLinkText: {
    ...typography.caption,
    color: colors.textSecondary,
    textDecorationLine: 'underline',
  },
  footerDivider: {
    ...typography.small,
    fontWeight: '400',
    color: colors.textDisabled,
  },
  deleteAccountText: {
    ...typography.caption,
    color: colors.textSecondary,
    textDecorationLine: 'underline',
  },
});
