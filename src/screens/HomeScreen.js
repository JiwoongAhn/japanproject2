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
  Linking,
} from 'react-native';
import { colors } from '../constants/colors';
import { typography } from '../constants/typography';
import { spacing, radius, shadow } from '../constants/spacing';
import { getCategoryInfo } from '../constants/boardCategories';
import { getCourseColor } from '../constants/courseColors';
import { supabase } from '../lib/supabase';
import { getCourseStatus, getPeriodRanges } from '../utils/timetable';
import { getDdayColor } from '../utils/assignment';
import { getTodayStr } from '../utils/date';
import { getUniversityInfo, getUniversityLinks } from '../utils/university';
import { universities } from '../constants/universities';

export default function HomeScreen({ navigation }) {
  const [todayCourses, setTodayCourses] = useState([]);
  const [upcomingAssignments, setUpcomingAssignments] = useState([]);
  const [recentPosts, setRecentPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [universityInfo, setUniversityInfo] = useState(universities[0]);

  // 날짜/인사말 계산
  const now = new Date();
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ${weekdays[now.getDay()]}曜日`;
  const hour = now.getHours();
  const greetSuffix = hour < 11 ? 'おはようございます！👋' : hour < 18 ? 'こんにちは！👋' : 'こんばんは！🌙';
  const greeting = nickname ? `${nickname}さん、${greetSuffix}` : greetSuffix;

  // 모든 데이터 한 번에 로드
  const fetchAll = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setUserEmail(user.email);
        setUniversityInfo(getUniversityInfo(user.email));

        // 학번(nickname) 조회
        const { data: profile } = await supabase
          .from('profiles')
          .select('nickname')
          .eq('id', user.id)
          .single();
        if (profile?.nickname) setNickname(profile.nickname);
      }

      // 오늘 요일 → DB day_of_week (0=월, 4=금 / JS: 0=일, 1=월 ... 6=토)
      const jsDay = now.getDay(); // 0=일, 1=월 ... 6=토
      const dbDay = jsDay - 1;   // 0=월, 4=금, 토일은 -1, 6

      const todayStr = getTodayStr();
      const d3Str = (() => {
        const d = new Date(now);
        d.setDate(d.getDate() + 3);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      })();

      // 본인 대학 이름 (이메일 기준) — 게시글을 학교별로 분리하기 위해 사용
      const myUniversity = user?.email ? getUniversityInfo(user.email).name : null;

      const [coursesRes, assignmentsRes, postsRes] = await Promise.all([
        // 오늘 수업 (평일일 때만, 본인 수업만)
        dbDay >= 0 && dbDay <= 4 && user
          ? supabase.from('courses').select('*').eq('user_id', user.id).eq('day_of_week', dbDay).order('period')
          : Promise.resolve({ data: [] }),

        // D-3 이내 미제출 과제
        supabase
          .from('assignments')
          .select('*, courses(name)')
          .eq('status', 'pending')
          .gte('due_date', todayStr)
          .lte('due_date', d3Str)
          .order('due_date'),

        // 최신 게시글 3개 — 본인 대학 게시글만
        myUniversity
          ? supabase
              .from('posts')
              .select('*, post_comments(count)')
              .eq('university', myUniversity)
              .order('created_at', { ascending: false })
              .limit(3)
          : Promise.resolve({ data: [] }),
      ]);

      if (coursesRes.data) setTodayCourses(coursesRes.data);
      if (assignmentsRes.data) setUpcomingAssignments(assignmentsRes.data);
      if (postsRes.data) setRecentPosts(postsRes.data);
    } catch {
      // 네트워크 에러 등 — 빈 상태로 표시
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const unsubscribe = navigation.addListener('focus', fetchAll);
    return unsubscribe;
  }, [navigation, fetchAll]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAll();
  }, [fetchAll]);

  // 현재 분(자정 기준)
  const nowMin = now.getHours() * 60 + now.getMinutes();
  // 현재 학교의 URL 정보
  const links = getUniversityLinks(universityInfo?.id);

  // 아바타 이니셜: 학번 첫 글자 (없으면 이메일 첫 글자)
  const avatarLetter = nickname
    ? nickname[0].toUpperCase()
    : userEmail
      ? userEmail[0].toUpperCase()
      : 'A';

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator style={{ flex: 1 }} size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >

        {/* ── 헤더: 날짜 + 인사말 + 아바타 ── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.dateText}>{dateStr}</Text>
            <Text style={styles.greetingText} numberOfLines={1}>{greeting}</Text>
            <Text style={styles.universityText}>{universityInfo.name}</Text>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{avatarLetter}</Text>
          </View>
        </View>

        {/* ── 今日の授業 ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>今日の授業</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Timetable')}>
              <Text style={styles.seeAll}>すべて見る</Text>
            </TouchableOpacity>
          </View>

          {todayCourses.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyCardText}>
                {now.getDay() === 0 || now.getDay() === 6
                  ? '今日は休日です 🎉'
                  : '今日の授業はありません'}
              </Text>
            </View>
          ) : (
            todayCourses.map((course, index) => {
              const status = getCourseStatus(course.period, nowMin, todayCourses, universityInfo);
              const barColor = getCourseColor(course.id).accent;
              const range = getPeriodRanges(universityInfo)[course.period];
              const startH = Math.floor(range.start / 60);
              const startM = range.start % 60;
              const endH = Math.floor(range.end / 60);
              const endM = range.end % 60;
              const timeStr = `${startH}:${String(startM).padStart(2, '0')} - ${endH}:${String(endM).padStart(2, '0')}`;

              return (
                <View key={course.id} style={styles.courseCard}>
                  <View style={[styles.courseColorBar, { backgroundColor: barColor }]} />
                  <View style={styles.courseInfo}>
                    <Text style={styles.courseName} numberOfLines={1}>{course.name}</Text>
                    <Text style={styles.courseDetail}>
                      {timeStr}{course.room ? ` · ${course.room}` : ''}
                    </Text>
                  </View>
                  {status !== '終了' && (
                    <View style={[
                      styles.statusBadge,
                      status === '進行中' && styles.statusBadgeActive,
                      status === '次の授業' && styles.statusBadgeNext,
                    ]}>
                      <Text style={[
                        styles.statusBadgeText,
                        status === '進行中' && styles.statusBadgeTextActive,
                        status === '次の授業' && styles.statusBadgeTextNext,
                      ]}>{status}</Text>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>

        {/* ── 締切が近い課題 ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>締切が近い課題</Text>
              {upcomingAssignments.length > 0 && (
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{upcomingAssignments.length}件</Text>
                </View>
              )}
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('Assignment')}>
              <Text style={styles.seeAll}>すべて見る</Text>
            </TouchableOpacity>
          </View>

          {upcomingAssignments.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyCardText}>締切が近い課題はありません ✅</Text>
            </View>
          ) : (
            upcomingAssignments.map((item) => {
              const due = new Date(item.due_date);
              const today = new Date(); today.setHours(0, 0, 0, 0);
              const dday = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
              const courseName = item.courses?.name || '未登録';

              return (
                <View key={item.id} style={styles.assignmentCard}>
                  <View style={styles.assignmentInfo}>
                    <Text style={styles.assignmentCourse}>{courseName}</Text>
                    <Text style={styles.assignmentTitle} numberOfLines={1}>{item.title}</Text>
                  </View>
                  <View style={[styles.ddayBadge, { backgroundColor: getDdayColor(dday) + '18' }]}>
                    <Text style={[styles.ddayText, { color: getDdayColor(dday) }]}>
                      D-{dday}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* ── 掲示板 미리보기 ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>掲示板</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Community')}>
              <Text style={styles.seeAll}>すべて見る</Text>
            </TouchableOpacity>
          </View>

          {recentPosts.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyCardText}>まだ投稿がありません</Text>
            </View>
          ) : (
            recentPosts.map((post) => {
              const catInfo = getCategoryInfo(post.category);
              const commentCount = post.post_comments?.[0]?.count ?? 0;
              return (
                <TouchableOpacity
                  key={post.id}
                  style={styles.postCard}
                  activeOpacity={0.7}
                  onPress={() => navigation.navigate('Community', {
                    screen: 'PostDetail',
                    params: { postId: post.id },
                  })}
                >
                  <View style={styles.postHeader}>
                    <View style={[styles.categoryBadge, { backgroundColor: catInfo.color + '18' }]}>
                      <Text style={[styles.categoryBadgeText, { color: catInfo.color }]}>{catInfo.label}</Text>
                    </View>
                    <Text style={styles.postAnon}>{post.is_anonymous ? '匿名' : '実名'}</Text>
                  </View>
                  <Text style={styles.postTitle} numberOfLines={1}>{post.title}</Text>
                  <View style={styles.postFooter}>
                    <Text style={styles.postReaction}>♡ {post.like_count || 0}</Text>
                    <Text style={styles.postReaction}>□ {commentCount}</Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* ── 学校情報 2×2 그리드 ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>学校情報</Text>
          <View style={styles.schoolGrid}>
            {[
              // manaba는 앱 내부 WebView 화면(쿠키 저장+공지 파싱)으로 진입
              // manaba 없으면 lmsUrl(WebClass 등)을 외부 링크로 대체
              ...(links.manabaUrl
                ? [{ icon: '📚', label: 'manaba', internal: 'Manaba', tint: colors.primary }]
                : links.lmsUrl
                  ? [{ icon: '📚', label: links.lmsLabel ?? 'LMS', url: links.lmsUrl, tint: colors.primary }]
                  : []
              ),
              // kaede-i는 앱 내부 WebView로 진입 (autoLogin: ID/PW 자동 로그인)
              { icon: '📅', label: 'kaede-i',      url: links.kaedeUrl,    webview: true, autoLogin: true, tint: colors.success },
              { icon: '🏫', label: 'ホームページ', url: links.homepageUrl, tint: colors.warning },
            ].filter(item => item.url || item.internal).map((item) => (
              <TouchableOpacity
                key={item.label}
                style={styles.schoolCard}
                activeOpacity={0.7}
                onPress={() => {
                  if (item.internal) navigation.navigate(item.internal);
                  else if (item.webview) navigation.navigate('SchoolWeb', { url: item.url, title: item.label, autoLogin: item.autoLogin });
                  else Linking.openURL(item.url);
                }}
              >
                <View style={[styles.schoolIconChip, { backgroundColor: item.tint + '18' }]}>
                  <Text style={styles.schoolIcon}>{item.icon}</Text>
                </View>
                <Text style={styles.schoolLabel}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={{ height: 32 }} />
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
    paddingBottom: 84,
  },

  // 헤더 (흰색 카드)
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    ...shadow.card,
  },
  headerLeft: {
    flex: 1,
  },
  dateText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  greetingText: {
    ...typography.title2,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  universityText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xl,
  },
  avatarText: {
    ...typography.subtitle,
    color: colors.primary,
  },

  // 섹션 공통 (흰색 카드)
  section: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
    ...shadow.card,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  sectionTitle: {
    ...typography.subtitle,
    color: colors.textPrimary,
  },
  seeAll: {
    ...typography.caption,
    color: colors.primary,
  },
  countBadge: {
    backgroundColor: colors.danger + '18',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  countBadgeText: {
    ...typography.small,
    fontWeight: '700',
    color: colors.danger,
  },

  // 빈 상태 카드
  emptyCard: {
    backgroundColor: colors.gray50,
    borderRadius: radius.md,
    padding: spacing.lg,
    alignItems: 'center',
  },
  emptyCardText: {
    ...typography.caption,
    color: colors.textSecondary,
  },

  // 오늘 수업 카드
  courseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray50,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  courseColorBar: {
    width: 4,
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 2,
  },
  courseInfo: {
    flex: 1,
    paddingLeft: spacing.lg,
  },
  courseName: {
    ...typography.body2,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 3,
  },
  courseDetail: {
    ...typography.small,
    fontWeight: '400',
    color: colors.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    backgroundColor: colors.gray100,
  },
  statusBadgeActive: {
    backgroundColor: colors.success + '18',
  },
  statusBadgeNext: {
    backgroundColor: colors.warning + '18',
  },
  statusBadgeText: {
    ...typography.small,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  statusBadgeTextActive: {
    color: colors.success,
  },
  statusBadgeTextNext: {
    color: colors.warning,
  },

  // 과제 카드
  assignmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.gray50,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  assignmentInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  assignmentCourse: {
    ...typography.small,
    fontWeight: '400',
    color: colors.textSecondary,
    marginBottom: 3,
  },
  assignmentTitle: {
    ...typography.body2,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  ddayBadge: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  ddayText: {
    ...typography.caption,
    fontWeight: '700',
  },

  // 게시판 카드
  postCard: {
    backgroundColor: colors.gray50,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm - 2,
  },
  categoryBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm - 2,
  },
  categoryBadgeText: {
    ...typography.small,
    fontWeight: '600',
  },
  postAnon: {
    ...typography.small,
    fontWeight: '400',
    color: colors.textSecondary,
  },
  postTitle: {
    ...typography.body2,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  postFooter: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  postReaction: {
    ...typography.small,
    fontWeight: '400',
    color: colors.textSecondary,
  },

  // 학교 정보 그리드
  schoolGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  schoolCard: {
    flex: 1,
    backgroundColor: colors.gray50,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    gap: spacing.sm,
  },
  schoolIconChip: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  schoolIcon: {
    fontSize: 20,
  },
  schoolLabel: {
    ...typography.small,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
  },
});
