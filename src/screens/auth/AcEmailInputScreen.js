import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, SafeAreaView, Alert,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthProvider';
import { colors } from '../../constants/colors';
import LoadingDots from '../../components/LoadingDots';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { getUniversityInfo } from '../../utils/university';

// 닉네임 입력 화면 (신규 회원 전용)
// OtpVerificationScreen에서 OTP 인증 완료 후 이 화면으로 이동
// 닉네임 중복 확인 → profiles 저장 → AuthProvider가 자동으로 MainTab 이동
export default function AcEmailInputScreen({ route }) {
  const { email, userId } = route.params ?? {};
  const { refreshProfile } = useAuth();

  // OTP 인증된 이메일 도메인으로 대학 판별
  const universityName = getUniversityInfo(email).name;

  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);

  // 닉네임 형식 검증 (2~10자, 공백 불가)
  const isValidNickname = (v) => {
    const t = v.trim();
    return t.length >= 2 && t.length <= 10 && !/\s/.test(t);
  };

  const handleSave = async () => {
    const trimmedNickname = nickname.trim();

    if (!isValidNickname(trimmedNickname)) {
      Alert.alert('お知らせ', 'ニックネームは2〜10文字でお願いします（スペース不可）');
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
        Alert.alert('お知らせ', `「${trimmedNickname}」はすでに使われています。\n別のニックネームでお試しください`);
        return;
      }

      // 프로필 저장
      const { error } = await supabase.from('profiles').upsert({
        id: userId,
        university: universityName,
        nickname: trimmedNickname,
        school_email: email,
      });

      if (error) throw new Error(error.message);

      // 프로필 재조회 → AppNavigator가 nickname 감지 후 MainTab으로 자동 전환
      await refreshProfile();
    } catch (e) {
      Alert.alert('お知らせ', '保存できませんでした。もう一度お試しください');
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
          {/* 헤더 — 1 thing/1 page: 닉네임 설정 하나에 집중 */}
          <View style={styles.header}>
            <View style={styles.universityBadge}>
              <Text style={styles.universityBadgeText}>{universityName}</Text>
            </View>
            <Text style={styles.title}>ニックネームを{'\n'}設定してください</Text>
            <Text style={styles.subtitle}>
              空き時間合わせで友達が検索するIDになります。{'\n'}
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
            activeOpacity={0.85}
          >
            {loading
              ? <LoadingDots size={6} color={colors.white} />
              : <Text style={styles.buttonText}>はじめる</Text>
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
  header: {
    marginTop: spacing.huge,
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
    marginBottom: spacing.xxxl,
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
    color: colors.textSecondary,
    marginTop: spacing.xs,
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
