// 시간표 관련 순수 함수
// 테스트 대상: timetable.test.js

// 국사관대학 교시 시간 — 다른 학교에 periodRanges가 없을 경우 기본값으로 사용
export const PERIOD_RANGES = {
  1: { start: 9 * 60,       end: 10 * 60 + 30  }, // 9:00 ~ 10:30
  2: { start: 10 * 60 + 45, end: 12 * 60 + 15  }, // 10:45 ~ 12:15
  3: { start: 12 * 60 + 55, end: 14 * 60 + 25  }, // 12:55 ~ 14:25
  4: { start: 14 * 60 + 40, end: 16 * 60 + 10  }, // 14:40 ~ 16:10
  5: { start: 16 * 60 + 25, end: 17 * 60 + 55  }, // 16:25 ~ 17:55
  6: { start: 18 * 60 + 10, end: 19 * 60 + 40  }, // 18:10 ~ 19:40
  7: { start: 19 * 60 + 55, end: 21 * 60 + 25  }, // 19:55 ~ 21:25
  8: { start: 21 * 60 + 40, end: 23 * 60 + 10  }, // 21:40 ~ 23:10
};

// 학교별 교시 시간 반환 (universities.js의 periodRanges 필드 사용, 없으면 국사관 기본값)
export function getPeriodRanges(university) {
  return university?.periodRanges ?? PERIOD_RANGES;
}

