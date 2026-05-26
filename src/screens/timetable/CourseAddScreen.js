import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { COURSE_COLORS } from '../../constants/courseColors';
import Card from '../../components/Card';
import Button from '../../components/Button';

// 요일 선택지 (0=월, 1=화, ..., 4=금)
const DAYS = [
  { label: '月', value: 0 },
  { label: '火', value: 1 },
  { label: '水', value: 2 },
  { label: '木', value: 3 },
  { label: '金', value: 4 },
];

// 교시 선택지 (1~8교시)
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8];

export default function CourseAddScreen({ route, navigation }) {
  // route.params.course 가 있으면 편집 모드 (없으면 신규 추가 모드)
  const editingCourse = route.params?.course ?? null;
  const isEditMode = !!editingCourse;

  // 빈 셀 탭 시 route.params로 요일/교시 pre-fill 지원
  // 편집 모드면 기존 수업 값으로 pre-fill
  const [courseName, setCourseName] = useState(editingCourse?.name ?? '');
  const [selectedDay, setSelectedDay] = useState(
    editingCourse?.day_of_week ?? route.params?.day ?? null
  );
  const [selectedPeriod, setSelectedPeriod] = useState(
    editingCourse?.period ?? route.params?.period ?? null
  );
  const [professorName, setProfessorName] = useState(editingCourse?.professor_name ?? '');
  const [memo, setMemo] = useState(editingCourse?.memo ?? '');
  const [selectedColorIndex, setSelectedColorIndex] = useState(
    Number.isInteger(editingCourse?.color_index) ? editingCourse.color_index : 0
  );
  const [saving, setSaving] = useState(false);

  // 필수 항목 모두 입력됐을 때만 저장 버튼 활성화
  const isFormValid =
    courseName.trim().length > 0 &&
    selectedDay !== null &&
    selectedPeriod !== null;

  const handleSave = async () => {
    if (!isFormValid) return;
    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();

    // 추가/편집 공통으로 저장할 값
    const payload = {
      name: courseName.trim(),
      day_of_week: selectedDay,
      period: selectedPeriod,
      professor_name: professorName.trim() || null,
      memo: memo.trim() || null,
      color_index: selectedColorIndex,
    };

    let error;
    let data;
    if (isEditMode) {
      // 편집 모드 — 기존 행 업데이트 (user_id는 RLS로 보호되므로 그대로 둠)
      // .select()로 실제 반영된 행을 돌려받아, RLS 등으로 0건 처리되는 조용한 실패를 감지
      ({ data, error } = await supabase
        .from('courses')
        .update(payload)
        .eq('id', editingCourse.id)
        .select());
    } else {
      // 신규 추가 모드
      ({ data, error } = await supabase
        .from('courses')
        .insert({ ...payload, user_id: user.id })
        .select());
    }

    setSaving(false);

    // error가 없어도 반영된 행이 0건이면 실패로 간주 (RLS 정책 누락 등)
    if (error || !data || data.length === 0) {
      // 부드러운 실패 문구
      Alert.alert('お知らせ', '授業をうまく保存できませんでした。もう一度お試しください');
    } else {
      navigation.goBack();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        {/* ── 헤더 (보더 없는 토스 스타일) ── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerSide}>
            <Text style={styles.cancelText}>キャンセル</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{isEditMode ? '授業を編集' : '授業を追加'}</Text>
          <View style={styles.headerSide} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── 과목명 ── */}
          <Card style={styles.section}>
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

          {/* ── 요일 선택 ── */}
          <Card style={styles.section}>
            <Text style={styles.sectionLabel}>
              曜日 <Text style={styles.required}>*</Text>
            </Text>
            <View style={styles.chipRow}>
              {DAYS.map((day) => {
                const active = selectedDay === day.value;
                return (
                  <TouchableOpacity
                    key={day.value}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setSelectedDay(day.value)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {day.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Card>

          {/* ── 교시 선택 ── */}
          <Card style={styles.section}>
            <Text style={styles.sectionLabel}>
              時限 <Text style={styles.required}>*</Text>
            </Text>
            <View style={styles.chipRow}>
              {PERIODS.map((period) => {
                const active = selectedPeriod === period;
                return (
                  <TouchableOpacity
                    key={period}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setSelectedPeriod(period)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {period}限
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Card>

          {/* ── 교수명 ── */}
          <Card style={styles.section}>
            <Text style={styles.sectionLabel}>
              担当教員 <Text style={styles.optional}>(任意)</Text>
            </Text>
            <TextInput
              style={styles.textInput}
              placeholder="例: 田中 一郎"
              placeholderTextColor={colors.textDisabled}
              value={professorName}
              onChangeText={setProfessorName}
              maxLength={20}
            />
          </Card>

          {/* ── 메모 ── */}
          <Card style={styles.section}>
            <Text style={styles.sectionLabel}>
              メモ <Text style={styles.optional}>(任意)</Text>
            </Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              placeholder="例: テスト範囲は3章まで / 出席重視"
              placeholderTextColor={colors.textDisabled}
              value={memo}
              onChangeText={setMemo}
              maxLength={100}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </Card>

          {/* ── 색상 ── */}
          <Card style={styles.section}>
            <Text style={styles.sectionLabel}>カラー</Text>
            <View style={styles.colorRow}>
              {COURSE_COLORS.map((color, index) => {
                const selected = selectedColorIndex === index;
                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.colorDot,
                      { backgroundColor: color.bg, borderColor: selected ? color.accent : 'transparent' },
                    ]}
                    onPress={() => setSelectedColorIndex(index)}
                    activeOpacity={0.8}
                  >
                    {selected && (
                      <Text style={[styles.colorDotCheck, { color: color.accent }]}>✓</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </Card>

          <View style={{ height: spacing.huge }} />
        </ScrollView>

        {/* ── 저장 버튼 ── */}
        <View style={styles.saveButtonContainer}>
          <Button
            title={isEditMode ? '変更を保存' : '保存する'}
            onPress={handleSave}
            disabled={!isFormValid}
            loading={saving}
          />
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

  // ── 헤더 ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors.background,
  },
  headerSide: {
    minWidth: 72,
  },
  cancelText: {
    ...typography.body2,
    color: colors.textSecondary,
  },
  headerTitle: {
    ...typography.subtitle,
    color: colors.textPrimary,
  },

  // ── 스크롤 영역 ──
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.md,
  },

  // ── 섹션 카드 ──
  section: {
    // Card 컴포넌트가 padding·radius·shadow 적용
  },
  sectionLabel: {
    ...typography.captionStrong,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  required: {
    color: colors.danger,
  },
  optional: {
    ...typography.caption,
    color: colors.textDisabled,
    fontWeight: '400',
  },

  // ── 텍스트 입력 ──
  textInput: {
    ...typography.body1,
    color: colors.textPrimary,
    backgroundColor: colors.gray50,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  // 메모 — 여러 줄 입력
  textArea: {
    minHeight: 80,
    paddingTop: spacing.md,
  },

  // ── 칩 (요일·교시) ──
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.gray50,
  },
  chipActive: {
    backgroundColor: colors.primary,
  },
  chipText: {
    ...typography.bodyStrong,
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.white,
  },

  // ── 색상 ──
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  colorDot: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorDotCheck: {
    ...typography.captionStrong,
    fontWeight: '800',
  },

  // ── 저장 버튼 ──
  saveButtonContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    backgroundColor: colors.background,
  },
});
