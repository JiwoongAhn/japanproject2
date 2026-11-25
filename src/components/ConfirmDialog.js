// 확인 창 3종류 (2026-11-25 확정) — 화면에서는 hooks/useConfirm 으로 쓴다
//   normal : 되돌릴 수 있는 일 (ブロック·保存を解除)            회색 아이콘 + 파랑 버튼
//   danger : 되돌릴 수 없는 일 (削除·ログアウト)                 빨강 아이콘 + 빨강 버튼
//   all    : 전부 지우는 일 (退会·時間割を全て削除)              체크해야 빨강 버튼이 켜진다
//   choice : 여러 개 중 하나 고르기 (通報の理由 등)                회색 버튼 여러 개
//            Alert 는 Android 에서 버튼이 3개까지만 보여 キャンセル 이 사라지므로 4개 이상은 반드시 이것을 쓴다
// 단순 안내·오류는 여기 쓰지 않고 Alert 를 그대로 쓴다
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BottomSheet from './BottomSheet';
import CenterDialog from './CenterDialog';
import { colors } from '../constants/colors';
import { spacing, radius } from '../constants/spacing';
import { typography } from '../constants/typography';

const DEFAULT_ICON = { choice: 'list-outline', normal: 'help-circle-outline', danger: 'trash-outline', all: 'warning-outline' };

export default function ConfirmDialog({ visible, placement = 'sheet', options, onCancel, onConfirm, onChoose }) {
  const [checked, setChecked] = useState(false);
  useEffect(() => { if (visible) setChecked(false); }, [visible]);

  const { kind = 'normal', icon, title, target, message, confirmText = 'OK', checkText, choices } = options ?? {};
  const danger = kind === 'danger' || kind === 'all';
  const blocked = kind === 'all' && !checked;

  const body = options ? (
    <>
      <View style={[styles.iconBox, danger && styles.iconBoxDanger]}>
        <Ionicons name={icon ?? DEFAULT_ICON[kind]} size={26} color={danger ? colors.danger : colors.gray700} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {target ? (
        <View style={styles.target}>
          <Text style={styles.targetText} numberOfLines={2}>{target}</Text>
        </View>
      ) : null}
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {kind === 'all' ? (
        <TouchableOpacity
          style={styles.checkRow}
          onPress={() => setChecked((v) => !v)}
          activeOpacity={0.7}
          accessibilityRole="checkbox"
          accessibilityState={{ checked }}
          accessibilityLabel={checkText}
        >
          <Ionicons name={checked ? 'checkbox' : 'square-outline'} size={24} color={checked ? colors.danger : colors.gray400} />
          <Text style={styles.checkText}>{checkText}</Text>
        </TouchableOpacity>
      ) : null}
      {kind === 'choice' ? (choices ?? []).map((c) => (
        <TouchableOpacity
          key={c.text}
          style={[styles.button, styles.buttonChoice]}
          onPress={() => onChoose?.(c)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={c.text}
        >
          <Text style={styles.choiceText}>{c.text}</Text>
        </TouchableOpacity>
      )) : (
      <TouchableOpacity
        style={[styles.button, danger ? styles.buttonDanger : styles.buttonPrimary, blocked && styles.buttonDisabled]}
        onPress={onConfirm}
        disabled={blocked}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={confirmText}
      >
        <Text style={styles.buttonText}>{confirmText}</Text>
      </TouchableOpacity>
      )}
      <TouchableOpacity
        style={[styles.button, styles.buttonCancel]}
        onPress={onCancel}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="キャンセル"
      >
        <Text style={styles.cancelText}>キャンセル</Text>
      </TouchableOpacity>
    </>
  ) : null;

  return placement === 'center'
    ? <CenterDialog visible={visible} onClose={onCancel}>{body}</CenterDialog>
    : <BottomSheet visible={visible} onClose={onCancel}>{body}</BottomSheet>;
}

const styles = StyleSheet.create({
  iconBox: {
    width: 52, height: 52, borderRadius: radius.lg, backgroundColor: colors.gray100,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md,
  },
  iconBoxDanger: { backgroundColor: colors.dangerSoft },
  title: { ...typography.title3, color: colors.textPrimary, marginBottom: spacing.sm },
  target: { backgroundColor: colors.gray50, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  targetText: { ...typography.bodyStrong, color: colors.textPrimary },
  message: { ...typography.body2, color: colors.gray700, marginBottom: spacing.lg },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.lg },
  checkText: { ...typography.body2, color: colors.gray700, flex: 1, paddingTop: 1 },
  button: { height: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  buttonPrimary: { backgroundColor: colors.primary },
  buttonDanger: { backgroundColor: colors.danger },
  buttonDisabled: { opacity: 0.4 },
  buttonChoice: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  choiceText: { ...typography.subtitle, color: colors.textPrimary },
  buttonText: { ...typography.subtitle, fontWeight: '700', color: colors.white },
  buttonCancel: { backgroundColor: colors.gray100, marginTop: spacing.sm },
  cancelText: { ...typography.subtitle, color: colors.gray700 },
});
