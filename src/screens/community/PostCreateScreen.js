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
import { BOARD_CATEGORIES } from '../../constants/boardCategories';
import { supabase } from '../../lib/supabase';

export default function PostCreateScreen({ navigation }) {
  const [category, setCategory] = useState('');        // 선택한 카테고리
  const [title, setTitle] = useState('');              // 제목
  const [body, setBody] = useState('');                // 본문
  const [isAnonymous, setIsAnonymous] = useState(true); // 익명 여부
  const [submitting, setSubmitting] = useState(false); // 제출 중 여부

  // 저장 버튼 활성화 조건: 카테고리 + 제목 모두 입력
  const canSubmit = category !== '' && title.trim() !== '';

  // Supabase에 게시글 저장
  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);

    // 현재 로그인된 사용자 확인
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      Alert.alert('エラー', 'ログインが必要です');
      setSubmitting(false);
      return;
    }

    const { error } = await supabase.from('posts').insert({
      user_id: user.id,
      category,
      title: title.trim(),
      body: body.trim() || null,
      is_anonymous: isAnonymous,
    });

    if (error) {
      Alert.alert('エラー', '投稿に失敗しました。もう一度お試しください。');
    } else {
      // 작성 성공 → 목록으로 돌아가기
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
        <Text style={styles.headerTitle}>投稿する</Text>
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

        {/* ── 카테고리 선택 ── */}
        <View style={styles.section}>
          <Text style={styles.label}>カテゴリ <Text style={styles.required}>*</Text></Text>
          <View style={styles.categoryRow}>
            {BOARD_CATEGORIES.map((cat) => {
              const selected = category === cat.key;
              return (
                <TouchableOpacity
                  key={cat.key}
                  style={[
                    styles.categoryChip,
                    selected && { backgroundColor: cat.color, borderColor: cat.color },
                  ]}
                  onPress={() => setCategory(cat.key)}
                  activeOpacity={0.75}
                >
                  <Text style={[
                    styles.categoryChipText,
                    selected && { color: '#FFFFFF', fontWeight: '700' },
                  ]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── 제목 입력 ── */}
        <View style={styles.section}>
          <Text style={styles.label}>タイトル <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={styles.titleInput}
            placeholder="タイトルを入力してください"
            placeholderTextColor={colors.textDisabled}
            value={title}
            onChangeText={setTitle}
            maxLength={60}
            returnKeyType="next"
          />
          <Text style={styles.charCount}>{title.length}/60</Text>
        </View>

        {/* ── 본문 입력 ── */}
        <View style={styles.section}>
          <Text style={styles.label}>本文 <Text style={styles.optional}>(任意)</Text></Text>
          <TextInput
            style={styles.bodyInput}
            placeholder="本文を入力してください（任意）"
            placeholderTextColor={colors.textDisabled}
            value={body}
            onChangeText={setBody}
            maxLength={500}
            multiline
            textAlignVertical="top"
          />
          <Text style={styles.charCount}>{body.length}/500</Text>
        </View>

        {/* ── 익명 토글 ── */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.anonymousRow}
            onPress={() => setIsAnonymous(!isAnonymous)}
            activeOpacity={0.75}
          >
            <View>
              <Text style={styles.anonymousTitle}>匿名で投稿する</Text>
              <Text style={styles.anonymousDesc}>ONにすると名前が表示されません</Text>
            </View>
            {/* 토글 스위치 */}
            <View style={[styles.toggle, isAnonymous && styles.toggleOn]}>
              <View style={[styles.toggleThumb, isAnonymous && styles.toggleThumbOn]} />
            </View>
          </TouchableOpacity>
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

  // 카테고리 칩
  categoryRow: {
    flexDirection: 'row',
    gap: 8,
  },
  categoryChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
  },
  categoryChipText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },

  // 제목 입력
  titleInput: {
    fontSize: 15,
    color: colors.textPrimary,
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: 12,
    lineHeight: 22,
  },
  charCount: {
    fontSize: 11,
    color: colors.textDisabled,
    textAlign: 'right',
    marginTop: 6,
  },

  // 본문 입력
  bodyInput: {
    fontSize: 14,
    color: colors.textPrimary,
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: 12,
    minHeight: 140,
    lineHeight: 22,
  },

  // 익명 토글
  anonymousRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  anonymousTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 3,
  },
  anonymousDesc: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  toggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.border,
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  toggleOn: {
    backgroundColor: colors.primary,
  },
  toggleThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
  },
  toggleThumbOn: {
    alignSelf: 'flex-end',
  },
});
