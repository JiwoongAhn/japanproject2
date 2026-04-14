import React, { useState } from 'react';
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
} from 'react-native';
import { colors } from '../../constants/colors';
import { formatDueDate, isAssignmentFormValid } from '../../utils/assignment';

// 상태 선택지
const STATUS_OPTIONS = [
  { label: '未提出', value: 'pending' },
  { label: '提出済', value: 'submitted' },
];

export default function AssignmentAddScreen({ navigation }) {
  const [courseName, setCourseName]   = useState('');  // 수업명
  const [title, setTitle]             = useState('');  // 과제 제목
  const [dueDate, setDueDate]         = useState('');  // 마감일 (YYYY-MM-DD)
  const [status, setStatus]           = useState('pending');  // 상태 (기본: 미제출)

  // 필수 항목이 모두 채워졌는지 확인
  const isFormValid = isAssignmentFormValid(courseName, title, dueDate);

  // 마감일 입력 시 자동으로 - 붙여주기
  const handleDueDateChange = (text) => {
    setDueDate(formatDueDate(text));
  };

  // 저장 버튼 — 목업 단계: 실제 저장 없이 화면만 돌아가요
  // TODO: Supabase 연결 후 여기에 insert 로직 추가
  const handleSave = () => {
    if (!isFormValid) return;
    navigation.goBack();
  };

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
          {/* 우측 균형 맞추기 */}
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

          {/* ── 마감일 입력 ── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              提出期限 <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.textInput}
              placeholder="例: 2026-04-15"
              placeholderTextColor={colors.textDisabled}
              value={dueDate}
              onChangeText={handleDueDateChange}
              keyboardType="numeric"
              maxLength={10}
            />
            {/* 형식 오류 안내 */}
            {dueDate.length > 0 && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate) && (
              <Text style={styles.inputError}>YYYY-MM-DD 形式で入力してください</Text>
            )}
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
            style={[styles.saveButton, !isFormValid && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={!isFormValid}
          >
            <Text style={styles.saveButtonText}>保存する</Text>
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
  inputError: {
    fontSize: 12,
    color: colors.danger,
    marginTop: 6,
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
