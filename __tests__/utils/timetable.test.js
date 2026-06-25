import {
  calculateFreePeriods,
  getCourseStatus,
  PERIOD_RANGES,
  buildCourseRows,
  parseKaedeCellId,
  parseKaedeTimetable,
  getCurrentTerm,
} from '../../src/utils/timetable';

describe('calculateFreePeriods', () => {
  // T-01: 수업 0개 → 공강 30개 전부 (5요일 × 6교시)
  test('T-01: 수업 없으면 공강 30개 반환', () => {
    const result = calculateFreePeriods([]);
    expect(result).toHaveLength(30);
  });

  // T-02: 수업 30개 (월~금 × 1~6교시 전부) → 공강 0개
  test('T-02: 전체 수업 등록 시 공강 0개 반환', () => {
    const allCourses = [];
    for (let day = 0; day <= 4; day++) {
      for (let period = 1; period <= 6; period++) {
        allCourses.push({ day_of_week: day, period });
      }
    }
    const result = calculateFreePeriods(allCourses);
    expect(result).toHaveLength(0);
  });

  // T-03: 월요일(day_of_week:0) 1교시 수업 1개 → 29개, {day:0, period:1} 미포함
  test('T-03: 월요일 1교시 수업 등록 시 공강 29개, 해당 칸 미포함', () => {
    const result = calculateFreePeriods([{ day_of_week: 0, period: 1 }]);
    expect(result).toHaveLength(29);
    expect(result).not.toContainEqual({ day: 0, period: 1 });
  });

  // T-04: 같은 칸 중복 입력 시 Set으로 중복 제거 → 여전히 29개
  test('T-04: 같은 칸 중복 입력 시 Set 중복 제거 → 공강 29개', () => {
    const courses = [
      { day_of_week: 0, period: 1 },
      { day_of_week: 0, period: 1 },
    ];
    const result = calculateFreePeriods(courses);
    expect(result).toHaveLength(29);
  });

  // T-05: 반환 결과에 토요일(day >= 5) 없음
  test('T-05: 반환 결과에 토요일(day >= 5) 포함 없음', () => {
    const result = calculateFreePeriods([]);
    const hasSaturday = result.some(slot => slot.day >= 5);
    expect(hasSaturday).toBe(false);
  });

  // T-06: 반환 결과에 9교시(period >= 9) 없음
  test('T-06: 반환 결과에 9교시(period >= 9) 포함 없음', () => {
    const result = calculateFreePeriods([]);
    const hasPeriod9 = result.some(slot => slot.period >= 9);
    expect(hasPeriod9).toBe(false);
  });
});

describe('getCourseStatus', () => {
  // T-07: period=1, nowMin=570(9시30분), courses=[{period:1}] → '進行中'
  test('T-07: 수업 시간 중 → 進行中', () => {
    const result = getCourseStatus(1, 570, [{ period: 1 }]);
    expect(result).toBe('進行中');
  });

  // T-08: period=2, nowMin=500(8시20분), courses=[{period:2}] → '次の授業'
  test('T-08: 가장 가까운 다음 수업 → 次の授業', () => {
    const result = getCourseStatus(2, 500, [{ period: 2 }]);
    expect(result).toBe('次の授業');
  });

  // T-09: period=1, nowMin=700(11시40분), courses=[{period:1}] → '終了'
  test('T-09: 수업 종료 후 → 終了', () => {
    const result = getCourseStatus(1, 700, [{ period: 1 }]);
    expect(result).toBe('終了');
  });

  // T-10: period=3, nowMin=500, courses=[{period:2},{period:3}] → '未開始' (period:2가 다음 수업)
  test('T-10: 다음 수업이 아닌 미래 수업 → 未開始', () => {
    const result = getCourseStatus(3, 500, [{ period: 2 }, { period: 3 }]);
    expect(result).toBe('未開始');
  });

  // T-11: 존재하지 않는 교시 period=9 → '未開始'
  test('T-11: 존재하지 않는 교시(period=9) → 未開始', () => {
    const result = getCourseStatus(9, 570, [{ period: 9 }]);
    expect(result).toBe('未開始');
  });
});

