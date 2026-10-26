// 인증 코드 대기 기억 — 안드로이드에서 메일 앱을 여는 사이 앱이 꺼져도 코드 입력으로 돌아오게 (2026-10-26)
let mockStore = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (k) => mockStore[k] ?? null),
  setItem: jest.fn(async (k, v) => { mockStore[k] = v; }),
  removeItem: jest.fn(async (k) => { delete mockStore[k]; }),
}));

import {
  isPendingValid,
  shouldSkipResend,
  resendCooldownSeconds,
  isOtpRateLimitError,
  savePendingOtp,
  loadPendingOtp,
  clearPendingOtp,
  PENDING_OTP_TTL_MS,
} from '../../src/utils/pendingOtp';

const T0 = 1_800_000_000_000;
const EMAIL = 's00a000x@kokushikan.ac.jp';

beforeEach(() => { mockStore = {}; });

describe('pendingOtp', () => {
  test('PO-01: 보낸 지 15분 안이면 유효, 넘으면 무효, 이상한 값은 무효', () => {
    expect(isPendingValid({ email: EMAIL, sentAt: T0 }, T0 + 60_000)).toBe(true);
    expect(isPendingValid({ email: EMAIL, sentAt: T0 }, T0 + PENDING_OTP_TTL_MS)).toBe(false);
    expect(isPendingValid({ email: EMAIL, sentAt: T0 + 5000 }, T0)).toBe(false); // 미래 시각(시계 변경)
    expect(isPendingValid(null)).toBe(false);
    expect(isPendingValid({ email: '', sentAt: T0 }, T0)).toBe(false);
    expect(isPendingValid({ email: EMAIL }, T0)).toBe(false);
  });

  test('PO-02: 같은 메일로 60초 안이면 재발송하지 않는다 (대소문자·공백 무시)', () => {
    const p = { email: EMAIL, sentAt: T0 };
    expect(shouldSkipResend(p, EMAIL, T0 + 30_000)).toBe(true);
    expect(shouldSkipResend(p, `  ${EMAIL.toUpperCase()} `, T0 + 30_000)).toBe(true);
    expect(shouldSkipResend(p, EMAIL, T0 + 61_000)).toBe(false);
    expect(shouldSkipResend(p, 'other@kokushikan.ac.jp', T0 + 10_000)).toBe(false);
    expect(shouldSkipResend(null, EMAIL, T0)).toBe(false);
  });

  test('PO-03: 재발송 남은 초는 보낸 시각 기준 (앱이 다시 켜져도 정확)', () => {
    expect(resendCooldownSeconds(T0, T0)).toBe(60);
    expect(resendCooldownSeconds(T0, T0 + 45_500)).toBe(15);
    expect(resendCooldownSeconds(T0, T0 + 90_000)).toBe(0);
    expect(resendCooldownSeconds(undefined, T0)).toBe(0);
  });

  test('PO-04: Supabase 재발송 제한 오류 판별', () => {
    expect(isOtpRateLimitError({ status: 429 })).toBe(true);
    expect(isOtpRateLimitError({ code: 'over_email_send_rate_limit' })).toBe(true);
    expect(isOtpRateLimitError({ message: 'For security purposes, you can only request this after 42 seconds.' })).toBe(true);
    expect(isOtpRateLimitError({ status: 400, message: 'Invalid email' })).toBe(false);
    expect(isOtpRateLimitError(null)).toBe(false);
  });

  test('PO-05: 저장 → (앱 재시작) 불러오기 → 삭제', async () => {
    await savePendingOtp({ email: ` ${EMAIL.toUpperCase()}`, university: { id: 'kokushikan' }, sentAt: T0 });
    expect(await loadPendingOtp(T0 + 120_000)).toEqual({ email: EMAIL, universityId: 'kokushikan', sentAt: T0 });
    expect(await loadPendingOtp(T0 + PENDING_OTP_TTL_MS + 1)).toBeNull(); // 오래된 기록은 복원하지 않는다
    await clearPendingOtp();
    expect(await loadPendingOtp(T0 + 1000)).toBeNull();
  });

  test('PO-06: 저장값이 깨져 있어도 앱이 멈추지 않는다', async () => {
    mockStore.pending_otp_v1 = '{broken';
    expect(await loadPendingOtp(T0)).toBeNull();
  });
});
