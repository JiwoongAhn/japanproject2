// 국사관 Web시라바스에서 강의실(教室)을 조회·매칭하는 유틸
// ───────────────────────────────────────────────────────────
// [배경] 카에데 MY時間割 셀엔 교실 정보가 없다. 교실은 공개 시라바스
//   (kaedei.kokushikan.ac.jp/Syllabus/Top.aspx) 검색결과 표의 「教室」 컬럼에만 있다.
//   과목명으로 검색 → 教員名(+曜日時限+キャンパス)으로 정확한 줄을 골라 교실을 얻는다.
//
// [구성]
//   - 순수 함수(parseDayPeriod/normalizeJa/parseResultRow/matchRoom): 매칭 로직, Jest로 검증.
//   - buildSyllabusFetchJS: WebView에 주입할 브라우저 스크립트 문자열.
//     페이지 새로고침 없이 fetch(POST)로 검색을 순차 반복(요청 사이 딜레이)하고
//     결과 행을 RN으로 postMessage → RN이 matchRoom으로 교실 확정.

// 시라바스 결과표 曜日時限의 요일 문자 → day 인덱스 (parseKaedeCellId와 동일: 月=0 … 土=5)
const WEEKDAY_TO_DAY = { 月: 0, 火: 1, 水: 2, 木: 3, 金: 4, 土: 5, 日: 6 };

// 결과표 컬럼 인덱스 (Step 0에서 실측 확정)
// 0 授業科目名 | 1 教員名 | 2 対象 | 3 期 | 4 曜日時限 | 5 キャンパス | 6 教室 | 7 詳細
const COL = { name: 0, professor: 1, term: 3, dayPeriod: 4, campus: 5, room: 6 };

// 교실 조회를 지원하는 학교 → 그 학교의 시라바스 URL
// ⚠️ 이 파서는 카에데(국사관) ASP.NET 폼 구조 전용이다. 폼 필드명·결과표 컬럼이
//    아래 FIELD_*/COL 상수와 동일한 학교만 추가할 것. 다른 구조의 학교를 여기에
//    넣으면 그 학교 서버에 무의미한 검색 요청을 보내게 된다.
const SYLLABUS_URL_BY_UNIVERSITY = {
  kokushikan: 'https://kaedei.kokushikan.ac.jp/Syllabus/Top.aspx',
};

// 학교 id → 시라바스 URL. 미지원 학교는 null (호출부가 조회를 건너뛰어야 함)
export function getSyllabusUrl(universityId) {
  return SYLLABUS_URL_BY_UNIVERSITY[universityId] ?? null;
}

// 이 학교가 교실 자동 조회를 지원하는가
export function supportsSyllabusRoom(universityId) {
  return getSyllabusUrl(universityId) !== null;
}

// ASP.NET 폼 필드 이름 (Step 0에서 실측 확정)
export const SYLLABUS_URL = SYLLABUS_URL_BY_UNIVERSITY.kokushikan;
const FIELD_KAMOKU = 'ctl00$MainContent$param_KamokuName';
const FIELD_SEARCH_BTN = 'ctl00$MainContent$searchButton';

// 공백 제거 정규화 — 교수명/과목명 표기 차이 흡수 ("安重 千代子" == "安重千代子")
export function normalizeJa(s) {
  return String(s || '')
    .replace(/[\s　]+/g, '') // 반각·전각 공백 모두 제거
    .trim();
}

// "金／1" 또는 "月／2土／5"(복수 슬롯) → [{day, period}, ...]
export function parseDayPeriod(str) {
  const out = [];
  const re = /([月火水木金土日])\s*[／/]\s*(\d+)/g; // 요일문자 + 전각/반각 슬래시 + 숫자
  let m;
  while ((m = re.exec(String(str || ''))) !== null) {
    const day = WEEKDAY_TO_DAY[m[1]];
    const period = parseInt(m[2], 10);
    if (day !== undefined && !Number.isNaN(period)) out.push({ day, period });
  }
  return out;
}

// 결과표 raw 행(문자열 배열) → 정규화 객체
export function parseResultRow(cells = []) {
  return {
    name: (cells[COL.name] || '').trim(),
    professor: (cells[COL.professor] || '').trim(),
    term: (cells[COL.term] || '').trim(),
    slots: parseDayPeriod(cells[COL.dayPeriod] || ''),
    campus: (cells[COL.campus] || '').trim(),
    room: (cells[COL.room] || '').trim(),
  };
}

// 주 2회 수업(예: 月3·木3)은 教室 칸에 방이 여러 개(공백 구분: "11504 13204")로 온다.
// 시라바스는 曜日時限과 教室을 같은 순서(이른 요일부터)로 나열하므로,
// 방 개수와 슬롯 개수가 정확히 같을 때만 요청한 요일·교시 위치의 방을 골라준다.
// 개수가 안 맞으면(방1개=양일 공용, 방3개≠슬롯2개 등) 헷갈릴 수 있으니 통째로 반환한다.
function pickRoomForSlot(row, course) {
  const rooms = String(row.room || '').trim().split(/\s+/).filter(Boolean);
  if (rooms.length <= 1) return row.room || null;              // 방 1개 → 그대로
  if (course.day == null || course.period == null) return row.room;
  if (rooms.length !== (row.slots || []).length) return row.room; // 개수 불일치 → 안전하게 통째로
  const idx = row.slots.findIndex(
    (sl) => sl.day === course.day && sl.period === course.period
  );
  if (idx < 0) return row.room;                                // 슬롯 못 찾으면 통째로
  return rooms[idx] || row.room;                               // 순서대로 매칭된 방
}

