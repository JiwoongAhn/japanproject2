// LargeSecureStore 유닛 테스트
// supabase.js에서 export되지 않으므로 클래스와 헬퍼를 직접 정의

// ─── Mock 설정 ────────────────────────────────────────────────────────────────

let mockSecureStoreData = {};

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key) => mockSecureStoreData[key] ?? null),
  setItemAsync: jest.fn(async (key, value) => {
    mockSecureStoreData[key] = value;
  }),
}));

let mockAsyncStorageData = {};

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (key) => mockAsyncStorageData[key] ?? null),
  setItem: jest.fn(async (key, value) => {
    mockAsyncStorageData[key] = value;
  }),
  removeItem: jest.fn(async (key) => {
    delete mockAsyncStorageData[key];
  }),
}));

// aes-js mock: passthrough (encrypt/decrypt 그대로 반환, PKCS#7 패딩 처리)
jest.mock('aes-js', () => ({
  ModeOfOperation: {
    cbc: jest.fn().mockImplementation(() => ({
      encrypt: (bytes) => {
        // PKCS#7 패딩이 이미 붙은 bytes를 그대로 반환
        return Array.from(bytes);
      },
      decrypt: (bytes) => {
        // encrypt와 동일하게 그대로 반환 (패딩 제거는 LargeSecureStore가 담당)
        return Array.from(bytes);
      },
    })),
  },
  utils: {
    utf8: {
      toBytes: (str) => Array.from(new TextEncoder().encode(str)),
      fromBytes: (bytes) => new TextDecoder().decode(new Uint8Array(bytes)),
    },
  },
}));

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

// crypto.getRandomValues mock: 고정된 bytes 반환
global.crypto = {
  getRandomValues: jest.fn((arr) => {
    arr.fill(1); // 모든 바이트를 1로 고정
    return arr;
  }),
};

// ─── 헬퍼 함수 (supabase.js에서 복사) ────────────────────────────────────────

function bytesToHex(bytes) {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBytes(hex) {
  const result = [];
  for (let i = 0; i < hex.length; i += 2) {
    result.push(parseInt(hex.substring(i, i + 2), 16));
  }
  return new Uint8Array(result);
}

// ─── LargeSecureStore 클래스 (supabase.js에서 복사) ──────────────────────────

const SecureStore = require('expo-secure-store');
const AsyncStorage = require('@react-native-async-storage/async-storage');
const aesjs = require('aes-js');

const ENCRYPTION_KEY_NAME = 'supabase_encryption_key';

class LargeSecureStore {
  async _getEncryptionKey() {
    let keyHex = await SecureStore.getItemAsync(ENCRYPTION_KEY_NAME);
    if (!keyHex) {
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
      const iv = encryptedBytes.slice(0, 16);
      const cipherBytes = encryptedBytes.slice(16);
      const aesCbc = new aesjs.ModeOfOperation.cbc(encKey, iv);
      const decryptedBytes = aesCbc.decrypt(cipherBytes);
      const padLen = decryptedBytes[decryptedBytes.length - 1];
      const plainBytes = decryptedBytes.slice(0, decryptedBytes.length - padLen);
      return aesjs.utils.utf8.fromBytes(plainBytes);
    } catch {
      await AsyncStorage.removeItem(key);
      return null;
    }
  }

  async setItem(key, value) {
    const encKey = await this._getEncryptionKey();
    const plainBytes = aesjs.utils.utf8.toBytes(value);
    const padLen = 16 - (plainBytes.length % 16);
    const paddedBytes = new Uint8Array(plainBytes.length + padLen);
    paddedBytes.set(plainBytes);
    paddedBytes.fill(padLen, plainBytes.length);
    const iv = crypto.getRandomValues(new Uint8Array(16));
    const aesCbc = new aesjs.ModeOfOperation.cbc(encKey, Array.from(iv));
    const cipherBytes = aesCbc.encrypt(paddedBytes);
    const combined = new Uint8Array(iv.length + cipherBytes.length);
    combined.set(iv);
    combined.set(cipherBytes, iv.length);
    await AsyncStorage.setItem(key, bytesToHex(combined));
  }

  async removeItem(key) {
    await AsyncStorage.removeItem(key);
  }
}

// ─── 테스트 ───────────────────────────────────────────────────────────────────

describe('LargeSecureStore', () => {
  let store;

  beforeEach(() => {
    mockAsyncStorageData = {};
    mockSecureStoreData = {};
    store = new LargeSecureStore();
    jest.clearAllMocks();
  });

  // L-01: 기본 왕복
  test('L-01: setItem 후 getItem → 동일한 값 반환', async () => {
    await store.setItem('key1', 'v');
    const result = await store.getItem('key1');
    expect(result).toBe('v');
  });

  // L-02: 1500자 긴 문자열 (JWT 길이 시뮬레이션)
  test('L-02: 1500자 긴 문자열 setItem/getItem 왕복', async () => {
    const longValue = 'a'.repeat(1500);
    await store.setItem('key2', longValue);
    const result = await store.getItem('key2');
    expect(result).toBe(longValue);
  });

  // L-03: 유니코드 (한국어/일본어)
  test('L-03: 일본어 유니코드 문자열 setItem/getItem 왕복', async () => {
    await store.setItem('key3', 'テスト値');
    const result = await store.getItem('key3');
    expect(result).toBe('テスト値');
  });

  // L-04: removeItem 후 getItem → null
  test('L-04: setItem 후 removeItem 하면 getItem → null', async () => {
    await store.setItem('key4', 'toDelete');
    await store.removeItem('key4');
    const result = await store.getItem('key4');
    expect(result).toBeNull();
  });

  // L-05: 저장하지 않은 key → null
  test('L-05: 존재하지 않는 key getItem → null', async () => {
    const result = await store.getItem('nonexistent');
    expect(result).toBeNull();
  });

  // L-06: 덮어쓰기
  test('L-06: 같은 key에 두 번 setItem → 최신 값 반환', async () => {
    await store.setItem('key6', 'first');
    await store.setItem('key6', 'second');
    const result = await store.getItem('key6');
    expect(result).toBe('second');
  });

  // L-07: 다른 key에 영향 없음
  test('L-07: keyA 삭제 후 keyB getItem → 여전히 valueB', async () => {
    await store.setItem('keyA', 'valueA');
    await store.setItem('keyB', 'valueB');
    await store.removeItem('keyA');
    const result = await store.getItem('keyB');
    expect(result).toBe('valueB');
  });
});
