// AI 시간표 파서 결과 정규화 (순수 함수)
//
// Edge Function `parse-timetable` 이 돌려준 courses 를
// 미리보기/저장 형식 { parsed, unparsed } 로 바꾼다. (parseKaedeTimetable 과 같은 형식)
//
// AI 출력 형식 (서버 스키마와 1:1):
//   { name, professor, room, day: 'mon'..'sat'|'unknown', period: 0~10 (0=모름), term: 'spring'|'fall'|'unknown' }
//
// 규칙:
//   - 과목명이 없으면 버린다
//   - 요일·교시를 모르면 null 로 두고 confidence='low' → 미리보기에서 체크 해제 + 사용자가 직접 지정
//   - 토요일·9교시 이상도 'low' (buildCourseRows 가 月~金·1~8 만 저장하므로 그대로는 못 넣는다)
//   - 같은 과목·요일·교시가 두 번 나오면 하나만 남긴다 (스크린샷 여러 장이 겹칠 때)
//   - options.term 을 주면 학기를 아는 수업 중 다른 학기는 뺀다 (모르는 학기는 남긴다)

const DAY_INDEX = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5 };
const MAX_NAME = 60;
const MAX_FIELD = 40;

function cleanText(v, max) {
  if (typeof v !== 'string') return null;
  const s = v.replace(/\s+/g, ' ').trim().slice(0, max);
  return s || null;
}

