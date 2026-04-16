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
  Linking,
} from 'react-native';

// 国士舘大学 シラバス URL
// ※ ログインが必要な場合はポータルURL (https://portal.kokushikan.ac.jp/) に変更してください
const SYLLABUS_URL = 'https://kaedei.kokushikan.ac.jp/Syllabus/Top.aspx';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../lib/supabase';
import { colors } from '../../constants/colors';
import { getCourseColor } from '../../constants/courseColors';
import CourseDetailModal from './CourseDetailModal';
import { TODAY_COLOR_KEY } from '../ProfileScreen';

// 요일 레이블 (일본어)
const DAYS = ['月', '火', '水', '木', '金'];
// 교시 목록 (1~6교시)
const PERIODS = [1, 2, 3, 4, 5, 6];
// 교시 열(가장 왼쪽) 너비 — 시간 텍스트 공간 확보
const PERIOD_COL_WIDTH = 42;
// 행 높이
const ROW_HEIGHT = 80;
// 교시별 시작 시간 (국사관대학 기준)
const PERIOD_TIMES = {
  1: '9:00',
  2: '10:45',
  3: '12:55',
  4: '14:40',
  5: '16:25',
  6: '18:10',
};

// 오늘 요일 → 시간표 열 인덱스 (월=0 ~ 금=4, 주말=-1)
// JS: 0=일, 1=월 ... 6=토
const jsDay = new Date().getDay();
const TODAY_COL = (jsDay >= 1 && jsDay <= 5) ? jsDay - 1 : -1;

