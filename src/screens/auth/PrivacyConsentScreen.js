import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../../constants/colors';
import LoadingDots from '../../components/LoadingDots';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import PrivacyPolicyBody from '../../components/PrivacyPolicyBody';
import TermsOfServiceBody from '../../components/TermsOfServiceBody';

// 동의 상태 저장 키. 버전을 붙여 정책이 크게 바뀌면 올려 재동의를 받을 수 있게 한다.
// v2: 이용規約(利用規約, App Store UGC 대응) 추가에 따라 전원 재동의.
export const PRIVACY_CONSENT_KEY = 'unipas_privacy_consented_v2';

// 첫 실행 시 1회 표시하는 개인정보처리방침 + 이용규약 동의 화면.
// 맨 아래까지 스크롤하고 체크박스를 켜야만 「同意して始める」 버튼이 활성화된다.
export default function PrivacyConsentScreen({ onConsent }) {
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);

  const canAgree = scrolledToBottom && checked;

  // 스크롤이 맨 아래에 도달했는지 판정 (여유 24px)
  const handleScroll = ({ nativeEvent }) => {
    const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 24) {
      setScrolledToBottom(true);
    }
  };

  const handleAgree = async () => {
    if (!canAgree || saving) return;
    setSaving(true);
    try {
      await AsyncStorage.setItem(PRIVACY_CONSENT_KEY, new Date().toISOString());
      onConsent?.();
    } catch {
      // 저장 실패 시에도 진행은 시켜 사용자를 막지 않는다 (다음 실행에 다시 표시될 뿐)
      onConsent?.();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 헤더 (뒤로가기 없음 — 첫 실행 게이트) */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>プライバシーポリシー・利用規約</Text>
        <Text style={styles.headerSub}>ご利用の前に内容をご確認ください</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        <PrivacyPolicyBody />
        <TermsOfServiceBody />
      </ScrollView>

      {/* 하단 고정: 동의 체크 + 시작 버튼 */}
      <View style={styles.footer}>
        {!scrolledToBottom && (
          <Text style={styles.scrollHint}>↓ 最後までスクロールしてください</Text>
        )}

        <TouchableOpacity
          style={styles.checkRow}
          onPress={() => setChecked((v) => !v)}
          activeOpacity={0.7}
          disabled={!scrolledToBottom}
        >
          <View style={[
            styles.checkbox,
            checked && styles.checkboxOn,
            !scrolledToBottom && styles.checkboxDisabled,
          ]}>
            {checked && <Text style={styles.checkMark}>✓</Text>}
          </View>
          <Text style={[styles.checkLabel, !scrolledToBottom && styles.checkLabelDisabled]}>
            上記のプライバシーポリシーおよび利用規約に同意します
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.agreeButton, !canAgree && styles.agreeButtonDisabled]}
          onPress={handleAgree}
          disabled={!canAgree || saving}
          activeOpacity={0.85}
        >
          {saving
            ? <LoadingDots size={6} color="#FFFFFF" />
            : <Text style={styles.agreeText}>同意して始める</Text>
          }
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerTitle: {
    ...typography.subtitle,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  headerSub: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
  },

  // 하단 고정 영역
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  scrollHint: {
    ...typography.caption,
    color: colors.textDisabled,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    marginBottom: spacing.md,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxDisabled: {
    opacity: 0.4,
  },
  checkMark: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '800',
  },
  checkLabel: {
    ...typography.body2,
    color: colors.textPrimary,
    flex: 1,
  },
  checkLabelDisabled: {
    color: colors.textDisabled,
  },
  agreeButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
  },
  agreeButtonDisabled: {
    backgroundColor: colors.border,
  },
  agreeText: {
    ...typography.body1,
    fontWeight: '700',
    color: colors.white,
  },
});
