import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, SafeAreaView, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';

// 학교 이메일 OTP 인증 화면
// SchoolPortalAuthScreen에서 OTP 발송 후 이 화면으로 이동
// 코드 확인 → signUp → 메인 화면 자동 진입
export default function OtpVerificationScreen({ navigation, route }) {
  const { email } = route.params ?? {};

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(60); // 재발송 쿨다운(초)
  const timerRef = useRef(null);

  // 60초 카운트다운
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setResendCooldown(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  // OTP 재발송 (Supabase 내장 SMTP)
  const handleResend = async () => {
    if (resendCooldown > 0) return;
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true },
      });
      if (!error) {
        Alert.alert('再送信しました', `${email} に新しいコードをお送りしました`);
        setResendCooldown(60);
        clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
          setResendCooldown(prev => {
            if (prev <= 1) { clearInterval(timerRef.current); return 0; }
            return prev - 1;
          });
        }, 1000);
      } else {
        Alert.alert('お知らせ', '再送信できませんでした。もう一度お試しください');
      }
    } catch (e) {
      Alert.alert('お知らせ', 'ネットワークの状態をご確認の上、もう一度お試しください');
    }
  };

  // OTP 확인 + 가입 (Supabase 내장 OTP)
  const handleVerify = async () => {
    const trimmedCode = code.trim();
    if (trimmedCode.length !== 6) {
      Alert.alert('お知らせ', '6桁のコードを入力してください');
      return;
    }

    setLoading(true);
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: trimmedCode,
        type: 'email',
      });

      if (verifyError) {
        const msg = verifyError.message.includes('expired')
          ? 'コードの有効期限が切れました。再送信ボタンで新しいコードを取得してください'
          : 'コードをもう一度ご確認ください';
        Alert.alert('お知らせ', msg);
        return;
      }
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
        <View style={styles.inner}>
          {/* 뒤로가기 */}
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Text style={styles.backText}>‹ 戻る</Text>
          </TouchableOpacity>

          {/* 헤더 — 1 thing/1 page: 코드 입력 한 가지에 집중 */}
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <Text style={styles.iconEmoji}>📧</Text>
            </View>
            <Text style={styles.title}>認証コードを入力</Text>
            <Text style={styles.subtitle}>
              <Text style={styles.emailHighlight}>{email}</Text>
              {'\n'}に送信した6桁のコードを入力してください
            </Text>
          </View>

          {/* 코드 입력 — iOS oneTimeCode / Android sms-otp 자동완성 */}
          <TextInput
            style={styles.codeInput}
            value={code}
            onChangeText={v => setCode(v.replace(/[^0-9]/g, '').slice(0, 6))}
            keyboardType="number-pad"
            maxLength={6}
            placeholder="000000"
            placeholderTextColor={colors.textDisabled}
            textAlign="center"
            autoFocus
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
          />

          {/* 확인 버튼 */}
          <TouchableOpacity
            style={[styles.button, (code.length !== 6 || loading) && styles.buttonDisabled]}
            onPress={handleVerify}
            disabled={code.length !== 6 || loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={colors.white} />
              : <Text style={styles.buttonText}>確認</Text>
            }
          </TouchableOpacity>

          {/* 재발송 */}
          <TouchableOpacity
            style={styles.resendButton}
            onPress={handleResend}
            disabled={resendCooldown > 0}
            activeOpacity={0.7}
          >
            <Text style={[styles.resendText, resendCooldown > 0 && styles.resendTextDisabled]}>
              {resendCooldown > 0
                ? `再送信 (${resendCooldown}秒後)`
                : 'コードを再送信する'
              }
            </Text>
          </TouchableOpacity>

          {/* 안내 */}
          <Text style={styles.note}>
            メールが届かない場合、迷惑メールフォルダもご確認ください
          </Text>
        </View>
      </KeyboardAvoidingView>
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
    alignItems: 'center',
    marginTop: spacing.xxl,
    marginBottom: spacing.huge,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  iconEmoji: {
    fontSize: 32,
  },
  title: {
    ...typography.title2,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  subtitle: {
    ...typography.body2,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  emailHighlight: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
  },

  codeInput: {
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    paddingVertical: spacing.xl,
    fontSize: 36,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 12,
    marginBottom: spacing.xxl,
  },

  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    ...typography.bodyStrong,
    fontSize: 16,
    color: colors.white,
  },

  resendButton: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginBottom: spacing.xxl,
  },
  resendText: {
    ...typography.bodyStrong,
    color: colors.primary,
  },
  resendTextDisabled: {
    color: colors.textDisabled,
  },

  note: {
    ...typography.caption,
    color: colors.textDisabled,
    textAlign: 'center',
  },
});
