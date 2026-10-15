// 학교별 기능 표 — universities + universityLinks 설정만 보고 "어느 학교에서 무엇이 되는지"를 만든다.
//
// 사람이 표를 손으로 고치면 코드와 어긋난다. 그래서 표는 이 함수가 만들고,
//   - `node scripts/school-features.mjs --write` 가 docs/university-lms-profiles.md 에 써 넣고
//   - __tests__/utils/schoolFeatures.test.js 가 문서 속 표가 최신인지 검사한다(설정만 바꾸고 문서를 잊으면 실패).
import { autoLoginHostsFor, lmsEntryFor } from './autoLoginPolicy';

export const DOC_BEGIN = '<!-- school-features:begin (자동 생성 — 직접 고치지 말 것: node scripts/school-features.mjs --write) -->';
export const DOC_END = '<!-- school-features:end -->';

// 자동 로그인 상태 — 앱이 실제로 읽는 건 autoLoginHosts 뿐
export function autoLoginStatus(links) {
  if (autoLoginHostsFor(links).length > 0) return 'ON';
  if (links?.autoLoginBlocked) return '⛔차단';
  if (Array.isArray(links?.autoLoginCandidates) && links.autoLoginCandidates.length) return '검증대기';
  return '—';
}

// 학교 1개의 기능 상태 (표 1행)
export function schoolFeatureRow(univ, links) {
  const lms = lmsEntryFor(links);
  return {
    id: univ.id,
    name: univ.name,
    bulkImport: !!links?.timetableUrl,
    autoLogin: autoLoginStatus(links),
    manabaNotice: !!links?.manabaUrl,
    lms: lms ? lms.label : '',
    portal: links?.portalLabel || '',
    syllabus: !!links?.syllabusUrl,
    officialPeriods: !!univ.periodRanges,
  };
}

const mark = (b) => (b ? '✅' : '—');

// 마크다운 표 문자열. 게시판·講義評価는 RLS(profiles.university)로 전 학교 자동 분리라 모든 행 ✅
export function buildSchoolFeatureTable(universities, universityLinks) {
  const head = [
    '| 학교 | 게시판·講義評価 | 시간표 一括 | 자동 로그인 | manaba 통지 | LMS(앱 내) | 포털 | 시라바스 | 교시 |',
    '|---|---|---|---|---|---|---|---|---|',
  ];
  const rows = universities.map((u) => {
    const r = schoolFeatureRow(u, universityLinks[u.id]);
    return `| ${r.name} \`${r.id}\` | ✅ | ${mark(r.bulkImport)} | ${r.autoLogin} | ${mark(r.manabaNotice)} | ${r.lms || '—'} | ${r.portal || '—'} | ${mark(r.syllabus)} | ${r.officialPeriods ? '공식' : '기본값'} |`;
  });
  return [...head, ...rows].join('\n');
}

// 문서 안 마커 사이를 표로 교체. 마커가 없으면 null (호출 측이 알린다)
export function replaceBetweenMarkers(doc, table) {
  const b = doc.indexOf(DOC_BEGIN);
  const e = doc.indexOf(DOC_END);
  if (b < 0 || e < 0 || e < b) return null;
  return `${doc.slice(0, b + DOC_BEGIN.length)}\n${table}\n${doc.slice(e)}`;
}
