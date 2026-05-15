// 앱 전체에서 사용하는 색상 팔레트 (토스 스타일)
export const colors = {
  // 메인 — 토스 스타일 블루
  primary:       '#3182F6',   // 버튼, 탭 활성화, 강조
  primaryDark:   '#1B64DA',   // 버튼 눌렀을 때
  primaryLight:  '#EBF3FE',   // 배지 배경, 아이콘 배경

  // 상태
  success:       '#05C072',   // 과제 제출 완료
  warning:       '#FF8A00',   // 마감 임박
  danger:        '#F04438',   // 기한 초과

  // 부드러운 상태 배경 — 실패·경고 화면을 강압적이지 않게
  successSoft:   '#DCFCE7',
  warningSoft:   '#FFF4E5',
  dangerSoft:    '#FEE4E2',

  // 배경
  background:    '#F2F4F6',   // 앱 전체 배경
  surface:       '#FFFFFF',   // 카드 배경

  // 텍스트
  textPrimary:   '#191F28',   // 제목
  textSecondary: '#8B95A1',   // 부제목, 날짜, 힌트
  textDisabled:  '#C9CDD2',

  // 구분선
  border:        '#E5E8EB',

  // 그레이 스케일 (위계 표현용)
  gray900:       '#191F28',
  gray800:       '#333D4B',
  gray700:       '#4E5968',
  gray600:       '#6B7684',
  gray500:       '#8B95A1',
  gray400:       '#B0B8C1',
  gray300:       '#D1D6DB',
  gray200:       '#E5E8EB',
  gray100:       '#F2F4F6',
  gray50:        '#F9FAFB',
  white:         '#FFFFFF',
};

// 일본 감성 파스텔 액센트 7색 (밀러의 법칙 — 7±2)
// 각 컬러는 bg(연한 배경) + accent(글자/강조) 페어
// 시간표 셀, 카테고리 칩, 태그 등에 사용
export const pastel = {
  pink:     { bg: '#FFE4E6', accent: '#FB7185' },
  peach:    { bg: '#FFEDD5', accent: '#FB923C' },
  yellow:   { bg: '#FEF3C7', accent: '#D97706' },
  mint:     { bg: '#D1FAE5', accent: '#10B981' },
  sky:      { bg: '#DBEAFE', accent: '#3B82F6' },
  lavender: { bg: '#EDE9FE', accent: '#8B5CF6' },
  rose:     { bg: '#FCE7F3', accent: '#DB2777' },
};
