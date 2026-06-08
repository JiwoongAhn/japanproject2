import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, SafeAreaView, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';

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
      Alert.alert('お知らせ', 'メールアドレスを入力してください');
      return;
    }
    if (!isValidDomain()) {
      const domain = university?.emailDomain ?? 'ac.jp';
      Alert.alert(
        'メールアドレスを確認してください',
        `${university?.name ?? '大学'}の学校メールアドレスでお願いします。\n（例: 学籍番号@${domain}）`
      );
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: trimmedEmail,
        options: { shouldCreateUser: true },
      });

      if (error) {
        Alert.alert('お知らせ', 'コードをうまく送信できませんでした。もう一度お試しください');
        return;
      }

      navigation.navigate('OtpVerification', {
        email: trimmedEmail,
        university,
        studentId: '',
        password: '',
      });
    } catch (e) {
      Alert.alert('お知らせ', 'ネットワークの状態をご確認の上、もう一度お試しください');
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
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.backText}>‹ 大学選択</Text>
          </TouchableOpacity>

          {/* 헤더 */}
          <View style={styles.header}>
            <View style={styles.universityBadge}>
              <Text style={styles.universityBadgeText}>{university?.name ?? '大学'}</Text>
            </View>
            <Text style={styles.title}>学校メールアドレスで{'\n'}ログイン</Text>
            <Text style={styles.subtitle}>
              学校のメールアドレスに認証コードを送ります
            </Text>
          </View>

          {/* 입력 폼 — 1 thing/1 page: 이메일 입력 하나에 집중 */}
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
              学校メールに6桁の認証コードをお送りします。{'\n'}
              はじめての方は自動でアカウントが作成されます。
            </Text>
          </View>

          {/* 발송 버튼 */}
          <TouchableOpacity
            style={[styles.button, (!email.trim() || loading) && styles.buttonDisabled]}
            onPress={handleSendOtp}
            disabled={!email.trim() || loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={colors.white} />
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
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.huge,
  },

  backButton: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  backText: {
    ...typography.bodyStrong,
    color: colors.primary,
  },

  header: {
    marginTop: spacing.lg,
    marginBottom: spacing.xxxl,
  },
  universityBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    marginBottom: spacing.lg,
  },
  universityBadgeText: {
    ...typography.captionStrong,
    color: colors.primary,
  },
  title: {
    ...typography.title2,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body2,
    color: colors.textSecondary,
  },

  form: {
    marginBottom: spacing.xl,
  },
  inputGroup: {
    gap: spacing.sm,
  },
  label: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    ...typography.body2,
    color: colors.textPrimary,
  },
  hint: {
    ...typography.caption,
    color: colors.primary,
    marginTop: spacing.xs,
  },

  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.xxl,
  },
  infoIcon: {
    fontSize: 16,
  },
  infoText: {
    flex: 1,
    ...typography.caption,
    color: colors.primary,
  },

  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    ...typography.bodyStrong,
    fontSize: 16,
    color: colors.white,
  },
});
