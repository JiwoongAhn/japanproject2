import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';

import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { colors } from '../../constants/colors';
import { spacing, radius, shadow } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { getCourseColorFor } from '../../constants/courseColors';
import CourseDetailModal from './CourseDetailModal';
import { getPeriodStartTimeStr } from '../../utils/timetable';
import { useAuth } from '../../lib/AuthProvider';
import { getUniversityInfo, getUniversityLinks } from '../../utils/university';

// 요일 레이블 (일본어)
const DAYS = ['月', '火', '水', '木', '金'];
// 교시 열(가장 왼쪽) 너비 — 시간 텍스트 공간 확보
const PERIOD_COL_WIDTH = 32;

// JST(UTC+9) 기준 오늘 요일 → 시간표 열 인덱스 (월=0 ~ 금=4, 주말=-1)
// 렌더 시점마다 호출해 날짜 경계에서도 정확하게 반영
function getTodayCol() {
  const now = new Date();
  // UTC에 9시간 더한 뒤 UTC 메서드로 읽으면 기기 로컬 시간대와 무관하게 JST 기준 요일을 얻음
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const jsDay = jst.getUTCDay(); // 0=일, 1=월, 2=화 ... 6=토
  return (jsDay >= 1 && jsDay <= 5) ? jsDay - 1 : -1;
}

// 일본 학기 라벨 — 5월이면 春学期, 11월이면 秋学期 등
function getSemesterLabel() {
  const m = new Date().getMonth() + 1; // 1~12
  const y = new Date().getFullYear();
  const semester = (m >= 4 && m <= 8) ? '春学期' : '秋学期';
  return `${y}年 ${semester}`;
}

