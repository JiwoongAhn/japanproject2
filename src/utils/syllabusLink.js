// 과목별 시라바스 열기 (kaede-i MY時間割 셀 → 과목 시라바스 페이지)
//
// 실측(2026-09-18, Chrome으로 kaede-i DOM 확인):
//   셀 안 링크 = <a href="#" onclick="OpenSyllabusWindow(406939);return false;">シラバス</a>
//   OpenSyllabusWindow(id) = window.open("../Syllabus/SyllabusViewVer2.aspx?uid=" + id, "child_syllabus", ...)
// 즉 새 창(window.open)으로 여는 구조라 WebView에서 그냥 클릭하면 아무 일도 안 일어난다.
// 대신 onclick에서 uid를 읽어 같은 WebView 안에서 그 URL로 이동시킨다(로그인 쿠키 공유).
// uid는 시간표 페이지에만 있으므로 앱은 MY時間割를 열고 → 도착 즉시 이 스크립트를 주입한다.

export const KAEDE_SYLLABUS_VIEW_PATH = '/Syllabus/SyllabusViewVer2.aspx?uid=';

// 앱의 수업(day_of_week 0=月, period, term spring|fall) → kaede 셀 id
// parseKaedeCellId(utils/timetable.js)의 정확한 역변환.
// term이 fall이 아니면(spring/null/미지정) Spring으로 본다.
export function buildKaedeCellId({ day, period, term } = {}) {
  if (!Number.isInteger(day) || day < 0 || day > 5) return null;
  if (!Number.isInteger(period) || period < 1) return null;
  const suffix = term === 'fall' ? 'Autumn' : 'Spring';
  return `Cell${day + 1}_${period}_${suffix}`;
}

// onclick 문자열에서 시라바스 uid 추출 (없으면 null). 순수 함수라 테스트 가능.
export function extractSyllabusUid(onclick) {
  const m = /OpenSyllabusWindow\(\s*(\d+)\s*\)/.exec(onclick || '');
  return m ? m[1] : null;
}

// WebView에 주입할 JS. 결과는 postMessage({type:'syllabusClick', ok, reason})로 보고.
//   1) 셀 안의 <a> 중 텍스트에 'シラバス'가 있는 것 탐색
//   2) onclick에 OpenSyllabusWindow(uid)가 있으면 → 같은 창에서 시라바스 URL로 이동 (실측 경로)
//   3) 없으면 href의 __doPostBack 직접 호출 → 그것도 없으면 a.click() (구조가 바뀐 경우 대비)
export function buildSyllabusClickJS(cellId) {
  const id = JSON.stringify(String(cellId || ''));
  const viewPath = JSON.stringify(KAEDE_SYLLABUS_VIEW_PATH);
  return `(function(){
  function report(ok, reason){
    try { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'syllabusClick', ok: ok, reason: reason || '', cellId: ${id} })); } catch (e) {}
  }
  try {
    var td = document.getElementById(${id});
    if (!td) { report(false, 'cellNotFound'); return; }
    var anchors = td.querySelectorAll('a');
    var target = null;
    for (var i = 0; i < anchors.length; i++) {
      if ((anchors[i].textContent || '').indexOf('シラバス') >= 0) { target = anchors[i]; break; }
    }
    if (!target) {
      for (var j = 0; j < anchors.length; j++) {
        var h = (anchors[j].getAttribute('href') || '') + (anchors[j].getAttribute('onclick') || '');
        if (h.indexOf('OpenSyllabusWindow') >= 0 || h.indexOf('__doPostBack') >= 0) { target = anchors[j]; break; }
      }
    }
    if (!target) { report(false, 'linkNotFound'); return; }
    var onclick = target.getAttribute('onclick') || '';
    var u = /OpenSyllabusWindow\\(\\s*(\\d+)\\s*\\)/.exec(onclick);
    if (u) {
      report(true, 'uid');
      location.href = location.origin + ${viewPath} + u[1];
      return;
    }
    var href = target.getAttribute('href') || '';
    var m = /__doPostBack\\(\\s*'([^']*)'\\s*,\\s*'([^']*)'\\s*\\)/.exec(href);
    if (m && typeof window.__doPostBack === 'function') {
      report(true, 'postback');
      window.__doPostBack(m[1], m[2]);
      return;
    }
    report(true, 'click');
    target.click();
  } catch (e) {
    report(false, String(e));
  }
})(); true;`;
}
