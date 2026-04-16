import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, SafeAreaView, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { colors } from '../../constants/colors';
import { buildEmail } from '../../utils/auth';

// 학교 포털 인증 화면
// 학적번호 + 포털 비밀번호로 로그인 → 최초 접속 시 자동으로 계정 생성
export default function SchoolPortalAuthScreen({ navigation, route }) {
  const { university } = route.params ?? {};

  const [studentId, setStudentId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    const id = studentId.trim();
    if (!id || !password) {
      Alert.alert('エラー', '学籍番号とパスワードを入力してください');
      return;
    }

    setLoading(true);

    // 이메일은 "학적번호@대학ID.unipas" 형태로 내부 생성
    const email = buildEmail(studentId, university?.id);

    try {
      // 1. 먼저 로그인 시도 (기존 회원)
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (!signInError) {
        // 로그인 성공 → AppNavigator가 세션 감지 후 MainTab으로 자동 이동
        return;
      }

      // 2. 로그인 실패 = 처음 접속 → 학교 ac.jp 이메일 인증 화면으로 이동
      if (
        signInError.message.includes('Invalid login credentials') ||
        signInError.message.includes('invalid_credentials')
      ) {
        // 학적번호·비밀번호를 다음 화면에 전달 (학교 이메일 가입 시 사용)
        navigation.navigate('AcEmailInput', {
          university,
          studentId: id,
          password,
        });
      } else {
        Alert.alert('ログイン失敗', signInError.message);
      }
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
            <Text style={styles.title}>学校アカウントで{'\n'}ログイン</Text>
            <Text style={styles.subtitle}>
              学校のポータルIDとパスワードを入力してください
            </Text>
          </View>

          {/* 입력 폼 */}
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>学籍番号</Text>
              <TextInput
                style={styles.input}
                placeholder="例: A1234567"
                placeholderTextColor={colors.textDisabled}
                value={studentId}
                onChangeText={setStudentId}
                autoCapitalize="characters"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>ポータルパスワード</Text>
              <TextInput
                style={styles.input}
                placeholder="パスワードを入力"
                placeholderTextColor={colors.textDisabled}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>
          </View>

          {/* 안내 박스 */}
          <View style={styles.infoBox}>
            <Text style={styles.infoIcon}>🔒</Text>
            <Text style={styles.infoText}>
              初めてログインする場合は自動的にアカウントが作成されます。{'\n'}
              在学生のみご利用いただけます。
            </Text>
          </View>

          {/* 로그인 버튼 */}
          <TouchableOpacity
            style={[styles.button, (!studentId.trim() || !password || loading) && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={!studentId.trim() || !password || loading}
            activeOpacity={0.8}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.buttonText}>ログイン</Text>
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