export default function TimetableScreen({ navigation }) {
  const [courses, setCourses] = useState([]);    // 수업 목록
  const [loading, setLoading] = useState(true);  // 로딩 상태
  const [selectedCourse, setSelectedCourse] = useState(null); // 모달에 표시할 수업
  const [todayColor, setTodayColor] = useState(colors.primary); // 오늘 요일 강조 색상

  // Supabase에서 수업 목록 불러오기
  const fetchCourses = useCallback(async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .order('day_of_week')
      .order('period');

    if (error) {
      Alert.alert('エラー', '時間割の読み込みに失敗しました');
    } else {
      setCourses(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCourses();

    // 화면 포커스 시 수업 목록 + 색상 설정 새로고침
    const unsubscribe = navigation.addListener('focus', async () => {
      fetchCourses();
      const saved = await AsyncStorage.getItem(TODAY_COLOR_KEY);
      if (saved) setTodayColor(saved);
    });
    return unsubscribe;
  }, [navigation, fetchCourses]);

  // 특정 요일(dayIndex)과 교시(period)에 해당하는 수업 반환
  const getCourse = useCallback(
    (dayIndex, period) =>
      courses.find(c => c.day_of_week === dayIndex && c.period === period),
    [courses]
  );

  // 수업 삭제 (CourseDetailModal에서 호출)
  const handleDeleteCourse = async (courseId) => {
    const { error } = await supabase
      .from('courses')
      .delete()
      .eq('id', courseId);

    if (error) {
      Alert.alert('エラー', '削除に失敗しました');
    } else {
      setSelectedCourse(null);
      fetchCourses();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* ── 상단 헤더 ── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>時間割</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate('CourseAdd')}
        >
          <Text style={styles.addButtonText}>＋ 追加</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{ flex: 1 }} size="large" color={colors.primary} />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* ── 요일 헤더 행 (月火水木金) ── */}
          <View style={styles.dayHeaderRow}>
            {/* 교시 열 공간 확보 */}
            <View style={{ width: PERIOD_COL_WIDTH }} />
            {DAYS.map((day, i) => {
              const isToday = i === TODAY_COL;
              return (
                <View
                  key={i}
                  style={[
                    styles.dayHeaderCell,
                    isToday && { backgroundColor: todayColor + '18', borderRadius: 8, marginHorizontal: 2 },
                  ]}
                >
                  <Text style={[
                    styles.dayHeaderText,
                    isToday && { color: todayColor, fontWeight: '800' },
                  ]}>
                    {day}
                  </Text>
                  {isToday && <View style={[styles.todayDot, { backgroundColor: todayColor }]} />}
                </View>
              );
            })}
          </View>

          {/* ── 교시별 행 (1~8교시) ── */}
          {PERIODS.map((period) => (
            <View key={period} style={styles.periodRow}>
              {/* 교시 번호 + 시간 */}
              <View style={styles.periodLabelCell}>
                <Text style={styles.periodLabelText}>{period}</Text>
                <Text style={styles.periodTimeText}>{PERIOD_TIMES[period]}</Text>
              </View>

              {/* 요일별 셀 */}
              {DAYS.map((_, dayIndex) => {
                const course = getCourse(dayIndex, period);
                // 과목 색상 (수업 있을 때만)
                const color = course ? getCourseColor(course.id) : null;
                return (
                  <TouchableOpacity
                    key={dayIndex}
                    style={[
                      styles.cell,
                      course
                        ? {
                            backgroundColor: color.bg,
                            borderLeftWidth: 3,
                            borderLeftColor: color.accent,
                          }
                        : styles.cellEmpty,
                    ]}
                    onPress={() => {
                      if (course) {
                        // 수업 있는 셀 탭 → 상세 모달 열기
                        setSelectedCourse(course);
                      } else {
                        // 빈 셀 탭 → 해당 요일/교시 미리 선택된 추가 화면
                        navigation.navigate('CourseAdd', { day: dayIndex, period });
                      }
                    }}
                    activeOpacity={0.75}
                  >
                    {course ? (
                      <>
                        <Text
                          style={[styles.courseName, { color: color.accent }]}
                          numberOfLines={2}
                        >
                          {course.name}
                        </Text>
                        {course.professor_name ? (
                          <Text
                            style={[styles.professorName, { color: color.accent }]}
                            numberOfLines={1}
                          >
                            {course.professor_name}
                          </Text>
                        ) : null}
                      </>
                    ) : (
                      // 빈 셀에 + 아이콘 (호버 느낌)
                      <Text style={styles.emptyCellPlus}>＋</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}

          {/* ── 하단 메뉴 카드 (강의평가 / 공강맞추기) ── */}
          <View style={styles.menuSection}>
            <Text style={styles.menuSectionTitle}>授業関連機能</Text>
            <TouchableOpacity
              style={styles.menuCard}
              activeOpacity={0.75}
              onPress={() => navigation.navigate('CourseReview')}
            >
              <Text style={styles.menuCardIcon}>📝</Text>
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
              <Text style={styles.menuCardIcon}>📅</Text>
              <View style={styles.menuCardText}>
                <Text style={styles.menuCardTitle}>空き時間合わせ</Text>
                <Text style={styles.menuCardDesc}>友達と共通の空き時間を探す</Text>
              </View>
              <Text style={styles.menuCardChevron}>›</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuCard}
              activeOpacity={0.75}
              onPress={() => Linking.openURL(SYLLABUS_URL)}
            >
              <Text style={styles.menuCardIcon}>📖</Text>
              <View style={styles.menuCardText}>
                <Text style={styles.menuCardTitle}>シラバス</Text>
                <Text style={styles.menuCardDesc}>國士舘大学 シラバス検索システム</Text>
              </View>
              <Text style={styles.menuCardChevron}>›</Text>
            </TouchableOpacity>
          </View>

          {/* 하단 여백 */}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}

      {/* 수업이 아직 없을 때 안내 오버레이 */}
      {!loading && courses.length === 0 && (
        <View style={styles.emptyOverlay}>
          <Text style={styles.emptyEmoji}>📚</Text>
          <Text style={styles.emptyText}>まだ授業がありません</Text>
          <Text style={styles.emptySubText}>空きコマをタップして授業を追加しよう</Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => navigation.navigate('CourseAdd')}
          >
            <Text style={styles.emptyButtonText}>＋ 授業を追加する</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 수업 상세 모달 (수업 셀 탭 시 표시) */}
      <CourseDetailModal
        course={selectedCourse}
        onClose={() => setSelectedCourse(null)}
        onDelete={handleDeleteCourse}
      />
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
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  addButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },

  // 요일 헤더
  dayHeaderRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 8,
    marginBottom: 2,
  },
  dayHeaderCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 2,
  },
  dayHeaderText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
  },

  // 교시 행
  periodRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  periodLabelCell: {
    width: PERIOD_COL_WIDTH,
    height: ROW_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  periodLabelText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  periodTimeText: {
    fontSize: 9,
    color: colors.textDisabled,
    marginTop: 2,
  },

  // 수업 셀
  cell: {
    flex: 1,
    height: ROW_HEIGHT,
    marginHorizontal: 1,
    borderRadius: 6,
    padding: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellEmpty: {
    backgroundColor: colors.surface,
  },
  courseName: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 15,
  },
  professorName: {
    fontSize: 9,
    textAlign: 'center',
    marginTop: 2,
    opacity: 0.75,
  },
  // 하단 메뉴 섹션
  menuSection: {
    marginHorizontal: 12,
    marginTop: 16,
  },
  menuSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
    paddingLeft: 4,
  },
  menuCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  menuCardIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  menuCardText: {
    flex: 1,
  },
  menuCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  menuCardDesc: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  menuCardChevron: {
    fontSize: 20,
    color: colors.textDisabled,
    lineHeight: 24,
  },

  // 빈 셀의 + 아이콘
  emptyCellPlus: {
    fontSize: 16,
    color: colors.border,
    fontWeight: '300',
  },

  // 빈 상태 안내 오버레이
  emptyOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 56,
    backgroundColor: 'rgba(242,244,246,0.92)',
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  emptySubText: {
    fontSize: 13,
    color: colors.textDisabled,
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
