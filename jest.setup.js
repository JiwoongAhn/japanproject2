// ─────────────────────────────────────────────────────────────────────────────
// Jest 테스트 환경 셋업
//
// 네이티브 모듈(AsyncStorage)은 실제 기기에서만 동작하므로, 테스트 환경에서는
// 공식 mock으로 대체한다. 이게 없으면 supabase를 import하는 util(timetable,
// review 등)이 "NativeModule: AsyncStorage is null" 로 테스트가 실패한다.
// ─────────────────────────────────────────────────────────────────────────────

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// supabase 클라이언트는 import 시점에 환경변수를 읽어 createClient()를 실행한다.
// 테스트는 실제 서버에 연결하지 않으므로, 형식만 유효한 더미 값을 주입해
// "supabaseUrl is required" 에러를 막는다. (실제 키는 .env / eas.json이 담당)
process.env.EXPO_PUBLIC_SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://test.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'test-anon-key';
