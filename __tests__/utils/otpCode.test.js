import { extractOtpCode } from '../../src/utils/otpCode';

describe('extractOtpCode', () => {
  test('코드만 있는 경우', () => {
    expect(extractOtpCode('123456')).toBe('123456');
  });
  test('문장 속 6자리 코드 추출 (일본어 안내문)', () => {
    expect(extractOtpCode('認証コードは 482913 です。10分間有効。')).toBe('482913');
    expect(extractOtpCode('Your code: 007788')).toBe('007788');
  });
  test('앞뒤 공백/줄바꿈 포함', () => {
    expect(extractOtpCode('\n  654321  \n')).toBe('654321');
  });
  test('5자리·7자리는 오인식하지 않음 (정확히 6자리만)', () => {
    expect(extractOtpCode('12345')).toBeNull();
    expect(extractOtpCode('1234567')).toBeNull();
  });
  test('더 긴 숫자에 6자리가 섞여도, 정확히 6자리 덩어리만 채택', () => {
    // 전화번호(11자리)만 있으면 매칭 안 됨
    expect(extractOtpCode('09012345678')).toBeNull();
    // 6자리 덩어리가 따로 있으면 그것을 반환
    expect(extractOtpCode('tel 09012345678 code 246810')).toBe('246810');
  });
  test('숫자가 전혀 없으면 null', () => {
    expect(extractOtpCode('コードが見つかりません')).toBeNull();
  });
  test('빈 값/비문자열 안전 처리', () => {
    expect(extractOtpCode('')).toBeNull();
    expect(extractOtpCode(null)).toBeNull();
    expect(extractOtpCode(undefined)).toBeNull();
    expect(extractOtpCode(123456)).toBeNull();
  });
  test('length 인자로 자리수 변경 가능', () => {
    expect(extractOtpCode('code 1234', 4)).toBe('1234');
  });
});
