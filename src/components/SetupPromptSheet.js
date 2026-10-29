import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable } from 'react-native';
import { colors } from '../constants/colors';
import { typography } from '../constants/typography';
import { spacing, radius } from '../constants/spacing';
import { SETUP_STEP_LABELS } from '../utils/manabaSetupStatus';

/**
 * 앱을 열 때 아래에서 올라오는 「まだ終わっていない設定」 안내 창 (2026-10-29)
 *
 * manaba 통지 설정을 끝내지 않은 학생에게 단계별로 다른 안내를 보여준다.
 *   none(미시작) → 메일 연결 온보딩 / pending(중간) → 주소·설정 가이드 / no-push(알림 꺼짐) → 허용 팝업 또는 설정 앱
 * 문구는 utils/manabaSetupStatus.js 의 getSetupSheetCopy 가 정한다.
 * 「あとで」로 닫을 수 있다 — 강제하지 않는다. 언제 뜨는지는 shouldPromptSetup (새로 켰을 때 / 30분 이상 비웠다 돌아왔을 때).
 */
export default function SetupPromptSheet({ visible, copy, onAction, onLater }) {
  if (!copy) return null;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onLater}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTouch} onPress={onLater} accessibilityLabel="閉じる" />
        <View style={styles.sheet}>
          <View style={styles.grab} />
          <View style={styles.iconBox}>
            <Text style={styles.icon}>{copy.icon}</Text>
          </View>
          <Text style={styles.title}>{copy.title}</Text>
          <Text style={styles.body}>{copy.body}</Text>

          {copy.steps && (
            <View style={styles.steps}>
              {copy.steps.map((state, i) => (
                <View key={SETUP_STEP_LABELS[i]} style={[styles.step, state === 'done' && styles.stepDone, state === 'now' && styles.stepNow]}>
                  <Text
                    style={[styles.stepText, state === 'done' && styles.stepTextDone, state === 'now' && styles.stepTextNow]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {SETUP_STEP_LABELS[i]}{state === 'done' ? ' ✓' : ''}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {copy.guide && (
            <View style={styles.guide}>
              <Text style={styles.guideTitle}>{copy.guide.title}</Text>
              <Text style={styles.guideText}>{copy.guide.text}</Text>
            </View>
          )}

          <TouchableOpacity style={styles.button} activeOpacity={0.85} onPress={onAction}>
            <Text style={styles.buttonText}>{copy.action}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.later} onPress={onLater}>
            <Text style={styles.laterText}>あとで</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  backdropTouch: { flex: 1 },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.huge,
  },
  grab: { width: 38, height: 5, borderRadius: 3, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.lg },
  iconBox: {
    width: 56, height: 56, borderRadius: radius.lg, backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md,
  },
  icon: { fontSize: 28 },
  title: { ...typography.title3, color: colors.textPrimary, marginBottom: spacing.sm },
  body: { ...typography.body2, color: colors.gray700, marginBottom: spacing.lg },
  steps: { flexDirection: 'row', gap: 6, marginBottom: spacing.lg },
  step: { flex: 1, alignItems: 'center', paddingVertical: 7, paddingHorizontal: 2, borderRadius: radius.sm, backgroundColor: colors.background },
  stepDone: { backgroundColor: colors.primaryLight },
  stepNow: { backgroundColor: colors.warningSoft },
  stepText: { ...typography.micro, color: colors.textSecondary },
  stepTextDone: { color: colors.primary, fontWeight: '700' },
  stepTextNow: { color: colors.warning, fontWeight: '700' },
  guide: { backgroundColor: colors.background, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg },
  guideTitle: { ...typography.captionStrong, color: colors.textPrimary, marginBottom: 2 },
  guideText: { ...typography.caption, color: colors.gray700 },
  button: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.lg, alignItems: 'center', marginBottom: spacing.sm },
  buttonText: { ...typography.bodyStrong, fontSize: 16, color: '#FFFFFF' },
  later: { alignItems: 'center', paddingVertical: spacing.md },
  laterText: { ...typography.body2, color: colors.textSecondary },
});
