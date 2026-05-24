// 시간표 파서 라우터
// 학교 id + 입력 종류(payload)에 따라 알맞은 파서로 위임하고,
// 항상 { parsed, unparsed } 형식을 반환한다. (DB 저장은 buildCourseRows가 담당)
//
// payload.kind:
//   'kaedeCells' : 국사관 카에데 DOM 셀 배열 [{id,name,professor}] → parseKaedeTimetable (전용)
//   'text'       : 사용자가 붙여넣은 텍스트                        → parseTimetableText (폴백)
//   'html'       : 임의 학교 시간표 HTML                          → AI 범용 파서 (출시 후 구현)
//
// 새 학교의 전용 파서를 추가할 때는 DEDICATED 맵과 아래 switch의 case만 늘리면 된다.

import { parseKaedeTimetable } from './timetable';
import { parseTimetableText } from './timetableParser';

// 전용(학교별) 파서를 가진 학교 목록
const DEDICATED = { kokushikan: 'kaede' };

// 해당 학교가 전용 파서를 가지고 있는지 (UI 분기 등에서 사용)
export function hasDedicatedParser(universityId) {
  return !!DEDICATED[universityId];
}

// 통합 진입점 — 어떤 입력이든 { parsed, unparsed }로 정규화해서 반환
// universityId: 현재는 미사용(text/kaedeCells는 학교가 자명). 'html'(AI) 분기에서 학교 컨텍스트로 사용 예정.
export function parseTimetable({ universityId, payload } = {}) {
  switch (payload?.kind) {
    case 'kaedeCells':
      return parseKaedeTimetable(payload.data, { term: payload.term });
    case 'text':
      return parseTimetableText(payload.data, { defaultTerm: payload.term });
    case 'html':
      // 출시 후: 실제 타교 LMS 분포를 보고 Edge Function(AI) 또는 자동생성 전용 파서로 구현
      throw new Error('AI parser not implemented yet');
    default:
      throw new Error('unknown payload kind: ' + payload?.kind);
  }
}
