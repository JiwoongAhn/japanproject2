import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, SafeAreaView, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { colors } from '../../constants/colors';

// 학교 ac.jp 이메일 + 닉네임 입력 화면
// 검증 순서: 이메일 도메인 → 닉네임 중복 → OTP 발송 → OtpVerificationScreen으로 이동
export default function AcEmailInputScreen({ navigation, route }) {
  const { university, studentId, password } = route.params ?? {};

  const [email, setEmail]       = useState('');
  const [nickname, setNickname] = useState('');
  const [loading, setLoading]   = useState(false);

  // 이메일 도메인 검증
  const isValidDomain = () => {
    const domain = university?.emailDomain;
    if (!domain) return true;
    return email.trim().toLowerCase().endsWith(`@${domain}`);
  };

  // 닉네임 형식 검증 (2~10자, 공백 불가)
  const isValidNickname = (v) => {
    const t = v.trim();
    return t.length >= 2 && t.length <= 10 && !/\s/.test(t);
  };

  const handleNext = async () => {
    const trimmedEmail    = email.trim().toLowerCase();
    const trimmedNickname = nickname.trim();

    if (!trimmedEmail) {
      Alert.alert('エラー', 'メールアドレスを入力してください');
      return;
    }
    if (!trimmedEmail.includes('@') || !trimmedEmail.includes('.')) {
      Alert.alert('エラー', '正しいメールアドレスを入力してください');
      return;
    }
    if (!isValidDomain()) {
      const domain = university?.emailDomain ?? 'ac.jp';
      Alert.alert(
        'メールアドレスエラー',
        `${university?.name ?? '大学'}の学校メールアドレスを入力してください。\n（例: 学籍番号@${domain}）`
      );
      return;
    }
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

      // OTP 발송 Edge Function 호출
      const res = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/send-school-otp`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ email: trimmedEmail }),
        }
      );

      const result = await res.json();

      if (!res.ok || result.error) {
        Alert.alert('送信エラー', result.error ?? 'コードの送信に失敗しました。もう一度お試しください。');
        return;
      }

      // OTP 입력 화면으로 이동 (모든 가입 정보 전달)
      navigation.navigate('OtpVerification', {
        email: trimmedEmail,
        nickname: trimmedNickname,
        university,
        studentId,
        password,
      });

    } catch (e) {
      Alert.alert('エラー', `通信エラーが発生しました。\n${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const domain    = university?.emailDomain;
  const canSubmit = email.trim() && isValidNickname(nickname) && !loading;

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
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>‹ 戻る</Text>
          </TouchableOpacity>

          <View style={styles.header}>
            <View style={styles.universityBadge}>
              <Text style={styles.universityBadgeText}>{university?.name ?? '大学'}</Text>
            </View>
            <Text style={styles.title}>アカウント情報を{'\n'}入力してください</Text>
            <Text style={styles.subtitle}>
              在学生確認のため学校メールアドレスを入力し、アプリで使うニックネームを設定してください。
            </Text>
          </View>

          <View style={styles.form}>
            {/* 학교 이메일 */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>学校メールアドレス</Text>
              <TextInput
                style={styles.input}
                placeholder={domain ? `例: 学籍番号@${domain}` : 'example@university.ac.jp'}
                placeholderTextColor={colors.textDisabled}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {domain && (
                <Text style={styles.hint}>@{domain} のアドレスのみ使用可能</Text>
              )}
            </View>

            {/* 닉네임 */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>ニックネーム</Text>
              <TextInput
                style={styles.input}
                placeholder="例: たろう（2〜10文字）"
                placeholderTextColor={colors.textDisabled}
                value={nickname}
                onChangeText={setNickname}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={10}
              />
              <Text style={styles.hint}>空き時間合わせで友達があなたを検索するIDになります</Text>
            </View>
          </View>

          <View style={styles.infoBox}>
            <Text style={styles.infoIcon}>📧</Text>
            <Text style={styles.infoText}>
              入力したメールアドレスに6桁の認証コードを送信します。{'\n'}
              学校のメールボックスを確認してください。
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.button, !canSubmit && styles.buttonDisabled]}
            onPress={handleNext}
            disabled={!canSubmit}
            activeOpacity={0.8}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.buttonText}>認証コードを送信</Text>
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
  backButton:    { marginTop: 16, marginBottom: 8 },
  backText:      { fontSize: 15, color: colors.primary, fontWeight: '600' },
  header:        { marginTop: 16, marginBottom: 36 },
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
  form:       { gap: 20, marginBottom: 20 },
  inputGroup: { gap: 8 },
  label:      { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  input: {
    backgroundColor: colors.background,
    borderRadius: 12, padding: 16,
    fontSize: 15, color: colors.textPrimary,
  },
  hint: { fontSize: 12, color: colors.primary, marginTop: 2 },
  infoBox: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: colors.primaryLight,
    borderRadius: 12, padding: 14, gap: 10, marginBottom: 24,
  },
  infoIcon: { fontSize: 16 },
  infoText:   { flex: 1, fontSize: 12, color: colors.primary, lineHeight: 18 },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 14, padding: 18, alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText:     { color: '#fff', fontSize: 16, fontWeight: '700' },
});
