import {
  calculateFreePeriods,
  getCourseStatus,
  PERIOD_RANGES,
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
