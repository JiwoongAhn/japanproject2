import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { radius } from '../constants/spacing';
import { MOCK_ASPECT, MOCK_WIDTH_MAX } from '../utils/layout';

// 온보딩에서 보여주는 폰 프레임 목업
// children: 폰 화면 안에 들어갈 콘텐츠
// width: 프레임 폭(px). 기본값은 큰 화면 기준 240. 작은 화면에서는 호출부가
//        computeMockSize()로 가용 공간에 맞춘 폭을 넘긴다 (높이는 항상 폭 × MOCK_ASPECT).
export default function PhoneMockup({ children, width = MOCK_WIDTH_MAX }) {
  const height = width * MOCK_ASPECT;
  return (
    <View style={[styles.frame, { width, height, borderRadius: width * 0.13 }]}>
      {/* 상단 노치 — 프레임 폭에 비례(240px 기준 65×18). 고정 70px이면 작은 프레임에서 상태바 아이콘과 겹친다 */}
      <View
        style={[
          styles.notch,
          { width: Math.round(width * 0.27), height: Math.round(width * 0.075), top: Math.round(width * 0.042) },
        ]}
      />
      {/* 화면 영역 */}
      <View style={[styles.screen, { borderRadius: width * 0.11 }]}>
        {/* 상태바 (아이폰 기본 스타일) */}
        <View style={styles.statusBar}>
          <Text style={styles.statusTime}>9:41</Text>
          <View style={styles.statusIcons}>
            <Ionicons name="cellular" size={11} color={colors.gray900} />
            <Ionicons name="wifi" size={12} color={colors.gray900} />
            <Ionicons name="battery-full" size={16} color={colors.gray900} />
          </View>
        </View>
        {/* 실제 콘텐츠 */}
        <View style={styles.content}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    backgroundColor: '#1A1A1A',
    padding: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
  notch: {
    position: 'absolute',
    alignSelf: 'center',
    borderRadius: radius.pill,
    backgroundColor: '#000',
    zIndex: 2,
  },
  screen: {
    flex: 1,
    backgroundColor: colors.white,
    overflow: 'hidden',
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  statusTime: { fontSize: 11, fontWeight: '700', color: colors.gray900 },
  statusIcons: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  content: { flex: 1 },
});
