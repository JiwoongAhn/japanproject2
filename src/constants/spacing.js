// 간격 토큰 (4px 단위)
// 가이드: xs(4)는 컴포넌트 내부 padding 전용.
// 객체 간 거리는 sm(8) 이상 사용 — 8dp 그리드 원칙.
export const spacing = {
  xs: 4,    // 내부 전용
  sm: 8,    // 컴포넌트 간 최소 거리
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
  lg: 16,   // 카드 기본 (토스)
  xl: 20,   // 큰 카드·모달
  xxl: 24,  // 바텀시트
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
  // 파스텔 카드용 더 옅은 그림자
  soft: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
};
