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