describe('buildCourseRows', () => {
  const UID = 'user-123';

  // B-01: 정상 항목 → DB 행으로 변환되고 user_id가 채워진다
  test('B-01: 정상 항목 변환 + user_id 주입', () => {
    const items = [{ name: '経営学概論', day: 0, period: 1, professor: '田中 一郎' }];
    const { rows, skipped } = buildCourseRows(items, UID);
    expect(skipped).toHaveLength(0);
    expect(rows).toEqual([
      { user_id: UID, name: '経営学概論', day_of_week: 0, period: 1, professor_name: '田中 一郎', color_index: null },
    ]);
  });

  // B-02: 교수명 없으면 professor_name = null
  test('B-02: 교수명 없으면 null', () => {
    const { rows } = buildCourseRows([{ name: '数学', day: 1, period: 2 }], UID);
    expect(rows[0].professor_name).toBeNull();
  });

  // B-03: 과목명·요일·교시 앞뒤 공백 trim
  test('B-03: 과목명 trim', () => {
    const { rows } = buildCourseRows([{ name: '  英語  ', day: 2, period: 3, professor: '  Smith ' }], UID);
    expect(rows[0].name).toBe('英語');
    expect(rows[0].professor_name).toBe('Smith');
  });

  // B-04: 요일/교시 미상(null) → invalid 로 skip
  test('B-04: 요일·교시 미상 → invalid skip', () => {
    const { rows, skipped } = buildCourseRows([{ name: 'プログラミング', day: null, period: null }], UID);
    expect(rows).toHaveLength(0);
    expect(skipped).toEqual([{ item: expect.any(Object), reason: 'invalid' }]);
  });

  // B-05: 토요일(day=5) → invalid (courses는 0~4만 허용)
  test('B-05: 토요일 → invalid skip', () => {
    const { rows, skipped } = buildCourseRows([{ name: '土曜講座', day: 5, period: 1 }], UID);
    expect(rows).toHaveLength(0);
    expect(skipped[0].reason).toBe('invalid');
  });

  // B-06: 범위 밖 교시(period=9) → invalid
  test('B-06: period 범위 밖 → invalid skip', () => {
    const { rows, skipped } = buildCourseRows([{ name: '夜間講座', day: 0, period: 9 }], UID);
    expect(rows).toHaveLength(0);
    expect(skipped[0].reason).toBe('invalid');
  });

  // B-07: 이름 없음 → invalid
  test('B-07: 이름 공백 → invalid skip', () => {
    const { rows, skipped } = buildCourseRows([{ name: '   ', day: 0, period: 1 }], UID);
    expect(rows).toHaveLength(0);
    expect(skipped[0].reason).toBe('invalid');
  });

  // B-08: 기존 시간표와 같은 칸 → occupied 로 skip (덮어쓰지 않음)
  test('B-08: 기존 칸 중복 → occupied skip', () => {
    const existing = [{ day_of_week: 0, period: 1 }];
    const { rows, skipped } = buildCourseRows([{ name: '別の授業', day: 0, period: 1 }], UID, existing);
    expect(rows).toHaveLength(0);
    expect(skipped[0].reason).toBe('occupied');
  });

  // B-09: 입력 안에서 같은 칸 중복 → 첫 항목만 추가, 나머지는 occupied
  test('B-09: 입력 내 같은 칸 중복 → 첫 항목만', () => {
    const items = [
      { name: '授業A', day: 0, period: 1 },
      { name: '授業B', day: 0, period: 1 },
    ];
    const { rows, skipped } = buildCourseRows(items, UID);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('授業A');
    expect(skipped[0].reason).toBe('occupied');
  });

  // B-10: 여러 항목 혼합 — 정상/미상/중복이 올바르게 분리
  test('B-10: 혼합 입력 분리', () => {
    const existing = [{ day_of_week: 3, period: 4 }];
    const items = [
      { name: '正常1', day: 0, period: 1, professor: 'A' },
      { name: '미상', day: null, period: null },
      { name: '既存と重複', day: 3, period: 4 },
      { name: '正常2', day: 1, period: 2 },
    ];
    const { rows, skipped } = buildCourseRows(items, UID, existing);
    expect(rows).toHaveLength(2);
    expect(skipped).toHaveLength(2);
  });

  // B-11: 빈 입력 / null 입력 → 빈 결과 (앱이 멈추지 않게)
  test('B-11: 빈·null 입력 안전 처리', () => {
    expect(buildCourseRows([], UID)).toEqual({ rows: [], skipped: [] });
    expect(buildCourseRows(null, UID)).toEqual({ rows: [], skipped: [] });
  });
});

describe('getCurrentTerm', () => {
  test('5월 → spring', () => {
    expect(getCurrentTerm(new Date('2026-05-25'))).toBe('spring');
  });
  test('11월 → fall', () => {
    expect(getCurrentTerm(new Date('2026-11-01'))).toBe('fall');
  });
  test('1월 → fall (겨울)', () => {
    expect(getCurrentTerm(new Date('2026-01-15'))).toBe('fall');
  });
});

