// 인증 코드 대기 상태 기억 — "코드 보러 메일 앱 갔다 왔더니 대학 선택 화면" 방지
//
// 2026-10-26 안드로이드 로그인 실패 원인:
//   메모리가 적은 안드로이드 폰은 메일 앱(Outlook 등)을 여는 사이 뒤에 있던 우리 앱을 꺼버린다.
//   돌아오면 앱이 처음부터 시작돼 대학 선택 화면 → 메일을 다시 넣고 보내면 60초 재발송 제한에 걸려
//   「コードをうまく送信できませんでした」 → "로그인이 안 된다".
//   (서버 기록: 코드는 보냈는데 확인 요청이 한 번도 오지 않은 사용자들)
//
// 그래서 코드를 보내면 {메일, 학교, 보낸 시각}을 저장하고,
//   - 앱이 다시 켜졌을 때 유효시간 안이면 코드 입력 화면으로 바로 보낸다
//   - 같은 메일로 60초 안에 다시 보내려 하면 재발송하지 않고 코드 입력 화면으로 보낸다
// 판단은 순수 함수로 두고 테스트한다: __tests__/utils/pendingOtp.test.js
import AsyncStorage from '@react-native-async-storage/async-storage';

export const PENDING_OTP_KEY = 'pending_otp_v1';
export const PENDING_OTP_TTL_MS = 15 * 60 * 1000; // 코드 유효시간(Supabase 기본 1시간)보다 짧게 — 오래된 화면 복원 방지
export const RESEND_COOLDOWN_MS = 60 * 1000;       // Supabase 재발송 제한(60초)

// 저장값이 아직 쓸 만한가 (형식이 맞고 유효시간 안)
export function isPendingValid(pending, now = Date.now()) {
  if (!pending || typeof pending.email !== 'string' || !pending.email) return false;
  if (!Number.isFinite(pending.sentAt)) return false;
  const age = now - pending.sentAt;
  return age >= 0 && age < PENDING_OTP_TTL_MS;
}

// 같은 메일로 재발송 제한 시간 안인가 → 다시 보내지 말고 코드 입력 화면으로
export function shouldSkipResend(pending, email, now = Date.now()) {
  if (!isPendingValid(pending, now)) return false;
  if (pending.email !== String(email || '').trim().toLowerCase()) return false;
  return now - pending.sentAt < RESEND_COOLDOWN_MS;
}

// 재발송 버튼 남은 초 (보낸 시각 기준 — 앱이 다시 켜져도 정확하게)
export function resendCooldownSeconds(sentAt, now = Date.now()) {
  if (!Number.isFinite(sentAt)) return 0;
  return Math.max(0, Math.ceil((RESEND_COOLDOWN_MS - (now - sentAt)) / 1000));
}

// Supabase 의 "60초 안에 재요청" 오류인가
export function isOtpRateLimitError(error) {
  if (!error) return false;
  const code = String(error.code || '');
  const msg = String(error.message || '');
  return error.status === 429
    || code === 'over_email_send_rate_limit'
    || /security purposes|only request this after|rate limit/i.test(msg);
}

export async function savePendingOtp({ email, university, sentAt = Date.now() }) {
  try {
    await AsyncStorage.setItem(PENDING_OTP_KEY, JSON.stringify({
      email: String(email).trim().toLowerCase(),
      universityId: university?.id ?? null,
      sentAt,
    }));
  } catch (_) {}
}

export async function loadPendingOtp(now = Date.now()) {
  try {
    const raw = await AsyncStorage.getItem(PENDING_OTP_KEY);
    const pending = raw ? JSON.parse(raw) : null;
    return isPendingValid(pending, now) ? pending : null;
  } catch (_) {
    return null;
  }
}

export async function clearPendingOtp() {
  try {
    await AsyncStorage.removeItem(PENDING_OTP_KEY);
  } catch (_) {}
}
