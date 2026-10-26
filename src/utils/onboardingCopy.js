// 온보딩 문구 — 학교 링크(universityLinks[id])에 따라 슬라이드·요약·CTA를 결정하는 순수 함수
//
// 예전엔 manaba / kaede-i / 一括取り込み 문구가 모든 학교에 고정 노출됐다(국사관 기준).
// 타 대학 학생에겐 없는 기능을 약속하는 셈이라, 그 학교에 실제로 있는 것만 말한다.
//   - timetableUrl 있음  → 학교 시스템에서 버튼으로 가져오기(국사관 kaede-i) / 없음 → 스크린샷 AI 읽기(전 학교)
//   - manabaUrl 있음     → 課題 자동 추가(+마감 전날 알림) / 없음 → 마감 전날 알림만
//   - manabaUrl 없음     → お知らせ 푸시 슬라이드·CTA 제거
//   - 로그인 대상(manaba/LMS/포털) 없음 → 최초 1회 로그인 슬라이드 제거
//   - autoLoginHosts 없음 → "자동으로 이어짐" 대신 "앱 안에서 로그인 상태 유지" 문구
import { lmsEntryFor, supportsAutoLogin } from './autoLoginPolicy';

// 로그인 대상 라벨 목록 (예: ['manaba', 'kaede-i'] / ['WebClass'] / [])
export function loginTargetsFor(links) {
  const entry = lmsEntryFor(links);
  const targets = [];
  if (entry) targets.push(entry.label);
  if (links?.portalUrl && links?.portalLabel) targets.push(links.portalLabel);
  return targets;
}

export function buildOnboardingCopy(links) {
  const hasDedicatedImport = !!links?.timetableUrl;
  const usesManaba = !!links?.manabaUrl;
  const targets = loginTargetsFor(links);
  const autoLogin = supportsAutoLogin(links);
  const targetText = targets.join('と');

  const slides = [
    hasDedicatedImport
      ? {
          key: 'timetable',
          title: '時間割は、学校のシステムから\nそのまま取り込み',
          subtitle: `${links.portalLabel || '学校のシステム'}にログインしてボタンを押すだけ。\n授業を1つずつ入力しなくて大丈夫です。`,
        }
      : {
          key: 'timetable',
          title: '時間割は、スクショで取り込み',
          subtitle: '学校の時間割画面をスクショして選ぶだけ。\nAIが読み取って、まとめて登録します。',
        },
    usesManaba
      ? {
          key: 'manabaPush',
          title: 'manabaのお知らせを、\nスマホの通知に',
          subtitle: '休講・課題・重要連絡を見逃さない。\nメールを開かなくても、通知で届きます。',
        }
      : null,
    // 자동 추가는 manaba 메일이 있어야 돼서 manaba 학교만 약속한다. 마감 3일 전·전날 알림은 전 학교
    usesManaba
      ? {
          key: 'assignment',
          title: '課題は、自動でリストに',
          subtitle: 'manabaでレポートや小テストが出ると、\n締切つきで自動追加。提出すると「提出済」に。\n締切の3日前と前日、18時ごろにもお知らせします。',
          autoAdd: true,
        }
      : {
          key: 'assignment',
          title: '課題の締切、\n3日前と前日にお知らせ',
          subtitle: '課題を登録しておけば、\n締切の3日前と前日の18時ごろに通知が届きます。',
          autoAdd: false,
        },
    {
      key: 'review',
      title: '授業のリアルな評判をチェック',
      subtitle: '履修する前に、先輩たちの授業評価を確認。\n自分でも評価を投稿できます。',
    },
    {
      key: 'community',
      title: '匿名で、気軽につながる',
      subtitle: '同じ大学の仲間と、匿名の掲示板でおしゃべり。\n質問も雑談も気軽にどうぞ。',
    },
    targets.length === 0
      ? null
      : autoLogin
        ? {
            key: 'oneTimeLogin',
            title: '最初の1回だけ、ログイン',
            subtitle: `${targetText}は、最初に一度ログインするだけ。\nあとは毎回ログインしなくても自動でつながります。`,
            targets,
            afterText: 'あとは自動でつながります',
          }
        : {
            key: 'oneTimeLogin',
            title: '学校のシステムに、アプリからそのまま',
            subtitle: `${targetText}はアプリ内で開けます。\nログイン状態が保たれるので、毎回の入力が減ります。`,
            targets,
            afterText: 'ログイン状態はアプリが保持します',
          },
  ].filter(Boolean);

  const summaryItems = [
    hasDedicatedImport ? '学校のシステムから時間割を取り込み' : 'スクショで時間割をまとめて登録',
    usesManaba
      ? 'manabaのお知らせ・課題が自動で届く'
      : targets.length
        ? `${targetText}にアプリ内でアクセス`
        : null,
    '課題の締切を3日前と前日にお知らせ',
    '授業評価と匿名掲示板も使える',
  ].filter(Boolean);

  const summaryLead =
    targets.length && autoLogin
      ? usesManaba
        ? '最初のログイン1回で、あとはおまかせ。\nお知らせと課題が自動で届きます。'
        : '最初のログイン1回で、あとはおまかせ。\n学校のシステムにすぐつながります。'
      : '時間割・課題・掲示板が、これひとつでそろいます。';

  return {
    slides,
    summaryItems,
    summaryLead,
    // manaba 학교만 "manaba通知を設定する" CTA. 그 외는 "始める" 단일 버튼
    showMailConnectCta: usesManaba,
  };
}
