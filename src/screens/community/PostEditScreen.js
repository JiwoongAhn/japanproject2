import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, SafeAreaView, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { colors } from '../../constants/colors';

// 게시글 수정 화면
// route.params: { postId, title, body }
export default function PostEditScreen({ navigation, route }) {
  const { postId, title: initTitle, body: initBody } = route.params ?? {};

  const [title, setTitle] = useState(initTitle ?? '');
  const [body, setBody] = useState(initBody ?? '');
  const [saving, setSaving] = useState(false);

  const canSave = title.trim().length > 0 && (
    title.trim() !== (initTitle ?? '').trim() ||
    body.trim() !== (initBody ?? '').trim()
  );

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('posts')
        .update({ title: title.trim(), body: body.trim() || null })
        .eq('id', postId);

      if (error) {
        Alert.alert('エラー', '保存に失敗しました');
        return;
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
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.cancelButton}>
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
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
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
  cancelButton: { paddingVertical: 4, paddingHorizontal: 4 },
  cancelText: { fontSize: 15, color: colors.textSecondary },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  saveButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 8,
  },
  saveButtonDisabled: { backgroundColor: colors.textDisabled },
  saveText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  scrollContent: { padding: 16, gap: 16 },
  inputGroup: { gap: 8 },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  titleInput: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: colors.textPrimary,
    letterSpacing: 0,
  },
  bodyInput: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: colors.textPrimary,
    minHeight: 200,
    letterSpacing: 0,
  },
});
