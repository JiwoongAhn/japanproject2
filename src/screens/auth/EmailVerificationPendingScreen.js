import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity,
  StyleSheet, SafeAreaView, Alert, ActivityIndicator,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';

// 이메일 인증 대기 화면
// 인증 메일 발송 완료 후 사용자에게 안내
// 재발송 버튼 + 인증 완료 후 로그인으로 이동 버튼 제공
export default function EmailVerificationPendingScreen({ navigation, route }) {
  const { email, university } = route.params ?? {};
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(false);

  // 이메일 재발송
  const handleResend = async () => {
    if (resendCooldown) {
      Alert.alert('お知らせ', '再送信は60秒後にできます');
      return;
    }

    setResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
      });

      if (error) {
        Alert.alert('お知らせ', '再送信できませんでした。もう一度お試しください');
        return;
      }

      Alert.alert('再送信しました', `${email} にもう一度お送りしました`);

      // 60초 쿨다운
      setResendCooldown(true);
      setTimeout(() => setResendCooldown(false), 60000);
    } catch (e) {
      Alert.alert('お知らせ', 'ネットワークの状態をご確認の上、もう一度お試しください');
    } finally {
      setResending(false);
    }
  };

  // 인증 완료 후 로그인 화면으로 이동
  const handleGoToLogin = () => {
    navigation.navigate('SchoolPortalAuth', { university });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        {/* 이메일 아이콘 */}
        <View style={styles.iconWrap}>
          <Text style={styles.icon}>📬</Text>
        </View>

        {/* 안내 텍스트 — 1 thing/1 page: 메일 확인이 핵심 액션 */}
        <Text style={styles.title}>メールをご確認ください</Text>
        <Text style={styles.description}>
          以下のアドレスに確認メールをお送りしました
        </Text>
        <View style={styles.emailBox}>
          <Text style={styles.emailText}>{email}</Text>
        </View>
        <Text style={styles.description}>
          メール内の「メールアドレスを確認する」リンクをタップして、認証を完了してください
        </Text>

        {/* 주의사항 */}
        <View style={styles.noteBox}>
          <Text style={styles.noteText}>
            ・メールが届かない場合は迷惑メールフォルダもご確認ください{'\n'}
            ・リンクの有効期限は24時間です{'\n'}
            ・認証後、下のボタンからログインしてください
          </Text>
        </View>

        {/* 버튼 영역 */}
        <View style={styles.buttonGroup}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleGoToLogin}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryButtonText}>認証完了 → ログインへ</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryButton, resendCooldown && styles.buttonDisabled]}
            onPress={handleResend}
            disabled={resending || resendCooldown}
            activeOpacity={0.85}
          >
            {resending ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <Text style={styles.secondaryButtonText}>
                {resendCooldown ? 'しばらく後に再送できます' : 'メールを再送する'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  inner: {
    flex: 1,
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.huge,
    alignItems: 'center',
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xxl,
  },
  icon: {
    fontSize: 36,
  },
  title: {
    ...typography.title2,
    color: colors.textPrimary,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  description: {
    ...typography.body2,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  emailBox: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  emailText: {
    ...typography.bodyStrong,
    color: colors.primary,
  },
  noteBox: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.md,
    alignSelf: 'stretch',
    marginTop: spacing.sm,
    marginBottom: spacing.xxxl,
  },
  noteText: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  buttonGroup: {
    alignSelf: 'stretch',
    gap: spacing.md,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  primaryButtonText: {
    ...typography.bodyStrong,
    fontSize: 16,
    color: colors.white,
  },
  secondaryButton: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  secondaryButtonText: {
    ...typography.bodyStrong,
    color: colors.primary,
  },
});
