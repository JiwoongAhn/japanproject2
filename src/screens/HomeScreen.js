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
import { supabase } from '../lib/supabase';

// 국사관대학 교시별 시작·종료 시간 (분 단위로 변환해두면 비교 쉬움)
// period → { startMin, endMin }  (자정 기준 분수)
const PERIOD_RANGES = {
  1: { start: 9 * 60,       end: 10 * 60 + 30  }, // 9:00 ~ 10:30
  2: { start: 10 * 60 + 45, end: 12 * 60 + 15  }, // 10:45 ~ 12:15
  3: { start: 12 * 60 + 55, end: 14 * 60 + 25  }, // 12:55 ~ 14:25
  4: { start: 14 * 60 + 40, end: 16 * 60 + 10  }, // 14:40 ~ 16:10
  5: { start: 16 * 60 + 25, end: 17 * 60 + 55  }, // 16:25 ~ 17:55
  6: { start: 18 * 60 + 10, end: 19 * 60 + 40  }, // 18:10 ~ 19:40
  7: { start: 19 * 60 + 55, end: 21 * 60 + 25  }, // 19:55 ~ 21:25
  8: { start: 21 * 60 + 40, end: 23 * 60 + 10  }, // 21:40 ~ 23:10
};

// 현재 시각(분)을 기준으로 수업 상태 반환
function getCourseStatus(period, nowMin, todayCoursesSorted) {
  const range = PERIOD_RANGES[period];
  if (!range) return '未開始';

  if (nowMin >= range.start && nowMin < range.end) return '進行中';
  if (nowMin >= range.end) return '終了';

  // 아직 시작 전 — 오늘 수업 중 다음 교시인지 판단
  const sortedPeriods = todayCoursesSorted.map(c => c.period);
  const futureIdx = sortedPeriods.filter(p => PERIOD_RANGES[p]?.start > nowMin);
  if (futureIdx.length > 0 && futureIdx[0] === period) return '次の授業';
  return '未開始';
}

// 컬러 팔레트 (수업 카드 왼쪽 컬러 바)
const COURSE_COLORS = ['#4E95F5', '#F97316', '#A855F7', '#05C072', '#EF4444', '#F59E0B', '#14B8A6', '#EC4899'];

// D-day 배지 색상
function getDdayColor(dday) {
  if (dday <= 1) return colors.warning;
  if (dday <= 3) return colors.primary;
  return colors.textSecondary;
}

// 오늘 날짜를 'YYYY-MM-DD' 문자열로 반환 (JST 기준)
function getTodayStr() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function HomeScreen({ navigation }) {
  const [todayCourses, setTodayCourses] = useState([]);
  const [upcomingAssignments, setUpcomingAssignments] = useState([]);
  const [recentPosts, setRecentPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userEmail, setUserEmail] = useState('');

  // 날짜/인사말 계산
  const now = new Date();
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ${weekdays[now.getDay()]}曜日`;
  const hour = now.getHours();
  const greeting = hour < 11 ? 'おはようございます 👋' : hour < 18 ? 'こんにちは 👋' : 'こんばんは 🌙';

  // 모든 데이터 한 번에 로드
  const fetchAll = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email) setUserEmail(user.email);

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
      // 오늘 수업 (평일일 때만)
      dbDay >= 0 && dbDay <= 4
        ? supabase.from('courses').select('*').eq('day_of_week', dbDay).order('period')
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

    setLoading(false);
    setRefreshing(false);
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

  // 아바타 이니셜: 이메일 첫 글자
  const avatarLetter = userEmail ? userEmail[0].toUpperCase() : 'A';

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
            <Text style={styles.universityText}>國士舘大学</Text>
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
              const barColor = COURSE_COLORS[index % COURSE_COLORS.length];
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
              { icon: '📢', label: 'お知らせ', url: 'https://www.kokushikan.ac.jp/news/' },
              { icon: '📅', label: '学事日程', url: 'https://www.kokushikan.ac.jp/campuslife/calendars/' },
              { icon: '📖', label: 'シラバス', url: 'https://kaedei.kokushikan.ac.jp/Syllabus/Top.aspx' },
              { icon: '🏫', label: 'ポータル', url: 'https://portal.kokushikan.ac.jp/' },
            ].map((item) => (
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
    width: '47.5%',
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  schoolIcon: {
    fontSize: 20,
  },
  schoolLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
});
