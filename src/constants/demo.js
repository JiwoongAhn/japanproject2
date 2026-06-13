// Apple 심사용 데모 계정.
// 이 이메일로 로그인하면 실제 메일 발송을 건너뛰고 demo-login Edge Function 경로로
// 세션을 발급한다. 일반 사용자 흐름과 완전히 분리됨.
// (로그인 코드는 서버 Secret DEMO_OTP_CODE 에만 존재 — 앱 코드에는 두지 않음)
export const DEMO_EMAIL = 'appreview@kokushikan.ac.jp';
