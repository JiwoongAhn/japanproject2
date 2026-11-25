// 공용 바텀시트 — 아래에서 올라오는 창은 모두 이 부품을 쓴다 (2026-11-25)
//   모양: 흰 배경 · 위 모서리 24 · 손잡이 38×5 · 어두운 배경 45% / 배경은 제자리에서 어두워지고 시트만 올라온다
// ⚠️ 닫은 직후 다른 창(모달·사진첩·Alert·modal 화면)을 열 때는 setTimeout(…, motion.afterClose) 로 미룰 것
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated, Dimensions, Easing, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View,
} from 'react-native';
import { colors } from '../constants/colors';
import { motion } from '../constants/motion';
import { spacing, radius } from '../constants/spacing';

/**
 * @param {boolean}  visible
 * @param {Function} onClose            바깥 탭·안드로이드 뒤로가기로 닫힐 때
 * @param {boolean}  dismissOnBackdrop  false면 바깥을 눌러도 안 닫힘 (입력·동의 창)
 * @param {boolean}  inline             true면 OS 모달 대신 현재 화면 위에 겹친다 (하단 탭이 그대로 보임)
 * @param {boolean}  avoidKeyboard      입력칸이 있는 시트
 * @param {boolean}  scrollable       안에 ScrollView(flexShrink:1)가 있는 긴 시트 — 화면 높이의 88%까지만 커진다
 * @param {object}   style              시트에 덧붙일 스타일(여백 등)
 */
export default function BottomSheet({
  visible, onClose, dismissOnBackdrop = true, inline = false, avoidKeyboard = false, scrollable = false, style, children,
}) {
  const [mounted, setMounted] = useState(!!visible);
  const progress = useRef(new Animated.Value(0)).current; // 0 = 닫힘, 1 = 열림
  const height = useRef(new Animated.Value(Dimensions.get('window').height)).current;
  const translateY = useRef(
    Animated.multiply(Animated.subtract(1, progress), height)
  ).current;

  // 닫히는 동안에는 데이터가 이미 비어 있을 수 있어, 마지막으로 보이던 내용을 그대로 보여준다
  const lastChildren = useRef(children);
  if (visible) lastChildren.current = children;

  useEffect(() => {
    if (visible) setMounted(true);
    Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: visible ? motion.open : motion.close,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    if (visible) return undefined;
    // 애니메이션 완료 콜백 대신 시간으로 치운다 — 도중에 끊겨도 투명한 창이 남아 화면을 막지 않게
    const timer = setTimeout(() => setMounted(false), motion.close);
    return () => clearTimeout(timer);
  }, [visible, progress]);

  if (!visible && !mounted) return null;

  const body = (
    <View style={styles.root} pointerEvents={visible ? 'auto' : 'none'}>
      <Animated.View style={[styles.backdrop, { opacity: progress }]} />
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={dismissOnBackdrop ? onClose : undefined}
        accessible={dismissOnBackdrop}
        accessibilityLabel={dismissOnBackdrop ? '閉じる' : undefined}
      />
      <Animated.View
        style={[styles.sheet, scrollable && styles.sheetScrollable, style, { transform: [{ translateY }] }]}
        onLayout={(e) => height.setValue(e.nativeEvent.layout.height)}
      >
        <View style={styles.grab} />
        {visible ? children : lastChildren.current}
      </Animated.View>
    </View>
  );

  if (inline) return <View style={StyleSheet.absoluteFill}>{body}</View>;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      {avoidKeyboard ? (
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {body}
        </KeyboardAvoidingView>
      ) : body}
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.huge,
  },
  // 세로가 짧은 기기·키보드가 올라왔을 때 화면 위로 넘치지 않게
  sheetScrollable: { maxHeight: '88%' },
  grab: {
    width: 38, height: 5, borderRadius: 3, backgroundColor: colors.border,
    alignSelf: 'center', marginBottom: spacing.lg,
  },
});