export function normalizeAiCourses(courses, options = {}) {
  const parsed = [];
  const unparsed = [];
  const seen = new Set();

  for (const c of Array.isArray(courses) ? courses : []) {
    const name = cleanText(c?.name, MAX_NAME);
    if (!name) continue;

    const day = Object.prototype.hasOwnProperty.call(DAY_INDEX, c?.day) ? DAY_INDEX[c.day] : null;
    const period = Number.isInteger(c?.period) && c.period >= 1 && c.period <= 10 ? c.period : null;
    const term = c?.term === 'spring' || c?.term === 'fall' ? c.term : null;

    if (options.term && term && term !== options.term) continue;

    const key = `${name}|${day}|${period}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const savable = day !== null && day <= 4 && period !== null && period <= 8;
    parsed.push({
      name,
      day,
      period,
      term,
      professor: cleanText(c?.professor, MAX_FIELD),
      room: cleanText(c?.room, MAX_FIELD),
      confidence: savable ? 'high' : 'low',
    });
  }

  return { parsed, unparsed };
}

// 학기별 개수 — 「どの学期を取り込みますか」 선택지에 쓴다. 학기 모름은 unknown 으로 센다
export function countAiTerms(parsed) {
  const counts = { spring: 0, fall: 0, unknown: 0 };
  for (const it of parsed || []) {
    counts[it?.term === 'spring' || it?.term === 'fall' ? it.term : 'unknown'] += 1;
  }
  return counts;
}

// ─────────────────────────────────────────────────────────────
// 「時間割を読み取る」 버튼 — 앱 안 브라우저의 현재 페이지 내용을 가져온다
//
// 화면을 이미지로 찍는 대신 페이지의 글자·표 구조를 가져간다.
//   - 글자를 그대로 받으므로 이미지 인식보다 정확하고 AI 비용도 적다
//   - 스크롤 아래에 있는 수업까지 한 번에 가져간다
//   - 네이티브 모듈이 필요 없어 OTA 로 배포할 수 있다
// 같은 출처의 frame/iframe 안 내용도 함께 모은다 (구형 학무 시스템은 프레임 구조가 많다).
// 다른 출처 프레임은 브라우저 보안상 읽을 수 없으므로 건너뛴다.
export const CAPTURE_PAGE_JS = `
(function () {
  try {
    var parts = [];
    function collect(doc, depth) {
      if (!doc || depth > 3) return;
      if (doc.body) parts.push(doc.body.outerHTML);
      var frames = doc.querySelectorAll('frame, iframe');
      for (var i = 0; i < frames.length; i++) {
        try { collect(frames[i].contentDocument, depth + 1); } catch (e) {}
      }
    }
    collect(document, 0);
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'pageCapture', url: location.href, title: document.title, html: parts.join('\\n')
    }));
  } catch (e) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'pageCapture', error: String(e) }));
  }
})();
true;
`;

// AI 에 보낼 수 있게 페이지 HTML 을 줄인다 (순수 함수)
//   - 스크립트·스타일·SVG·주석·입력폼 같은 시간표와 무관한 덩어리 제거
//   - 태그 속성은 rowspan/colspan 만 남긴다 (표 칸 위치 계산에 필요)
//   - 연속 공백을 하나로
// 학생 이름·학번이 화면에 있으면 그대로 남지만, 서버는 저장하지 않는다(개인정보 고지에 명시).
export function cleanPageHtml(html) {
  if (typeof html !== 'string') return '';
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|noscript|svg|template|select|textarea)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<(img|input|link|meta|br|hr|wbr)\b[^>]*>/gi, (m, tag) => (tag.toLowerCase() === 'br' ? '\n' : ''))
    .replace(/<([a-zA-Z][\w-]*)\b([^>]*)>/g, (m, tag, attrs) => {
      const keep = (attrs.match(/\b(rowspan|colspan)\s*=\s*("[^"]*"|'[^']*'|\d+)/gi) || []).join(' ');
      return keep ? `<${tag.toLowerCase()} ${keep}>` : `<${tag.toLowerCase()}>`;
    })
    .replace(/<\/([a-zA-Z][\w-]*)\s*>/g, (m, tag) => `</${tag.toLowerCase()}>`)
    .replace(/&nbsp;/g, ' ')
    .replace(/[ \t\r\f\v]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/<(div|span|font|b|i|u|strong|em|p|a|label|center)>\s*<\/\1>/g, '')
    .trim();
}

// ─────────────────────────────────────────────────────────────
// 미리보기로 넘기기 전 정리 (순수 함수)

// 처음 한 번 보여주는 AI 안내·동의 — 기기 저장 키 (문구를 크게 바꾸면 v2 로 올려 다시 묻는다)
export const AI_CONSENT_KEY = 'ai_timetable_consent_v1';

// 확인이 필요한 수업(요일·교시 모름 등 low)을 맨 위로. 나머지는 요일→교시 순
// (사용자 결정 2026-10-19: 놓치지 않게 맨 위)
export function sortForPreview(parsed) {
  const slot = (it) => (it.day ?? 9) * 100 + (it.period ?? 99);
  return [...(parsed || [])].sort((a, b) => {
    const la = a.confidence === 'low' ? 0 : 1;
    const lb = b.confidence === 'low' ? 0 : 1;
    return la - lb || slot(a) - slot(b);
  });
}

// 고른 학기 + 학기를 모르는 수업만 남겨 미리보기 형식으로 (학기 모름은 고른 학기로 저장된다)
export function pickTermResult(parsed, term) {
  return {
    parsed: sortForPreview((parsed || []).filter((it) => !it.term || it.term === term)),
    unparsed: [],
  };
}

// 학교 사이트 위쪽 안내 띠 문구
export function buildSiteGuide(guide) {
  return guide
    ? `時間割が表示されたら、左下のボタンを押してください\n見つからないときは ${guide}`
    : '時間割が表示されたら、左下のボタンを押してください';
}

// 어느 학기로 미리보기를 열지 (순수 함수)
//   봄·가을이 둘 다 있으면 → 사용자에게 묻는다(ask)
//   한쪽만 있으면 → 그 학기
//   학기를 전혀 모르면 → 지금 학기
export function decideTerm(counts, currentTerm) {
  const { spring = 0, fall = 0 } = counts || {};
  if (spring > 0 && fall > 0) return { ask: true, term: currentTerm };
  if (spring > 0) return { ask: false, term: 'spring' };
  if (fall > 0) return { ask: false, term: 'fall' };
  return { ask: false, term: currentTerm };
}
