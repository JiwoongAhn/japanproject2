// 스켈레톤 — 내용이 들어올 자리를 회색 뼈대로 먼저 보여준다 (첫 로딩에만)
//   홈·時間割·掲示板·課題 4곳. 나머지 화면과 버튼 안은 LoadingDots 를 쓴다
import React, { createContext, useContext, useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, View } from 'react-native';
import { colors } from '../constants/colors';
import { spacing, radius, shadow } from '../constants/spacing';

// 한 화면의 뼈대는 모두 같은 박자로 밝아졌다 어두워진다
const PulseContext = createContext(null);

function Pulse({ children, style }) {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const anim = Animated.loop(Animated.sequence([
      Animated.timing(opacity, { toValue: 0.45, duration: 900, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 900, useNativeDriver: true }),
    ]));
    let stopped = false;
    // 「動きを減らす」를 켠 사람에게는 움직이지 않는 뼈대만
    Promise.resolve(AccessibilityInfo.isReduceMotionEnabled?.()).then((reduce) => {
      if (!reduce && !stopped) anim.start();
    }).catch(() => {});
    return () => { stopped = true; anim.stop(); };
  }, [opacity]);
  return (
    <PulseContext.Provider value={opacity}>
      <View style={style} accessibilityLabel="読み込み中" accessible>{children}</View>
    </PulseContext.Provider>
  );
}

function Box({ w = '100%', h = 14, r = 7, mb = 0, style }) {
  const opacity = useContext(PulseContext);
  return <Animated.View style={[styles.box, { width: w, height: h, borderRadius: r, marginBottom: mb, opacity }, style]} />;
}

export function HomeSkeleton() {
  return (
    <Pulse style={styles.page}>
      <View style={styles.card}>
        <Box w="40%" mb={spacing.md} />
        <Box w="75%" h={24} />
      </View>
      <View style={styles.card}>
        <Box w="38%" mb={spacing.lg} />
        <View style={styles.row}>
          {[0, 1, 2].map((i) => <Box key={i} h={56} r={radius.md} style={styles.flex} w="auto" />)}
        </View>
      </View>
      {[0, 1].map((k) => (
        <View key={k} style={styles.card}>
          <Box w="38%" mb={spacing.lg} />
          {[0, 1].map((i) => (
            <View key={i}>
              <Box mb={spacing.md} />
              <Box w="60%" mb={i === 0 ? spacing.xl : 0} />
            </View>
          ))}
        </View>
      ))}
    </Pulse>
  );
}

export function TimetableSkeleton() {
  return (
    <Pulse style={styles.page}>
      <View style={[styles.card, styles.grid]}>
        {[0, 1, 2, 3, 4, 5].map((r) => (
          <View key={r} style={[styles.row, styles.gridRow]}>
            {[0, 1, 2, 3, 4].map((c) => <Box key={c} h={68} r={radius.sm} style={styles.cell} w="auto" />)}
          </View>
        ))}
      </View>
    </Pulse>
  );
}

export function ListSkeleton({ count = 5 }) {
  return (
    <Pulse style={styles.page}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.card}>
          <View style={[styles.row, { marginBottom: spacing.md }]}>
            <Box w={46} h={20} /><Box w={40} h={20} />
          </View>
          <Box w="85%" mb={spacing.sm} />
          <Box w="55%" />
        </View>
      ))}
    </Pulse>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, paddingTop: spacing.md, overflow: 'hidden' },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl,
    marginHorizontal: spacing.lg, marginBottom: spacing.md, ...shadow.card,
  },
  box: { backgroundColor: colors.gray200 },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  cell: { flex: 1, backgroundColor: colors.gray100 },
  grid: { padding: spacing.md },
  gridRow: { marginBottom: spacing.sm },
});
