// 앱 최상위 인증/온보딩 라우팅 결정 (순수 함수)
//
// AppNavigator가 세션·프로필·1회성 게이트 플래그들을 넘기면, 지금 보여줄
// 화면을 문자열로 반환한다. 분기 로직을 컴포넌트에서 떼어내 테스트 가능하게 함.
//
// 반환값(라우트):
//   'splash'      : 아직 확인 중 (세션/플래그/프로필 로딩) — 화면 깜빡임 방지
//   'welcome'     : 최초 1회 환영 화면 (로그인 이전)
//   'consent'     : 개인정보처리방침 동의 (로그인 이전)
//   'auth'        : 로그인/가입 스택 (비로그인)
//   'pushPriming' : 신규 회원 통지 프리퍼미션 (닉네임 이전 1회)
//   'nickname'    : 닉네임 설정 (신규 회원)
//   'onboarding'  : 기능 소개 온보딩 (신규 회원 1회)
//   'main'        : 메인 탭 (정상 로그인)
//
// ⚠️ 핵심 가드: 로그인은 됐지만 profile을 아직 못 불러온(null) 동안에는 'main'이
//    아니라 'splash'를 반환한다. 이 가드가 없으면 needsNickname/needsOnboarding이
//    모두 false가 되어, 신규 회원이 온보딩을 건너뛰고 곧장 메인으로 진입해버린다.
//    (증상: 최초 실행엔 온보딩이 안 뜨고, 앱을 껐다 켜서 profile이 로드된 뒤에야 뜸)

export function resolveAuthGate({
  loading,
  welcomeSeen,
  consented,
  pushPrimingDone,
  session,
  profile,
} = {}) {
  // 1) 세션/1회성 플래그(AsyncStorage) 확인 중이면 스플래시
  if (loading || welcomeSeen == null || consented == null || pushPrimingDone == null) {
    return 'splash';
  }
  // 2) 로그인 이전 게이트 (세션 유무와 무관하게 최초 1회)
  if (!welcomeSeen) return 'welcome';
  if (!consented) return 'consent';
  // 3) 비로그인 → 로그인/가입 스택
  if (!session) return 'auth';
  // 4) 로그인은 됐지만 프로필 로딩 전 → 스플래시 유지 (메인 조기 진입 방지)
  if (profile == null) return 'splash';
  // 5) 닉네임 미설정(신규 회원): 통지 프리퍼미션 → 닉네임
  const needsNickname = !profile.nickname;
  if (needsNickname && !pushPrimingDone) return 'pushPriming';
  if (needsNickname) return 'nickname';
  // 6) 온보딩 미완료(신규 회원 1회)
  if (profile.onboarding_completed === false) return 'onboarding';
  // 7) 정상 로그인 상태
  return 'main';
}
