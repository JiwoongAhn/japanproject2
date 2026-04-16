import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, SafeAreaView, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { colors } from '../../constants/colors';

// 학교 ac.jp 이메일 입력 화면
// SchoolPortalAuthScreen에서 신규 가입자로 판단될 때 이 화면으로 이동
// 학교 이메일(@ac.jp)을 입력 → 인증 메일 발송 → EmailVerificationPendingScreen으로 이동
export default function AcEmailInputScreen({ navigation, route }) {
  const { university, studentId, password } = route.params ?? {};

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  // 입력된 이메일이 해당 대학 도메인인지 검증
  const isValidDomain = () => {
    const domain = university?.emailDomain;
    if (!domain) return true; // 도메인 정보 없으면 검증 생략
    return email.trim().toLowerCase().endsWith(`@${domain}`);
  };

  const handleSendVerification = async () => {
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail) {
      Alert.alert('エラー', 'メールアドレスを入力してください');
      return;
    }

    // 이메일 기본 형식 검증 (@ 포함, . 포함)
    if (!trimmedEmail.includes('@') || !trimmedEmail.includes('.')) {
      Alert.alert('エラー', '正しいメールアドレスを入力してください');
      return;
    }

    // 학교 도메인 검증
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
      // Supabase에 신규 계정 생성 (학교 ac.jp 이메일 사용)
      // Supabase 이메일 인증이 ON이면 인증 메일이 자동 발송됨
      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          data: {
            student_id: studentId,
            university: university?.name ?? '',
          },
        },
      });

      if (error) {
        // 이미 가입된 이메일인 경우
        if (error.message.includes('already registered') || error.message.includes('already been registered')) {
          Alert.alert(
            'すでに登録済み',
            'このメールアドレスはすでに使用されています。\n学籍番号とパスワードで再度お試しください。',
            [{ text: '戻る', onPress: () => navigation.goBack() }]
          );
          return;
        }
        Alert.alert('エラー', error.message);
        return;
      }

      // 프로필 생성 (학적번호를 닉네임으로)
      if (data.user) {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          university: university?.name ?? '国士舘大学',
          nickname: studentId ?? trimmedEmail.split('@')[0],
        });
      }

      // 인증 메일 발송 완료 화면으로 이동
      navigation.navigate('EmailVerificationPending', {
        email: trimmedEmail,
        university,
      });
    } catch (e) {
      Alert.alert('エラー', `通信エラーが発生しました。\n${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const domain = university?.emailDomain;

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
            <Text style={styles.backText}>‹ 戻る</Text>
          </TouchableOpacity>

          {/* 헤더 */}
          <View style={styles.header}>
            <View style={styles.universityBadge}>
              <Text style={styles.universityBadgeText}>{university?.name ?? '大学'}</Text>
            </View>
            <Text style={styles.title}>学校メールアドレスで{'\n'}本人確認</Text>
            <Text style={styles.subtitle}>
              在学生確認のため、大学から発行された学校メールアドレスを入力してください。
            </Text>
          </View>

          {/* 입력 폼 */}
          <View style={styles.form}>
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
              {/* 도메인 힌트 표시 */}
              {domain && (
                <Text style={styles.domainHint}>@{domain} のアドレスのみ使用可能</Text>
              )}
            </View>
          </View>

          {/* 안내 박스 */}
          <View style={styles.infoBox}>
            <Text style={styles.infoIcon}>📧</Text>
            <Text style={styles.infoText}>
              入力したメールアドレスに確認メールが届きます。{'\n'}
              メール内のリンクをクリックして認証を完了してください。
            </Text>
          </View>

          {/* 발송 버튼 */}
          <TouchableOpacity
            style={[styles.button, (!email.trim() || loading) && styles.buttonDisabled]}
            onPress={handleSendVerification}
            disabled={!email.trim() || loading}
            activeOpacity={0.8}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.buttonText}>確認メールを送る</Text>
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
  },
  domainHint: {
    fontSize: 12,
    color: colors.primary,
    marginTop: 2,
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
