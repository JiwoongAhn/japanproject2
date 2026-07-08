import {
  normalizeJa,
  parseDayPeriod,
  parseResultRow,
  matchRoom,
  buildSyllabusFetchJS,
} from '../../src/utils/syllabusRoom';

// 결과표 컬럼순: 0 授業科目名 | 1 教員名 | 2 対象 | 3 期 | 4 曜日時限 | 5 キャンパス | 6 教室 | 7 詳細
const row = (name, prof, dayPeriod, campus, room, term = '春期') => [
  name,
  prof,
  '２１世紀アジア学部：アジア・2,3,4',
  term,
  dayPeriod,
  campus,
  room,
  '詳細',
];

// ──────────────────────────────────────────────
// normalizeJa — 공백(반각/전각) 제거
// ──────────────────────────────────────────────
describe('normalizeJa', () => {
  test('반각 공백 제거', () => {
    expect(normalizeJa('安重 千代子')).toBe('安重千代子');
  });
  test('전각 공백 제거', () => {
    expect(normalizeJa('安重　千代子')).toBe('安重千代子');
  });
  test('null/undefined → 빈 문자열', () => {
    expect(normalizeJa(null)).toBe('');
    expect(normalizeJa(undefined)).toBe('');
  });
});

// ──────────────────────────────────────────────
// parseDayPeriod — 曜日時限 파싱
// ──────────────────────────────────────────────
describe('parseDayPeriod', () => {
  test('단일 슬롯 "金／1" (전각 슬래시)', () => {
    expect(parseDayPeriod('金／1')).toEqual([{ day: 4, period: 1 }]);
  });
  test('반각 슬래시 "金/1"', () => {
    expect(parseDayPeriod('金/1')).toEqual([{ day: 4, period: 1 }]);
  });
  test('복수 슬롯 "月／2土／5"', () => {
    expect(parseDayPeriod('月／2土／5')).toEqual([
      { day: 0, period: 2 },
      { day: 5, period: 5 },
    ]);
  });
  test('집중(集中) 등 요일 없음 → 빈 배열', () => {
    expect(parseDayPeriod('集中')).toEqual([]);
    expect(parseDayPeriod('')).toEqual([]);
  });
});

// ──────────────────────────────────────────────
// parseResultRow
// ──────────────────────────────────────────────
describe('parseResultRow', () => {
  test('행을 정규화 객체로', () => {
    const r = parseResultRow(row('ビジネス実務', '安重 千代子', '金／1', '町田', '30303'));
    expect(r).toMatchObject({
      name: 'ビジネス実務',
      professor: '安重 千代子',
      campus: '町田',
      room: '30303',
      slots: [{ day: 4, period: 1 }],
    });
  });
});

// ──────────────────────────────────────────────
// matchRoom — 핵심 매칭
// ──────────────────────────────────────────────
describe('matchRoom', () => {
  test('단일 결과 → 그 교실 (실제 검증 케이스)', () => {
    const course = { name: 'ビジネス実務', professor: '安重 千代子', day: 4, period: 1, campus: '町田' };
    const rows = [row('ビジネス実務', '安重 千代子', '金／1', '町田', '30303')];
    expect(matchRoom(course, rows)).toBe('30303');
  });

  test('교수명으로 분반 구분', () => {
    const course = { name: 'グローバルアジア演習I', professor: '榊原 一也', day: 0, period: 2 };
    const rows = [
      row('グローバルアジア演習I', '陳 慧', '土／1土／2', '町田', '10101'),
      row('グローバルアジア演習I', '榊原 一也', '月／2土／5', '町田', '30403'),
      row('グローバルアジア演習I', '山田 尚史', '火／3土／1', '町田', '20202'),
    ];
    expect(matchRoom(course, rows)).toBe('30403');
  });

  test('교수명 공백 표기 차이 흡수', () => {
    const course = { name: 'ビジネス実務', professor: '安重千代子', day: 4, period: 1 };
    const rows = [row('ビジネス実務', '安重 千代子', '金／1', '町田', '30303')];
    expect(matchRoom(course, rows)).toBe('30303');
  });

  test('교수 같고 요일·교시로 최종 구분', () => {
    const course = { name: '演習', professor: '田中 太郎', day: 2, period: 3 };
    const rows = [
      row('演習', '田中 太郎', '月／1', '町田', 'A101'),
      row('演習', '田中 太郎', '水／3', '町田', 'B202'),
    ];
    expect(matchRoom(course, rows)).toBe('B202');
  });

  test('교실 빈칸(집중강의) → null', () => {
    const course = { name: 'グローバルアジア論', professor: '高橋 伸子', day: null, period: null };
    const rows = [row('グローバルアジア論', '高橋 伸子', '集中', '町田', '')];
    expect(matchRoom(course, rows)).toBeNull();
  });

  test('결과 없음 → null', () => {
    expect(matchRoom({ name: 'なにか', professor: '誰か' }, [])).toBeNull();
  });
});

// ──────────────────────────────────────────────
// buildSyllabusFetchJS — 주입 스크립트 생성
// ──────────────────────────────────────────────
describe('buildSyllabusFetchJS', () => {
  test('과목 목록·딜레이·필드명이 스크립트에 반영', () => {
    const js = buildSyllabusFetchJS([{ index: 0, name: 'ビジネス実務' }], { delayMs: 800 });
    expect(js).toContain('ビジネス実務');
    expect(js).toContain('var DELAY = 800');
    expect(js).toContain('param_KamokuName');
    expect(js).toContain('searchButton');
    expect(js.trim().endsWith('})();')).toBe(true);
  });
});
