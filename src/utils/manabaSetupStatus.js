// manaba 통지(메일전달) 설정이 실제로 끝났는지 판정하는 순수 함수
//
// 배경(실기 버그 ⑤: "마나바 연결했는데 통지가 안 와"):
//   앱에서 전달용 주소를 발급받으면 mail_subscriptions 행이 생긴다. 하지만 그것만으로는
//   통지가 오지 않는다. 학교 메일(manaba 리마인더)에 그 주소를 등록해서 실제로 메일이
//   한 번 도착해야 verified_at이 채워지고, 그때부터 통지가 온다.
//   실제 운영 DB에서 7명 중 5명이 "주소만 발급받고 verified_at은 비어 있는" 상태였고,
//   그 5명은 통지를 한 건도 받지 못했다. 그런데 앱은 이 미완료 상태를 홈에서
//   전혀 알려주지 않아, 사용자는 "연결했는데 왜 안 와?"라고 느꼈다.
//
// 여기서는 그 상태를 한 곳에서 판정해, 홈 배너·마이페이지가 같은 기준을 쓰게 한다.

// 설정 단계
//   'not-applicable' : manaba를 쓰지 않는 학교 → 아무것도 안내하지 않음
//   'none'           : 아직 시작 안 함
//   'pending'        : 주소는 발급됐지만 전달 확인 전 (⚠️ 통지가 오지 않는 상태)
//   'no-push'        : 전달은 확인됐지만 기기 푸시 토큰이 없음 (⚠️ 역시 통지가 안 옴)
//   'ready'          : 정상 — 통지가 오는 상태
export function resolveManabaSetupStage({ usesManaba, hasSubscription, verifiedAt, pushTokenCount }) {
  if (!usesManaba) return 'not-applicable';
  if (!hasSubscription) return 'none';
  if (!verifiedAt) return 'pending';
  if (!pushTokenCount) return 'no-push';
  return 'ready';
}

// 홈 화면에 경고 배너를 띄워야 하는 단계인가
// (none은 온보딩/마이페이지에서 안내하므로 배너까지는 띄우지 않는다 —
//  "시작도 안 한 사람"이 아니라 "시작해놓고 안 끝난 사람"을 구하는 게 목적)
export function shouldShowSetupBanner(stage) {
  return stage === 'pending' || stage === 'no-push';
}

// 배너에 쓸 문구 (일본어 UI)
export function getSetupBannerCopy(stage) {
  if (stage === 'pending') {
    return {
      title: 'manaba通知の設定があと1ステップ',
      body: 'manabaのリマインダ設定に、発行されたアドレスを追加してください。完了するまで通知は届きません。',
      action: '設定をつづける',
    };
  }
  if (stage === 'no-push') {
    return {
      title: '通知がオフになっています',
      body: 'manabaの設定は完了していますが、端末の通知が許可されていないためお届けできません。',
      action: '通知をオンにする',
    };
  }
  return null;
}
