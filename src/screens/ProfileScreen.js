import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
  TextInput,
  Modal,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppTextInput from '../components/AppTextInput';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import LoadingDots from '../components/LoadingDots';
import { typography } from '../constants/typography';
import { spacing, radius, shadow } from '../constants/spacing';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthProvider';
import { getUniversityInfo, findUniversityByEmail, getUniversityLinks } from '../utils/university';
import { supportsManaba, manabaUrlsFor, manabaOriginFrom } from '../constants/manaba';
import { clearCachedNotices } from '../utils/manabaCache';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearAllSchoolSites } from '../utils/schoolLogout';
import { useConfirm } from '../hooks/useConfirm';
import HomeDisplaySheet from '../components/HomeDisplaySheet';
import { readLoginFailures, getFailureCopy } from '../utils/loginDiagnostics';
import { getCategoryInfo } from '../constants/boardCategories';
import { getAppVersionLabel } from '../utils/appVersion';
import { formatTimeAgo } from '../utils/community';
import { useTabBarScroll } from '../navigation/TabBarScrollContext';

// 네이티브 버전은 앱 실행 중 바뀌지 않으므로 모듈 로드 시 1회만 읽는다
const APP_VERSION_LABEL = getAppVersionLabel();

export default function ProfileScreen({ navigation }) {
  const { confirm, confirmElement } = useConfirm();
  const [homeDisplayVisible, setHomeDisplayVisible] = useState(false);
  const { refreshProfile } = useAuth();
  const { handleScroll } = useTabBarScroll();
  const [userEmail, setUserEmail]           = useState('');
  const [nickname, setNickname]             = useState('');
  const [universityName, setUniversityName] = useState('');
  // 내 학교가 manaba를 쓰는가 — manaba 관련 메뉴 노출 여부를 가른다.
  // ⚠️ getUniversityInfo는 모르는 도메인을 국사관으로 폴백하므로 여기선 쓰면 안 된다.
  // 내 학교의 링크 모음 (로그인 정보 리셋 대상 호스트를 고르는 데도 쓴다)
  const links = getUniversityLinks(findUniversityByEmail(userEmail)?.id) ?? {};
  const usesManaba = supportsManaba(links.manabaUrl);
  const [loading, setLoading]               = useState(true);
  const [loggingOut, setLoggingOut]         = useState(false);
  const [myPosts, setMyPosts]               = useState([]);
  const [postsLoading, setPostsLoading]     = useState(false);
  const [shareTimetable, setShareTimetable] = useState(false); // 공강맞추기 공개 여부
  const [deadlineReminder, setDeadlineReminder] = useState(true); // 締切が近づいたら通知 (기본 ON)
  const [userId, setUserId]                 = useState(null);
  // 닉네임 변경 모달
  const [nicknameModalVisible, setNicknameModalVisible] = useState(false);
  const [newNickname, setNewNickname]                   = useState('');
  const [savingNickname, setSavingNickname]             = useState(false);
  // manaba 통지 메일전달 상태: 'none'(미설정) | 'pending'(주소발급, 전달대기) | 'verified'(전달확인)
  const [forwardStatus, setForwardStatus] = useState('none');
  const [testPushSending, setTestPushSending] = useState(false);
  // 「通知にAI要約を表示」 — 켜면 manaba 통지 본문을 AI 가 요약해 푸시에 넣는다 (서버 mail_subscriptions.ai_summary_push)
  const [aiSummaryPush, setAiSummaryPush] = useState(false);
  // 「課題を自動で追加」 — manaba 課題 메일이 오면 서버가 課題에 넣는다 (기본 ON, mail_subscriptions.auto_assignment)
  const [autoAssignment, setAutoAssignment] = useState(true);
  const [autoAssignmentSaving, setAutoAssignmentSaving] = useState(false);
  const [aiSummarySaving, setAiSummarySaving] = useState(false);
  // 최근 학교 사이트 접속 실패 기록 (④ 재현 어려운 로그인 문제 추적용)
  const [loginFailures, setLoginFailures] = useState([]);
  // 푸시 수신 상태(안전망 정보): 최근 받은 통지 시각 + 최근 7일 미달 건수
  const [lastDelivered, setLastDelivered] = useState(null);
  const [recentFailed, setRecentFailed]   = useState(0);

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
        .select('nickname, share_timetable, deadline_reminder')
        .eq('id', user.id)
        .maybeSingle();
      setNickname(profile?.nickname ?? '');
      setShareTimetable(profile?.share_timetable ?? false);
      setDeadlineReminder(profile?.deadline_reminder !== false);

      // 내가 올린 게시글 불러오기
      setPostsLoading(true);
      const { data: posts } = await supabase
        .from('posts_v') // 가린 창구 (보안 A1)
        .select('id, title, category, created_at, like_count, post_comments(count)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(4); // 3개 초과 여부 확인용으로 4개 조회
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

  // manaba 메일전달 설정 상태 조회 (전달주소 발급 여부 + 전달 확인 여부)
  const fetchForwardStatus = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from('mail_subscriptions')
      .select('verified_at, ai_summary_push, auto_assignment')
      .eq('user_id', userId)
      .maybeSingle();
    if (!data) setForwardStatus('none');
    else setForwardStatus(data.verified_at ? 'verified' : 'pending');
    setAiSummaryPush(!!data?.ai_summary_push);
    setAutoAssignment(data?.auto_assignment !== false);
  }, [userId]);

  useEffect(() => {
    fetchForwardStatus();
  }, [fetchForwardStatus]);

  // 최근 접속 실패 기록 읽기 (기기 안에만 저장된 값)
  useEffect(() => {
    readLoginFailures(AsyncStorage).then(setLoginFailures).catch(() => {});
  }, []);

  // 학교 로그인 정보 초기화 — 쿠키가 만료·오염된 채로 굳어 로그인이 계속 실패할 때의 탈출구.
  // 저장된 ID/PW와 쿠키를 모두 비우고 처음부터 다시 로그인하게 한다.
  const handleResetSchoolLogin = useCallback(() => {
    confirm({
      kind: 'danger',
      icon: 'refresh-outline',
      title: '学校ログイン情報をリセットしますか？',
      message: '保存されたIDとパスワード、ログイン状態を削除します。次回は改めてログインが必要になります。',
      confirmText: 'リセット',
      onConfirm: async () => {
        // 이 학교에서 쓰는 모든 로그인 호스트를 대상으로 정리한다
        await clearAllSchoolSites(links);
        await clearCachedNotices();
        Alert.alert('完了', 'ログイン情報を削除しました。\nもう一度ログインしてお試しください。');
      },
    });
  }, [links, confirm]);

  // 테스트 통지 발송 — 서버가 호출자 본인에게만 보낸다(userId를 보내지 않는다)
  const handleSendTestPush = useCallback(async () => {
    setTestPushSending(true);
    try {
      const { error } = await supabase.functions.invoke('send-test-push', {
        body: { scenario: 'normal' },
      });
      if (error) throw error;
      Alert.alert(
        'テスト通知を送信しました',
        '数秒以内に届かない場合は、端末の通知設定をご確認ください。',
      );
    } catch {
      Alert.alert(
        '送信できませんでした',
        '通知の準備がまだ完了していない可能性があります。manaba通知設定をご確認ください。',
      );
    } finally {
      setTestPushSending(false);
    }
  }, []);

  // 「通知にAI要約を表示」 저장 (서버 함수 set_ai_summary_push — 본인 행만 바뀐다)
  const saveAiSummaryPush = useCallback(async (enabled) => {
    setAiSummarySaving(true);
    setAiSummaryPush(enabled); // 먼저 반영, 실패하면 되돌림
    const { data, error } = await supabase.rpc('set_ai_summary_push', { enabled });
    setAiSummarySaving(false);
    if (error || data === null) {
      setAiSummaryPush(!enabled);
      Alert.alert('保存できませんでした', 'しばらくしてからもう一度お試しください。');
    }
  }, []);

  // 「課題を自動で追加」 저장 (서버 함수 set_auto_assignment — 본인 행만). 외부 전송이 없어 동의 확인은 없다
  const handleAutoAssignmentToggle = useCallback(async (enabled) => {
    setAutoAssignmentSaving(true);
    setAutoAssignment(enabled); // 먼저 반영, 실패하면 되돌림
    const { data, error } = await supabase.rpc('set_auto_assignment', { enabled });
    setAutoAssignmentSaving(false);
    if (error || data === null) {
      setAutoAssignment(!enabled);
      Alert.alert('保存できませんでした', 'しばらくしてからもう一度お試しください。');
    }
  }, []);

  // 켤 때는 해외(미국) AI 로 보낸다는 사실을 알리고 동의를 받는다 (끌 때는 바로)
  const handleAiSummaryToggle = useCallback((next) => {
    if (!next) {
      saveAiSummaryPush(false);
      return;
    }
    Alert.alert(
      '通知にAI要約を表示しますか？',
      '新しいお知らせが届くたびに、本文をAI（Anthropic社・米国）に送信して3〜4行に要約し、通知に表示します。\n\n' +
        '・要約はお知らせと一緒に保存され、アプリでもすぐ見られます\n' +
        '・送信した内容はAIの学習には使われません\n' +
        '・この設定はいつでもオフにできます',
      [
        { text: 'キャンセル', style: 'cancel' },
        { text: '同意してオンにする', onPress: () => saveAiSummaryPush(true) },
      ],
    );
  }, [saveAiSummaryPush]);

  // 푸시 수신 상태 조회 (최신 delivered 시각 + 최근 7일 dead/permanent_fail 건수)
  const fetchPushStatus = useCallback(async () => {
    if (!userId) return;
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: delivered } = await supabase
      .from('push_delivery_logs')
      .select('created_at')
      .eq('user_id', userId)
      .eq('status', 'delivered')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setLastDelivered(delivered?.created_at ?? null);

    const { count } = await supabase
      .from('push_delivery_logs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .in('status', ['dead', 'permanent_fail'])
      .gt('created_at', sevenDaysAgo);
    setRecentFailed(count ?? 0);
  }, [userId]);

  useEffect(() => {
    fetchPushStatus();
  }, [fetchPushStatus]);

  // MyPosts에서 돌아왔을 때 게시글 목록만 재조회
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', async () => {
      if (!userId) return;
      fetchForwardStatus();
      fetchPushStatus();
      const { data: posts } = await supabase
        .from('posts_v') // 가린 창구 (보안 A1)
        .select('id, title, category, created_at, like_count, post_comments(count)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(4);
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
  // 「締切が近づいたら通知」 — 매일 18:00 서버가 未提出 課題를 마감 3일 전·전날에 알린다 (profiles.deadline_reminder)
  const handleDeadlineReminderToggle = async (value) => {
    if (!userId) return;
    setDeadlineReminder(value); // 먼저 반영, 실패하면 되돌림
    const { error } = await supabase
      .from('profiles')
      .update({ deadline_reminder: value })
      .eq('id', userId);
    if (error) {
      setDeadlineReminder(!value);
      Alert.alert('保存できませんでした', 'しばらくしてからもう一度お試しください。');
    }
  };

  const handleShareTimetableToggle = async (value) => {
    if (!userId) return;
    setShareTimetable(value);
    await supabase
      .from('profiles')
      .update({ share_timetable: value })
      .eq('id', userId);
  };

  // 탈퇴 — 체크해야 버튼이 켜진다
  const handleDeleteAccount = () => {
    confirm({
      kind: 'all',
      title: '退会しますか？',
      message: '時間割・課題・投稿など、すべてのデータが完全に削除されます。',
      checkText: 'すべてのデータが消え、元に戻せないことを理解しました',
      confirmText: '退会する',
      onConfirm: confirmDeleteAccount,
    });
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

      // 계정 삭제 성공 → manaba 캐시 정리(다른 계정에 옛 공지 섞임 방지) → 세션 정리 → 로그인 화면 이동
      await clearAllSchoolSites(links);
      await clearCachedNotices();
      await supabase.auth.signOut();
    } catch (e) {
      Alert.alert('エラー', `通信エラーが発生しました。\n${e.message}`);
    }
  };

  // 로그아웃
  const handleLogout = () => {
    confirm({
      kind: 'danger',
      icon: 'log-out-outline',
      title: 'UniOneからログアウトしますか？',
      message: 'ログアウトすると、この端末に保存されている学校サイトのID・パスワードとログイン状態も削除されます。時間割や投稿は消えません。',
      confirmText: 'ログアウト',
      onConfirm: async () => {
        setLoggingOut(true);
        // 학교 사이트 로그인까지 지운다 → 같은 폰에서 다른 사람이 로그인해도 앞 사람의 manaba 가 열리지 않게
        await clearAllSchoolSites(links);
        // manaba 공지 캐시 정리 → 다른 계정으로 로그인해도 옛 공지가 홈에 남지 않게
        await clearCachedNotices();
        // scope: 'local' → 서버 요청 실패해도 로컬 세션 강제 삭제
        await supabase.auth.signOut({ scope: 'local' });
      },
    });
  };

  // 게시글 탭 → 게시글 상세로 이동
  // 마이페이지 스택 안에서 열어야 뒤로가기가 게시판이 아닌 마이페이지로 돌아간다.
  const handlePostPress = (post) => {
    navigation.navigate('PostDetail', { postId: post.id });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <LoadingDots fullscreen />
      </SafeAreaView>
    );
  }

  // 이메일에서 학적번호 추출 (@ 앞부분)
  // Apple 심사용 데모 계정은 로그인 이메일이 appreview@... 라 학적번호가 APPREVIEW로 보인다.
  // 스토어 스크린샷에서 자연스럽게 보이도록 데모 계정에 한해 표시용 값으로 대체한다.
  // (demo-login 함수/auth 자격증명에는 전혀 영향 없음 — 화면 표시만 바꿈)
  const DEMO_EMAIL = 'appreview@kokushikan.ac.jp';
  const displayEmail = userEmail === DEMO_EMAIL ? 's2433015@kokushikan.ac.jp' : userEmail;
  const studentId = displayEmail.split('@')[0]?.toUpperCase() ?? '';
  const avatarLetter = studentId[0] ?? 'U';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} onScroll={handleScroll} scrollEventThrottle={16} contentContainerStyle={styles.scrollContent}>

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
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior="padding"
          >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>ニックネームを変更</Text>
              <AppTextInput
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
                    ? <LoadingDots size={6} color="#FFFFFF" />
                    : <Text style={styles.modalBtnSaveText}>保存</Text>
                  }
                </TouchableOpacity>
              </View>
            </View>
          </View>
          </KeyboardAvoidingView>
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
              <Text style={styles.infoValue} numberOfLines={1}>{displayEmail}</Text>
            </View>
          </View>
        </View>

        {/* ── 내 글 ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>自分の投稿</Text>
          <View style={styles.infoCard}>
            {/* #12: 게시글 수와 무관하게 항상 진입 가능 — 여기서 掲示板·コメント·講義評価를
                한곳에서 관리한다(적은 게시글이어도 講義評価 탭에 접근되게 함) */}
            <TouchableOpacity onPress={() => navigation.navigate('MyPosts')} activeOpacity={0.8}>
              <View style={styles.toggleRow}>
                <View style={styles.toggleInfo}>
                  <Text style={styles.toggleLabel}>投稿・講義評価</Text>
                  <Text style={styles.toggleHint}>自分の投稿・コメント・評価を確認できます</Text>
                </View>
                <Text style={styles.menuArrow}>›</Text>
              </View>
            </TouchableOpacity>
            {postsLoading ? (
              <LoadingDots size={7} style={{ paddingVertical: spacing.md }} />
            ) : myPosts.length === 0 ? (
              null
            ) : (
              <View>
                {myPosts.slice(0, 3).map((post) => {
                  const cat = getCategoryInfo(post.category);
                  return (
                    <React.Fragment key={post.id}>
                      <View style={styles.divider} />
                      <TouchableOpacity
                        style={styles.postRow}
                        onPress={() => handlePostPress(post)}
                        activeOpacity={0.75}
                      >
                        {/* 카테고리 배지 */}
                        <View style={[styles.categoryBadge, { backgroundColor: cat.color + '22' }]}>
                          <Text style={[styles.categoryText, { color: cat.textColor }]}>{cat.label}</Text>
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
              </View>
            )}
            <View style={styles.divider} />
            <TouchableOpacity
              onPress={() => navigation.navigate('SavedPosts')}
              activeOpacity={0.8}
            >
              <View style={styles.toggleRow}>
                <View style={styles.toggleInfo}>
                  <Text style={styles.toggleLabel}>保存した投稿を見る</Text>
                  <Text style={styles.toggleHint}>気になる投稿を保存していつでも見返せます</Text>
                </View>
                <Text style={styles.menuArrow}>›</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── 통지 (課題 마감 알림은 모든 학교 — 수동 등록 課題에도 적용) ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>通知</Text>
          <View style={styles.infoCard}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleInfo}>
                <Text style={styles.toggleLabel}>締切が近づいたら通知</Text>
                <Text style={styles.toggleHint}>
                  未提出の課題を、締切の3日前と前日の18時ごろにお知らせします
                </Text>
              </View>
              <Switch
                value={deadlineReminder}
                onValueChange={handleDeadlineReminderToggle}
                trackColor={{ false: colors.gray300, true: colors.primary }}
                thumbColor={colors.white}
              />
            </View>
            {/* ── manaba 알림 메일전달 설정 ── */}
            {/* manaba를 쓰지 않는 학교에는 이 메뉴 자체를 노출하지 않는다.
                (누르면 국사관 manaba 설정 화면으로 이어져 혼란을 준다) */}
            {usesManaba && (
              <>
            <View style={styles.divider} />
            <TouchableOpacity
              onPress={() =>
                navigation.navigate(
                  'MailConnectOnboarding',
                  // 첫 설정(none)만 인트로부터, 이미 시작한 경우(pending/verified)는 설정 안내로 바로
                  forwardStatus === 'none' ? undefined : { mode: 'settings' },
                )
              }
              activeOpacity={0.8}
            >
              <View style={styles.toggleRow}>
                <View style={styles.toggleInfo}>
                  <Text style={styles.toggleLabel}>manaba通知メール</Text>
                  <Text style={styles.toggleHint}>
                    {forwardStatus === 'verified'
                      ? '✅ 設定が確認できました。新着通知をお届けします'
                      : forwardStatus === 'pending'
                      ? '⏳ 確認待ち。manabaのリマインダ設定でアドレスを追加してください'
                      : 'manabaのお知らせを通知で受け取れます'}
                  </Text>
                </View>
                {forwardStatus === 'verified' ? (
                  <View style={styles.connectedBadge}>
                    <Text style={styles.connectedText}>設定済み</Text>
                  </View>
                ) : (
                  <View style={styles.connectButton}>
                    <Text style={styles.connectButtonText}>
                      {forwardStatus === 'pending' ? '設定を見る' : '設定する'}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>

            {/* 푸시 수신 상태 (안전망 정보) */}
            <View style={styles.divider} />
            <View style={styles.pushStatusRow}>
              <View style={styles.pushStatusLabelWrap}>
                <Ionicons name="mail-outline" size={15} color={colors.textSecondary} />
                <Text style={styles.pushStatusLabel}>最近の通知</Text>
              </View>
              <Text style={styles.pushStatusValue}>
                {lastDelivered ? `${formatTimeAgo(lastDelivered)}に受信` : 'まだありません'}
              </Text>
            </View>
            {recentFailed > 0 && (
              <Text style={styles.pushFailNote}>
                ⚠️ 一部の通知が届かなかった可能性があります（{recentFailed}件）
              </Text>
            )}

            {/* 「課題を自動で追加」·「通知にAI要約を表示」 — 메일 전달을 시작한 사람만 (전달 설정 행이 있어야 저장된다) */}
            {forwardStatus !== 'none' && (
              <>
                <View style={styles.divider} />
                <View style={styles.toggleRow}>
                  <View style={styles.toggleInfo}>
                    <Text style={styles.toggleLabel}>課題を自動で追加</Text>
                    <Text style={styles.toggleHint}>
                      manabaでレポート・小テスト・授業のアンケートが公開されると、締切つきで課題に追加します。提出すると「提出済」になります
                    </Text>
                  </View>
                  <Switch
                    value={autoAssignment}
                    onValueChange={handleAutoAssignmentToggle}
                    disabled={autoAssignmentSaving}
                    trackColor={{ false: colors.gray300, true: colors.primary }}
                    thumbColor={colors.white}
                  />
                </View>
                {/* 「提出済」 자동 전환은 manaba 가 제출 메일을 보내야 가능 — 그 설정은 기본으로 꺼져 있는 사람이 많다
                    (2026-10-26 운영 DB: 課題 공개 메일 수십 건에 제출 메일 1건) */}
                {autoAssignment && manabaUrlsFor(manabaOriginFrom(links.manabaUrl)) && (
                  <TouchableOpacity
                    style={styles.inlineLink}
                    activeOpacity={0.7}
                    onPress={() =>
                      navigation.navigate('SchoolWeb', {
                        url: manabaUrlsFor(manabaOriginFrom(links.manabaUrl)).reminder,
                        title: 'リマインダ設定',
                        autoLogin: true,
                      })
                    }
                  >
                    <Text style={styles.inlineLinkText}>
                      提出も自動で反映するには、manabaの「課題提出のお知らせ」を「受信する」に › 設定を開く
                    </Text>
                  </TouchableOpacity>
                )}
                <View style={styles.divider} />
                <View style={styles.toggleRow}>
                  <View style={styles.toggleInfo}>
                    <Text style={styles.toggleLabel}>通知にAI要約を表示</Text>
                    <Text style={styles.toggleHint}>
                      アプリを開かなくても、お知らせの要点（締切・提出物など）を通知で確認できます
                    </Text>
                  </View>
                  <Switch
                    value={aiSummaryPush}
                    onValueChange={handleAiSummaryToggle}
                    disabled={aiSummarySaving}
                    trackColor={{ false: colors.gray300, true: colors.primary }}
                    thumbColor={colors.white}
                  />
                </View>
              </>
            )}

            {/* 테스트 통지 — 설정이 실제로 동작하는지 사용자가 직접 확인할 수 있게 한다.
                "연결했는데 통지가 안 온다"를 스스로 진단하는 가장 빠른 방법 */}
            <TouchableOpacity
              style={styles.testPushButton}
              onPress={handleSendTestPush}
              disabled={testPushSending}
              activeOpacity={0.8}
            >
              <Ionicons name="notifications-outline" size={16} color={colors.primary} />
              <Text style={styles.testPushButtonText}>
                {testPushSending ? '送信中…' : 'テスト通知を送る'}
              </Text>
            </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {/* ── 학교 사이트·프라이버시 ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>学校とプライバシー</Text>
          <View style={styles.infoCard}>
            <TouchableOpacity onPress={handleResetSchoolLogin} activeOpacity={0.8}>
              <View style={styles.toggleRow}>
                <View style={styles.toggleInfo}>
                  <Text style={styles.toggleLabel}>ログイン情報をリセット</Text>
                  <Text style={styles.toggleHint}>
                    ログインがうまくいかないときにお試しください。保存されたIDとログイン状態を削除します
                  </Text>
                </View>
                <Text style={styles.menuArrow}>›</Text>
              </View>
            </TouchableOpacity>

            {/* 최근 접속 실패 기록 — 기기 안에만 저장되며 서버로 보내지 않는다 */}
            {loginFailures.length > 0 && (
              <>
                <View style={styles.divider} />
                <Text style={styles.failureLogTitle}>最近の接続エラー</Text>
                {loginFailures.slice(0, 3).map((f, i) => (
                  <Text key={`${f.at}-${i}`} style={styles.failureLogItem}>
                    ・{formatTimeAgo(f.at)} — {getFailureCopy(f.kind).title}
                    {f.host ? `（${f.host}）` : ''}
                  </Text>
                ))}
              </>
            )}
            <View style={styles.divider} />
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
                trackColor={{ false: colors.gray300, true: colors.primary }}
                thumbColor={colors.white}
              />
            </View>
            <View style={styles.divider} />
            <TouchableOpacity
              onPress={() => navigation.navigate('BlockedUsers')}
              activeOpacity={0.8}
            >
              <View style={styles.toggleRow}>
                <View style={styles.toggleInfo}>
                  <Text style={styles.toggleLabel}>ブロックしたユーザー</Text>
                  <Text style={styles.toggleHint}>ブロックの確認・解除ができます</Text>
                </View>
                <Text style={styles.menuArrow}>›</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── 앱 ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>アプリ</Text>
          <View style={styles.infoCard}>
            <TouchableOpacity onPress={() => setHomeDisplayVisible(true)} activeOpacity={0.8}>
              <View style={styles.toggleRow}>
                <View style={styles.toggleInfo}>
                  <Text style={styles.toggleLabel}>ホームの表示</Text>
                  <Text style={styles.toggleHint}>ホームに表示するものを選べます</Text>
                </View>
                <Text style={styles.menuArrow}>›</Text>
              </View>
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity onPress={() => navigation.navigate('ReleaseNotes')} activeOpacity={0.8}>
              <View style={styles.toggleRow}>
                <View style={styles.toggleInfo}>
                  <Text style={styles.toggleLabel}>アップデート情報</Text>
                  <Text style={styles.toggleHint}>新しくなったところを確認できます</Text>
                </View>
                <Text style={styles.menuArrow}>›</Text>
              </View>
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity
              onPress={() => navigation.navigate('OnboardingReview')}
              activeOpacity={0.8}
            >
              <View style={styles.toggleRow}>
                <View style={styles.toggleInfo}>
                  <Text style={styles.toggleLabel}>使い方をもう一度見る</Text>
                  <Text style={styles.toggleHint}>最初に表示された紹介をもう一度確認できます</Text>
                </View>
                <Text style={styles.menuArrow}>›</Text>
              </View>
            </TouchableOpacity>
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
              ? <LoadingDots size={7} color={colors.danger} />
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
          <TouchableOpacity
            onPress={() => navigation.navigate('TermsOfService')}
            activeOpacity={0.7}
          >
            <Text style={styles.footerLinkText}>利用規約</Text>
          </TouchableOpacity>
          <Text style={styles.footerDivider}>|</Text>
          <TouchableOpacity onPress={handleDeleteAccount} activeOpacity={0.7}>
            <Text style={styles.deleteAccountText}>退会する</Text>
          </TouchableOpacity>
        </View>

        {APP_VERSION_LABEL && (
          <Text style={styles.versionText}>{APP_VERSION_LABEL}</Text>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
      <HomeDisplaySheet visible={homeDisplayVisible} onClose={() => setHomeDisplayVisible(false)} usesManaba={usesManaba} />
      {confirmElement}
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
    paddingBottom: 100,
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
    color: colors.textSecondary,
  },

  // 섹션
  section: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    ...typography.captionStrong,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    paddingLeft: spacing.xs,
  },

  // 정보 카드
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.xl, // 카드 안쪽 여백 20 (홈과 같은 기준)
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
    backgroundColor: colors.gray100,
  },

  // 게시글 목록
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
    color: colors.textSecondary,
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
  inlineLink: {
    paddingBottom: spacing.sm,
  },
  inlineLinkText: {
    ...typography.caption,
    color: colors.primary,
  },
  toggleHint: {
    ...typography.small,
    fontWeight: '400',
    color: colors.textSecondary,
  },
  menuArrow: {
    fontSize: 24,
    color: colors.textDisabled,
    fontWeight: '300',
  },
  // 재연결 필요 안내 (빨간 강조)
  toggleHintWarning: {
    ...typography.small,
    fontWeight: '500',
    color: colors.danger,
  },

  // 푸시 수신 상태 (안전망 정보)
  pushStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md + 2,
  },
  pushStatusLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  pushStatusLabel: {
    ...typography.body2,
    color: colors.textSecondary,
  },
  pushStatusValue: {
    ...typography.body2,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  testPushButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    marginBottom: spacing.md,
  },
  testPushButtonText: {
    ...typography.captionStrong,
    color: colors.primary,
  },
  failureLogTitle: {
    ...typography.captionStrong,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    marginBottom: 4,
  },
  failureLogItem: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 19,
  },
  pushFailNote: {
    ...typography.small,
    fontWeight: '500',
    color: colors.warning,
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
    color: colors.textSecondary,
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
  versionText: {
    ...typography.small,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: -spacing.md,
  },
  footerLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
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
  connectedBadge: {
    backgroundColor: colors.successSoft,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  connectedText: {
    ...typography.caption,
    color: colors.success,
    fontWeight: '600',
  },
  connectButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  // 재연결 버튼 (빨강)
  reauthButton: {
    backgroundColor: colors.danger,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  connectButtonText: {
    ...typography.caption,
    color: '#fff',
    fontWeight: '600',
  },
});
