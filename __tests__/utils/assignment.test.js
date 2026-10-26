import { calcDday, getDdayColor, formatDueDate, isAssignmentFormValid } from '../../src/utils/assignment';

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-04-14'));
});

afterEach(() => {
  jest.useRealTimers();
});

// ──────────────────────────────────────────────
// calcDday
// ──────────────────────────────────────────────
describe('calcDday', () => {
  test('A-01: 오늘 마감 → D-Day, isUrgent: true', () => {
    expect(calcDday('2026-04-14')).toEqual({ label: 'D-Day', isUrgent: true });
  });

  test('A-02: 내일 마감 → D-1, isUrgent: true', () => {
    expect(calcDday('2026-04-15')).toEqual({ label: 'D-1', isUrgent: true });
  });

  test('A-03: 3일 후 마감 → D-3, isUrgent: true', () => {
    expect(calcDday('2026-04-17')).toEqual({ label: 'D-3', isUrgent: true });
  });

  test('A-04: 4일 후 마감 → D-4, isUrgent: false', () => {
    expect(calcDday('2026-04-18')).toEqual({ label: 'D-4', isUrgent: false });
  });

  test('A-05: 어제 마감 (1일 경과) → D+1, isUrgent: true', () => {
    expect(calcDday('2026-04-13')).toEqual({ label: 'D+1', isUrgent: true });
  });

  test('A-06: 10일 전 마감 → D+10, isUrgent: true', () => {
    expect(calcDday('2026-04-04')).toEqual({ label: 'D+10', isUrgent: true });
  });
});

// ──────────────────────────────────────────────
// getDdayColor
// ──────────────────────────────────────────────
describe('getDdayColor', () => {
  test('A-07: dday=0 → colors.warning (#FF8A00)', () => {
    expect(getDdayColor(0)).toBe('#FF8A00');
  });

  test('A-08: dday=1 → colors.warning (#FF8A00)', () => {
    expect(getDdayColor(1)).toBe('#FF8A00');
  });

  test('A-09: dday=2 → colors.primary (#3182F6)', () => {
    expect(getDdayColor(2)).toBe('#3182F6');
  });

  test('A-10: dday=3 → colors.primary (#3182F6)', () => {
    expect(getDdayColor(3)).toBe('#3182F6');
  });

  test('A-11: dday=4 → colors.textSecondary (#8B95A1)', () => {
    expect(getDdayColor(4)).toBe('#8B95A1');
  });

  test('A-12: dday=-1 (음수) → colors.warning (#FF8A00)', () => {
    expect(getDdayColor(-1)).toBe('#FF8A00');
  });
});

// ──────────────────────────────────────────────
// formatDueDate
// ──────────────────────────────────────────────
describe('formatDueDate', () => {
  test('A-13: "2026" (4자리 이하) → "2026"', () => {
    expect(formatDueDate('2026')).toBe('2026');
  });

  test('A-14: "202604" → "2026-04"', () => {
    expect(formatDueDate('202604')).toBe('2026-04');
  });

  test('A-15: "20260415" → "2026-04-15"', () => {
    expect(formatDueDate('20260415')).toBe('2026-04-15');
  });

  test('A-16: "2026/04/15" (슬래시 포함) → "2026-04-15"', () => {
    expect(formatDueDate('2026/04/15')).toBe('2026-04-15');
  });

  test('A-17: "202604151234" (8자리 초과) → "2026-04-15"', () => {
    expect(formatDueDate('202604151234')).toBe('2026-04-15');
  });
});

// ──────────────────────────────────────────────
// isAssignmentFormValid
// ──────────────────────────────────────────────
describe('isAssignmentFormValid', () => {
  test('A-18: 모든 필드 유효 → true', () => {
    expect(isAssignmentFormValid('経営学', 'レポート', '2026-04-15')).toBe(true);
  });

  test('A-19: courseName 빈 문자열 → false', () => {
    expect(isAssignmentFormValid('', 'レポート', '2026-04-15')).toBe(false);
  });

  test('A-20: title 빈 문자열 → false', () => {
    expect(isAssignmentFormValid('経営学', '', '2026-04-15')).toBe(false);
  });

  test('A-21: dueDate 형식 오류 (슬래시) → false', () => {
    expect(isAssignmentFormValid('経営学', 'レポート', '2026/04/15')).toBe(false);
  });

  test('A-22: dueDate 형식 오류 (년월만) → false', () => {
    expect(isAssignmentFormValid('経営学', 'レポート', '2026-04')).toBe(false);
  });
});

describe('formatDueLabel / isPastDue — manaba 자동 추가 課題(시각 있음)', () => {
  const { formatDueLabel, isPastDue } = require('../../src/utils/assignment');

  test('시각이 있으면 JST 날짜+시각', () => {
    expect(formatDueLabel({ due_date: '2026-10-15', due_at: '2026-10-15T07:25:00+00:00' }))
      .toBe('2026-10-15 16:25');
  });
  test('0:00 마감은 전날 24:00', () => {
    expect(formatDueLabel({ due_date: '2026-10-26', due_at: '2026-10-26T15:00:00+00:00' }))
      .toBe('2026-10-26 24:00');
  });
  test('수동 등록(시각 없음)은 날짜만 / 빈 값 안전', () => {
    expect(formatDueLabel({ due_date: '2026-10-15', due_at: null })).toBe('2026-10-15');
    expect(formatDueLabel(null)).toBe('');
  });
  test('시각 기준 마감 판정 — 같은 날이라도 시각이 지나면 초과', () => {
    const a = { due_date: '2026-10-15', due_at: '2026-10-15T16:25:00+09:00' };
    expect(isPastDue(a, new Date('2026-10-15T16:24:00+09:00'))).toBe(false);
    expect(isPastDue(a, new Date('2026-10-15T16:26:00+09:00'))).toBe(true);
  });
  test('시각 없으면 마감일 당일까지는 초과 아님 (기존 동작)', () => {
    const a = { due_date: '2026-10-15', due_at: null };
    expect(isPastDue(a, new Date(2026, 9, 15, 23, 0))).toBe(false);
    expect(isPastDue(a, new Date(2026, 9, 16, 0, 1))).toBe(true);
  });
});
