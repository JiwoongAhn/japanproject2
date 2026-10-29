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
// 2026-10-29: 'none'(시작도 안 한 사람)도 포함 — 실사용 국사관 23명 중 6명이 미시작인데 아무 안내가 없었다.
//   친구 소개로 가볍게 깔고 통지 설정까지 가지 않은 경우가 대부분이라, 설정 전까지 계속 안내한다.
export function shouldShowSetupBanner(stage) {
  return stage === 'none' || stage === 'pending' || stage === 'no-push';
}

// 앱을 열 때 아래에서 올라오는 안내 창(SetupPromptSheet)을 띄울 때인가
//   coldStart     : 이번 실행에서 아직 한 번도 안 띄웠다 (앱을 새로 켬)
//   backgroundedMs: 다른 앱에 가 있던 시간 — 30분 이상이면 「다시 들어온 것」으로 본다
//   탭 이동·잠깐 다른 앱을 보고 오는 정도로는 띄우지 않는다 (간편 조회 앱이라 마찰 최소화)
export const SETUP_PROMPT_INTERVAL_MS = 30 * 60 * 1000;
export function shouldPromptSetup({ stage, coldStart, backgroundedMs }) {
  if (!shouldShowSetupBanner(stage)) return false;
  return !!coldStart || (backgroundedMs ?? 0) >= SETUP_PROMPT_INTERVAL_MS;
}

// 알림 권한 → 「통지 켜기」 버튼이 할 일
//   'ask'      : 아직 OS 가 물어본 적 없음 → 허용 팝업을 바로 띄운다
//   'settings' : 이미 거부(다시 물을 수 없음) → 설정 앱을 연다
export function resolvePushAction(permission) {
  if (permission?.status === 'granted') return 'register';
  return permission?.canAskAgain === false || permission?.status === 'denied' ? 'settings' : 'ask';
}

// 배너에 쓸 문구 (일본어 UI)
export function getSetupBannerCopy(stage) {
  if (stage === 'none') {
    return {
      title: 'まだ終わっていない設定があります',
      body: 'manaba通知を設定すると、新しいお知らせがすぐ届きます。',
      action: 'manaba通知を設定する',
    };
  }
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

// 앱을 열 때 올라오는 안내 창의 문구 — 단계마다 다른 「온보딩」을 보여준다
//   steps: 진행 표시 ① 주소 발급 ② manaba 에 등록 ③ 통지 허용 의 각 상태 ('done' | 'now' | 'todo')
export function getSetupSheetCopy(stage, pushAction = 'ask') {
  if (stage === 'none') {
    return {
      icon: '🔔',
      title: 'まだ終わっていない設定があります',
      body: 'manabaの新しいお知らせや課題を、プッシュ通知ですぐ受け取れます。設定は2分ほどで終わります。',
      steps: ['now', 'todo', 'todo'],
      action: 'manaba通知を設定する',
    };
  }
  if (stage === 'pending') {
    return {
      icon: '📬',
      title: 'manaba通知の設定が\nあと1ステップです',
      body: '発行したアドレスを、manabaのリマインダ設定に追加してください。追加するまで通知は届きません。',
      steps: ['done', 'now', 'todo'],
      action: '設定をつづける',
    };
  }
  if (stage === 'no-push') {
    const toSettings = pushAction === 'settings';
    return {
      icon: '🔕',
      title: '通知がオフになっています',
      body: 'manabaの設定は完了しています。あとは通知を許可するだけで、新しいお知らせが届きます。',
      guide: toSettings
        ? { title: '設定アプリが開きます', text: '「通知」→「通知を許可」をオンにして、このアプリに戻ってください。' }
        : null,
      steps: null,
      action: toSettings ? '設定アプリを開く' : '通知をオンにする',
    };
  }
  return null;
}

export const SETUP_STEP_LABELS = ['① アドレス発行', '② manabaに登録', '③ 通知を許可'];
