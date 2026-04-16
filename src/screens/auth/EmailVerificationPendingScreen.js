import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity,
  StyleSheet, SafeAreaView, Alert, ActivityIndicator,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { colors } from '../../constants/colors';

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
      Alert.alert('しばらくお待ちください', '再送信は60秒後にできます');
      return;
    }

    setResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
      });

      if (error) {
        Alert.alert('エラー', error.message);
        return;
      }

      Alert.alert('送信完了', `${email} に再送しました`);

      // 60초 쿨다운 (연속 재발송 방지)
      setResendCooldown(true);
      setTimeout(() => setResendCooldown(false), 60000);
    } catch (e) {
      Alert.alert('エラー', `通信エラーが発生しました。\n${e.message}`);
    } finally {
      setResending(false);
    }
  };

  // 인증 완료 후 로그인 화면으로 이동
  const handleGoToLogin = () => {
    // UniversitySelect까지 pop해서 새로 시작
    navigation.navigate('SchoolPortalAuth', { university });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>

        {/* 이메일 아이콘 */}
        <View style={styles.iconWrap}>
          <Text style={styles.icon}>📬</Text>
        </View>

        {/* 안내 텍스ト */}
        <Text style={styles.title}>メールを確認してください</Text>
        <Text style={styles.description}>
          以下のアドレスに確認メールを送りました。
        </Text>
        <View style={styles.emailBox}>
          <Text style={styles.emailText}>{email}</Text>
        </View>
        <Text style={styles.description}>
          メール内の「メールアドレスを確認する」リンクをクリックして、認証を完了してください。
        </Text>

        {/* 주의사항 */}
        <View style={styles.noteBox}>
          <Text style={styles.noteText}>
            ・メールが届かない場合は迷惑メールフォルダをご確認ください{'\n'}
            ・リンクの有効期限は24時間です{'\n'}
            ・認証後、下のボタンからログインしてください
          </Text>
        </View>

        {/* 버튼 영역 */}
        <View style={styles.buttonGroup}>
          {/* 인증 완료 후 로그인 */}
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleGoToLogin}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>認証完了 → ログインへ</Text>
          </TouchableOpacity>

          {/* 재발송 */}
          <TouchableOpacity
            style={[styles.secondaryButton, resendCooldown && styles.buttonDisabled]}
            onPress={handleResend}
            disabled={resending || resendCooldown}
            activeOpacity={0.8}
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
    paddingHorizontal: 28,
    paddingTop: 60,
    alignItems: 'center',
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  icon: {
    fontSize: 36,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 14,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 12,
  },
  emailBox: {
    backgroundColor: colors.background,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 12,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  emailText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
  },
  noteBox: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 14,
    alignSelf: 'stretch',
    marginTop: 8,
    marginBottom: 32,
  },
  noteText: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  buttonGroup: {
    alignSelf: 'stretch',
    gap: 12,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: colors.background,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  secondaryButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
});
