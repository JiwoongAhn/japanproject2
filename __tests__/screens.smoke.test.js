// 화면 모듈 로드 스모크 테스트
// [배경] 이 프로젝트의 Jest 테스트는 순수 함수만 검증하고 화면 파일은 아예 불러오지 않는다.
//   그래서 화면에 중복 import·잘못된 import를 넣어도 테스트가 전부 통과해 버렸다(실제로 발생).
//   여기서 화면을 실제로 require해 그런 사고를 잡는다. (렌더링까지는 검증하지 않는다)
// WebView 등 네이티브 전용 모듈은 테스트 환경에 네이티브 바이너리가 없으므로 가짜로 대체.
jest.mock('react-native-webview', () => ({ WebView: 'WebView' }));
jest.mock('@react-native-cookies/cookies', () => ({
  __esModule: true,
  default: { get: jest.fn(), set: jest.fn(), clearAll: jest.fn(), getAll: jest.fn() },
}));
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn() }));

describe('수정한 화면 모듈 로드 스모크', () => {
  it.each([
    ['ManabaLoginScreen', '../src/screens/manaba/ManabaLoginScreen'],
    ['ManabaReminderSetupScreen', '../src/screens/manaba/ManabaReminderSetupScreen'],
    ['ManabaNoticePreview', '../src/components/ManabaNoticePreview'],
    ['BulkAddPreviewScreen', '../src/screens/timetable/BulkAddPreviewScreen'],
    ['BulkAddInputScreen', '../src/screens/timetable/BulkAddInputScreen'],
    ['HomeScreen', '../src/screens/HomeScreen'],
    ['ProfileScreen', '../src/screens/ProfileScreen'],
    ['MailConnectOnboardingScreen', '../src/screens/auth/MailConnectOnboardingScreen'],
  ])('%s 가 로드된다', (name, path) => {
    const mod = require(path);
    expect(typeof mod.default).toBe('function');
  });
});
