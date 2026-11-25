// 업데이트 내용 — 새 기능을 배포할 때 맨 위에 하나 추가한다 (최신이 위)
//   popup: true 면 업데이트 뒤 처음 켤 때 한 번 「新しくなりました」 창을 띄운다. 버그 수정만 있으면 false
//   releasedAt: 배포하는 날(JST). 이 날 뒤에 가입한 사람에게는 창을 띄우지 않는다
//   icon: Ionicons 이름
export const RELEASE_NOTES = [
  {
    id: '2026-12-home',
    releasedAt: '2026-12-03',
    label: '2026年12月',
    popup: true,
    items: [
      { icon: 'calendar-outline', title: 'ホームに時間割', text: '今日の授業か1週間の表か、好きな方を選べます' },
      { icon: 'star-outline', title: '講義評価にすぐ行ける', text: 'ホームのボタンから開けます' },
      { icon: 'eye-outline', title: '文字が見やすく', text: '時間割と説明の文字をはっきりさせました' },
      { icon: 'shield-checkmark-outline', title: '削除の前に分かりやすい確認', text: '元に戻せない操作は赤い画面でお知らせします' },
    ],
  },
  {
    id: '2026-10-assignment',
    releasedAt: '2026-10-27',
    label: '2026年10月',
    popup: false,
    items: [
      { icon: 'checkbox-outline', title: '課題の自動追加', text: 'manabaの課題が締切つきで自動で追加されます' },
      { icon: 'notifications-outline', title: '締切のお知らせ', text: '締切の3日前と前日、18時ごろに通知します' },
    ],
  },
];
