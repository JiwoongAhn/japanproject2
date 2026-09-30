// 클립보드/텍스트에서 OTP 코드(연속 N자리 숫자)를 추출하는 순수 함수.
//
// 이메일 OTP는 iOS의 oneTimeCode 자동완성이 잘 안 뜨고, number-pad 키보드는
// 위에 붙여넣기 제안 바가 없어서, 앱에서 직접 클립보드를 읽어 "붙여넣기" 버튼을
// 띄우는 데 사용한다.
//
// 규칙: 숫자 덩어리들 중 "정확히 length자리"인 첫 덩어리를 반환.
//   - 더 긴 숫자(전화번호 등)에 6자리가 포함돼도 오인식하지 않도록 정확히 일치만 채택.
//   - 없으면 null.

export function extractOtpCode(text, length = 6) {
  if (!text || typeof text !== 'string') return null;
  const runs = text.match(/\d+/g);
  if (!runs) return null;
  const hit = runs.find((r) => r.length === length);
  return hit || null;
}

// 6자리를 다 채웠을 때 "지금 자동으로 확인을 보낼지" 판단하는 순수 함수.
//
// 왜 필요한가:
//   작은 화면(iPhone SE 등)에서는 숫자 키패드가 確認 버튼을 거의 덮는다.
//   숫자 키패드에는 완료 키도 없어 사용자가 내릴 수도 없었다.
//   → 6자리가 채워지면 버튼을 누르지 않아도 진행시킨다.
//
// 반복 제출을 막는 것이 핵심:
//   코드가 틀리면 Alert이 뜨고 입력값은 그대로 남는다. 가드가 없으면
//   같은 코드로 무한히 재요청하게 된다. 그래서 "이미 시도한 코드"는 건너뛴다.
//
//   code      : 현재 입력값
//   loading   : 확인 요청이 진행 중인가
//   lastTried : 자동 제출을 이미 시도한 코드(없으면 null)
export function shouldAutoSubmitOtp({ code, loading, lastTried }, length = 6) {
  if (typeof code !== 'string' || code.length !== length) return false;
  if (loading) return false;
  if (lastTried === code) return false;
  return true;
}