describe('parseKaedeCellId', () => {
  // K-01: 月曜1限 春期
  test('K-01: Cell1_1_Spring → 月(0) 1限 spring', () => {
    expect(parseKaedeCellId('Cell1_1_Spring')).toEqual({ day: 0, period: 1, term: 'spring' });
  });
  // K-02: 火曜3限 秋期
  test('K-02: Cell2_3_Autumn → 火(1) 3限 fall', () => {
    expect(parseKaedeCellId('Cell2_3_Autumn')).toEqual({ day: 1, period: 3, term: 'fall' });
  });
  // K-03: 土曜(6열) → day 5
  test('K-03: Cell6_2_Spring → 土(5)', () => {
    expect(parseKaedeCellId('Cell6_2_Spring').day).toBe(5);
  });
  // K-04: 형식 불명 → null
  test('K-04: 잘못된 id → null', () => {
    expect(parseKaedeCellId('Course1_1_Spring')).toBeNull();
    expect(parseKaedeCellId('')).toBeNull();
    expect(parseKaedeCellId(null)).toBeNull();
  });
});

describe('parseKaedeTimetable', () => {
  // 실제 카에데 MY時間割에서 추출한 春期 13과목 (2026 春期)
  const KAEDE_CELLS = [
    { id: 'Cell1_1_Spring', name: 'ビジネスコミュニケーション', professor: '榊原　一也' },
    { id: 'Cell5_1_Spring', name: 'ビジネス実務', professor: '安重　千代子' },
    { id: 'Cell1_2_Spring', name: 'スポーツ実習Ⅴ　テニス', professor: '山田　美絵子' },
    { id: 'Cell5_2_Spring', name: '身体と心', professor: '鈴木　敦子' },
    { id: 'Cell1_3_Spring', name: '応用英語１', professor: 'ヴィンセント　ロバート' },
    { id: 'Cell2_3_Spring', name: '現代の国際経済', professor: '金　明花' },
    { id: 'Cell4_3_Spring', name: '応用英語１', professor: 'ヴィンセント　ロバート' },
    { id: 'Cell5_3_Spring', name: '日本的経営', professor: '宮田　純' },
    { id: 'Cell2_4_Spring', name: 'Ｗｅｂデザインの基礎', professor: '羽根　秀也' },
    { id: 'Cell3_4_Spring', name: '２１世紀アジア学演習１', professor: '土佐　昌樹' },
    { id: 'Cell4_4_Spring', name: 'キャリアデザイン３', professor: '堤　由紀子' },
    { id: 'Cell5_4_Spring', name: '空手', professor: '田中　理沙' },
    { id: 'Cell3_5_Spring', name: '異文化理解', professor: '濱田　英作' },
  ];

  // K-05: 13개 전부 파싱
  test('K-05: 春期 13과목 모두 parsed', () => {
    const { parsed } = parseKaedeTimetable(KAEDE_CELLS);
    expect(parsed).toHaveLength(13);
  });

  // K-06: 요일 매핑 정확 — 21世紀アジア = 水(2) 4限 (MOCK에선 틀렸던 부분)
  test('K-06: 21世紀アジア演習1 → 水(2) 4限', () => {
    const { parsed } = parseKaedeTimetable(KAEDE_CELLS);
    const c = parsed.find(x => x.name === '２１世紀アジア学演習１');
    expect(c).toMatchObject({ day: 2, period: 4 });
  });

  // K-07: 같은 과목이 다른 요일에 두 번 (応用英語１ = 月3限 + 木3限)
  test('K-07: 応用英語１ 月(0)·木(3) 두 개로 분리', () => {
    const { parsed } = parseKaedeTimetable(KAEDE_CELLS);
    const days = parsed.filter(x => x.name === '応用英語１').map(x => x.day).sort();
    expect(days).toEqual([0, 3]);
  });

  // K-08: 교수명 포함, confidence high
  test('K-08: 과목 정보 정확', () => {
    const { parsed } = parseKaedeTimetable(KAEDE_CELLS);
    const c = parsed.find(x => x.name === 'ビジネスコミュニケーション');
    expect(c).toMatchObject({
      day: 0, period: 1, term: 'spring', professor: '榊原　一也', confidence: 'high',
    });
  });

  // K-09: term 필터 — fall 지정 시 春期만 있는 데이터는 0개
  test('K-09: term=fall 필터 → 0개', () => {
    const { parsed } = parseKaedeTimetable(KAEDE_CELLS, { term: 'fall' });
    expect(parsed).toHaveLength(0);
  });

  // K-10: 빈 셀(name 없음)·null 안전
  test('K-10: 빈·null 입력 안전', () => {
    expect(parseKaedeTimetable(null)).toEqual({ parsed: [], unparsed: [] });
    expect(parseKaedeTimetable([{ id: 'Cell1_1_Spring', name: '' }]).parsed).toHaveLength(0);
  });
});
