// 간격 토큰 (4px 단위)
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
};

// 둥근 모서리 토큰
export const radius = {
  sm: 8,
  md: 12,   // 버튼 기본
  lg: 16,   // 카드 기본
  xl: 20,
  pill: 999,
};

// 그림자 토큰 (토스 스타일 — 아주 옅게)
// 사용 예: <View style={[styles.card, shadow.card]} />
export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  // 하단 탭바 — 위쪽으로 향하는 옅은 그림자
  tabBar: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 8,
  },
};
