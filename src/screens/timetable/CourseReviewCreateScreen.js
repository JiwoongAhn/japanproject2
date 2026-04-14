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
} from 'react-native';
import { colors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';
import { toggleTag as toggleTagFn, addCustomTag as addCustomTagFn } from '../../utils/review';

// 미리 정의된 태그 추천 목록
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
          <Text style={[starStyles.star, { color: star <= value ? '#F59E0B' : colors.border }]}>
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
  ratingLabel: { fontSize: 14, color: colors.textSecondary, marginLeft: 8 },
});

export default function CourseReviewCreateScreen({ navigation, route }) {
  // 시간표 수업 셀에서 넘어온 경우 과목명/교수명 미리 채우기
  const { courseName: preCourseName = '', professorName: preProfessorName = '' } = route.params || {};

  const [courseName, setCourseName] = useState(preCourseName);
  const [professorName, setProfessorName] = useState(preProfessorName);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [customTag, setCustomTag] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = courseName.trim() !== '' && rating > 0;

  // 태그 토글
  const toggleTag = (tag) => {
    setSelectedTags(prev => toggleTagFn(tag, prev));
  };

  // 커스텀 태그 추가
  const addCustomTag = () => {
    const next = addCustomTagFn(customTag, selectedTags);
    if (next !== selectedTags) {
      setSelectedTags(next);
      setCustomTag('');
    }
  };

  // Supabase에 강의평가 저장
  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      Alert.alert('エラー', 'ログインが必要です');
      setSubmitting(false);
      return;
    }

    const { error } = await supabase.from('course_reviews').insert({
      user_id: user.id,
      course_name: courseName.trim(),
      professor_name: professorName.trim() || null,
      rating,
      comment: comment.trim() || null,
      tags: selectedTags,
    });

    if (error) {
      Alert.alert('エラー', '投稿に失敗しました。もう一度お試しください。');
    } else {
      navigation.goBack();
    }
    setSubmitting(false);
  };

  return (
    <SafeAreaView style={styles.container}>

      {/* ── 헤더 ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.cancelButton}>
          <Text style={styles.cancelText}>キャンセル</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>講義評価を書く</Text>
        <TouchableOpacity
          style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit || submitting}
        >
          {submitting
            ? <ActivityIndicator size="small" color="#FFFFFF" />
            : <Text style={styles.submitText}>投稿</Text>
          }
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* ── 과목명 ── */}
        <View style={styles.section}>
          <Text style={styles.label}>科目名 <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={styles.textInput}
            placeholder="例: 経営学概論"
            placeholderTextColor={colors.textDisabled}
            value={courseName}
            onChangeText={setCourseName}
            maxLength={40}
          />
        </View>

        {/* ── 교수명 ── */}
        <View style={styles.section}>
          <Text style={styles.label}>担当教員名 <Text style={styles.optional}>(任意)</Text></Text>
          <TextInput
            style={styles.textInput}
            placeholder="例: 田中 一郎"
            placeholderTextColor={colors.textDisabled}
            value={professorName}
            onChangeText={setProfessorName}
            maxLength={30}
          />
        </View>

        {/* ── 별점 ── */}
        <View style={styles.section}>
          <Text style={styles.label}>評価 <Text style={styles.required}>*</Text></Text>
          <StarSelector value={rating} onChange={setRating} />
        </View>

        {/* ── 태그 선택 ── */}
        <View style={styles.section}>
          <Text style={styles.label}>タグ <Text style={styles.optional}>(任意・最大8個)</Text></Text>

          {/* 추천 태그 */}
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

          {/* 직접 입력 태그 */}
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
              style={[styles.addTagButton, (!customTag.trim() || selectedTags.length >= 8) && styles.addTagButtonDisabled]}
              onPress={addCustomTag}
              disabled={!customTag.trim() || selectedTags.length >= 8}
            >
              <Text style={styles.addTagButtonText}>追加</Text>
            </TouchableOpacity>
          </View>

          {/* 선택된 커스텀 태그 표시 */}
          {selectedTags.filter(t => !SUGGESTED_TAGS.includes(t)).length > 0 && (
            <View style={styles.customTagsRow}>
              {selectedTags.filter(t => !SUGGESTED_TAGS.includes(t)).map((tag) => (
                <TouchableOpacity
                  key={tag}
                  style={styles.tagChipSelected}
                  onPress={() => toggleTag(tag)}
                >
                  <Text style={styles.tagChipTextSelected}>✓ {tag}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* ── 코멘트 ── */}
        <View style={styles.section}>
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
        </View>

      </ScrollView>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cancelButton: {
    paddingVertical: 4,
    paddingRight: 8,
  },
  cancelText: {
    fontSize: 15,
    color: colors.textSecondary,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  submitButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 16,
    minWidth: 56,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: colors.textDisabled,
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  scrollContent: {
    padding: 16,
    gap: 12,
  },

  // 섹션 공통
  section: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 10,
  },
  required: {
    color: colors.danger,
  },
  optional: {
    color: colors.textDisabled,
    fontWeight: '400',
  },

  // 텍스트 입력
  textInput: {
    fontSize: 15,
    color: colors.textPrimary,
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: 12,
  },

  // 태그 그리드
  tagGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  tagChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  tagChipSelected: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  tagChipText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  tagChipTextSelected: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '600',
  },

  // 커스텀 태그 입력
  customTagRow: {
    flexDirection: 'row',
    gap: 8,
  },
  customTagInput: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
    backgroundColor: colors.background,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  addTagButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTagButtonDisabled: {
    backgroundColor: colors.textDisabled,
  },
  addTagButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  customTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },

  // 코멘트 입력
  commentInput: {
    fontSize: 14,
    color: colors.textPrimary,
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: 12,
    minHeight: 120,
    lineHeight: 22,
  },
  charCount: {
    fontSize: 11,
    color: colors.textDisabled,
    textAlign: 'right',
    marginTop: 6,
  },
});
