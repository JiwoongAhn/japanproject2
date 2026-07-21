// 시간표 가져오기(추출) 버튼 노출 여부 (순수 함수)
//
// 기존엔 URL에 'mytimetable'이 포함될 때만 버튼을 띄웠는데, 기기에 따라
// 로그인 후 MY時間割 페이지로의 자동 이동이 실패하면(쿠키 자동복원/타이밍 차이)
// URL이 안 맞아 버튼이 영영 안 떠서 추출 자체가 불가능했다.
//
// → 로그인된 상태(loggedIn)이면 버튼을 띄워, 자동 이동이 실패해도 사용자가
//   직접 時間割 페이지를 열고 버튼을 누를 수 있게 한다. (시간표 페이지가 아니면
//   추출 결과가 0건이고, 화면에서 "時間割ページを開いてから" 안내로 유도)
//
// forTimetableImport: 시간표 일괄추가 경로로 열렸는지 (홈 등 다른 경로면 항상 false)
// loggedIn          : 로그인 페이지를 벗어났는지
// currentUrl        : 현재 WebView가 보고 있는 URL

export function shouldShowExtractButton({ forTimetableImport, currentUrl } = {}) {
  if (!forTimetableImport) return false;
  // #10: MY時間割(学習ナビ) 페이지에 있을 때만 노출한다.
  // 이전엔 loggedIn이면 어디서든 띄웠지만, kaede 로그인 페이지/기타 페이지에서도
  // 버튼이 떠서 혼란스러웠다. 시간표 페이지 URL(MyTimeTable) 일 때만 보이게 좁힌다.
  // (자동이동 실패 시엔 사용자가 MY時間割를 직접 열면 버튼이 나타난다)
  return (currentUrl || '').toLowerCase().includes('mytimetable');
}
