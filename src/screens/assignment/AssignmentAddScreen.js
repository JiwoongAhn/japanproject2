import React, { useState, useCallback } from 'react';
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
import { isAssignmentFormValid } from '../../utils/assignment';
import { supabase } from '../../lib/supabase';

// ──────────────────────────────────────────────────
// 인라인 달력 컴포넌트
// ──────────────────────────────────────────────────
const WEEK_DAYS = ['日', '月', '火', '水', '木', '金', '土'];

function CalendarPicker({ selectedDate, onSelectDate }) {
  // selectedDate: 'YYYY-MM-DD' 문자열 또는 ''
  const today = new Date();

  // 현재 보여주는 연/월
  const [viewYear, setViewYear] = useState(
    selectedDate ? parseInt(selectedDate.slice(0, 4)) : today.getFullYear()
  );
  const [viewMonth, setViewMonth] = useState(
    selectedDate ? parseInt(selectedDate.slice(5, 7)) - 1 : today.getMonth()
  );
  // viewMonth: 0~11 (JS Date 기준)

  // 이전 달로 이동
  const goPrev = () => {
    if (viewMonth === 0) {
      setViewYear(y => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth(m => m - 1);
    }
  };

  // 다음 달로 이동
  const goNext = () => {
    if (viewMonth === 11) {
      setViewYear(y => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth(m => m + 1);
    }
  };

  // 이번 달 1일이 무슨 요일인지 계산
  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay(); // 0=일,1=월...
  // 이번 달 총 일수
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  // 달력 그리드 셀 배열 만들기 (앞 빈칸 + 날짜 + 뒤 빈칸)
  const cells = [];
  for (let i = 0; i < firstDayOfMonth; i++) cells.push(null); // 빈 칸
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  // 7의 배수가 되도록 뒤 빈칸
  while (cells.length % 7 !== 0) cells.push(null);

  // 날짜를 'YYYY-MM-DD' 로 변환
  const toDateStr = (day) => {
    const mm = String(viewMonth + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${viewYear}-${mm}-${dd}`;
  };

  // 오늘 날짜 문자열
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
              i === 0 && { color: '#EF4444' }, // 일요일 빨강
              i === 6 && { color: '#3182F6' }, // 토요일 파랑
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
          const col = idx % 7; // 0=일, 6=토

          return (
            <TouchableOpacity
              key={idx}
              style={[
                calStyles.cell,
                isSelected && calStyles.cellSelected,
                isToday && !isSelected && calStyles.cellToday,
              ]}
              onPress={() => onSelectDate(dateStr)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  calStyles.dayText,
                  col === 0 && { color: '#EF4444' },
                  col === 6 && { color: '#3182F6' },
                  isSelected && calStyles.dayTextSelected,
                ]}
              >
                {day}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const calStyles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  weekRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  weekLabel: {
    flex: 1,
    textAlign: 'center',
    paddingVertical: 6,
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellSelected: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    margin: 2,
    width: undefined,
    aspectRatio: 1,
    // 원형으로 만들기 위해 width 고정이 필요 — 부모 flex 기반이므로 paddingVertical 조정
  },
  cellToday: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 999,
    margin: 2,
  },
  dayText: {
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  dayTextSelected: {
    color: '#FFFFFF',
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
  const [courseName, setCourseName] = useState('');
  const [title, setTitle]           = useState('');
  const [dueDate, setDueDate]       = useState('');   // 'YYYY-MM-DD'
  const [status, setStatus]         = useState('pending');
  const [saving, setSaving]         = useState(false);

  const isFormValid = courseName.trim().length > 0 && title.trim().length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(dueDate);

  // 저장 버튼 — Supabase에 과제 저장
  const handleSave = async () => {
    if (!isFormValid || saving) return;
    setSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('エラー', 'ログインが必要です');
        return;
      }

      // 입력한 수업명과 일치하는 수업 찾기 (있으면 course_id 연결)
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
        Alert.alert('エラー', '課題の保存に失敗しました');
        return;
      }

      navigation.goBack();
    } catch (e) {
      Alert.alert('エラー', `通信エラーが発生しました。\n${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  // 선택된 날짜를 보기 좋게 표시 (YYYY年MM月DD日)
  const displayDate = dueDate
    ? `${dueDate.slice(0, 4)}年${dueDate.slice(5, 7)}月${dueDate.slice(8, 10)}日`
    : '';

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        {/* ── 상단 헤더 ── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.cancelText}>キャンセル</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>課題を追加</Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView
          style={styles.scrollView}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── 수업명 입력 ── */}
          <View style={styles.section}>
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
          </View>

          {/* ── 과제 제목 입력 ── */}
          <View style={styles.section}>
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
          </View>

          {/* ── 달력 날짜 선택 ── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              提出期限 <Text style={styles.required}>*</Text>
            </Text>

            {/* 선택된 날짜 표시 배지 */}
            {displayDate ? (
              <View style={styles.selectedDateBadge}>
                <Text style={styles.selectedDateText}>📅 {displayDate}</Text>
              </View>
            ) : (
              <Text style={styles.dateHint}>カレンダーから日付を選んでください</Text>
            )}

            {/* 인라인 달력 */}
            <CalendarPicker
              selectedDate={dueDate}
              onSelectDate={setDueDate}
            />
          </View>

          {/* ── 제출 상태 선택 ── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>提出状態</Text>
            <View style={styles.buttonRow}>
              {STATUS_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.selectButton,
                    status === opt.value && styles.selectButtonActive,
                  ]}
                  onPress={() => setStatus(opt.value)}
                >
                  <Text
                    style={[
                      styles.selectButtonText,
                      status === opt.value && styles.selectButtonTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>

        {/* ── 저장 버튼 ── */}
        <View style={styles.saveButtonContainer}>
          <TouchableOpacity
            style={[styles.saveButton, (!isFormValid || saving) && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={!isFormValid || saving}
          >
            {saving
              ? <ActivityIndicator color="#fff" />
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  cancelText: {
    fontSize: 15,
    color: colors.primary,
    width: 60,
  },

  scrollView: {
    flex: 1,
    paddingTop: 16,
  },

  // 입력 섹션 카드
  section: {
    backgroundColor: colors.surface,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  required: {
    color: colors.danger,
  },

  // 텍스트 입력창
  textInput: {
    fontSize: 16,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.background,
  },

  // 선택된 날짜 배지
  selectedDateBadge: {
    backgroundColor: colors.primary + '18',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  selectedDateText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  dateHint: {
    fontSize: 12,
    color: colors.textDisabled,
    marginBottom: 10,
  },

  // 상태 선택 버튼 행
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  selectButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  selectButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  selectButtonText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  selectButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },

  // 저장 버튼
  saveButtonContainer: {
    padding: 16,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
