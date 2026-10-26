import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

// 암호화 저장소(세션·쿠키 공용) — 키체인 잠김·동시 생성 대책은 ./largeSecureStore 참고
import { LargeSecureStore } from './largeSecureStore';

export { LargeSecureStore };

// ─────────────────────────────────────────────────────────────────────────────
// Supabase 클라이언트
// ─────────────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    '[Supabase] 환경변수가 설정되지 않았습니다.\n' +
    '.env 파일에 EXPO_PUBLIC_SUPABASE_URL 과 EXPO_PUBLIC_SUPABASE_ANON_KEY 를 입력하세요.'
  );
}

// 스토리지 선택:
//   웹   → undefined (Supabase가 자동으로 localStorage 사용)
//   네이티브 → LargeSecureStore (AES-256 암호화)
const authStorage = Platform.OS === 'web' ? undefined : new LargeSecureStore();

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: authStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
