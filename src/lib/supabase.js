import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─────────────────────────────────────────────────────────────────────────────
// LargeSecureStore — 네이티브(iOS/Android) 전용 암호화 세션 저장소
//
// 왜 이 구조인가요?
//   - expo-secure-store: 가장 안전하지만 데이터 크기 제한 2KB
//   - JWT 토큰: 보통 1~3KB → SecureStore에 직접 저장 불가
//   - 해결책: 256비트 AES 암호화 키만 SecureStore에 보관,
//             실제 데이터는 그 키로 암호화한 뒤 AsyncStorage에 저장
//
// 웹에서는 이 클래스를 사용하지 않습니다 (SecureStore가 웹 미지원)
// ─────────────────────────────────────────────────────────────────────────────

let SecureStore;
let aesjs;

// 네이티브 환경에서만 보안 패키지 로드 (웹 빌드 시 오류 방지)
if (Platform.OS !== 'web') {
  SecureStore = require('expo-secure-store');
  aesjs = require('aes-js');
}

// SecureStore에 보관할 암호화 키의 이름
const ENCRYPTION_KEY_NAME = 'unipas_storage_enc_key';

// 암호화 키 16바이트 → 16진수 문자열 변환 유틸
function bytesToHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}
function hexToBytes(hex) {
  const result = [];
  for (let i = 0; i < hex.length; i += 2) {
    result.push(parseInt(hex.substring(i, i + 2), 16));
  }
  return new Uint8Array(result);
}

class LargeSecureStore {
  // SecureStore에서 AES 키 가져오기. 없으면 신규 생성 후 저장
  async _getEncryptionKey() {
    let keyHex = await SecureStore.getItemAsync(ENCRYPTION_KEY_NAME);
    if (!keyHex) {
      // 256비트(32바이트) 난수 키 생성
      const keyBytes = crypto.getRandomValues(new Uint8Array(32));
      keyHex = bytesToHex(keyBytes);
      await SecureStore.setItemAsync(ENCRYPTION_KEY_NAME, keyHex);
    }
    return hexToBytes(keyHex);
  }

  async getItem(key) {
    const encryptedHex = await AsyncStorage.getItem(key);
    if (!encryptedHex) return null;

    try {
      const encKey = await this._getEncryptionKey();
      const encryptedBytes = hexToBytes(encryptedHex);

      // 첫 16바이트: IV(초기벡터), 이후: 암호화된 데이터
      const iv = encryptedBytes.slice(0, 16);
      const cipherBytes = encryptedBytes.slice(16);

      const aesCbc = new aesjs.ModeOfOperation.cbc(encKey, iv);
      const decryptedBytes = aesCbc.decrypt(cipherBytes);

      // PKCS#7 패딩 제거
      const padLen = decryptedBytes[decryptedBytes.length - 1];
      const plainBytes = decryptedBytes.slice(0, decryptedBytes.length - padLen);

      return aesjs.utils.utf8.fromBytes(plainBytes);
    } catch {
      // 복호화 실패 시 삭제 후 null 반환 (세션 만료 처리됨)
      await AsyncStorage.removeItem(key);
      return null;
    }
  }

  async setItem(key, value) {
    const encKey = await this._getEncryptionKey();

    // 평문 → UTF-8 바이트 변환 후 PKCS#7 패딩 적용
    const plainBytes = aesjs.utils.utf8.toBytes(value);
    const padLen = 16 - (plainBytes.length % 16);
    const paddedBytes = new Uint8Array(plainBytes.length + padLen);
    paddedBytes.set(plainBytes);
    paddedBytes.fill(padLen, plainBytes.length);

    // 랜덤 IV 생성 후 CBC 모드로 암호화
    const iv = crypto.getRandomValues(new Uint8Array(16));
    const aesCbc = new aesjs.ModeOfOperation.cbc(encKey, Array.from(iv));
    const cipherBytes = aesCbc.encrypt(paddedBytes);

    // IV + 암호화 데이터를 합쳐 hex 문자열로 저장
    const combined = new Uint8Array(iv.length + cipherBytes.length);
    combined.set(iv);
    combined.set(cipherBytes, iv.length);
    await AsyncStorage.setItem(key, bytesToHex(combined));
  }

  async removeItem(key) {
    await AsyncStorage.removeItem(key);
  }
}

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
