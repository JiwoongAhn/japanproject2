// 앱 전체에서 사용하는 색상 팔레트 (토스 스타일)
export const colors = {
  // 메인 — 짙은 파랑 (2026-11-25 변경: 흰 글씨 명암비 3.7 → 5.1)
  primary:       '#1D66E5',   // 버튼, 탭 활성화, 강조
  primaryDark:   '#1650B8',   // 버튼 눌렀을 때
  primaryLight:  '#E8F0FD',   // 배지 배경, 아이콘 배경

  // 상태
  success:       '#05C072',   // 과제 제출 완료
  warning:       '#FF8A00',   // 마감 임박
  danger:        '#F04438',   // 기한 초과

  // 부드러운 상태 배경 — 실패·경고 화면을 강압적이지 않게
  successSoft:   '#DCFCE7',
  warningSoft:   '#FFF4E5',
  dangerSoft:    '#FEE4E2',

  // 게시판 반응 (2026-10-21 사용자: 좋아요=빨강, 댓글=다른 색 — 파랑(primary)·빨강과 겹치지 않는 청록)
  like:          '#F04452',
  comment:       '#0BA5B8',
  hot:           '#FF5A36',   // 게시판 「リアルタイム人気」 HOT 배지
  hotSoft:       '#FFF0EB',

  // 배경
  background:    '#F2F4F6',   // 앱 전체 배경
  surface:       '#FFFFFF',   // 카드 배경

  // 텍스트
  textPrimary:   '#191F28',   // 제목
  textSecondary: '#5F6B7A',   // 부제목, 날짜, 힌트 (작은 글씨라 명암비 5 안팎 유지)
  textMuted:     '#8B95A1',   // 큰 숫자 「0」 등 일부러 힘을 뺀 큰 글씨 전용 (작은 글씨에 쓰지 말 것)
  textDisabled:  '#C9CDD2',

  // 구분선
  border:        '#E5E8EB',

  // 그레이 스케일 (위계 표현용)
  gray900:       '#191F28',
  gray800:       '#333D4B',
  gray700:       '#4E5968',
  gray600:       '#5F6B7A',
  gray500:       '#6B7684',
  gray400:       '#B0B8C1',
  gray300:       '#D1D6DB',
  gray200:       '#E5E8EB',
  gray100:       '#F2F4F6',
  gray50:        '#F9FAFB',
  white:         '#FFFFFF',
};

// 일본 감성 파스텔 액센트 7색 (밀러의 법칙 — 7±2)
// bg = 연한 배경 / accent = 점·테두리·아이콘 / text = bg 위의 작은 글씨 (명암비 4.5 — 더 진하면 무거워 보인다는 사용자 의견)
// 시간표 셀, 카테고리 칩, 태그 등에 사용
export const pastel = {
  pink:     { bg: '#FFE4E6', accent: '#FB7185', text: '#CD1D37' },
  peach:    { bg: '#FFEDD5', accent: '#FB923C', text: '#A55718' },
  yellow:   { bg: '#FEF3C7', accent: '#D97706', text: '#9F5F17' },
  mint:     { bg: '#D1FAE5', accent: '#10B981', text: '#127C59' },
  sky:      { bg: '#DBEAFE', accent: '#3B82F6', text: '#1E63D3' },
  lavender: { bg: '#EDE9FE', accent: '#8B5CF6', text: '#7848E5' },
  rose:     { bg: '#FCE7F3', accent: '#DB2777', text: '#C8216B' },
};
