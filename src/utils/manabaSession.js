// manaba 자동 재로그인 정책 — 앱 세션 전역 카운터/쿨다운
//
// 두 진입점에서 공유되는 정책:
// - ManabaLoginScreen: kaede 리디렉션 시 visible WebView로 자동 재로그인 시도
// - HomeScreen ManabaNoticePreview: 만료 감지 시 "재로그인 필요" 카드로 전환
//   (Preview는 백그라운드 자동 재로그인을 하지 않음 — 학교 봇 탐지 회피)
//
// 왜 모듈 변수(전역)인가?
//   컴포넌트 ref는 마운트/언마운트마다 초기화돼서, 사용자가 manaba 탭을 닫았다
//   다시 열기만 해도 시도 카운터가 0으로 돌아가 학교 서버에 과도하게 시도가
//   갈 수 있다. 모듈 변수로 앱 세션 동안 유지해 정책이 일관되게 적용되도록 함.

// 1 사이클 내 자동 재시도 허용 횟수 (학교 비번이 바뀌었으면 몇 번이든 실패하므로 2회)
export const AUTO_RELOGIN_MAX_ATTEMPTS = 2;
// kaede 자동 제출 후 manaba 도달까지 허용 시간 (네트워크 멈춤 보호용)
export const AUTO_RELOGIN_TIMEOUT_MS = 15000;
// MAX_ATTEMPTS 모두 실패한 뒤 다음 자동 시도까지 대기 시간 (5분)
const COOLDOWN_MS = 5 * 60 * 1000;

let failureCount = 0;
let lastFailureAt = 0;

// 지금 자동 재로그인을 시도해도 되는지 판단.
// - 실패 누적이 MAX 미만이면 시도 가능
// - MAX 도달했어도 쿨다운 경과했으면 다시 시도 가능 (학교 서버 회복 시간 확보)
export function canAttemptAutoRelogin() {
  if (failureCount < AUTO_RELOGIN_MAX_ATTEMPTS) return true;
  return Date.now() - lastFailureAt > COOLDOWN_MS;
}

// manaba 페이지에 정상 도달 → 카운터 초기화
export function recordAutoReloginSuccess() {
  failureCount = 0;
  lastFailureAt = 0;
}

// 타임아웃/거부 등 실패 발생 → 카운터+시각 기록 (쿨다운 진입)
export function recordAutoReloginFailure() {
  failureCount += 1;
  lastFailureAt = Date.now();
}

// 현재 정책 상태 (Preview 카드에서 "쿨다운 중" 메시지 분기용)
export function getAutoReloginState() {
  return { failureCount, lastFailureAt, cooldownMs: COOLDOWN_MS };
}