// 교시 번호 → 시작 시간 문자열 반환 (예: 1 → '9:00')
export function getPeriodStartTimeStr(period, university) {
  const range = getPeriodRanges(university)[period];
  if (!range) return '';
  const h = Math.floor(range.start / 60);
  const m = range.start % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

// 수업 목록에서 공강(빈 교시) 목록 계산
// courses: [{ day_of_week: 0~4, period: 1~8 }, ...]
// 반환값: [{ day: 0~4, period: 1~8 }, ...]
export function calculateFreePeriods(courses) {
  const occupied = new Set(courses.map(c => `${c.day_of_week}-${c.period}`));
  const free = [];
  for (let day = 0; day <= 4; day++) {
    for (let period = 1; period <= 6; period++) {
      if (!occupied.has(`${day}-${period}`)) {
        free.push({ day, period });
      }
    }
  }
  return free;
}

// 현재 시각(분)을 기준으로 수업 상태 반환
// period: 교시 번호 (1~8)
// nowMin: 자정 기준 현재 분수 (예: 9시30분 = 570)
// todayCoursesSorted: 오늘 수업 목록 (period 오름차순 정렬)
// university: 학교 객체 (없으면 국사관 기본값)
// 반환값: '進行中' | '次の授業' | '終了' | '未開始'
export function getCourseStatus(period, nowMin, todayCoursesSorted, university) {
  const ranges = getPeriodRanges(university);
  const range = ranges[period];
  if (!range) return '未開始';

  if (nowMin >= range.start && nowMin < range.end) return '進行中';
  if (nowMin >= range.end) return '終了';

  // 아직 시작 전 — 오늘 수업 중 다음 교시인지 판단
  const sortedPeriods = todayCoursesSorted.map(c => c.period);
  const futureIdx = sortedPeriods.filter(p => ranges[p]?.start > nowMin);
  if (futureIdx.length > 0 && futureIdx[0] === period) return '次の授業';
  return '未開始';
}

// 현재 날짜 기준 학기 판별 — 카에데 시간표는 春期(spring)/秋期(fall) 2개 행으로 나뉜다.
// 4~9월 = 春期, 10~3월 = 秋期 (국사관 학사일정 기준)
export function getCurrentTerm(date = new Date()) {
  const m = date.getMonth() + 1; // 1~12
  return (m >= 4 && m <= 9) ? 'spring' : 'fall';
}

// 카에데 시간표 셀 id 해석
// 형식: "Cell{열}_{교시}_{Spring|Autumn}" (예: "Cell1_1_Spring" = 月曜1限 春期)
//   열  1~6 → 月火水木金土 → day_of_week 0~5
//   교시 1~7
//   학기 Spring=spring / Autumn=fall
// 형식이 안 맞으면 null 반환
export function parseKaedeCellId(id) {
  const m = /^Cell(\d+)_(\d+)_(Spring|Autumn)$/.exec(id || '');
  if (!m) return null;
  return {
    day: parseInt(m[1], 10) - 1,     // 1열(月)=0
    period: parseInt(m[2], 10),
    term: m[3] === 'Spring' ? 'spring' : 'fall',
  };
}

// 카에데 MY時間割에서 injectedJS로 긁어온 셀 배열 → 미리보기/저장용 항목으로 변환
// cells   : [{ id: 'Cell1_1_Spring', name, professor }, ...] (빈 칸은 injectedJS에서 이미 제외)
// options.term : 'spring'|'fall' 지정 시 해당 학기만 추출 (없으면 전체)
// 반환값 { parsed, unparsed } — BulkAddPreviewScreen / buildCourseRows가 그대로 사용하는 형식
export function parseKaedeTimetable(cells, options = {}) {
  const parsed = [];
  const unparsed = [];

  for (const cell of (cells || [])) {
    const pos = parseKaedeCellId(cell?.id);
    const name = typeof cell?.name === 'string' ? cell.name.trim() : '';

    if (!pos || !name) {
      // id 형식 불명 또는 과목명 없음
      if (name) unparsed.push({ rawText: name, reason: 'セル位置不明' });
      continue;
    }
    if (options.term && pos.term !== options.term) continue; // 다른 학기는 건너뜀

    parsed.push({
      name,
      day: pos.day,
      period: pos.period,
      term: pos.term,
      professor: (cell.professor && String(cell.professor).trim()) || null,
      confidence: 'high', // DOM 위치 기반이라 신뢰도 높음
    });
  }

  return { parsed, unparsed };
}

// 시간표 일괄 추가용 변환 함수
// 파서/미리보기가 만든 항목(items)을 courses 테이블 insert 행(rows)으로 변환한다.
//
// items     : [{ name, day, period, professor, ... }, ...] (파서 결과 형식)
// userId    : 로그인 사용자 id (각 행의 user_id에 채움)
// existing  : 이미 등록된 수업 [{ day_of_week, period }, ...] (중복 칸 검사용)
//
// 반환값 { rows, skipped }
//   rows    : supabase.from('courses').insert()에 그대로 넣을 수 있는 배열
//   skipped : 저장하지 못한 항목 [{ item, reason }] (reason: 'invalid' | 'occupied')
//
// 저장 규칙 (2026-05-24 확정):
//   - day_of_week 는 0~4(월~금), period 는 1~8 만 허용 → 미상·토요일(5)은 'invalid'
//   - 같은 요일+교시 칸이 이미 차 있으면 'occupied' 로 건너뜀(skip)
//   - 입력 안에서 같은 칸이 중복되면 첫 항목만 남기고 나머지도 'occupied'
//   - 学期(term)·학점·캠퍼스는 현재 스키마에 컬럼이 없어 저장하지 않음
export function buildCourseRows(items, userId, existing = []) {
  const rows = [];
  const skipped = [];

  // 이미 점유된 칸 집합 ("요일-교시" 문자열). 이번에 추가되는 칸도 누적해 입력 내 중복까지 막는다.
  const occupied = new Set(
    (existing || []).map(c => `${c.day_of_week}-${c.period}`)
  );

  for (const item of (items || [])) {
    const name = typeof item?.name === 'string' ? item.name.trim() : '';
    const dayOk = Number.isInteger(item?.day) && item.day >= 0 && item.day <= 4;
    const periodOk = Number.isInteger(item?.period) && item.period >= 1 && item.period <= 8;

    // 이름 없음 / 요일·교시 미상 / 토요일 → 저장 불가
    if (!name || !dayOk || !periodOk) {
      skipped.push({ item, reason: 'invalid' });
      continue;
    }

    // 이미 차 있는 칸(기존 + 이번 추가분) → 건너뛰기
    const key = `${item.day}-${item.period}`;
    if (occupied.has(key)) {
      skipped.push({ item, reason: 'occupied' });
      continue;
    }
    occupied.add(key);

    rows.push({
      user_id: userId,
      name,
      day_of_week: item.day,
      period: item.period,
      professor_name: item.professor ? String(item.professor).trim() : null,
    });
  }

  return { rows, skipped };
}
