import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { colors, pastel } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthProvider';
import { toggleTag as toggleTagFn, addCustomTag as addCustomTagFn } from '../../utils/review';
import Card from '../../components/Card';

// 미리 정의된 태그 추천 목록 (밀러 7±2 — 10개로 컴팩트하게)
const SUGGESTED_TAGS = [
  'わかりやすい', '出席必須', '課題多め', 'テスト重要',
  'おもしろい', '単位楽', '難しい', '予習必須',
  '実践的', 'おすすめ',
];

// 별점 선택 컴포넌트
function StarSelector({ value, onChange }) {
  return (
    <View style={starStyles.row}>
      {[1, 2, 3, 4, 5].map((star) => (
        <TouchableOpacity
          key={star}
          onPress={() => onChange(star)}
          activeOpacity={0.7}
          style={starStyles.starButton}
        >
          <Text style={[starStyles.star, { color: star <= value ? pastel.yellow.accent : colors.gray200 }]}>
            ★
          </Text>
        </TouchableOpacity>
      ))}
      <Text style={starStyles.ratingLabel}>
        {value === 0 ? '未評価' : ['', '悪い', '普通以下', '普通', '良い', 'とても良い'][value]}
      </Text>
    </View>
  );
}

const starStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  starButton: { padding: 4 },
  star: { fontSize: 32 },
  ratingLabel: { ...typography.body2, color: colors.textSecondary, marginLeft: spacing.sm },
});

