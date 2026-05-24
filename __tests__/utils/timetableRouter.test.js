import { parseTimetable, hasDedicatedParser } from '../../src/utils/timetableRouter';
import { parseKaedeTimetable } from '../../src/utils/timetable';
import { parseTimetableText } from '../../src/utils/timetableParser';

describe('hasDedicatedParser', () => {
  test('국사관(kokushikan)은 전용 파서 보유', () => {
    expect(hasDedicatedParser('kokushikan')).toBe(true);
  });
  test('타교는 전용 파서 없음', () => {
    expect(hasDedicatedParser('nihon-u')).toBe(false);
    expect(hasDedicatedParser(undefined)).toBe(false);
  });
});

describe('parseTimetable 라우팅', () => {
  // R-01: kaedeCells → parseKaedeTimetable에 위임 (직접 호출 결과와 동일)
  test('R-01: kaedeCells → 카에데 파서 위임', () => {
    const cells = [
      { id: 'Cell1_1_Spring', name: 'ビジネスコミュニケーション', professor: '榊原　一也' },
      { id: 'Cell3_5_Spring', name: '異文化理解', professor: '濱田　英作' },
    ];
    const routed = parseTimetable({
      universityId: 'kokushikan',
      payload: { kind: 'kaedeCells', data: cells, term: 'spring' },
    });
    const direct = parseKaedeTimetable(cells, { term: 'spring' });
    expect(routed).toEqual(direct);
    expect(routed.parsed).toHaveLength(2);
  });

  // R-02: text → parseTimetableText에 위임 (직접 호출 결과와 동일)
  test('R-02: text → 텍스트 파서 위임', () => {
    const text = '1限目\n月曜\n経営学概論\n[2]\n田中 一郎';
    const routed = parseTimetable({
      universityId: 'kokushikan',
      payload: { kind: 'text', data: text, term: 'spring' },
    });
    const direct = parseTimetableText(text, { defaultTerm: 'spring' });
    expect(routed).toEqual(direct);
  });

  // R-03: html → AI 미구현 throw
  test('R-03: html → 미구현 에러', () => {
    expect(() =>
      parseTimetable({ universityId: 'toyo', payload: { kind: 'html', data: '<table></table>' } })
    ).toThrow('AI parser not implemented yet');
  });

  // R-04: 알 수 없는 kind → throw
  test('R-04: 알 수 없는 kind → 에러', () => {
    expect(() => parseTimetable({ payload: { kind: 'foo' } })).toThrow('unknown payload kind');
    expect(() => parseTimetable({})).toThrow('unknown payload kind');
    expect(() => parseTimetable()).toThrow('unknown payload kind');
  });
});
