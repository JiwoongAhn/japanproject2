// 가운데에 뜨는 창 — 이미 아래에서 올라온 화면(manaba·学校サイト·課題) 안에서 쓴다.
//   규칙(2026-11-25): 일반 화면에서는 아래에서(BottomSheet), 이미 올라온 창 안에서는 가운데에서(CenterDialog)
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, View } from 'react-native';
import { colors } from '../constants/colors';
import { motion } from '../constants/motion';
import { useModalGuard } from '../hooks/useModalGuard';
import { spacing, radius } from '../constants/spacing';

export default function CenterDialog({ visible, onClose, dismissOnBackdrop = true, children }) {
  const [mounted, setMounted] = useState(!!visible);
  const onShow = useModalGuard(!!visible, onClose);
  const progress = useRef(new Animated.Value(0)).current;
  const scale = useRef(progress.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] })).current;

  // 닫히는 동안에도 마지막 내용을 보여준다 (BottomSheet 와 같은 방식)
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
    const timer = setTimeout(() => setMounted(false), motion.close);
    return () => clearTimeout(timer);
  }, [visible, progress]);

  if (!visible && !mounted) return null;

  return (
    <Modal visible transparent animationType="none" onShow={onShow} onRequestClose={onClose}>
      <View style={styles.root} pointerEvents={visible ? 'auto' : 'none'}>
        <Animated.View style={[styles.backdrop, { opacity: progress }]} />
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={dismissOnBackdrop ? onClose : undefined}
          accessible={dismissOnBackdrop}
          accessibilityLabel={dismissOnBackdrop ? '閉じる' : undefined}
        />
        <Animated.View style={[styles.card, { opacity: progress, transform: [{ scale }] }]}>
          {visible ? children : lastChildren.current}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xxl },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  card: {
    width: '100%', maxWidth: 360, backgroundColor: colors.surface,
    borderRadius: radius.xxl, padding: spacing.xl,
  },
});