// 수업 1개에 대한 최적 교실 선택
//   course : { name, professor, day, period, campus? }
//   rows   : 시라바스 검색결과 raw 행 배열(문자열 배열의 배열)
//   반환   : 교실 문자열 / 못 찾으면 null (집중강의 등 교실 자체가 없으면 null)
export function matchRoom(course = {}, rows = []) {
  // 교실이 실제로 있는 행만 후보로
  let cands = rows.map(parseResultRow).filter((r) => r.room);
  if (cands.length === 0) return null;

  const profKey = normalizeJa(course.professor);
  const nameKey = normalizeJa(course.name);

  // 1) 교수명 완전 일치 우선
  if (profKey) {
    const byProf = cands.filter((r) => normalizeJa(r.professor) === profKey);
    if (byProf.length) cands = byProf;
  }
  // 2) 과목명 완전 일치 우선
  if (nameKey) {
    const byName = cands.filter((r) => normalizeJa(r.name) === nameKey);
    if (byName.length) cands = byName;
  }
  // 3) 요일·교시 일치 우선
  if (course.day != null && course.period != null) {
    const bySlot = cands.filter((r) =>
      r.slots.some((sl) => sl.day === course.day && sl.period === course.period)
    );
    if (bySlot.length) cands = bySlot;
  }
  // 4) 캠퍼스 일치 우선 (있을 때만)
  if (course.campus) {
    const byCampus = cands.filter((r) => r.campus === course.campus);
    if (byCampus.length) cands = byCampus;
  }

  const best = cands[0];
  if (!best || !best.room) return null;
  return pickRoomForSlot(best, course);
}

// WebView(시라바스 페이지)에 주입할 스크립트 생성
//   courses  : [{ index, name }, ...]  (index=원본 순서, name=검색어)
//   options  : { delayMs=1000 }        (요청 사이 텀 — 학교 서버 배려)
// 동작: 폼 필드 직렬화 → 과목명별로 fetch(POST) 순차 검색 → 결과 행을 postMessage.
//   메시지 phase: 'start'(total) / 'item'(index,rows) / 'itemError' / 'done' / 'error'
export function buildSyllabusFetchJS(courses = [], options = {}) {
  const delayMs = options.delayMs ?? 1000;
  const list = courses.map((c) => ({ index: c.index, name: c.name }));
  return `(function(){
  var COURSES = ${JSON.stringify(list)};
  var DELAY = ${delayMs};
  var F_KAMOKU = ${JSON.stringify(FIELD_KAMOKU)};
  var F_BTN = ${JSON.stringify(FIELD_SEARCH_BTN)};
  function send(o){ try { window.ReactNativeWebView.postMessage(JSON.stringify(o)); } catch(e){} }
  function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
  function serialize(form){
    var params = new URLSearchParams();
    var els = form.querySelectorAll('input, select, textarea');
    for (var i=0;i<els.length;i++){
      var el = els[i];
      if (!el.name) continue;
      var type = (el.type||'').toLowerCase();
      if ((type==='checkbox'||type==='radio') && !el.checked) continue;
      if (type==='button'||type==='submit') continue;
      params.append(el.name, el.value);
    }
    return params;
  }
  function tokensFrom(doc){
    function v(id){ var e = doc.getElementById(id); return e ? (e.value||'') : ''; }
    return { vs: v('__VIEWSTATE'), ev: v('__EVENTVALIDATION'), vsg: v('__VIEWSTATEGENERATOR') };
  }
  function extractRows(doc){
    var tables = doc.querySelectorAll('table'), rt = null;
    for (var i=0;i<tables.length;i++){
      var head = tables[i].querySelector('tr');
      var ht = head ? head.innerText : '';
      if (ht.indexOf('授業科目名')>=0 && ht.indexOf('教室')>=0){ rt = tables[i]; break; }
    }
    if (!rt) return [];
    var trs = rt.querySelectorAll('tr'), rows = [];
    for (var j=1;j<trs.length;j++){
      var tds = trs[j].querySelectorAll('td'), cells = [];
      for (var k=0;k<tds.length;k++) cells.push((tds[k].innerText||'').replace(/\\s+/g,' ').trim());
      if (cells.length) rows.push(cells);
    }
    return rows;
  }
  (async function(){
    try {
      var form = document.forms[0];
      if (!form){ send({type:'syllabusRoom', phase:'error', message:'form not found'}); return; }
      var tokens = tokensFrom(document);
      send({type:'syllabusRoom', phase:'start', total: COURSES.length});
      for (var i=0;i<COURSES.length;i++){
        var c = COURSES[i], rows = [];
        try {
          var params = serialize(form);
          if (tokens.vs) params.set('__VIEWSTATE', tokens.vs);
          if (tokens.ev) params.set('__EVENTVALIDATION', tokens.ev);
          if (tokens.vsg) params.set('__VIEWSTATEGENERATOR', tokens.vsg);
          params.set(F_KAMOKU, c.name);
          params.set(F_BTN, '検索');
          var res = await fetch('./Top.aspx', { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body: params.toString() });
          var html = await res.text();
          var doc = new DOMParser().parseFromString(html, 'text/html');
          rows = extractRows(doc);
          var nt = tokensFrom(doc);
          if (nt.vs) tokens = nt; // 다음 요청용 토큰 갱신
        } catch(err){
          send({type:'syllabusRoom', phase:'itemError', index: c.index, message: String(err)});
        }
        send({type:'syllabusRoom', phase:'item', index: c.index, rows: rows});
        if (i < COURSES.length-1) await sleep(DELAY);
      }
      send({type:'syllabusRoom', phase:'done'});
    } catch(e){
      send({type:'syllabusRoom', phase:'error', message:String(e)});
    }
  })();
  true;
})();`;
}
