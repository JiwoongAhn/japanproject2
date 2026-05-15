// 토스 스타일 타이포그래피 토큰
// 사용 예: <Text style={typography.title1}>제목</Text>
// 가이드: 한 화면에 5단계 이상 섞지 말 것 (밀러의 법칙·1 thing/1 page)
export const typography = {
  // 기존 위계 (회귀 방지 위해 유지)
  title1:   { fontSize: 28, fontWeight: '800', letterSpacing: -0.5, lineHeight: 38 },
  title2:   { fontSize: 24, fontWeight: '700', letterSpacing: -0.4, lineHeight: 32 },
  title3:   { fontSize: 20, fontWeight: '700', letterSpacing: -0.3, lineHeight: 28 },
  subtitle: { fontSize: 17, fontWeight: '600', letterSpacing: -0.2, lineHeight: 24 },
  body1:    { fontSize: 16, fontWeight: '400', lineHeight: 24 },
  body2:    { fontSize: 15, fontWeight: '400', lineHeight: 22 },
  caption:  { fontSize: 13, fontWeight: '400', lineHeight: 18 },
  small:    { fontSize: 12, fontWeight: '500', lineHeight: 16 },

  // 추가 위계 (강조·마이크로카피 보강)
  display:       { fontSize: 32, fontWeight: '800', letterSpacing: -0.6, lineHeight: 42 },  // 화면 상단 큰 숫자
  bodyStrong:    { fontSize: 15, fontWeight: '600', lineHeight: 22 },  // 본문 강조
  captionStrong: { fontSize: 13, fontWeight: '600', lineHeight: 18 },  // 라벨·배지
  micro:         { fontSize: 11, fontWeight: '500', lineHeight: 14 },  // 시간표 셀 등 마이크로카피
};

// 부드러운 실패·빈 상태 문구 톤 가이드 (참고용)
// ✗ "エラーが発生しました"        →  ✓ "うまく取得できませんでした"
// ✗ "授業がありません"            →  ✓ "まだ授業がないみたい"
// ✗ "削除に失敗しました"          →  ✓ "削除できませんでした。もう一度お試しください"
