import { HOME_DISPLAY_DEFAULT, parseHomeDisplay } from '../../src/utils/homeDisplay';
import { lastPeriodOf } from '../../src/utils/timetable';
import { pickReleaseNote } from '../../src/utils/releaseNotes';
import { RELEASE_NOTES } from '../../src/constants/releaseNotes';

describe('ホームの表示 설정', () => {
  test('HD-01 저장된 것이 없거나 깨졌으면 전부 보이는 기본값', () => {
    expect(parseHomeDisplay(null)).toEqual(HOME_DISPLAY_DEFAULT);
    expect(parseHomeDisplay('{깨짐')).toEqual(HOME_DISPLAY_DEFAULT);
    expect(parseHomeDisplay('"문자"')).toEqual(HOME_DISPLAY_DEFAULT);
  });
  test('HD-02 저장한 값은 살리고, 모르는 값·빠진 칸은 기본값으로 메운다', () => {
    const r = parseHomeDisplay(JSON.stringify({ timetable: 'off', board: false, school: 'x', timetableX: 1 }));
    expect(r).toEqual({ ...HOME_DISPLAY_DEFAULT, timetable: 'off', board: false });
    expect(parseHomeDisplay(JSON.stringify({ timetable: 'month' })).timetable).toBe('today');
  });
});

describe('주간 표', () => {
  test('HD-03 마지막 수업 교시까지, 최소 4교시', () => {
    expect(lastPeriodOf([])).toBe(4);
    expect(lastPeriodOf([{ period: 2 }])).toBe(4);
    expect(lastPeriodOf([{ period: 6 }, { period: 1 }, { period: null }])).toBe(6);
  });
});

describe('「新しくなりました」 창', () => {
  const notes = [
    { id: 'fix', releasedAt: '2026-12-20', popup: false, items: [] },
    { id: 'new', releasedAt: '2026-12-03', popup: true, items: [] },
  ];
  const OLD = '2026-10-01T00:00:00Z';
  test('RN-01 배포 전에 가입한 사람에게 한 번 띄운다 (버그 수정만 있는 항목은 건너뜀)', () => {
    expect(pickReleaseNote(notes, null, OLD)?.id).toBe('new');
  });
  test('RN-02 이미 봤으면 안 띄운다', () => {
    expect(pickReleaseNote(notes, 'new', OLD)).toBeNull();
  });
  test('RN-03 배포 뒤에 가입한 사람·가입일을 모르는 경우에는 안 띄운다', () => {
    expect(pickReleaseNote(notes, null, '2026-12-03T00:00:00+09:00')).toBeNull();
    expect(pickReleaseNote(notes, null, null)).toBeNull();
  });
  test('RN-04 실제 업데이트 목록: id 중복 없음·날짜 형식·내용 있음', () => {
    expect(new Set(RELEASE_NOTES.map((n) => n.id)).size).toBe(RELEASE_NOTES.length);
    for (const n of RELEASE_NOTES) {
      expect(n.releasedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(n.items.length).toBeGreaterThan(0);
    }
  });
});
