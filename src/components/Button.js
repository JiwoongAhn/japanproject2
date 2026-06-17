import React from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../constants/colors';
import LoadingDots from './LoadingDots';
import { radius } from '../constants/spacing';

// 토스 스타일 공용 버튼
// variant: 'primary' (파란색) | 'secondary' (회색) | 'ghost' (배경 없음)
// size: 'lg' (56px, 기본) | 'md' (48px)
export default function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'lg',
  disabled = false,
  loading = false,
  style,
}) {
  const containerStyle = [
    styles.base,
    styles[`size_${size}`],
    styles[`variant_${variant}`],
    (disabled || loading) && styles.disabled,
    style,
  ];
  const textStyle = [styles.text, styles[`text_${variant}`]];

  return (
    <TouchableOpacity
      style={containerStyle}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
    >
      {loading ? (
        <LoadingDots size={6} color={variant === 'primary' ? '#FFFFFF' : colors.gray700} />
      ) : (
        <Text style={textStyle}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  size_lg: { height: 56, paddingHorizontal: 20 },
  size_md: { height: 48, paddingHorizontal: 16 },

  variant_primary:   { backgroundColor: colors.primary },
  variant_secondary: { backgroundColor: colors.gray100 },
  variant_ghost:     { backgroundColor: 'transparent' },

  disabled: { opacity: 0.5 },

  text: { fontSize: 17, fontWeight: '700', letterSpacing: -0.2 },
  text_primary:   { color: colors.white },
  text_secondary: { color: colors.gray700 },
  text_ghost:     { color: colors.primary },
});
