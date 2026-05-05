import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, SafeAreaView, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { colors } from '../../constants/colors';

// 학교 포털 인증 화면
// 학교 이메일로 OTP 발송 → OTP 입력 → 로그인/가입
export default function SchoolPortalAuthScreen({ navigation, route }) {
  const { university } = route.params ?? {};

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  // 이메일 도메인 검증
  const isValidDomain = () => {
    const domain = university?.emailDomain;
    if (!domain) return true;
    return email.trim().toLowerCase().endsWith(`@${domain}`);
  };

  const handleSendOtp = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      Alert.alert('エラー', 'メールアドレスを入力してください');
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

    setLoading(true);
    try {
      // 기존/신규 회원 관계없이 OTP 발송 (Supabase가 자동 처리)
      const { error } = await supabase.auth.signInWithOtp({
        email: trimmedEmail,
        options: { shouldCreateUser: true },
      });

      if (error) {
        Alert.alert('送信エラー', error.message ?? 'コードの送信に失敗しました。');
        return;
      }

      // OTP 입력 화면으로 이동 (신규/기존 구분은 인증 후 처리)
      navigation.navigate('OtpVerification', {
        email: trimmedEmail,
        university,
        studentId: '',
        password: '',
      });
    } catch (e) {
      Alert.alert('エラー', `通信エラーが発生しました。\n${e.message}`);
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
          {/* 뒤로가기 */}
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>‹ 大学選択</Text>
          </TouchableOpacity>

          {/* 헤더 */}
          <View style={styles.header}>
            <View style={styles.universityBadge}>
              <Text style={styles.universityBadgeText}>{university?.name ?? '大学'}</Text>
            </View>
            <Text style={styles.title}>学校メールアドレスで{'\n'}ログイン</Text>
            <Text style={styles.subtitle}>
              学校のメールアドレスに認証コードを送信します
            </Text>
          </View>

          {/* 입력 폼 */}
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>学校メールアドレス</Text>
              <TextInput
                style={styles.input}
                placeholder={university?.emailDomain ? `学籍番号@${university.emailDomain}` : '学籍番号@university.ac.jp'}
                placeholderTextColor={colors.textDisabled}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {university?.emailDomain && (
                <Text style={styles.hint}>@{university.emailDomain} のアドレスのみ使用可能</Text>
              )}
            </View>
          </View>

          {/* 안내 박스 */}
          <View style={styles.infoBox}>
            <Text style={styles.infoIcon}>📧</Text>
            <Text style={styles.infoText}>
              学校メールアドレスに6桁の認証コードを送信します。{'\n'}
              初めての方は自動的にアカウントが作成されます。
            </Text>
          </View>

          {/* 발송 버튼 */}
          <TouchableOpacity
            style={[styles.button, (!email.trim() || loading) && styles.buttonDisabled]}
            onPress={handleSendOtp}
            disabled={!email.trim() || loading}
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
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },

  backButton: {
    marginTop: 16,
    marginBottom: 8,
  },
  backText: {
    fontSize: 15,
    color: colors.primary,
    fontWeight: '600',
  },

  header: {
    marginTop: 16,
    marginBottom: 36,
  },
  universityBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 16,
  },
  universityBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.5,
    lineHeight: 34,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },

  form: {
    gap: 20,
    marginBottom: 20,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    color: colors.textPrimary,
    letterSpacing: 0,
  },

  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.primaryLight,
    borderRadius: 12,
    padding: 14,
    gap: 10,
    marginBottom: 24,
  },
  infoIcon: {
    fontSize: 16,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: colors.primary,
    lineHeight: 18,
  },

  hint: { fontSize: 12, color: colors.primary, marginTop: 2 },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
