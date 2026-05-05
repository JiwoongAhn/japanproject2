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
import { getCategoryInfo } from '../constants/boardCategories';
import { getCourseColor } from '../constants/courseColors';
import { supabase } from '../lib/supabase';
import { getCourseStatus, PERIOD_RANGES } from '../utils/timetable';
import { getDdayColor } from '../utils/assignment';
import { getTodayStr } from '../utils/date';
import { universities } from '../constants/universities';

// 로그인한 사용자의 대학 ID로 대학 정보 찾기 (없으면 국사관 기본값)
function getUniversityInfo(email) {
  const domainPart = email?.split('@')?.[1]?.split('.')?.[0] ?? '';
  return universities.find(u => u.id === domainPart) ?? universities[0];
}

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

        // 최신 게시글 3개
        supabase
          .from('posts')
          .select('*, post_comments(count)')
          .order('created_at', { ascending: false })
          .limit(3),
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
            <Text style={styles.greetingText}>{greeting}</Text>
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
              const status = getCourseStatus(course.period, nowMin, todayCourses);
              const barColor = getCourseColor(course.id).accent;
              const range = PERIOD_RANGES[course.period];
              const startH = Math.floor(range.start / 60);
              const startM = range.start % 60;
              const endH = Math.floor(range.end / 60);
              const endM = range.end % 60;
              const timeStr = `${startH}:${String(startM).padStart(2, '0')} - ${endH}:${String(endM).padStart(2, '0')}`;

              return (
                <View key={course.id} style={styles.courseCard}>
                  <View style={[styles.courseColorBar, { backgroundColor: barColor }]} />
                  <View style={styles.courseInfo}>
                    <Text style={styles.courseName}>{course.name}</Text>
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
              { icon: '📚', label: 'manaba',       url: universityInfo.manabaUrl   },
              { icon: '📅', label: 'kaede-i',      url: universityInfo.kaedeUrl    },
              { icon: '🏫', label: 'ホームページ', url: universityInfo.homepageUrl },
            ].filter(item => item.url).map((item) => (
              <TouchableOpacity
                key={item.label}
                style={styles.schoolCard}
                activeOpacity={0.7}
                onPress={() => Linking.openURL(item.url)}
              >
                <Text style={styles.schoolIcon}>{item.icon}</Text>
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
    paddingBottom: 16,
  },

  // 헤더
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    backgroundColor: colors.surface,
    marginBottom: 8,
  },
  headerLeft: {
    flex: 1,
  },
  dateText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  greetingText: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  universityText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },

  // 섹션 공통
  section: {
    backgroundColor: colors.surface,
    marginBottom: 8,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  seeAll: {
    fontSize: 13,
    color: colors.primary,
  },
  countBadge: {
    backgroundColor: colors.danger + '18',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.danger,
  },

  // 빈 상태 카드
  emptyCard: {
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
  },
  emptyCardText: {
    fontSize: 13,
    color: colors.textSecondary,
  },

  // 오늘 수업 카드
  courseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
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
    paddingLeft: 16,
  },
  courseName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 3,
  },
  courseDetail: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: colors.background,
  },
  statusBadgeActive: {
    backgroundColor: '#05C072' + '18',
  },
  statusBadgeNext: {
    backgroundColor: colors.warning + '18',
  },
  statusBadgeText: {
    fontSize: 11,
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
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  assignmentInfo: {
    flex: 1,
    marginRight: 12,
  },
  assignmentCourse: {
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 3,
  },
  assignmentTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  ddayBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  ddayText: {
    fontSize: 13,
    fontWeight: '700',
  },

  // 게시판 카드
  postCard: {
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  postAnon: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  postTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: 8,
    lineHeight: 20,
  },
  postFooter: {
    flexDirection: 'row',
    gap: 12,
  },
  postReaction: {
    fontSize: 12,
    color: colors.textSecondary,
  },

  // 학교 정보 그리드
  schoolGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  schoolCard: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 6,
  },
  schoolIcon: {
    fontSize: 20,
  },
  schoolLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
  },
});
