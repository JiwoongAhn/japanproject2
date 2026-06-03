import React, { useState } from 'react';
import { useRoute } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { colors } from '../../constants/colors';
import { spacing, radius, shadow } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import Card from '../../components/Card';
import { supabase } from '../../lib/supabase';

// ──────────────────────────────────────────────────
// 인라인 달력 컴포넌트
// ──────────────────────────────────────────────────
const WEEK_DAYS = ['日', '月', '火', '水', '木', '金', '土'];

function CalendarPicker({ selectedDate, onSelectDate }) {
  const today = new Date();

  const [viewYear, setViewYear] = useState(
    selectedDate ? parseInt(selectedDate.slice(0, 4)) : today.getFullYear()
  );
  const [viewMonth, setViewMonth] = useState(
    selectedDate ? parseInt(selectedDate.slice(5, 7)) - 1 : today.getMonth()
  );

  const goPrev = () => {
    if (viewMonth === 0) {
      setViewYear(y => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth(m => m - 1);
    }
  };

  const goNext = () => {
    if (viewMonth === 11) {
      setViewYear(y => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth(m => m + 1);
    }
  };

  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < firstDayOfMonth; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const toDateStr = (day) => {
    const mm = String(viewMonth + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${viewYear}-${mm}-${dd}`;
  };

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  return (
    <View style={calStyles.container}>
      {/* 연월 네비게이션 */}
      <View style={calStyles.navRow}>
        <TouchableOpacity onPress={goPrev} style={calStyles.navBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={calStyles.navArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={calStyles.monthTitle}>
          {viewYear}年{viewMonth + 1}月
        </Text>
        <TouchableOpacity onPress={goNext} style={calStyles.navBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={calStyles.navArrow}>›</Text>
        </TouchableOpacity>
      </View>

      {/* 요일 헤더 */}
      <View style={calStyles.weekRow}>
        {WEEK_DAYS.map((d, i) => (
          <Text
            key={i}
            style={[
              calStyles.weekLabel,
              i === 0 && { color: '#EF4444' },
              i === 6 && { color: colors.primary },
            ]}
          >
            {d}
          </Text>
        ))}
      </View>

      {/* 날짜 그리드 */}
      <View style={calStyles.grid}>
        {cells.map((day, idx) => {
          if (!day) return <View key={idx} style={calStyles.cell} />;

          const dateStr = toDateStr(day);
          const isSelected = dateStr === selectedDate;
          const isToday = dateStr === todayStr;
          const col = idx % 7;

          return (
            <TouchableOpacity
              key={idx}
              style={calStyles.cell}
              onPress={() => onSelectDate(dateStr)}
              activeOpacity={0.7}
            >
              <View style={[
                calStyles.dayCircle,
                isSelected && calStyles.dayCircleSelected,
                isToday && !isSelected && calStyles.dayCircleToday,
              ]}>
                <Text
                  style={[
                    calStyles.dayText,
                    col === 0 && { color: '#EF4444' },
                    col === 6 && { color: colors.primary },
                    isSelected && calStyles.dayTextSelected,
                  ]}
                >
                  {day}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const calStyles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  navBtn: {
    width: 36,
    alignItems: 'center',
  },
  navArrow: {
    fontSize: 24,
    color: colors.primary,
    fontWeight: '600',
    lineHeight: 28,
  },
  monthTitle: {
    ...typography.subtitle,
    color: colors.textPrimary,
  },
  weekRow: {
    flexDirection: 'row',
    paddingBottom: spacing.sm,
  },
  weekLabel: {
    flex: 1,
    textAlign: 'center',
    paddingVertical: 6,
    ...typography.captionStrong,
    color: colors.textSecondary,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingBottom: spacing.sm,
  },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleSelected: {
    backgroundColor: colors.primary,
  },
  dayCircleToday: {
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  dayText: {
    ...typography.body2,
    color: colors.textPrimary,
  },
  dayTextSelected: {
    color: colors.white,
    fontWeight: '700',
  },
});

// ──────────────────────────────────────────────────
// 상태 선택지
// ──────────────────────────────────────────────────
const STATUS_OPTIONS = [
  { label: '未提出', value: 'pending' },
  { label: '提出済', value: 'submitted' },
];

// ──────────────────────────────────────────────────
// 메인 화면
// ──────────────────────────────────────────────────
export default function AssignmentAddScreen({ navigation }) {
  // manaba 공지 미리보기에서 "과제로 추가하기"로 진입할 때 prefill 값을 받는다.
  // 일반 "+ 추가" 진입에는 params가 없으므로 빈 값이 기본.
  const route = useRoute();
  const prefill = route.params ?? {};

  const [courseName, setCourseName] = useState(prefill.courseName ?? '');
  const [title, setTitle]           = useState(prefill.title ?? '');
  const [dueDate, setDueDate]       = useState(prefill.dueDate ?? '');
  const [status, setStatus]         = useState('pending');
  const [saving, setSaving]         = useState(false);

  const isFormValid = courseName.trim().length > 0 && title.trim().length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(dueDate);

  const handleSave = async () => {
    if (!isFormValid || saving) return;
    setSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('お知らせ', 'ログインが必要です');
        return;
      }

      // 입력한 수업명과 일치하는 수업 찾기
      const { data: courseData } = await supabase
        .from('courses')
        .select('id')
        .eq('user_id', user.id)
        .ilike('name', courseName.trim())
        .maybeSingle();

      const { error } = await supabase.from('assignments').insert({
        user_id: user.id,
        course_id: courseData?.id ?? null,
        title: title.trim(),
        due_date: dueDate,
        status,
      });

      if (error) {
        Alert.alert('お知らせ', '課題を保存できませんでした');
        return;
      }

      navigation.goBack();
    } catch (e) {
      Alert.alert('お知らせ', `通信できませんでした。\n${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const displayDate = dueDate
    ? `${dueDate.slice(0, 4)}年${dueDate.slice(5, 7)}月${dueDate.slice(8, 10)}日`
    : '';

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        {/* 헤더 */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerSide}>
            <Text style={styles.cancelText}>キャンセル</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>課題を追加</Text>
          <View style={styles.headerSide} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* 수업명 */}
          <Card padding="lg" radius="lg" style={styles.section}>
            <Text style={styles.sectionLabel}>
              科目名 <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.textInput}
              placeholder="例: 経営学概論"
              placeholderTextColor={colors.textDisabled}
              value={courseName}
              onChangeText={setCourseName}
              maxLength={30}
            />
          </Card>

          {/* 과제 제목 */}
          <Card padding="lg" radius="lg" style={styles.section}>
            <Text style={styles.sectionLabel}>
              課題タイトル <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.textInput}
              placeholder="例: 第3章 レポート提出"
              placeholderTextColor={colors.textDisabled}
              value={title}
              onChangeText={setTitle}
              maxLength={60}
            />
          </Card>

          {/* 마감일 + 달력 */}
          <Card padding="lg" radius="lg" style={styles.section}>
            <Text style={styles.sectionLabel}>
              提出期限 <Text style={styles.required}>*</Text>
            </Text>

            {displayDate ? (
              <View style={styles.selectedDateBadge}>
                <Text style={styles.selectedDateText}>📅 {displayDate}</Text>
              </View>
            ) : (
              <Text style={styles.dateHint}>カレンダーから日付を選んでください</Text>
            )}

            <CalendarPicker
              selectedDate={dueDate}
              onSelectDate={setDueDate}
            />
          </Card>

          {/* 제출 상태 */}
          <Card padding="lg" radius="lg" style={styles.section}>
            <Text style={styles.sectionLabel}>提出状態</Text>
            <View style={styles.buttonRow}>
              {STATUS_OPTIONS.map((opt) => {
                const active = status === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.selectButton, active && styles.selectButtonActive]}
                    onPress={() => setStatus(opt.value)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.selectButtonText, active && styles.selectButtonTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Card>

          <View style={{ height: spacing.huge }} />
        </ScrollView>

        {/* 저장 버튼 */}
        <View style={styles.saveButtonContainer}>
          <TouchableOpacity
            style={[styles.saveButton, (!isFormValid || saving) && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={!isFormValid || saving}
            activeOpacity={0.85}
          >
            {saving
              ? <ActivityIndicator color={colors.white} />
              : <Text style={styles.saveButtonText}>保存する</Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background,
  },
  headerSide: {
    width: 80,
  },
  headerTitle: {
    ...typography.subtitle,
    color: colors.textPrimary,
  },
  cancelText: {
    ...typography.body2,
    color: colors.primary,
  },

  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
  },

  // 섹션 카드
  section: {
    marginBottom: spacing.md,
  },
  sectionLabel: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  required: {
    color: colors.danger,
  },

  // 텍스트 입력
  textInput: {
    ...typography.body1,
    color: colors.textPrimary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.background,
  },

  // 선택된 날짜 배지
  selectedDateBadge: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
    alignSelf: 'flex-start',
  },
  selectedDateText: {
    ...typography.captionStrong,
    color: colors.primary,
  },
  dateHint: {
    ...typography.caption,
    color: colors.textDisabled,
    marginBottom: spacing.md,
  },

  // 상태 버튼
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  selectButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    alignItems: 'center',
  },
  selectButtonActive: {
    backgroundColor: colors.primary,
  },
  selectButtonText: {
    ...typography.bodyStrong,
    color: colors.textSecondary,
  },
  selectButtonTextActive: {
    color: colors.white,
  },

  // 저장 버튼
  saveButtonContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    backgroundColor: colors.background,
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.4,
  },
  saveButtonText: {
    color: colors.white,
    ...typography.subtitle,
  },
});
