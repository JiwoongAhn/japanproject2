import { shouldShowExtractButton } from '../../src/utils/timetableImport';

describe('shouldShowExtractButton', () => {
  test('시간표 임포트 경로가 아니면 항상 숨김', () => {
    expect(shouldShowExtractButton({ forTimetableImport: false, loggedIn: true, currentUrl: 'https://x/MyTimeTable' })).toBe(false);
  });

  test('working 경로: 시간표 페이지 URL이면 노출 (기존 동작 유지)', () => {
    expect(shouldShowExtractButton({ forTimetableImport: true, loggedIn: false, currentUrl: 'https://kaedei/MyTimeTable.aspx' })).toBe(true);
  });

  test('URL 대소문자 무관', () => {
    expect(shouldShowExtractButton({ forTimetableImport: true, loggedIn: false, currentUrl: 'https://kaedei/mytimetable' })).toBe(true);
  });

  // #10: 로그인만으론 부족 — 시간표 페이지가 아니면 숨긴다 (로그인 페이지에서 버튼 안 뜸)
  test('로그인됐어도 시간표 페이지가 아니면 숨김', () => {
    expect(shouldShowExtractButton({ forTimetableImport: true, loggedIn: true, currentUrl: 'https://kaedei/Home.aspx' })).toBe(false);
  });

  test('로그인 페이지에선 숨김', () => {
    expect(shouldShowExtractButton({ forTimetableImport: true, loggedIn: false, currentUrl: 'https://kaedei/login' })).toBe(false);
  });

  test('currentUrl 누락 안전 처리 (시간표 URL 없으면 숨김)', () => {
    expect(shouldShowExtractButton({ forTimetableImport: true, loggedIn: false })).toBe(false);
    expect(shouldShowExtractButton({ forTimetableImport: true, loggedIn: true })).toBe(false);
  });

  test('인자 없이 호출해도 안전', () => {
    expect(shouldShowExtractButton()).toBe(false);
  });
});
