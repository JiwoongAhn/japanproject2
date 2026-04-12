import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { colors } from '../../constants/colors';
import { COURSE_COLORS } from '../../constants/courseColors';

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
  // 빈 셀 탭 시 route.params로 요일/교시 pre-fill 지원
  const [courseName, setCourseName] = useState('');
  const [selectedDay, setSelectedDay] = useState(route.params?.day ?? null);
  const [selectedPeriod, setSelectedPeriod] = useState(route.params?.period ?? null);
  const [professorName, setProfessorName] = useState('');
  const [selectedColorIndex, setSelectedColorIndex] = useState(0);
  const [saving, setSaving] = useState(false);

  // 필수 항목 모두 입력됐을 때만 저장 버튼 활성화
  const isFormValid =
    courseName.trim().length > 0 &&
    selectedDay !== null &&
    selectedPeriod !== null;

  // 저장 버튼 클릭 시 실행
  const handleSave = async () => {
    if (!isFormValid) return;

    setSaving(true);

    // 현재 로그인한 사용자 정보 가져오기
    const { data: { user } } = await supabase.auth.getUser();

    // Supabase courses 테이블에 수업 저장
    // ※ color_index 컬럼은 DB migration 후 아래 주석을 해제해 활성화 가능
    const { error } = await supabase.from('courses').insert({
      user_id: user.id,
      name: courseName.trim(),
      day_of_week: selectedDay,
      period: selectedPeriod,
      professor_name: professorName.trim() || null,
      // color_index: selectedColorIndex,  // DB migration 후 활성화
    });

    setSaving(false);

    if (error) {
      Alert.alert('エラー', '授業の保存に失敗しました');
    } else {
      // 저장 성공 → 시간표 화면으로 돌아가기
      navigation.goBack();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* KeyboardAvoidingView: 키보드가 올라올 때 화면이 함께 올라가도록 */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        {/* ── 상단 헤더 ── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.cancelText}>キャンセル</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>授業を追加</Text>
          {/* 우측 공간 균형 맞추기 */}
          <View style={{ width: 60 }} />
        </View>

        <ScrollView
          style={styles.scrollView}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── 과목명 입력 ── */}
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

          {/* ── 요일 선택 ── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              曜日 <Text style={styles.required}>*</Text>
            </Text>
            <View style={styles.buttonRow}>
              {DAYS.map((day) => (
                <TouchableOpacity
                  key={day.value}
                  style={[
                    styles.selectButton,
                    selectedDay === day.value && styles.selectButtonActive,
                  ]}
                  onPress={() => setSelectedDay(day.value)}
                >
                  <Text
                    style={[
                      styles.selectButtonText,
                      selectedDay === day.value && styles.selectButtonTextActive,
                    ]}
                  >
                    {day.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* ── 교시 선택 ── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              時限 <Text style={styles.required}>*</Text>
            </Text>
            <View style={styles.buttonRow}>
              {PERIODS.map((period) => (
                <TouchableOpacity
                  key={period}
                  style={[
                    styles.selectButton,
                    selectedPeriod === period && styles.selectButtonActive,
                  ]}
                  onPress={() => setSelectedPeriod(period)}
                >
                  <Text
                    style={[
                      styles.selectButtonText,
                      selectedPeriod === period && styles.selectButtonTextActive,
                    ]}
                  >
                    {period}限
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* ── 교수명 입력 (선택) ── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              担当教員{' '}
              <Text style={styles.optional}>(任意)</Text>
            </Text>
            <TextInput
              style={styles.textInput}
              placeholder="例: 田中 一郎"
              placeholderTextColor={colors.textDisabled}
              value={professorName}
              onChangeText={setProfessorName}
              maxLength={20}
            />
          </View>

          {/* ── 색상 선택 ── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>カラー</Text>
            <View style={styles.colorRow}>
              {COURSE_COLORS.map((color, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.colorDot,
                    { backgroundColor: color.bg, borderColor: color.accent },
                    selectedColorIndex === index && styles.colorDotSelected,
                  ]}
                  onPress={() => setSelectedColorIndex(index)}
                >
                  {selectedColorIndex === index && (
                    <Text style={[styles.colorDotCheck, { color: color.accent }]}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.colorNote}>
              ※ カラーはDB連携後に反映されます
            </Text>
          </View>

          {/* 하단 여백 (키보드 올라올 때 스크롤 공간 확보) */}
          <View style={{ height: 40 }} />
        </ScrollView>

        {/* ── 저장 버튼 ── */}
        <View style={styles.saveButtonContainer}>
          <TouchableOpacity
            style={[
              styles.saveButton,
              (!isFormValid || saving) && styles.saveButtonDisabled,
            ]}
            onPress={handleSave}
            disabled={!isFormValid || saving}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.saveButtonText}>保存する</Text>
            )}
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

  // 스크롤 영역
  scrollView: {
    flex: 1,
    paddingTop: 16,
  },

  // 입력 섹션 공통
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
  optional: {
    color: colors.textSecondary,
    fontWeight: '400',
    fontSize: 12,
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

  // 선택 버튼 행 (요일·교시)
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
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

  // 색상 선택
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  colorDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorDotSelected: {
    borderWidth: 2,
  },
  colorDotCheck: {
    fontSize: 14,
    fontWeight: '700',
  },
  colorNote: {
    fontSize: 11,
    color: colors.textDisabled,
    marginTop: 10,
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
