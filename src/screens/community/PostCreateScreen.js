import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
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
import { colors } from '../../constants/colors';
import { spacing, radius, shadow } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { BOARD_CATEGORIES } from '../../constants/boardCategories';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthProvider';
import {
  ensureMediaLibraryPermission,
  pickAndProcessImage,
  uploadImageToStorage,
} from '../../utils/imageUpload';

const MAX_IMAGES = 5;

export default function PostCreateScreen({ navigation }) {
  const { session, profile } = useAuth();
  const [category, setCategory] = useState('');        // 선택한 카테고리
  const [title, setTitle] = useState('');              // 제목
  const [body, setBody] = useState('');                // 본문
  const [isAnonymous, setIsAnonymous] = useState(true); // 익명 여부
  const [submitting, setSubmitting] = useState(false); // 제출 중 여부
  const [pickedImages, setPickedImages] = useState([]); // 선택된 이미지 { uri, base64, ... }[]
  const [picking, setPicking] = useState(false);        // 이미지 처리 중 표시

  // 저장 버튼 활성화 조건: 카테고리 + 제목 모두 입력
  const canSubmit = category !== '' && title.trim() !== '';

  // 사진 추가: 권한 확인 → 갤러리 → 리사이즈+EXIF 제거 → 목록 추가
  const handleAddImage = async () => {
    if (pickedImages.length >= MAX_IMAGES || picking) return;

    const granted = await ensureMediaLibraryPermission();
    if (!granted) {
      Alert.alert('写真へのアクセスを許可してください', '設定アプリから許可できます');
      return;
    }

    setPicking(true);
    try {
      const processed = await pickAndProcessImage();
      if (processed) setPickedImages((prev) => [...prev, processed]);
    } catch (e) {
      Alert.alert('エラー', '画像の処理に失敗しました');
    } finally {
      setPicking(false);
    }
  };

  // 선택된 이미지 1장 제거
  const handleRemoveImage = (index) => {
    setPickedImages((prev) => prev.filter((_, i) => i !== index));
  };

  // Supabase에 게시글 저장
  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);

    if (!session?.user) {
      Alert.alert('エラー', 'ログインが必要です');
      setSubmitting(false);
      return;
    }

    try {
      // 1) 선택된 이미지를 Supabase Storage에 병렬 업로드 → URL 배열 획득
      let imageUrls = [];
      if (pickedImages.length > 0) {
        imageUrls = await Promise.all(
          pickedImages.map((img) => uploadImageToStorage(img, session.user.id))
        );
      }

      // 2) 게시글 insert (image_urls 포함)
      const { error } = await supabase.from('posts').insert({
        user_id: session.user.id,
        university: profile.university,
        category,
        title: title.trim(),
        body: body.trim() || null,
        is_anonymous: isAnonymous,
        image_urls: imageUrls,
      });

      if (error) throw error;
      navigation.goBack();
    } catch (e) {
      Alert.alert('エラー', '投稿に失敗しました。もう一度お試しください。');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >

      {/* ── 헤더 ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.cancelButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
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

        {/* ── 사진 첨부 ── */}
        <View style={styles.section}>
          <View style={styles.imageHeaderRow}>
            <Text style={styles.label}>写真 <Text style={styles.optional}>(任意)</Text></Text>
            <Text style={styles.imageCount}>{pickedImages.length}/{MAX_IMAGES}</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.imageScroll}
          >
            {/* + 追加 버튼 (5장 미만일 때만 표시) */}
            {pickedImages.length < MAX_IMAGES && (
              <TouchableOpacity
                style={styles.addImageButton}
                onPress={handleAddImage}
                disabled={picking}
                activeOpacity={0.75}
              >
                {picking ? (
                  <ActivityIndicator size="small" color={colors.textSecondary} />
                ) : (
                  <>
                    <Text style={styles.addImagePlus}>+</Text>
                    <Text style={styles.addImageLabel}>追加</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
            {/* 선택된 이미지 썸네일 */}
            {pickedImages.map((img, idx) => (
              <View key={idx} style={styles.thumbWrapper}>
                <Image source={{ uri: img.uri }} style={styles.thumbImage} />
                <TouchableOpacity
                  style={styles.thumbRemove}
                  onPress={() => handleRemoveImage(idx)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.thumbRemoveText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
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
      </KeyboardAvoidingView>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
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
    minWidth: 60,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: colors.textDisabled,
  },
  submitText: {
    color: colors.white,
    ...typography.captionStrong,
  },

  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },

  // ── 섹션 공통 ──────────────────────────────
  section: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow.card,
  },
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

  // ── 카테고리 칩 ───────────────────────────
  categoryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  categoryChip: {
    flex: 1,
    paddingVertical: spacing.md - 2,
    borderRadius: radius.md,
    backgroundColor: colors.gray100,
    alignItems: 'center',
  },
  categoryChipText: {
    ...typography.body2,
    color: colors.textSecondary,
    fontWeight: '600',
  },

  // ── 제목 입력 ──────────────────────────────
  titleInput: {
    ...typography.body2,
    color: colors.textPrimary,
    backgroundColor: colors.gray100,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  charCount: {
    ...typography.small,
    color: colors.textDisabled,
    textAlign: 'right',
    marginTop: spacing.xs + 2,
  },

  // ── 본문 입력 ──────────────────────────────
  bodyInput: {
    ...typography.body2,
    color: colors.textPrimary,
    backgroundColor: colors.gray100,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 140,
  },

  // ── 사진 첨부 ──────────────────────────────
  imageHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  imageCount: {
    ...typography.caption,
    color: colors.textDisabled,
  },
  imageScroll: {
    gap: spacing.sm,
    paddingVertical: 2,
  },
  addImageButton: {
    width: 80,
    height: 80,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    backgroundColor: colors.gray50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addImagePlus: {
    fontSize: 24,
    color: colors.textSecondary,
    fontWeight: '300',
    lineHeight: 28,
  },
  addImageLabel: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: 2,
  },
  thumbWrapper: {
    width: 80,
    height: 80,
    borderRadius: radius.md,
    position: 'relative',
  },
  thumbImage: {
    width: 80,
    height: 80,
    borderRadius: radius.md,
    backgroundColor: colors.gray100,
  },
  thumbRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbRemoveText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 14,
  },

  // ── 익명 토글 ──────────────────────────────
  anonymousRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  anonymousTitle: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
    marginBottom: 3,
  },
  anonymousDesc: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  toggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.gray300,
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
    backgroundColor: colors.white,
  },
  toggleThumbOn: {
    alignSelf: 'flex-end',
  },
});
