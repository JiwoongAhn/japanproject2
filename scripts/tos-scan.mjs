// 학교 이용규정 1차 스캔 — 새 학교를 추가할 때 docs/university-tos-review.md 작성을 돕는다.
//   node scripts/tos-scan.mjs <homepageUrl> [추가로 볼 URL ...]
//   예) node scripts/tos-scan.mjs https://www.tcu.ac.jp
//
// 하는 일 (공개 페이지만, 로그인 없음):
//   1. 홈페이지에서 정책·규약·이용 링크를 찾는다 (サイトポリシー, 利用規約, 規程 …)
//   2. 그 페이지들 + 인자로 준 URL 을 받아 키워드를 문맥과 함께 출력한다
//      - 금지 신호: 自動・ロボット・スクレイピング・クローラ・機械的・負荷
//      - ID/PW 신호: 第三者・貸与・譲渡・開示・パスワード
//      - 앱 신호  : アプリ・非公式
//   3. 사람이 이어서 할 검색어를 출력한다 (주의 공지는 사이트 검색으로만 찾을 수 있어서)
// 판단은 사람이 한다 — 0건이어도 "금지 없음"이 아니라 "공개 문서에서 못 찾음"이다.
// 학교 서버 배려: 페이지 사이 1초 간격, 최대 MAX_PAGES 개.

const MAX_PAGES = 8;
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15';
const LINK_HINT = /ポリシー|規約|規程|規則|ご利用|利用について|利用にあたって|免責|著作権|ガイドライン/;
const LINK_SKIP = /アドミッション|ディプロマ|カリキュラム|3つの|３つの|教育方針|研究/;
const KEYWORDS = [
  ['금지', /自動|ロボット|スクレイピング|クロー[ラリ]|機械的|負荷|bot/i],
  ['ID/PW', /第三者|貸与|譲渡|開示|パスワード|アカウント/],
  ['앱', /アプリ|非公式/],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 일본 학교 사이트는 아직 Shift_JIS 페이지가 있다 → meta charset 을 보고 디코딩
async function fetchText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(20000) });
  const buf = Buffer.from(await res.arrayBuffer());
  const head = buf.subarray(0, 2048).toString('latin1');
  const charset = (res.headers.get('content-type')?.match(/charset=([\w-]+)/i)?.[1]
    || head.match(/charset=["']?([\w-]+)/i)?.[1] || 'utf-8').toLowerCase();
  const enc = /shift_jis|sjis|windows-31j|cp932/.test(charset) ? 'shift_jis' : /euc-jp/.test(charset) ? 'euc-jp' : 'utf-8';
  return { status: res.status, url: res.url, html: new TextDecoder(enc).decode(buf) };
}

export function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n');
}

// 홈페이지 HTML → 정책 후보 링크 [{text, url}] (중복 제거)
export function findPolicyLinks(html, baseUrl) {
  const out = new Map();
  for (const m of html.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const text = m[2].replace(/<[^>]+>/g, '').replace(/\s+/g, '');
    if (!LINK_HINT.test(text) || LINK_SKIP.test(text)) continue;
    try {
      const url = new URL(m[1], baseUrl).href.split('#')[0];
      if (!out.has(url)) out.set(url, text);
    } catch { /* 잘못된 href 무시 */ }
  }
  return [...out].map(([url, text]) => ({ url, text }));
}

// 본문 → [{tag, snippet}] 키워드 주변 40자
export function keywordHits(text, width = 40) {
  const hits = [];
  for (const [tag, re] of KEYWORDS) {
    const g = new RegExp(`.{0,${width}}(?:${re.source}).{0,${width}}`, re.flags.includes('i') ? 'gi' : 'g');
    for (const m of text.matchAll(g)) hits.push({ tag, snippet: m[0].trim() });
  }
  return hits;
}

async function main() {
  const [home, ...extra] = process.argv.slice(2);
  if (!home) {
    console.error('사용법: node scripts/tos-scan.mjs <homepageUrl> [추가 URL ...]');
    process.exit(1);
  }
  const top = await fetchText(home);
  const links = findPolicyLinks(top.html, top.url);
  console.log(`# ${top.url} (HTTP ${top.status})\n\n## 정책 후보 링크 ${links.length}개`);
  links.forEach((l) => console.log(`- ${l.text} → ${l.url}`));

  const targets = [...links.map((l) => l.url), ...extra].slice(0, MAX_PAGES);
  for (const url of targets) {
    await sleep(1000);
    try {
      const page = await fetchText(url);
      const hits = keywordHits(htmlToText(page.html));
      console.log(`\n## ${url} (HTTP ${page.status}) — 키워드 ${hits.length}건`);
      hits.slice(0, 15).forEach((h) => console.log(`- [${h.tag}] ${h.snippet}`));
    } catch (e) {
      console.log(`\n## ${url} — 실패: ${e.message}`);
    }
  }

  const host = new URL(top.url).hostname.replace(/^www\./, '');
  console.log(`\n## 이어서 사람이 할 것
- 사이트 검색: site:${host} 時間割アプリ 注意
- 사이트 검색: site:${host} 非公式 アプリ ID パスワード
- 웹 검색: "<학교명> 情報システム 利用規程 学生" (학생 규정 원문 PDF)
- 결과는 docs/university-tos-review.md 의 등급표(🔴/🟡/⚪/🟢)에 기록`);
}

// 테스트에서 import 할 때는 실행하지 않는다
if (import.meta.url === `file://${process.argv[1]}`) main();
