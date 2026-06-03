// manaba 알림 메일을 "과목 + 1줄 요약 + 메타정보"로 파싱
// Phase 3: ms-graph-webhook이 적재한 manaba_notices.body_html을 홈/모달에서 요약 표시
// 메일 본문은 매우 정형화돼 있어 정규식만으로 100% 파싱 가능
// 테스트 대상: __tests__/manabaMailSummary.test.js

// 메일 종류별 메타: 아이콘 + 한국어 라벨
// 제목/본문의 "◯◯のお知らせ" 키워드로 매칭
const NOTICE_TYPES = [
  { key: 'report',     keywords: ['レポート公開', 'レポート'],   icon: '📝', label: '課題' },
  { key: 'news',       keywords: ['コースニュース'],             icon: '📢', label: 'お知らせ' },
  { key: 'quiz',       keywords: ['小テスト'],                   icon: '✏️', label: '小テスト' },
  { key: 'survey',     keywords: ['アンケート'],                 icon: '📊', label: 'アンケート' },
  { key: 'thread',     keywords: ['スレッド', '掲示板'],         icon: '💬', label: 'スレッド' },
  { key: 'reminder',   keywords: ['リマインダ', 'リマインダー'], icon: '⏰', label: 'リマインダ' },
];

// HTML → 텍스트
// manaba 메일은 plain text/html 둘 다 들어올 수 있어 태그만 거칠게 제거
function stripHtml(html) {
  if (!html) return '';
  return String(html)
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\r\n?/g, '\n');
}

// "[라벨]：값" 또는 "[라벨]:값" 패턴 추출 (전각/반각 콜론 모두 지원)
function extractField(text, label) {
  if (!text) return null;
  // 라벨에 정규식 메타문자가 없어 escape 불필요
  const re = new RegExp(`\\[${label}\\]\\s*[：:]\\s*([^\\n]+)`);
  const m = text.match(re);
  return m ? m[1].trim() : null;
}

// 제목/본문에서 메일 종류 판정
function detectType(subject, text) {
  const haystack = `${subject || ''} ${text || ''}`;
  for (const t of NOTICE_TYPES) {
    if (t.keywords.some((k) => haystack.includes(k))) return t;
  }
  return { key: 'other', icon: '📬', label: 'お知らせ' };
}

// "2026-06-02 16:25:00" → "06/02 16:25" (짧게 표시)
function shortenDeadline(raw) {
  if (!raw) return null;
  const m = raw.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/);
  if (!m) return raw;
  return `${m[2]}/${m[3]} ${m[4]}:${m[5]}`;
}

// 메인 파서
// 입력: { subject, sender, bodyHtml, courseHint }
// 출력: {
//   type:        { key, icon, label },    // 항상 존재
//   courseName:  string|null,             // [コース名] 우선, 없으면 courseHint, 없으면 제목에서 추출
//   summary:     string|null,             // [課題名] / [タイトル] / 첫 의미있는 줄
//   deadline:    string|null,             // [受付終了日時] 단축형 "MM/DD HH:MM"
//   author:      string|null,             // [作成者]
//   hasAttach:   boolean,                 // "添付ファイルあり" 포함 여부
// }
export function summarizeManabaMail({ subject, sender, bodyHtml, courseHint } = {}) {
  const text = stripHtml(bodyHtml);
  const type = detectType(subject, text);

  // 과목명: 본문 [コース名] > courseHint > 제목 "manaba - {과목} - ..." 패턴
  const courseFromBody = extractField(text, 'コース名');
  let courseName = courseFromBody || courseHint || null;
  if (!courseName && subject) {
    const m = subject.match(/manaba\s*[-‐−–]\s*(.+?)\s*[-‐−–]/);
    if (m) courseName = m[1].trim();
  }

  // 요약: [課題名] > [タイトル] > 본문 첫 의미있는 줄
  let summary =
    extractField(text, '課題名') ||
    extractField(text, 'タイトル') ||
    extractField(text, '件名') ||
    null;

  if (!summary && text) {
    // 본문 첫 의미있는 줄 — 정형 헤더("manaba からのお知らせです。" 등) 스킵
    const skipPatterns = [
      /^manaba\s*からのお知らせ/,
      /^\[.+\]\s*に、/,
      /^--/,
      /^※/,
      /^https?:\/\//,
      /^PC[：:]/,
    ];
    const firstLine = text
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l && !skipPatterns.some((p) => p.test(l)));
    if (firstLine) summary = firstLine;
  }

  // 60자 컷 (UI 한 줄 안에 들어가게)
  if (summary && summary.length > 60) summary = summary.slice(0, 60) + '…';

  const deadlineRaw = extractField(text, '受付終了日時');
  const deadline = shortenDeadline(deadlineRaw);
  const author = extractField(text, '作成者');
  const hasAttach = /添付ファイルあり/.test(text);

  return {
    type,
    courseName,
    summary,
    deadline,
    author,
    hasAttach,
  };
}
