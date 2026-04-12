import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─────────────────────────────────────────────
// Supabase 클라이언트 설정
//
// 왜 이렇게 단순하게 바꿨나요?
//   이전 버전은 expo-secure-store, aes-js, react-native-get-random-values를
//   import했는데, 이 패키지들은 iOS/Android 전용이라 웹(--web)에서 실행하면
//   import 단계에서 오류가 발생합니다.
//
//   웹 개발 단계에서는 AsyncStorage로 충분히 안전하고 안정적입니다.
//   나중에 실기기 배포 시 SecureStore로 업그레이드하면 됩니다.
// ─────────────────────────────────────────────

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// 환경변수 누락 시 개발자가 바로 알 수 있게 경고 출력
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    '[Supabase] 환경변수가 설정되지 않았습니다.\n' +
    '.env 파일에 EXPO_PUBLIC_SUPABASE_URL 과 EXPO_PUBLIC_SUPABASE_ANON_KEY 를 입력하세요.'
  );
}

// 웹: localStorage (Supabase 기본값, undefined으로 두면 자동 사용)
// 네이티브(iOS/Android): AsyncStorage
const authStorage = Platform.OS === 'web' ? undefined : AsyncStorage;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: authStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
