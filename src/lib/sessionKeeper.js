// 로그인 세션을 "억울하게 끊기지 않게" 지키는 헬퍼 모음
//
// 배경(실기 버그 ⑥: 사용 중 갑자기 대학 선택 화면으로 롤백):
//   1) React Native에서는 Supabase의 autoRefreshToken 타이머가 앱이 백그라운드로
//      들어가면 멈춘다. AppState와 연결해 startAutoRefresh/stopAutoRefresh를
//      직접 호출하지 않으면, 폰을 잠갔다가 한참 뒤 열었을 때 액세스 토큰이 이미
//      만료돼 있고 갱신도 안 돼 로그아웃으로 처리된다.
//   2) 앱 시작 시 세션 확인이 5초를 넘기면 무조건 로그아웃 처리하던 코드가 있었다.
//      네트워크가 느린 곳(지하철·건물 안)에서 멀쩡히 로그인된 사용자를 튕겨냈다.
//
// 이 파일의 함수들은 전부 의존성을 인자로 주입받는다(테스트 가능하게 하기 위함).

// 앱 시작 시 세션 확인을 기다려주는 시간(1회 시도당)
export const BOOT_TIMEOUT_MS = 5000;
// 저장된 세션이 있을 때 재시도할 최대 횟수
export const BOOT_MAX_ATTEMPTS = 3;

// 타임아웃을 나타내는 고유 값 (null/undefined와 구분하기 위해 Symbol 대신 객체 사용)
export const TIMED_OUT = { __timedOut: true };

// promise가 ms 안에 끝나지 않으면 TIMED_OUT을 돌려준다.
// (promise 자체를 취소하지는 못하므로, 늦게 끝난 결과는 호출부에서 무시한다)
export function raceWithTimeout(promise, ms, timer = setTimeout) {
  return Promise.race([
    Promise.resolve(promise).catch(() => TIMED_OUT),
    new Promise((resolve) => timer(() => resolve(TIMED_OUT), ms)),
  ]);
}

// Supabase가 세션을 저장할 때 쓰는 키 형식: sb-<프로젝트ref>-auth-token
export const SESSION_KEY_PATTERN = /^sb-.+-auth-token$/;

// 기기에 저장된 로그인 세션이 있는가?
//   있음 = "이 사람은 로그인 상태다"라는 뜻이므로, 네트워크가 느리다는 이유만으로
//   로그아웃 화면(대학 선택)으로 보내면 안 된다.
// 값을 복호화할 필요는 없고 키의 존재만 확인하면 충분하다.
export async function hasStoredSession(storage) {
  try {
    const keys = await storage.getAllKeys();
    return (keys || []).some((k) => SESSION_KEY_PATTERN.test(String(k)));
  } catch {
    // 스토리지를 못 읽으면 '모른다' → 보수적으로 false (기존 동작 유지)
    return false;
  }
}

// AppState와 Supabase 토큰 자동갱신을 연결한다.
//   포그라운드(active) → startAutoRefresh()로 갱신 타이머 가동
//   백그라운드/비활성   → stopAutoRefresh()로 타이머 정지(배터리·불필요 요청 절약)
// 반환값: 정리(cleanup) 함수
export function attachAutoRefresh({ appState, auth }) {
  if (!appState?.addEventListener || !auth?.startAutoRefresh) return () => {};

  // 앱이 이미 떠 있는 상태로 시작하므로 즉시 1회 가동
  auth.startAutoRefresh();

  const subscription = appState.addEventListener('change', (state) => {
    if (state === 'active') auth.startAutoRefresh();
    else auth.stopAutoRefresh();
  });

  return () => {
    // RN 버전에 따라 remove()가 없을 수 있어 방어
    if (subscription?.remove) subscription.remove();
    auth.stopAutoRefresh();
  };
}

// 앱 시작 시 세션 복원 결과를 결정하는 순수 로직.
//   'session'  : 세션 확인 성공 (session 값을 그대로 사용)
//   'retry'    : 타임아웃 + 저장된 세션 있음 → 로그아웃시키지 말고 재시도
//   'logout'   : 타임아웃 + 저장된 세션 없음 → 비로그인 확정
//   'stalled'  : 재시도를 다 썼는데도 실패 + 저장된 세션 있음 → 재시도 안내 화면
export function resolveBootOutcome({ result, stored, attempt, maxAttempts = BOOT_MAX_ATTEMPTS }) {
  if (result !== TIMED_OUT) return 'session';
  if (!stored) return 'logout';
  return attempt + 1 < maxAttempts ? 'retry' : 'stalled';
}
