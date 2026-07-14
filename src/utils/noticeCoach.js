// 홈 공지 카드 "첫 탭 사용법 코치" 표시 여부를 결정하는 순수 로직.
// UI(ManabaNoticePreview)에서 분리해 테스트 가능하게 한다.
//
// coachShown 의미:
//   null  = AsyncStorage 플래그를 아직 읽기 전
//   false = 아직 코치를 본 적 없음 (→ 첫 탭에서 안내)
//   true  = 이미 코치를 봤음 (→ 바로 원본으로)

// AsyncStorage에서 읽은 원시 값('1' 또는 null 등)을 coachShown 불리언으로 변환.
// 저장은 '1'로만 하므로 '1'일 때만 "이미 봄"으로 판정한다.
export function parseCoachFlag(rawValue) {
  return rawValue === '1';
}

// 공지 카드를 탭했을 때 코치 모달을 먼저 띄워야 하는지.
// 아직 안 본(false) 경우에만 가로챈다. 로드 전(null)·이미 본(true)이면 바로 이동.
export function shouldShowCoachOnTap(coachShown) {
  return coachShown === false;
}
