// 一括 → 시간표 읽기 안내 시트 (전용 파서가 없는 학교용 — 国士舘은 기존 kaede 방식 그대로)
// 사용자 결정(2026-10-21): 선택지 없이 처음부터 스크린샷 방법만 안내한다.
//   日本文理 실기에서 스크린샷=정상, 학교 사이트(앱 안 브라우저)=학외 Basic 인증 401로 막힘,
//   붙여넣기=실사용 검증 0 → 정보를 더 모은 뒤 수정. 다시 보이려면 SHOW_OTHER_METHODS = true
import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { spacing, radius } from '../constants/spacing';
import { typography } from '../constants/typography';
import { buildScreenshotSteps } from '../utils/aiTimetable';

export const SHOW_OTHER_METHODS = false;

export default function AiImportSheet({ visible, siteLabel, siteGuide, onSite, onImages, onText, onClose }) {
  const steps = buildScreenshotSteps(siteLabel, siteGuide);
  const others = SHOW_OTHER_METHODS
    ? [
        siteLabel && onSite && { key: 'site', icon: 'school-outline', title: '大学のサイトから読み取る', onPress: onSite },
        onText && { key: 'text', icon: 'clipboard-outline', title: 'テキストを貼り付ける', onPress: onText },
      ].filter(Boolean)
    : [];

  return (
    <Modal visible={!!visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.dim} onPress={onClose} accessibilityLabel="閉じる">
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.title}>時間割をまとめて登録</Text>
          <Text style={styles.desc}>時間割のスクショを、AIが読み取って登録します。</Text>
          <View style={styles.steps}>
            {steps.map((s, i) => (
              <View key={s} style={styles.step}>
                <Text style={styles.stepNum}>{i + 1}</Text>
                <Text style={styles.stepText}>{s}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity style={styles.cta} onPress={onImages} activeOpacity={0.85} accessibilityRole="button">
            <Ionicons name="images-outline" size={20} color={colors.white} />
            <Text style={styles.ctaText}>スクショを選ぶ</Text>
          </TouchableOpacity>
          {others.map((o) => (
            <TouchableOpacity key={o.key} style={styles.other} onPress={o.onPress} activeOpacity={0.7} accessibilityRole="button">
              <Ionicons name={o.icon} size={16} color={colors.primary} />
              <Text style={styles.otherText}>{o.title}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.cancel} onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.cancelText}>キャンセル</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  dim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl, padding: spacing.xl, paddingBottom: spacing.xxxl, gap: spacing.md },
  title: { ...typography.title3, color: colors.textPrimary },
  desc: { ...typography.caption, color: colors.textSecondary },
  steps: { gap: spacing.sm, backgroundColor: colors.primaryLight, borderRadius: radius.lg, padding: spacing.lg },
  step: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  stepNum: { ...typography.bodyStrong, color: colors.primary, width: 18 },
  stepText: { ...typography.body2, color: colors.textPrimary, flex: 1 },
  cta: { flexDirection: 'row', gap: spacing.sm, backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.lg, alignItems: 'center', justifyContent: 'center' },
  ctaText: { ...typography.bodyStrong, color: colors.white },
  other: { flexDirection: 'row', gap: spacing.xs, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xs },
  otherText: { ...typography.body2, color: colors.primary },
  cancel: { alignItems: 'center', paddingTop: spacing.sm },
  cancelText: { ...typography.body2, color: colors.textSecondary },
});
