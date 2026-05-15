import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors, pastel } from '../constants/colors';
import { spacing, radius, shadow } from '../constants/spacing';

/**
 * 공통 Card 컴포넌트
 *
 * Props:
 *   variant: 'shadow' (기본) | 'soft' | 'flat'
 *     - shadow: 흰 배경 + 토스 카드 그림자 (기본)
 *     - soft:   흰 배경 + 더 옅은 그림자 (보조 카드)
 *     - flat:   배경만, 그림자 없음 (그룹 컨테이너)
 *   pastel:  'pink' | 'peach' | 'yellow' | 'mint' | 'sky' | 'lavender' | 'rose'
 *            지정 시 파스텔 배경 + soft 그림자 자동 적용
 *   padding: spacing 토큰 키 ('xs'~'huge') 또는 숫자 (기본 'lg' = 16)
 *   radius:  radius 토큰 키 ('sm'~'xxl','pill') (기본 'lg' = 16)
 *   style:   추가 스타일 override
 *
 * 사용 예:
 *   <Card>...</Card>
 *   <Card variant="soft" padding="md">...</Card>
 *   <Card pastel="mint">...</Card>
 *   <Card variant="flat" radius="xl">...</Card>
 */
export default function Card({
  variant = 'shadow',
  pastel: pastelName,
  padding = 'lg',
  radius: radiusKey = 'lg',
  style,
  children,
  ...rest
}) {
  // padding 값: 토큰 키이면 변환, 숫자면 그대로
  const paddingValue = typeof padding === 'string' ? (spacing[padding] ?? spacing.lg) : padding;
  const radiusValue = radius[radiusKey] ?? radius.lg;

  // 파스텔 지정 시: 파스텔 배경 + soft 그림자
  const isPastel = !!pastelName && pastel[pastelName];
  const backgroundColor = isPastel ? pastel[pastelName].bg : colors.surface;

  // variant별 그림자 (파스텔이면 자동 soft)
  let shadowStyle = null;
  if (isPastel || variant === 'soft') {
    shadowStyle = shadow.soft;
  } else if (variant === 'shadow') {
    shadowStyle = shadow.card;
  }
  // 'flat'은 그림자 없음

  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor,
          padding: paddingValue,
          borderRadius: radiusValue,
        },
        shadowStyle,
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    // shadow는 인라인으로 합성
  },
});
