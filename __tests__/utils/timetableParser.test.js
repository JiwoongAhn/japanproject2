import { parseTimetableText, detectedRangesToMinutes } from '../../src/utils/timetableParser';

// ──────────────────────────────────────────────
// parseTimetableText
// ──────────────────────────────────────────────

describe('parseTimetableText - kaede-i 정상 케이스', () => {
  test('1교시 春期 - 月/金 2개 셀 추출', () => {
    const text = `
1限目
9:00~10:30
春期
月
町田
ビジネスコミュニケーション
[2]
榊原 一也
シラバス
金
町田
ビジネス実務
[2]
安重 千代子
シラバス
    `.trim();

    const result = parseTimetableText(text, { defaultTerm: 'spring' });

    expect(result.parsed).toHaveLength(2);
    expect(result.parsed[0]).toEqual({
      name: 'ビジネスコミュニケーション',
      day: 0,
      period: 1,
      term: 'spring',
      professor: '榊原 一也',
      credit: 2,
      campus: '町田',
      confidence: 'high',
    });
    expect(result.parsed[1]).toEqual({
      name: 'ビジネス実務',
      day: 4,
      period: 1,
      term: 'spring',
      professor: '安重 千代子',
      credit: 2,
      campus: '町田',
      confidence: 'high',
    });
    expect(result.detectedPeriodRanges[1]).toEqual({ start: '09:00', end: '10:30' });
  });

  test('4~7교시 - 다양한 요일·교시 조합', () => {
    const text = `
4限目
14:40~16:10
春期
火
町田
Webデザインの基礎
[2]
羽根 秀也
シラバス
水
町田
21世紀アジア学演習1
[1]
土佐 昌樹
シラバス
木
町田
キャリアデザイン3
[2]
堤 由紀子
シラバス
金
町田
空手
[1]
田中 理沙
シラバス
5限目
16:25~17:55
春期
水
町田
異文化理解
[2]
濱田 英作
シラバス
    `.trim();

    const result = parseTimetableText(text);

    expect(result.parsed).toHaveLength(5);
    expect(result.parsed.every(p => p.confidence === 'high')).toBe(true);
    expect(result.parsed.find(p => p.name === '空手')).toMatchObject({ day: 4, period: 4, credit: 1 });
    expect(result.parsed.find(p => p.name === '異文化理解')).toMatchObject({ day: 2, period: 5 });
    expect(result.detectedPeriodRanges[4]).toEqual({ start: '14:40', end: '16:10' });
    expect(result.detectedPeriodRanges[5]).toEqual({ start: '16:25', end: '17:55' });
  });

  test('1~5교시 통합 - detectedPeriodRanges에 5개 시간 모두 추출', () => {
    const text = `
1限目
9:00~10:30
春期
月
町田
科目A
[2]
教授A
シラバス
2限目
10:45~12:15
春期
火
町田
科目B
[2]
教授B
シラバス
3限目
12:55~14:25
春期
水
町田
科目C
[2]
教授C
シラバス
4限目
14:40~16:10
春期
木
町田
科目D
[2]
教授D
シラバス
5限目
16:25~17:55
春期
金
町田
科目E
[2]
教授E
シラバス
    `.trim();

    const result = parseTimetableText(text);

    expect(Object.keys(result.detectedPeriodRanges)).toHaveLength(5);
    expect(result.detectedPeriodRanges[1]).toEqual({ start: '09:00', end: '10:30' });
    expect(result.detectedPeriodRanges[5]).toEqual({ start: '16:25', end: '17:55' });
    expect(result.parsed).toHaveLength(5);
  });
});

describe('parseTimetableText - manaba 정보 부족 케이스 (fallback)', () => {
  test('학점·교수명·シラバス 없는 텍스트 → 모두 confidence=low로 분류', () => {
    const text = `
1限目
月
ビジネスコミュニケーション
金
ビジネス実務
2限目
月
スポーツ実習Vテニス
金
身体と心
    `.trim();

    const result = parseTimetableText(text);

    expect(result.parsed).toHaveLength(4);
    expect(result.parsed.every(p => p.confidence === 'low')).toBe(true);
    expect(result.parsed.every(p => p.professor === null && p.credit === null)).toBe(true);
    expect(result.parsed[0]).toMatchObject({ name: 'ビジネスコミュニケーション', day: 0, period: 1 });
    expect(result.parsed[3]).toMatchObject({ name: '身体と心', day: 4, period: 2 });
  });
});

describe('parseTimetableText - defaultTerm 적용', () => {
  test('학기 토큰이 없는 텍스트 + defaultTerm=fall → 모두 term=fall', () => {
    const text = `
1限目
月
町田
科目X
[2]
教授X
シラバス
火
町田
科目Y
[2]
教授Y
シラバス
    `.trim();

    const result = parseTimetableText(text, { defaultTerm: 'fall' });

    expect(result.parsed).toHaveLength(2);
    expect(result.parsed.every(p => p.term === 'fall')).toBe(true);
  });

  test('options 미지정 시 기본값 spring', () => {
    const text = `
1限目
月
科目Z
    `.trim();

    const result = parseTimetableText(text);

    expect(result.parsed[0].term).toBe('spring');
  });
});

describe('parseTimetableText - 인식 실패 케이스', () => {
  test('요일 정보 없는 줄들은 unparsed로', () => {
    const text = `
1限目
ビジネスコミュニケーション
2限目
スポーツ実習Vテニス
    `.trim();

    const result = parseTimetableText(text);

    expect(result.parsed).toHaveLength(0);
    expect(result.unparsed).toHaveLength(2);
    expect(result.unparsed[0].reason).toBe('요일 정보 없음');
  });

  test('빈 입력은 빈 결과', () => {
    expect(parseTimetableText('')).toEqual({
      parsed: [],
      unparsed: [],
      detectedPeriodRanges: {},
    });
    expect(parseTimetableText('   \n  \n  ')).toEqual({
      parsed: [],
      unparsed: [],
      detectedPeriodRanges: {},
    });
  });

  test('non-string 입력도 안전하게 처리', () => {
    expect(parseTimetableText(null).parsed).toEqual([]);
    expect(parseTimetableText(undefined).parsed).toEqual([]);
  });
});

describe('parseTimetableText - dedupe', () => {
  test('같은 name+day+period+term 조합은 중복 제거', () => {
    const text = `
1限目
月
町田
科目A
[2]
教授A
シラバス
月
町田
科目A
[2]
教授A
シラバス
    `.trim();

    const result = parseTimetableText(text);

    expect(result.parsed).toHaveLength(1);
  });
});

// ──────────────────────────────────────────────
// detectedRangesToMinutes
// ──────────────────────────────────────────────

describe('detectedRangesToMinutes', () => {
  test('HH:MM 문자열 → 분 단위 변환', () => {
    const input = {
      1: { start: '09:00', end: '10:30' },
      2: { start: '10:45', end: '12:15' },
    };
    expect(detectedRangesToMinutes(input)).toEqual({
      1: { start: 540, end: 630 },
      2: { start: 645, end: 735 },
    });
  });

  test('빈 입력은 빈 객체', () => {
    expect(detectedRangesToMinutes({})).toEqual({});
    expect(detectedRangesToMinutes(null)).toEqual({});
    expect(detectedRangesToMinutes(undefined)).toEqual({});
  });

  test('잘못된 range는 건너뜀', () => {
    const input = {
      1: { start: '09:00', end: '10:30' },
      2: null,
      3: { start: '12:55' },
    };
    expect(detectedRangesToMinutes(input)).toEqual({
      1: { start: 540, end: 630 },
    });
  });
});
