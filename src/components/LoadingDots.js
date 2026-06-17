// 점 3개가 순서대로 통통 튀는 로딩 애니메이션 컴포넌트
// 앱 시작 로딩, 게시판 새로고침/더보기 등 로딩 표시 자리에 공용으로 사용
import { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { colors } from '../constants/colors';

const DOT_COUNT = 3;

/**
 * @param {number} size  점 하나의 지름(px). 기본 10
 * @param {string} color 점 색깔. 기본 앱 테마 primary
 * @param {object} style 컨테이너에 덧붙일 스타일(여백 등)
 */
export default function LoadingDots({ size = 10, color = colors.primary, style }) {
  // 점이 위로 튀는 높이는 점 크기에 비례 (작은 점은 조금만, 큰 점은 많이)
  const lift = size * 0.6;

  // 점마다 Animated.Value 1개씩 준비 (위아래 이동값)
  const dots = useRef(
    Array.from({ length: DOT_COUNT }, () => new Animated.Value(0))
  ).current;

  useEffect(() => {
    // 점 하나의 애니메이션 정의 (올라갔다 → 내려옴)
    const makeAnim = (dot) =>
      Animated.sequence([
        Animated.timing(dot, {
          toValue: -lift,        // 위로 이동
          duration: 300,
          useNativeDriver: true, // 네이티브 스레드에서 실행 (성능 좋음)
        }),
        Animated.timing(dot, {
          toValue: 0,            // 원위치
          duration: 300,
          useNativeDriver: true,
        }),
      ]);

    // 점마다 150ms 딜레이를 주되, 앞뒤 대기를 합쳐 모든 점의 주기를 동일하게 맞춤
    const animations = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 150),
          makeAnim(dot),
          Animated.delay((DOT_COUNT - 1 - i) * 150),
        ])
      )
    );

    animations.forEach((a) => a.start());
    return () => animations.forEach((a) => a.stop()); // 화면 나갈 때 정리
  }, [dots, lift]);

  return (
    <View style={[styles.container, style]}>
      {dots.map((dot, i) => (
        <Animated.View
          key={i}
          style={[
            styles.dot,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: color,
              marginHorizontal: size * 0.4, // gap 대신 margin (구버전 RN 호환)
              transform: [{ translateY: dot }],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  dot: {},
});