export default function TimetableScreen({ navigation }) {
  const { session } = useAuth();
  const universityInfo = getUniversityInfo(session?.user?.email);
  const links = getUniversityLinks(universityInfo.id);

  // 렌더 시점에 JST 기준으로 오늘 열 계산 (날짜가 바뀌어도 다음 렌더에서 자동 갱신)
  const TODAY_COL = getTodayCol();

  // 학교별 교시 수
  const periodCount = universityInfo?.periodRanges ? Object.keys(universityInfo.periodRanges).length : 6;
  const PERIODS = Array.from({ length: periodCount }, (_, i) => i + 1);
  // 그리드 셀 높이 — 에브리타임 스타일로 약간 더 컴팩트
  const ROW_HEIGHT = periodCount <= 5 ? 78 : periodCount <= 6 ? 70 : periodCount <= 8 ? 60 : 52;

  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState(null);
  // 오늘 요일 강조색은 파란색으로 고정 (사용자 색상 설정 기능 제거)
  const todayColor = colors.primary;

  // Supabase에서 본인 수업 목록 불러오기
  const fetchCourses = useCallback(async () => {
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .eq('user_id', user.id)
      .order('day_of_week')
      .order('period');

    if (error) {
      // 부드러운 실패 문구
      Alert.alert('お知らせ', '時間割をうまく取得できませんでした');
    } else {
      setCourses(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCourses();
    const unsubscribe = navigation.addListener('focus', () => {
      fetchCourses();
    });
    return unsubscribe;
  }, [navigation, fetchCourses]);

  const getCourse = useCallback(
    (dayIndex, period) =>
      courses.find(c => c.day_of_week === dayIndex && c.period === period),
    [courses]
  );

  // 一括取り込み: kaede 시간표 URL이 있으면 학교사이트 자동접속, 없으면 텍스트 붙여넣기로 폴백
  const handleBulkImport = () => {
    if (links.timetableUrl) {
      Alert.alert(
        '時間割の一括取り込み',
        'kaede-i にログインして時間割を自動で取り込みます。よろしいですか?',
        [
          { text: 'キャンセル', style: 'cancel' },
          {
            text: '接続する',
            onPress: () =>
              navigation.navigate('SchoolWeb', {
                url: links.timetableUrl,
                title: '時間割の取り込み',
                autoLogin: true,
                forTimetableImport: true, // 이 경로(일괄추가)에서만 '時間割を取り込む' 버튼 노출
              }),
          },
        ]
      );
    } else {
      // kaede 미지원 학교 → 텍스트 붙여넣기 폴백
      navigation.navigate('BulkAddInput');
    }
  };

  const handleDeleteCourse = async (courseId) => {
    const { error } = await supabase
      .from('courses')
      .delete()
      .eq('id', courseId);

    if (error) {
      Alert.alert('お知らせ', '削除できませんでした。もう一度お試しください');
    } else {
      setSelectedCourse(null);
      fetchCourses();
    }
  };

  // 시간표 전체 삭제 — 되돌릴 수 없으므로 반드시 확인 다이얼로그를 거친다
  const handleClearAll = () => {
    if (courses.length === 0) return;
    Alert.alert(
      '時間割を全て削除',
      `${courses.length}件の授業をすべて削除します。\nこの操作は元に戻せません。`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '全て削除',
          style: 'destructive',
          onPress: async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // 본인 수업만 삭제 (user_id 기준)
            const { error } = await supabase
              .from('courses')
              .delete()
              .eq('user_id', user.id);

            if (error) {
              Alert.alert('お知らせ', '削除できませんでした。もう一度お試しください');
            } else {
              setCourses([]); // 즉시 UI 비움
              fetchCourses();
            }
          },
        },
      ]
    );
  };

  // 오늘 수업 통계 (1 thing/1 page — 화면 상단의 핵심 정보 하나)
  const todayCourseCount = TODAY_COL >= 0
    ? courses.filter(c => c.day_of_week === TODAY_COL).length
    : 0;

  return (
    <SafeAreaView style={styles.container}>
      {/* ── 상단 헤더 (토스 스타일) ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.semesterLabel}>{getSemesterLabel()}</Text>
          <Text style={styles.headerTitle}>時間割</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.bulkButton}
            onPress={handleBulkImport}
            activeOpacity={0.8}
          >
            <Ionicons name="clipboard-outline" size={15} color={colors.primary} />
            <Text style={styles.bulkButtonText}>一括</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => navigation.navigate('CourseAdd')}
            activeOpacity={0.8}
          >
            <Text style={styles.addButtonText}>＋ 追加</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator style={{ flex: 1 }} size="large" color={colors.primary} />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.huge * 2 }}>
          {/* ── 오늘 수업 요약 + 전체 삭제 (좌: 요약 / 우: 全て削除) ── */}
          <View style={styles.summaryRow}>
            {TODAY_COL >= 0 ? (
              <View style={styles.todaySummary}>
                <View style={[styles.todayDotLarge, { backgroundColor: todayColor }]} />
                <Text style={styles.todaySummaryText}>
                  今日は<Text style={[styles.todaySummaryStrong, { color: todayColor }]}>{todayCourseCount}コマ</Text>
                </Text>
              </View>
            ) : (
              <View />
            )}

            {/* 수업이 하나라도 있을 때만 전체 삭제 버튼 노출 */}
            {courses.length > 0 && (
              <TouchableOpacity
                style={styles.clearAllButton}
                onPress={handleClearAll}
                activeOpacity={0.8}
              >
                <Ionicons name="trash-outline" size={14} color="#FF3B30" />
                <Text style={styles.clearAllText}>全て削除</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* ── 시간표 카드 (에브리타임 그리드 + 토스 카드) ── */}
          <View style={styles.gridCard}>
            {/* 요일 헤더 행 */}
            <View style={styles.dayHeaderRow}>
              <View style={{ width: PERIOD_COL_WIDTH }} />
              {DAYS.map((day, i) => {
                const isToday = i === TODAY_COL;
                return (
                  <View key={i} style={styles.dayHeaderCell}>
                    <Text style={[
                      styles.dayHeaderText,
                      isToday && { color: todayColor, fontWeight: '700' },
                    ]}>
                      {day}
                    </Text>
                  </View>
                );
              })}
            </View>

            {/* 그리드 본문 */}
            {PERIODS.map((period) => (
              <View key={period} style={[styles.periodRow, { height: ROW_HEIGHT }]}>
                {/* 교시 라벨 */}
                <View style={styles.periodLabelCell}>
                  <Text style={styles.periodLabelText}>{period}</Text>
                  <Text
                    style={styles.periodTimeText}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
                    {getPeriodStartTimeStr(period, universityInfo)}
                  </Text>
                </View>

                {/* 요일별 셀 */}
                {DAYS.map((_, dayIndex) => {
                  const course = getCourse(dayIndex, period);
                  const color = course ? getCourseColorFor(course) : null;
                  return (
                    <TouchableOpacity
                      key={dayIndex}
                      style={[
                        styles.cell,
                        course
                          ? { backgroundColor: color.bg }
                          : styles.cellEmpty,
                      ]}
                      onPress={() => {
                        if (course) {
                          setSelectedCourse(course);
                        } else {
                          navigation.navigate('CourseAdd', { day: dayIndex, period });
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      {course ? (
                        <>
                          <Text
                            style={[styles.courseName, { color: color.accent }]}
                            numberOfLines={2}
                          >
                            {course.name}
                          </Text>
                          {course.classroom ? (
                            <Text
                              style={[styles.courseRoom, { color: color.accent }]}
                              numberOfLines={1}
                            >
                              {course.classroom}
                            </Text>
                          ) : course.professor_name ? (
                            <Text
                              style={[styles.courseRoom, { color: color.accent }]}
                              numberOfLines={1}
                            >
                              {course.professor_name}
                            </Text>
                          ) : null}
                        </>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>

          {/* ── 하단 메뉴 섹션 (밀러의 법칙 — 3개 항목, 7±2 이내) ── */}
          <View style={styles.menuSection}>
            <Text style={styles.menuSectionTitle}>授業関連</Text>

            <TouchableOpacity
              style={styles.menuCard}
              activeOpacity={0.75}
              onPress={() => navigation.navigate('CourseReview')}
            >
              <Ionicons name="chatbox-ellipses-outline" size={22} color={colors.textPrimary} style={styles.menuCardIcon} />
              <View style={styles.menuCardText}>
                <Text style={styles.menuCardTitle}>講義評価</Text>
                <Text style={styles.menuCardDesc}>授業の評判を確認・投稿</Text>
              </View>
              <Text style={styles.menuCardChevron}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuCard}
              activeOpacity={0.75}
              onPress={() => navigation.navigate('FreeTime')}
            >
              <Ionicons name="calendar-outline" size={22} color={colors.textPrimary} style={styles.menuCardIcon} />
              <View style={styles.menuCardText}>
                <Text style={styles.menuCardTitle}>空き時間合わせ</Text>
                <Text style={styles.menuCardDesc}>友達と共通の空き時間を探す</Text>
              </View>
              <Text style={styles.menuCardChevron}>›</Text>
            </TouchableOpacity>

            {links.syllabusUrl ? (
              <TouchableOpacity
                style={styles.menuCard}
                activeOpacity={0.75}
                onPress={() => WebBrowser.openBrowserAsync(links.syllabusUrl, {
                  toolbarColor: colors.primary,
                  controlsColor: '#FFFFFF',
                })}
              >
                <Ionicons name="book-outline" size={22} color={colors.textPrimary} style={styles.menuCardIcon} />
                <View style={styles.menuCardText}>
                  <Text style={styles.menuCardTitle}>シラバス</Text>
                  <Text style={styles.menuCardDesc}>{universityInfo.name} シラバス検索</Text>
                </View>
                <Text style={styles.menuCardChevron}>›</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </ScrollView>
      )}

      <CourseDetailModal
        course={selectedCourse}
        onClose={() => setSelectedCourse(null)}
        onDelete={handleDeleteCourse}
        onEdit={(course) => navigation.navigate('CourseAdd', { course })}
      />
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
    backgroundColor: colors.background, // 보더 제거, 배경 일체화
  },
  semesterLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  headerTitle: {
    ...typography.title2,
    color: colors.textPrimary,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  bulkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  bulkButtonText: {
    color: colors.primary,
    ...typography.captionStrong,
  },
  addButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  addButtonText: {
    color: colors.white,
    ...typography.captionStrong,
  },

  // ── 오늘 요약 + 전체 삭제 줄 ──────────────────
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.md,
  },
  todaySummary: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clearAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: '#FFECEC', // 연한 빨강 배경 (위험 동작 강조)
  },
  clearAllText: {
    ...typography.captionStrong,
    color: '#FF3B30',
  },
  todayDotLarge: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.sm,
  },
  todaySummaryText: {
    ...typography.body2,
    color: colors.textSecondary,
  },
  todaySummaryStrong: {
    ...typography.bodyStrong,
  },

  // ── 시간표 카드 (토스 카드 컨테이너) ──────────
  gridCard: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadow.card,
  },

  // 요일 헤더
  dayHeaderRow: {
    flexDirection: 'row',
    paddingBottom: spacing.sm,
    marginBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  dayHeaderCell: {
    flex: 1,
    alignItems: 'center',
  },
  dayHeaderText: {
    ...typography.captionStrong,
    color: colors.textSecondary,
  },

  // 교시 행
  periodRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  periodLabelCell: {
    width: PERIOD_COL_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    paddingRight: spacing.xs,
  },
  periodLabelText: {
    ...typography.captionStrong,
    color: colors.textSecondary,
  },
  periodTimeText: {
    ...typography.micro,
    color: colors.textDisabled,
    marginTop: 2,
  },

  // 셀
  cell: {
    flex: 1,
    marginHorizontal: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
  },
  cellEmpty: {
    backgroundColor: colors.gray50,
  },
  courseName: {
    ...typography.captionStrong,
    fontSize: 11,
    lineHeight: 14,
  },
  courseRoom: {
    ...typography.micro,
    opacity: 0.85,
    marginTop: 2,
  },

  // ── 하단 메뉴 ──────────────────────────────
  menuSection: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.xxl,
  },
  menuSectionTitle: {
    ...typography.captionStrong,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    paddingLeft: spacing.xs,
  },
  menuCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
    ...shadow.card,
  },
  menuCardIcon: {
    marginRight: spacing.md,
  },
  menuCardText: {
    flex: 1,
  },
  menuCardTitle: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  menuCardDesc: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  menuCardChevron: {
    fontSize: 22,
    color: colors.textDisabled,
    lineHeight: 24,
  },

  // ── 빈 상태 (부드러운 톤) ─────────────────
  emptyOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.huge,
    backgroundColor: 'rgba(242,244,246,0.94)',
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
    marginBottom: spacing.xxl,
  },
  emptyButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
  },
  emptyButtonText: {
    color: colors.white,
    ...typography.bodyStrong,
  },
});
