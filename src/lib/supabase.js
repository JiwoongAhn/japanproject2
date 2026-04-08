import 'react-native-url-polyfill/auto';
import 'react-native-get-random-values';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as aesjs from 'aes-js';

// ─────────────────────────────────────────────
// LargeSecureStore
// 역할: JWT 토큰(세션)을 안전하게 저장
//
// 왜 두 곳에 나눠서 저장하나요?
//   - expo-secure-store  → 기기 보안 영역 (iOS Keychain / Android Keystore)
//                          보안은 최강이지만 저장 용량이 2KB로 제한됨
//   - AsyncStorage       → 일반 저장소, 용량 제한 없음
//
// 해결책: AES 암호화 키는 SecureStore에 보관,
//         암호화된 JWT 데이터는 AsyncStorage에 저장
// ─────────────────────────────────────────────
class LargeSecureStore {
  async _encrypt(key, value) {
    // 256비트(32바이트) 암호화 키 생성
    const encryptionKey = crypto.getRandomValues(new Uint8Array(256 / 8));

    // AES-CTR 모드로 데이터 암호화
    const cipher = new aesjs.ModeOfOperation.ctr(
      encryptionKey,
      new aesjs.Counter(1)
    );
    const encryptedBytes = cipher.encrypt(aesjs.utils.utf8.toBytes(value));

    // 암호화 키는 SecureStore(기기 보안 영역)에 저장
    await SecureStore.setItemAsync(key, aesjs.utils.hex.fromBytes(encryptionKey));

    // 암호화된 데이터를 hex 문자열로 반환
    return aesjs.utils.hex.fromBytes(encryptedBytes);
  }

  async _decrypt(key, value) {
    // SecureStore에서 암호화 키 가져오기
    const encryptionKeyHex = await SecureStore.getItemAsync(key);
    if (!encryptionKeyHex) return null;

    // AES-CTR 모드로 데이터 복호화
    const cipher = new aesjs.ModeOfOperation.ctr(
      aesjs.utils.hex.toBytes(encryptionKeyHex),
      new aesjs.Counter(1)
    );
    const decryptedBytes = cipher.decrypt(aesjs.utils.hex.toBytes(value));

    return aesjs.utils.utf8.fromBytes(decryptedBytes);
  }

  async getItem(key) {
    const encrypted = await AsyncStorage.getItem(key);
    if (!encrypted) return null;
    return await this._decrypt(key, encrypted);
  }

  async removeItem(key) {
    await AsyncStorage.removeItem(key);
    await SecureStore.deleteItemAsync(key);
  }

  async setItem(key, value) {
    const encrypted = await this._encrypt(key, value);
    await AsyncStorage.setItem(key, encrypted);
  }
}

// ─────────────────────────────────────────────
// Supabase 프로젝트 설정
//
// 아래 두 값을 Supabase 대시보드에서 복사해서 붙여넣으세요:
// 1. 대시보드 접속: https://supabase.com/dashboard
// 2. 프로젝트 선택 → Settings → API
// 3. "Project URL" → SUPABASE_URL에 입력
// 4. "anon public" 키 → SUPABASE_ANON_KEY에 입력
// ─────────────────────────────────────────────
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: new LargeSecureStore(),  // 세션을 암호화해서 기기에 저장
    autoRefreshToken: true,           // 토큰 만료 전 자동 갱신
    persistSession: true,             // 앱 종료 후에도 로그인 유지
    detectSessionInUrl: false,        // 모바일 앱은 URL 기반 세션 감지 불필요
  },
});
