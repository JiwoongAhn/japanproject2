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

  test('⭐ 타 기기 케이스: 자동이동 실패로 URL은 안 맞아도 로그인됐으면 노출', () => {
    expect(shouldShowExtractButton({ forTimetableImport: true, loggedIn: true, currentUrl: 'https://kaedei/Home.aspx' })).toBe(true);
  });

  test('로그인 전 + 시간표 URL도 아니면 숨김 (로그인 화면에서 버튼 안 뜸)', () => {
    expect(shouldShowExtractButton({ forTimetableImport: true, loggedIn: false, currentUrl: 'https://kaedei/login' })).toBe(false);
  });

  test('currentUrl 누락 안전 처리', () => {
    expect(shouldShowExtractButton({ forTimetableImport: true, loggedIn: false })).toBe(false);
    expect(shouldShowExtractButton({ forTimetableImport: true, loggedIn: true })).toBe(true);
  });

  test('인자 없이 호출해도 안전', () => {
    expect(shouldShowExtractButton()).toBe(false);
  });
});
