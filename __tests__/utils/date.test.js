// __tests__/utils/date.test.js
import { getTodayStr } from '../../src/utils/date';

describe('getTodayStr', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  // D-01: 반환값이 YYYY-MM-DD 형식인지 정규식 검사
  it('D-01: YYYY-MM-DD 형식으로 반환한다', () => {
    const result = getTodayStr();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  // D-02: 날짜를 고정하면 해당 날짜 문자열을 반환한다
  it('D-02: 날짜를 2026-04-14로 고정하면 "2026-04-14"를 반환한다', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-14'));

    const result = getTodayStr();
    expect(result).toBe('2026-04-14');
  });
});
