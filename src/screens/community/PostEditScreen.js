import React, { useState } from 'react';
import {
  View, Text, Image, TextInput, TouchableOpacity,
  StyleSheet, SafeAreaView, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { findProfanityInAny } from '../../utils/profanity';
import { colors } from '../../constants/colors';
import { spacing, radius, shadow } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import {
  ensureMediaLibraryPermission,
  pickAndProcessImage,
  uploadImageToStorage,
  deleteImagesFromStorage,
} from '../../utils/imageUpload';

const MAX_IMAGES = 5;

// 게시글 수정 화면
// route.params: { postId, title, body, imageUrls }
export default function PostEditScreen({ navigation, route }) {
  const { postId, title: initTitle, body: initBody, imageUrls: initImageUrls } = route.params ?? {};

  const [title, setTitle] = useState(initTitle ?? '');
  const [body, setBody] = useState(initBody ?? '');
  const [saving, setSaving] = useState(false);
  const [picking, setPicking] = useState(false);

  // 이미지 목록: { type: 'existing', url } | { type: 'new', processed }
  const initialItems = (initImageUrls ?? []).map((url) => ({ type: 'existing', url }));
  const [images, setImages] = useState(initialItems);

  const titleChanged = title.trim() !== (initTitle ?? '').trim();
  const bodyChanged = body.trim() !== (initBody ?? '').trim();
  const imagesChanged = (() => {
    if (images.length !== (initImageUrls ?? []).length) return true;
    if (images.some((i) => i.type === 'new')) return true;
    return images.some((item, idx) => item.type === 'existing' && item.url !== initImageUrls[idx]);
  })();

  const canSave = title.trim().length > 0 && (titleChanged || bodyChanged || imagesChanged);

  const handleAddImage = async () => {
    if (images.length >= MAX_IMAGES || picking) return;
    const granted = await ensureMediaLibraryPermission();
    if (!granted) {
      Alert.alert('写真へのアクセスを許可してください', '設定アプリから許可できます');
      return;
    }
    setPicking(true);
    try {
      const processed = await pickAndProcessImage();
      if (processed) setImages((prev) => [...prev, { type: 'new', processed }]);
    } catch (e) {
      Alert.alert('エラー', '画像の処理に失敗しました');
    } finally {
      setPicking(false);
    }
  };

  const handleRemoveImage = (index) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!canSave || saving) return;

    // 금칙어 검사 — 발견 시 저장 차단
    if (findProfanityInAny(title, body)) {
      Alert.alert('保存できません', '不適切な表現が含まれています。内容を修正してください。');
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('not authenticated');

      // 1) 새로 추가된 이미지만 업로드
      const finalUrls = await Promise.all(
        images.map(async (item) => {
          if (item.type === 'existing') return item.url;
          return uploadImageToStorage(item.processed, user.id);
        })
      );

      // 2) 삭제된 기존 이미지 = (initImageUrls) - (남은 existing URLs)
      const remainingExisting = images
        .filter((i) => i.type === 'existing')
        .map((i) => i.url);
      const removedUrls = (initImageUrls ?? []).filter(
        (url) => !remainingExisting.includes(url)
      );

      // 3) 게시글 update
      const { error } = await supabase
        .from('posts')
        .update({
          title: title.trim(),
          body: body.trim() || null,
          image_urls: finalUrls,
        })
        .eq('id', postId);

      if (error) {
        Alert.alert('エラー', '保存に失敗しました');
        return;
      }

      // 4) Storage에서 삭제 (DB update 성공 후)
      if (removedUrls.length > 0) {
        await deleteImagesFromStorage(removedUrls).catch(() => {});
      }

      navigation.goBack();
    } catch (e) {
      Alert.alert('エラー', `通信エラー: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.cancelButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.cancelText}>キャンセル</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>投稿を編集</Text>
        <TouchableOpacity
          style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={!canSave || saving}
        >
          {saving
            ? <ActivityIndicator size="small" color="#FFFFFF" />
            : <Text style={styles.saveText}>保存</Text>
          }
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.inputGroup}>
            <Text style={styles.label}>タイトル</Text>
            <TextInput
              style={styles.titleInput}
              value={title}
              onChangeText={setTitle}
              maxLength={100}
              placeholder="タイトルを入力"
              placeholderTextColor={colors.textDisabled}
              autoFocus
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>本文</Text>
            <TextInput
              style={styles.bodyInput}
              value={body}
              onChangeText={setBody}
              maxLength={2000}
              placeholder="内容を入力（任意）"
              placeholderTextColor={colors.textDisabled}
              multiline
              textAlignVertical="top"
            />
          </View>

          {/* 사진 첨부 */}
          <View style={styles.inputGroup}>
            <View style={styles.imageHeaderRow}>
              <Text style={styles.label}>写真</Text>
              <Text style={styles.imageCount}>{images.length}/{MAX_IMAGES}</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.imageScroll}
            >
              {images.length < MAX_IMAGES && (
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
              {images.map((item, idx) => {
                const uri = item.type === 'existing' ? item.url : item.processed.uri;
                return (
                  <View key={idx} style={styles.thumbWrapper}>
                    <Image source={{ uri }} style={styles.thumbImage} />
                    <TouchableOpacity
                      style={styles.thumbRemove}
                      onPress={() => handleRemoveImage(idx)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={styles.thumbRemoveText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  // ── 헤더 ────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.background,
  },
  cancelButton: { paddingVertical: spacing.xs, paddingHorizontal: spacing.xs },
  cancelText: { ...typography.body2, color: colors.textSecondary },
  headerTitle: { ...typography.subtitle, color: colors.textPrimary },
  saveButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    minWidth: 60,
    alignItems: 'center',
  },
  saveButtonDisabled: { backgroundColor: colors.textDisabled },
  saveText: { ...typography.captionStrong, color: colors.white },

  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },

  // ── 입력 그룹 (카드형) ─────────────────────
  inputGroup: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadow.card,
  },
  label: { ...typography.captionStrong, color: colors.textSecondary },
  titleInput: {
    backgroundColor: colors.gray100,
    borderRadius: radius.md,
    padding: spacing.md,
    ...typography.body2,
    color: colors.textPrimary,
  },
  bodyInput: {
    backgroundColor: colors.gray100,
    borderRadius: radius.md,
    padding: spacing.md,
    ...typography.body2,
    color: colors.textPrimary,
    minHeight: 200,
  },

  // ── 사진 첨부 ──────────────────────────────
  imageHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
});
