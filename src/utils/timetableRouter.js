// 시간표 파서 라우터
// 학교 id + 입력 종류(payload)에 따라 알맞은 파서로 위임하고,
// 항상 { parsed, unparsed } 형식을 반환한다. (DB 저장은 buildCourseRows가 담당)
//
// payload.kind:
//   'kaedeCells' : 국사관 카에데 DOM 셀 배열 [{id,name,professor}] → parseKaedeTimetable (전용)
//   'text'       : 사용자가 붙여넣은 텍스트                        → parseTimetableText (폴백)
//   'ai'         : AI 가 스크린샷/텍스트에서 읽은 courses 배열     → normalizeAiCourses (전 학교 공통)
//                  (AI 호출 자체는 비동기라 화면에서 Edge Function `parse-timetable` 을 부른 뒤 결과만 넘긴다)
//
// 새 학교의 전용 파서를 추가할 때는 DEDICATED 맵과 아래 switch의 case만 늘리면 된다.

import { parseKaedeTimetable } from './timetable';
import { parseTimetableText } from './timetableParser';
import { normalizeAiCourses } from './aiTimetable';

// 전용(학교별) 파서를 가진 학교 목록
const DEDICATED = { kokushikan: 'kaede' };

// 해당 학교가 전용 파서를 가지고 있는지 (UI 분기 등에서 사용)
export function hasDedicatedParser(universityId) {
  return !!DEDICATED[universityId];
}

// 통합 진입점 — 어떤 입력이든 { parsed, unparsed }로 정규화해서 반환
// universityId: 현재는 미사용(text/kaedeCells는 학교가 자명, ai 는 학교 정보를 서버 호출 때 이미 넘김).
export function parseTimetable({ universityId, payload } = {}) {
  switch (payload?.kind) {
    case 'kaedeCells':
      return parseKaedeTimetable(payload.data, { term: payload.term });
    case 'text':
      return parseTimetableText(payload.data, { defaultTerm: payload.term });
    case 'ai':
      return normalizeAiCourses(payload.data, { term: payload.term });
    default:
      throw new Error('unknown payload kind: ' + payload?.kind);
  }
}
