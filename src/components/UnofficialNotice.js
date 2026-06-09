import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../constants/colors';
import { spacing } from '../constants/spacing';
import { typography } from '../constants/typography';

/**
 * 학교 로그인/추출 화면 하단에 고정 표시하는 면책 고지 바.
 * "비공식 앱 + 본인 로그인 정보로 동작"을 명시 — 학교 약관 컴플라이언스(투명성) 장치.
 * 비차단(non-blocking)이라 간편 조회 UX를 해치지 않는다.
 */
export default function UnofficialNotice() {
  return (
    <View style={styles.bar}>
      <Text style={styles.text}>
        ℹ️ 本アプリは学校公式のアプリではありません。学生本人のログイン情報で動作します。
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.gray50,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  text: {
    ...typography.small,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