export default function CourseReviewCreateScreen({ navigation, route }) {
  const { session, profile } = useAuth();

  // 시간표 셀에서 넘어온 경우 과목명/교수명 미리 채우기
  const { courseName: preCourseName = '', professorName: preProfessorName = '' } = route.params || {};

  const [courseName, setCourseName] = useState(preCourseName);
  const [professorName, setProfessorName] = useState(preProfessorName);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [customTag, setCustomTag] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = courseName.trim() !== '' && rating > 0;

  const toggleTag = (tag) => {
    setSelectedTags(prev => toggleTagFn(tag, prev));
  };

  const addCustomTag = () => {
    const next = addCustomTagFn(customTag, selectedTags);
    if (next !== selectedTags) {
      setSelectedTags(next);
      setCustomTag('');
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);

    if (!session?.user) {
      Alert.alert('お知らせ', 'ログインが必要です');
      setSubmitting(false);
      return;
    }

    const { error } = await supabase.from('course_reviews').insert({
      user_id: session.user.id,
      university: profile.university,
      course_name: courseName.trim(),
      professor_name: professorName.trim() || null,
      rating,
      comment: comment.trim() || null,
      tags: selectedTags,
    });

    if (error) {
      // 부드러운 실패 문구
      Alert.alert('お知らせ', 'うまく投稿できませんでした。もう一度お試しください');
    } else {
      navigation.goBack();
    }
    setSubmitting(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* ── 헤더 ── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.cancelButton} activeOpacity={0.7}>
            <Text style={styles.cancelText}>キャンセル</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>評価を書く</Text>
          <TouchableOpacity
            style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit || submitting}
            activeOpacity={0.85}
          >
            {submitting
              ? <ActivityIndicator size="small" color={colors.white} />
              : <Text style={styles.submitText}>投稿</Text>
            }
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── 과목명 ── */}
          <Card>
            <Text style={styles.label}>科目名 <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={styles.textInput}
              placeholder="例: 経営学概論"
              placeholderTextColor={colors.textDisabled}
              value={courseName}
              onChangeText={setCourseName}
              maxLength={40}
            />
          </Card>

          {/* ── 교수명 ── */}
          <Card>
            <Text style={styles.label}>担当教員名 <Text style={styles.optional}>(任意)</Text></Text>
            <TextInput
              style={styles.textInput}
              placeholder="例: 田中 一郎"
              placeholderTextColor={colors.textDisabled}
              value={professorName}
              onChangeText={setProfessorName}
              maxLength={30}
            />
          </Card>

          {/* ── 별점 ── */}
          <Card>
            <Text style={styles.label}>評価 <Text style={styles.required}>*</Text></Text>
            <StarSelector value={rating} onChange={setRating} />
          </Card>

          {/* ── 태그 ── */}
          <Card>
            <Text style={styles.label}>タグ <Text style={styles.optional}>(任意・最大8個)</Text></Text>

            <View style={styles.tagGrid}>
              {SUGGESTED_TAGS.map((tag) => {
                const selected = selectedTags.includes(tag);
                return (
                  <TouchableOpacity
                    key={tag}
                    style={[styles.tagChip, selected && styles.tagChipSelected]}
                    onPress={() => toggleTag(tag)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.tagChipText, selected && styles.tagChipTextSelected]}>
                      {selected ? '✓ ' : '# '}{tag}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* 커스텀 태그 입력 */}
            <View style={styles.customTagRow}>
              <TextInput
                style={styles.customTagInput}
                placeholder="タグを直接入力"
                placeholderTextColor={colors.textDisabled}
                value={customTag}
                onChangeText={setCustomTag}
                onSubmitEditing={addCustomTag}
                maxLength={10}
                returnKeyType="done"
              />
              <TouchableOpacity
                style={[
                  styles.addTagButton,
                  (!customTag.trim() || selectedTags.length >= 8) && styles.addTagButtonDisabled,
                ]}
                onPress={addCustomTag}
                disabled={!customTag.trim() || selectedTags.length >= 8}
                activeOpacity={0.85}
              >
                <Text style={styles.addTagButtonText}>追加</Text>
              </TouchableOpacity>
            </View>

            {/* 선택된 커스텀 태그 */}
            {selectedTags.filter(t => !SUGGESTED_TAGS.includes(t)).length > 0 && (
              <View style={styles.customTagsRow}>
                {selectedTags.filter(t => !SUGGESTED_TAGS.includes(t)).map((tag) => (
                  <TouchableOpacity
                    key={tag}
                    style={styles.tagChipSelected}
                    onPress={() => toggleTag(tag)}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.tagChipTextSelected}>✓ {tag}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </Card>

          {/* ── 코멘트 ── */}
          <Card>
            <Text style={styles.label}>コメント <Text style={styles.optional}>(任意)</Text></Text>
            <TextInput
              style={styles.commentInput}
              placeholder="授業の感想を自由に書いてください"
              placeholderTextColor={colors.textDisabled}
              value={comment}
              onChangeText={setComment}
              maxLength={300}
              multiline
              textAlignVertical="top"
            />
            <Text style={styles.charCount}>{comment.length}/300</Text>
          </Card>

          <View style={{ height: spacing.huge }} />
        </ScrollView>
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
  cancelButton: {
    paddingVertical: spacing.xs,
    paddingRight: spacing.sm,
  },
  cancelText: {
    ...typography.body2,
    color: colors.textSecondary,
  },
  headerTitle: {
    ...typography.subtitle,
    color: colors.textPrimary,
  },
  submitButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    minWidth: 64,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: colors.gray300,
  },
  submitText: {
    color: colors.white,
    ...typography.captionStrong,
    fontWeight: '700',
  },

  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.md,
  },

  // ── 라벨 ──
  label: {
    ...typography.captionStrong,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  required: {
    color: colors.danger,
  },
  optional: {
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

  // ── 태그 ──
  tagGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  tagChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.gray50,
  },
  tagChipSelected: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryLight,
  },
  tagChipText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  tagChipTextSelected: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
  },

  // ── 커스텀 태그 입력 ──
  customTagRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  customTagInput: {
    flex: 1,
    ...typography.body2,
    color: colors.textPrimary,
    backgroundColor: colors.gray50,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  addTagButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTagButtonDisabled: {
    backgroundColor: colors.gray300,
  },
  addTagButtonText: {
    color: colors.white,
    ...typography.captionStrong,
    fontWeight: '700',
  },
  customTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },

  // ── 코멘트 ──
  commentInput: {
    ...typography.body2,
    color: colors.textPrimary,
    backgroundColor: colors.gray50,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 120,
    lineHeight: 22,
  },
  charCount: {
    ...typography.small,
    color: colors.textDisabled,
    textAlign: 'right',
    marginTop: spacing.xs + 2,
  },
});
