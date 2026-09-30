import { extractOtpCode, shouldAutoSubmitOtp } from '../../src/utils/otpCode';

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

// 작은 화면에서 確認 버튼이 키패드에 가려지는 문제 때문에 6자리 입력 시 자동 확인한다.
// 여기서 검증하는 핵심은 "같은 코드로 반복 제출하지 않는다"는 가드.
describe('shouldAutoSubmitOtp', () => {
  test('6자리를 채우면 제출한다', () => {
    expect(shouldAutoSubmitOtp({ code: '123456', loading: false, lastTried: null })).toBe(true);
  });
  test('6자리 미만이면 제출하지 않는다', () => {
    expect(shouldAutoSubmitOtp({ code: '12345', loading: false, lastTried: null })).toBe(false);
  });
  test('6자리를 넘으면 제출하지 않는다', () => {
    expect(shouldAutoSubmitOtp({ code: '1234567', loading: false, lastTried: null })).toBe(false);
  });
  test('확인 요청 중이면 제출하지 않는다(중복 요청 방지)', () => {
    expect(shouldAutoSubmitOtp({ code: '123456', loading: true, lastTried: null })).toBe(false);
  });
  test('같은 코드를 이미 시도했으면 제출하지 않는다(실패 후 무한 재시도 방지)', () => {
    expect(shouldAutoSubmitOtp({ code: '123456', loading: false, lastTried: '123456' })).toBe(false);
  });
  test('코드를 고쳐 다른 값이 되면 다시 제출한다', () => {
    expect(shouldAutoSubmitOtp({ code: '123457', loading: false, lastTried: '123456' })).toBe(true);
  });
  test('코드가 문자열이 아니면 제출하지 않는다', () => {
    expect(shouldAutoSubmitOtp({ code: null, loading: false, lastTried: null })).toBe(false);
    expect(shouldAutoSubmitOtp({ code: 123456, loading: false, lastTried: null })).toBe(false);
  });
  test('length 인자로 자리수 변경 가능', () => {
    expect(shouldAutoSubmitOtp({ code: '1234', loading: false, lastTried: null }, 4)).toBe(true);
    expect(shouldAutoSubmitOtp({ code: '123456', loading: false, lastTried: null }, 4)).toBe(false);
  });
});
