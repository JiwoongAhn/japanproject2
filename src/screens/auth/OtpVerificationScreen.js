import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, SafeAreaView, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { buildEmail } from '../../utils/auth';
import { colors } from '../../constants/colors';

// 학교 이메일 OTP 인증 화면
// AcEmailInputScreen에서 OTP 발송 후 이 화면으로 이동
// 코드 확인 → signUp → 메인 화면 자동 진입
export default function OtpVerificationScreen({ navigation, route }) {
  const { email, nickname, university, studentId, password } = route.params ?? {};

  const [code, setCode]             = useState('');
  const [loading, setLoading]       = useState(false);
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

  // OTP 재발송
  const handleResend = async () => {
    if (resendCooldown > 0) return;
    try {
      const res = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/send-school-otp`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ email }),
        }
      );
      const result = await res.json();
      if (result.success) {
        Alert.alert('再送信完了', `${email} に新しいコードを送りました`);
        // 쿨다운 재시작
        setResendCooldown(60);
        clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
          setResendCooldown(prev => {
            if (prev <= 1) { clearInterval(timerRef.current); return 0; }
            return prev - 1;
          });
        }, 1000);
      } else {
        Alert.alert('エラー', result.error ?? '再送信に失敗しました');
      }
    } catch (e) {
      Alert.alert('エラー', '通信エラーが発生しました');
    }
  };

  // OTP 확인 + 가입
  const handleVerify = async () => {
    const trimmedCode = code.trim();
    if (trimmedCode.length !== 6) {
      Alert.alert('エラー', '6桁のコードを入力してください');
      return;
    }

    setLoading(true);
    try {
      // 1. OTP 검증
      const verifyRes = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/verify-school-otp`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ email, code: trimmedCode }),
        }
      );
      const verifyResult = await verifyRes.json();

      if (!verifyResult.valid) {
        const msg =
          verifyResult.reason === 'expired'
            ? 'コードの有効期限が切れました。再送信ボタンで新しいコードを取得してください。'
            : 'コードが正しくありません。もう一度確認してください。';
        Alert.alert('認証失敗', msg);
        return;
      }

      // 2. OTP 인증 성공 → Supabase 계정 생성
      const internalEmail = buildEmail(studentId, university?.id);

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: internalEmail,
        password,
        options: {
          data: {
            student_id: studentId,
            university: university?.name ?? '',
          },
        },
      });

      if (signUpError) {
        if (
          signUpError.message.includes('already registered') ||
          signUpError.message.includes('User already registered')
        ) {
          Alert.alert(
            'すでに登録済み',
            'このアカウントはすでに登録されています。\nログイン画面からログインしてください。',
            [{ text: 'ログインへ', onPress: () => navigation.navigate('SchoolPortalAuth', { university }) }]
          );
          return;
        }
        throw new Error(signUpError.message);
      }

      // 3. 프로필 저장 (닉네임 + 학교 이메일)
      if (data.user) {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          university: university?.name ?? '国士舘大学',
          nickname,
          school_email: email,
        });
      }

      // AuthProvider가 세션 감지 → 자동으로 MainTab 이동

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
        <View style={styles.inner}>
          {/* 뒤로가기 */}
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>‹ 戻る</Text>
          </TouchableOpacity>

          {/* 헤더 */}
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <Text style={styles.iconEmoji}>📧</Text>
            </View>
            <Text style={styles.title}>認証コードを入力</Text>
            <Text style={styles.subtitle}>
              <Text style={styles.emailHighlight}>{email}</Text>
              {'\n'}に送信した6桁のコードを入力してください。
            </Text>
          </View>

          {/* 코드 입력 */}
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
          />

          {/* 확인 버튼 */}
          <TouchableOpacity
            style={[styles.button, (code.length !== 6 || loading) && styles.buttonDisabled]}
            onPress={handleVerify}
            disabled={code.length !== 6 || loading}
            activeOpacity={0.8}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
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
                ? `再送信 (${resendCooldown}秒後に再試行可能)`
                : 'コードを再送信する'
              }
            </Text>
          </TouchableOpacity>

          {/* 안내 */}
          <Text style={styles.note}>
            メールが届かない場合、迷惑メールフォルダも確認してください。
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: colors.surface },
  inner:      { flex: 1, paddingHorizontal: 24, paddingBottom: 40 },
  backButton: { marginTop: 16, marginBottom: 8 },
  backText:   { fontSize: 15, color: colors.primary, fontWeight: '600' },

  header:     { alignItems: 'center', marginTop: 24, marginBottom: 40 },
  iconCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 20,
  },
  iconEmoji:       { fontSize: 32 },
  title:           { fontSize: 24, fontWeight: '800', color: colors.textPrimary, marginBottom: 12 },
  subtitle:        { fontSize: 14, color: colors.textSecondary, lineHeight: 22, textAlign: 'center' },
  emailHighlight:  { fontWeight: '700', color: colors.textPrimary },

  codeInput: {
    backgroundColor: colors.background,
    borderRadius: 16,
    paddingVertical: 20,
    fontSize: 36,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 12,
    marginBottom: 24,
  },

  button: {
    backgroundColor: colors.primary,
    borderRadius: 14, padding: 18,
    alignItems: 'center', marginBottom: 16,
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText:     { color: '#fff', fontSize: 16, fontWeight: '700' },

  resendButton:        { alignItems: 'center', paddingVertical: 12, marginBottom: 24 },
  resendText:          { fontSize: 14, color: colors.primary, fontWeight: '600' },
  resendTextDisabled:  { color: colors.textDisabled },

  note: {
    fontSize: 12, color: colors.textDisabled,
    textAlign: 'center', lineHeight: 18,
  },
});
