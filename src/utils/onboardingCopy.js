// 온보딩 문구 — 학교 링크(universityLinks[id])에 따라 슬라이드·요약·CTA를 결정하는 순수 함수
//
// 예전엔 manaba / kaede-i / 一括取り込み 문구가 모든 학교에 고정 노출됐다(국사관 기준).
// 타 대학 학생에겐 없는 기능을 약속하는 셈이라, 그 학교에 실제로 있는 것만 말한다.
//   - timetableUrl 없음  → 一括 문구 대신 수동 등록 문구
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
  const canBulkImport = !!links?.timetableUrl;
  const usesManaba = !!links?.manabaUrl;
  const targets = loginTargetsFor(links);
  const autoLogin = supportsAutoLogin(links);
  const targetText = targets.join('と');

  const slides = [
    canBulkImport
      ? {
          key: 'timetable',
          title: '時間割は、コピペで一括登録',
          subtitle: '学校のシステムからコピーして貼り付けるだけ。\n1つずつ入力しなくても、まとめて取り込めます。',
        }
      : {
          key: 'timetable',
          title: '時間割を、かんたん登録',
          subtitle: '授業を追加するだけで、今週の予定がひと目で。\n空きコマもすぐに確認できます。',
        },
    usesManaba
      ? {
          key: 'manabaPush',
          title: 'manabaのお知らせを、\nスマホの通知に',
          subtitle: '休講・課題・重要連絡を見逃さない。\nメールを開かなくても、通知で届きます。',
        }
      : null,
    {
      key: 'assignment',
      title: '課題の締切、もう忘れない',
      subtitle: '提出期限が近い課題を一覧でお知らせ。\nうっかり忘れを防ぎます。',
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
    canBulkImport ? 'コピペで時間割を一括登録' : '時間割を登録して予定をひと目で',
    usesManaba
      ? 'manaba連携でお知らせをスマホ通知'
      : targets.length
        ? `${targetText}にアプリ内でアクセス`
        : null,
    '授業評価と匿名掲示板も使える',
  ].filter(Boolean);

  const summaryLead =
    targets.length && autoLogin
      ? '最初のログイン1回で、あとはおまかせ。\n時間割・課題・お知らせが自動でそろいます。'
      : '時間割・課題・掲示板が、これひとつでそろいます。';

  return {
    slides,
    summaryItems,
    summaryLead,
    // manaba 학교만 "manaba通知を設定する" CTA. 그 외는 "始める" 단일 버튼
    showMailConnectCta: usesManaba,
  };
}
