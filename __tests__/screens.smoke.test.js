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
// expo-linking은 실기기의 app.json 매니페스트를 읽어 URI 스킴을 정하므로 테스트 환경에선 실패한다.
// 딥링크 동작 자체는 이 테스트의 관심사가 아니라 대체한다.
jest.mock('expo-linking', () => ({
  createURL: () => 'unione://',
  addEventListener: () => ({ remove: () => {} }),
  getInitialURL: async () => null,
}));

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
    ['OnboardingScreen', '../src/screens/auth/OnboardingScreen'],
    ['PhoneMockup', '../src/components/PhoneMockup'],
    ['SchoolWebViewScreen', '../src/screens/SchoolWebViewScreen'],
    ['TimetableScreen', '../src/screens/timetable/TimetableScreen'],
    // ↓ 2026-09-29 실기 버그 수정으로 손댄 파일들. 이전에는 목록에 없어 검사조차 되지 않았다.
    ['AssignmentScreen', '../src/screens/AssignmentScreen'],
    ['FreeTimeScreen', '../src/screens/timetable/FreeTimeScreen'],
    ['PostDetailScreen', '../src/screens/community/PostDetailScreen'],
    ['SplashScreen', '../src/screens/auth/SplashScreen'],
    ['NoticePreviewModal', '../src/screens/notice/NoticePreviewModal'],
    ['MainTab', '../src/navigation/MainTab'],
    ['AppNavigator', '../src/navigation/AppNavigator'],
    ['WideScreenContainer', '../src/components/WideScreenContainer'],
    // ↓ 2026-09-30 작은 화면 키패드 가림 수정으로 손댄 파일
    ['OtpVerificationScreen', '../src/screens/auth/OtpVerificationScreen'],
    // ↓ 2026-10-01 강의평가 댓글 기능
    ['CourseReviewDetailScreen', '../src/screens/timetable/CourseReviewDetailScreen'],
    // ↓ 2026-10-03 인앱 업데이트 안내
    ['UpdateBanner', '../src/components/UpdateBanner'],
    ['StoreUpdateModal', '../src/components/StoreUpdateModal'],
  ])('%s 가 로드된다', (name, path) => {
    const mod = require(path);
    expect(typeof mod.default).toBe('function');
  });

  // 화면들이 공유하는 훅 (named export)
  it('useAutoRelogin 훅이 로드된다', () => {
    const mod = require('../src/hooks/useAutoRelogin');
    expect(typeof mod.useAutoRelogin).toBe('function');
  });

  it('useAppUpdate 훅이 로드된다', () => {
    const mod = require('../src/hooks/useAppUpdate');
    expect(typeof mod.useAppUpdate).toBe('function');
  });
});
