import React from 'react';
import { View, useWindowDimensions, StyleSheet } from 'react-native';
import { colors } from '../constants/colors';
import { getContentContainerStyle, isWideScreen } from '../utils/layout';

// 앱 전체를 감싸 큰 화면(아이패드·가로·분할 화면)에서 콘텐츠를 가운데로 모아주는 래퍼.
//
// 폰 크기에서는 { flex: 1 } 한 겹만 추가되므로 기존 화면과 픽셀 단위로 동일하다.
// 폭이 WIDE_BREAKPOINT 이상일 때만 최대 폭 컬럼 + 양옆 여백색이 적용된다.
// 화면 37개를 하나하나 고치는 대신 App.js 한 곳에서 일괄 적용한다.
export default function WideScreenContainer({ children }) {
  const { width } = useWindowDimensions();
  const wide = isWideScreen(width);

  return (
    <View style={[styles.outer, wide && styles.outerWide]}>
      <View style={getContentContainerStyle(width)}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
  },
  outerWide: {
    // 콘텐츠 양옆 빈 공간 — 배경색과 같게 두어 이질감을 없앤다
    backgroundColor: colors.background,
    alignItems: 'center',
  },
});
