import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, SafeAreaView, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthProvider';
import { colors } from '../../constants/colors';

// 닉네임 입력 화면 (신규 회원 전용)
// OtpVerificationScreen에서 OTP 인증 완료 후 이 화면으로 이동
// 닉네임 중복 확인 → profiles 저장 → AuthProvider가 자동으로 MainTab 이동
export default function AcEmailInputScreen({ navigation, route }) {
  const { university, email, userId } = route.params ?? {};
  const { refreshProfile } = useAuth();

  const [nickname, setNickname] = useState('');
  const [loading, setLoading]   = useState(false);

  // 닉네임 형식 검증 (2~10자, 공백 불가)
  const isValidNickname = (v) => {
    const t = v.trim();
    return t.length >= 2 && t.length <= 10 && !/\s/.test(t);
  };

  const handleSave = async () => {
    const trimmedNickname = nickname.trim();

    if (!isValidNickname(trimmedNickname)) {
      Alert.alert('ニックネームエラー', 'ニックネームは2〜10文字で入力してください（スペース不可）');
      return;
    }

    setLoading(true);
    try {
      // 닉네임 중복 확인
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('nickname', trimmedNickname)
        .maybeSingle();

      if (existing) {
        Alert.alert('ニックネーム重複', `「${trimmedNickname}」はすでに使われています。\n別のニックネームを入力してください。`);
        return;
      }

      // 프로필 저장 (닉네임 + 학교 이메일 + 대학교)
      const { error } = await supabase.from('profiles').upsert({
        id: userId,
        university: university?.name ?? '国士舘大学',
        nickname: trimmedNickname,
        school_email: email,
      });

      if (error) throw new Error(error.message);

      // 프로필 재조회 → AppNavigator가 nickname 감지 후 MainTab으로 자동 전환
      await refreshProfile();

    } catch (e) {
      Alert.alert('エラー', `保存に失敗しました。\n${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <View style={styles.universityBadge}>
              <Text style={styles.universityBadgeText}>{university?.name ?? '大学'}</Text>
            </View>
            <Text style={styles.title}>ニックネームを{'\n'}設定してください</Text>
            <Text style={styles.subtitle}>
              空き時間合わせで友達があなたを検索するIDになります。{'\n'}
              後からいつでも変更できます。
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>ニックネーム</Text>
              <TextInput
                style={styles.input}
                placeholder="例：たろう"
                placeholderTextColor={colors.textDisabled}
                value={nickname}
                onChangeText={setNickname}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={10}
              />
              <Text style={styles.hint}>2〜10文字、スペース不可</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.button, (!isValidNickname(nickname) || loading) && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={!isValidNickname(nickname) || loading}
            activeOpacity={0.8}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.buttonText}>はじめる</Text>
            }
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: colors.surface },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 40 },
  header:        { marginTop: 40, marginBottom: 36 },
  universityBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 20, marginBottom: 16,
  },
  universityBadgeText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  title: {
    fontSize: 26, fontWeight: '800', color: colors.textPrimary,
    letterSpacing: -0.5, lineHeight: 34, marginBottom: 10,
  },
  subtitle:   { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  form:       { gap: 20, marginBottom: 32 },
  inputGroup: { gap: 8 },
  label:      { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  input: {
    backgroundColor: colors.background,
    borderRadius: 12, padding: 16,
    fontSize: 15, color: colors.textPrimary,
    letterSpacing: 0,
  },
  hint: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 14, padding: 18, alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText:     { color: '#fff', fontSize: 16, fontWeight: '700' },
});
