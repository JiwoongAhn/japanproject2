// 시간표 텍스트 파서
// kaedei.kokushikan.ac.jp(우선) / manaba(보조) 화면에서 복사한 텍스트를
// 줄 단위 상태머신으로 스캔해서 수업 목록을 추출한다.

const DAY_CHARS = { '月': 0, '火': 1, '水': 2, '木': 3, '金': 4, '土': 5 };
const TERM_MAP = { '春期': 'spring', '秋期': 'fall', '通年': 'year' };
const CAMPUS_HINTS = ['町田', '世田谷', '梅ヶ丘', '多摩'];

// 토큰 인식 정규식
const RE_PERIOD     = /^(\d+)\s*限\s*目?$/;
const RE_TIME_RANGE = /^(\d{1,2}):(\d{2})\s*[~〜]\s*(\d{1,2}):(\d{2})$/;
const RE_TERM       = /^(春期|秋期|通年)$/;
const RE_DAY        = /^[月火水木金土]\s*曜?$/;
const RE_CREDIT     = /^\[(\d+)\]$/;
const RE_SYLLABUS   = /^シラバス$/;

// 두 글자(예: '月期', '春期'와 헷갈리지 않게) — 요일은 단독 1글자만 인정

function makeBuffer() {
  return { name: '', professor: '', credit: null, professorMode: false };
}

function pad(n) { return String(n).padStart(2, '0'); }

function timeStr(h, m) {
  return `${pad(parseInt(h, 10))}:${pad(parseInt(m, 10))}`;
}

function flush(state, result) {
  const { buffer, currentPeriod, currentDay, currentTerm, currentCampus } = state;
  const name = buffer.name.trim();

  if (!name) return;

  const hasCore = currentDay !== null && currentPeriod !== null;
  if (!hasCore) {
    result.unparsed.push({
      rawText: name,
      reason: currentDay === null ? '요일 정보 없음' : '교시 정보 없음',
    });
    return;
  }

  const professor = buffer.professor.trim() || null;
  const credit = buffer.credit;
  const confidence = (professor && credit !== null) ? 'high' : 'low';

  result.parsed.push({
    name,
    day: currentDay,
    period: currentPeriod,
    term: currentTerm,
    professor,
    credit,
    campus: currentCampus,
    confidence,
  });
}

// dedupe 키: name + day + period + term
function dedupeParsed(items) {
  const seen = new Set();
  const out = [];
  for (const it of items) {
    const key = `${it.name}|${it.day}|${it.period}|${it.term}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out;
}

export function parseTimetableText(rawText, options = {}) {
  const defaultTerm = options.defaultTerm || 'spring';

  const result = {
    parsed: [],
    unparsed: [],
    detectedPeriodRanges: {},
  };

  if (typeof rawText !== 'string' || !rawText.trim()) {
    return result;
  }

  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  const state = {
    currentPeriod: null,
    currentDay: null,
    currentTerm: defaultTerm,
    currentCampus: null,
    buffer: makeBuffer(),
  };

  for (const line of lines) {
    // 1) 교시 토큰 — 새 교시 시작
    let m = line.match(RE_PERIOD);
    if (m) {
      flush(state, result);
      state.currentPeriod = parseInt(m[1], 10);
      state.currentDay = null;
      state.currentCampus = null;
      state.buffer = makeBuffer();
      continue;
    }

    // 2) 시간 범위 — periodRanges 보강
    m = line.match(RE_TIME_RANGE);
    if (m) {
      if (state.currentPeriod !== null) {
        result.detectedPeriodRanges[state.currentPeriod] = {
          start: timeStr(m[1], m[2]),
          end:   timeStr(m[3], m[4]),
        };
      }
      continue;
    }

    // 3) 학기 토큰
    m = line.match(RE_TERM);
    if (m) {
      flush(state, result);
      state.currentTerm = TERM_MAP[m[1]];
      state.currentDay = null;
      state.currentCampus = null;
      state.buffer = makeBuffer();
      continue;
    }

    // 4) 요일 토큰 (단독 1글자)
    if (RE_DAY.test(line)) {
      flush(state, result);
      state.currentDay = DAY_CHARS[line[0]];
      state.currentCampus = null;
      state.buffer = makeBuffer();
      continue;
    }

    // 5) 캠퍼스 힌트 — 짧고 정확히 일치할 때만
    if (CAMPUS_HINTS.includes(line)) {
      state.currentCampus = line;
      continue;
    }

    // 6) 학점 [숫자]
    m = line.match(RE_CREDIT);
    if (m) {
      state.buffer.credit = parseInt(m[1], 10);
      state.buffer.professorMode = true;
      continue;
    }

    // 7) シラバス 앵커 → flush
    if (RE_SYLLABUS.test(line)) {
      flush(state, result);
      state.currentDay = null;
      state.currentCampus = null;
      state.buffer = makeBuffer();
      continue;
    }

    // 그 외 텍스트 — 학점 뒤면 교수명, 아니면 과목명 누적
    if (state.buffer.professorMode) {
      state.buffer.professor = (state.buffer.professor + line).replace(/\s+/g, ' ').trim();
    } else {
      state.buffer.name = (state.buffer.name + line).replace(/\s+/g, ' ').trim();
    }
  }

  // 마지막 buffer flush
  flush(state, result);

  // dedupe
  result.parsed = dedupeParsed(result.parsed);

  return result;
}

// 'HH:MM' → 분 단위 변환
// universities.js의 periodRanges는 분 단위(예: 540)라서 등록 시 변환 필요.
export function detectedRangesToMinutes(detectedPeriodRanges) {
  const out = {};
  if (!detectedPeriodRanges || typeof detectedPeriodRanges !== 'object') return out;

  for (const [period, range] of Object.entries(detectedPeriodRanges)) {
    if (!range || !range.start || !range.end) continue;
    const [sh, sm] = range.start.split(':').map(Number);
    const [eh, em] = range.end.split(':').map(Number);
    out[period] = {
      start: sh * 60 + sm,
      end:   eh * 60 + em,
    };
  }
  return out;
}
