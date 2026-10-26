// ─────────────────────────────────────────────────────────────────────────────
// LargeSecureStore — 네이티브(iOS/Android) 전용 암호화 저장소 (로그인 세션·학교 쿠키·ID/PW)
//
// 구조:
//   - expo-secure-store(아이폰 키체인 / 안드로이드 키스토어)는 2KB 제한 → 로그인 토큰(1~3KB)을 직접 못 넣는다
//   - 그래서 256비트 AES 키만 SecureStore 에 두고, 실제 데이터는 그 키로 암호화해 AsyncStorage 에 저장
//
// ⚠️ 2026-10-26 "잘 쓰다가 대학 선택 화면으로 돌아감"(아이폰) 원인과 대책:
//   1) 키체인 기본 설정(WHEN_UNLOCKED)은 "폰이 잠겨 있으면 못 읽음". 잠금 중에 앱이 잠깐 돌면
//      (알림 수신·잠금 직후 등) 키 읽기가 실패하는데, 예전 코드는 이를 "데이터가 망가짐"으로 보고
//      로그인 정보를 지웠다 → 다음 실행에 로그아웃.
//      → 읽기 실패는 절대 지우지 않는다. 몇 번 다시 해 보고, 그래도 안 되면 "못 읽음"을 기록하고 null.
//        (오류를 던지면 Supabase 내부에서 처리되지 않은 오류가 생겨서, 던지지 않고 기록으로 알린다)
//        AuthProvider 는 hadKeychainReadFailure() 로 이를 보고 로그아웃 대신 기다렸다 다시 확인한다.
//        데이터는 그대로 → 잠금이 풀린 뒤 다시 읽으면 복원된다.
//   2) 키를 "처음 한 번 잠금 해제한 뒤엔 읽을 수 있음"(AFTER_FIRST_UNLOCK)으로 새 이름(v2)에 복사해 쓴다.
//      옛 키(v1)는 지우지 않는다 — 옮기는 도중 앱이 꺼져도 키를 잃지 않게.
//   3) 처음 설치 직후 세션·쿠키 저장이 동시에 일어나면 키가 두 개 만들어져(나중 것이 덮어씀)
//      먼저 저장한 데이터를 못 푸는 경우가 있었다 → 키 읽기·만들기를 한 줄로 세우고(잠금), 한 번 읽은 키는 기억한다.
//   4) 복호화 결과가 이상하면(다른 키로 잠긴 데이터 등) 쓰레기 문자열 대신 null — Supabase 가 쓰레기를
//      "잘못된 세션"으로 보고 지우는 일을 막는다.
//
// 테스트: __tests__/lib/largeSecureStore.test.js (키체인 잠김·동시 생성·옛 키 이전을 재현)
// ─────────────────────────────────────────────────────────────────────────────

export const KEY_NAME_V1 = 'unipas_storage_enc_key';
export const KEY_NAME_V2 = 'unipas_storage_enc_key_v2';
const READ_RETRY_DELAYS_MS = [250, 750];

export class KeychainUnavailableError extends Error {
  constructor(cause) {
    super('Secure key storage is temporarily unavailable');
    this.name = 'KeychainUnavailableError';
    this.cause = cause;
  }
}

function bytesToHex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}
function hexToBytes(hex) {
  const result = [];
  for (let i = 0; i < hex.length; i += 2) {
    result.push(parseInt(hex.substring(i, i + 2), 16));
  }
  return new Uint8Array(result);
}

// 모든 LargeSecureStore 인스턴스(세션용·쿠키용)가 같은 키를 쓰므로, 기억·잠금도 공유한다
function createKeyState() {
  return { key: null, lock: Promise.resolve(), readFailed: false };
}
const SHARED_KEY_STATE = createKeyState();

// 마지막 확인 이후 "키체인을 못 읽어서 저장된 값을 null 로 돌려준 적"이 있는가 (읽으면 기록을 지운다)
export function consumeKeychainReadFailure(state = SHARED_KEY_STATE) {
  const failed = !!state.readFailed;
  state.readFailed = false;
  return failed;
}

function defaultDeps() {
  return {
    secureStore: require('expo-secure-store'),
    storage: (() => {
      const m = require('@react-native-async-storage/async-storage');
      return m.default ?? m;
    })(),
    aes: (() => {
      const m = require('aes-js');
      return m.default ?? m;
    })(),
    randomBytes: (n) => crypto.getRandomValues(new Uint8Array(n)),
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    keyState: SHARED_KEY_STATE,
  };
}

export class LargeSecureStore {
  constructor(deps) {
    this.d = deps ? { keyState: createKeyState(), sleep: async () => {}, ...deps } : null;
  }

  // 이 저장소가 쓰는 공유 상태 기준으로 "못 읽음" 기록 확인(테스트용 — 앱은 consumeKeychainReadFailure())
  consumeReadFailure() {
    return consumeKeychainReadFailure(this.deps.keyState);
  }

  // 네이티브 모듈은 실제로 쓸 때 불러온다(웹·테스트에서 import 만으로 깨지지 않게)
  get deps() {
    if (!this.d) this.d = defaultDeps();
    return this.d;
  }

  _keyOptions() {
    const ss = this.deps.secureStore;
    return { keychainAccessible: ss.AFTER_FIRST_UNLOCK };
  }

  // 키체인 읽기 — 잠김 등으로 실패하면 잠깐 기다렸다 다시. 끝내 실패하면 KeychainUnavailableError
  async _readKeyHex() {
    const { secureStore: ss, sleep } = this.deps;
    let lastError;
    for (let attempt = 0; attempt <= READ_RETRY_DELAYS_MS.length; attempt += 1) {
      try {
        let hex = await ss.getItemAsync(KEY_NAME_V2, this._keyOptions());
        if (!hex) {
          hex = await ss.getItemAsync(KEY_NAME_V1);
          if (hex) {
            // 옛 키를 잠금 중에도 읽히는 설정으로 복사 (실패해도 다음에 다시 — 옛 키는 남겨 둔다)
            try { await ss.setItemAsync(KEY_NAME_V2, hex, this._keyOptions()); } catch (_) {}
          }
        }
        return hex ?? null;
      } catch (e) {
        lastError = e;
        if (attempt < READ_RETRY_DELAYS_MS.length) await sleep(READ_RETRY_DELAYS_MS[attempt]);
      }
    }
    throw new KeychainUnavailableError(lastError);
  }

  // 키 가져오기. create=true 면 없을 때 새로 만든다(저장할 때만). 읽기·만들기는 한 줄로 처리한다
  async _getKey(create) {
    const state = this.deps.keyState;
    if (state.key) return state.key;
    const run = state.lock.then(async () => {
      if (state.key) return state.key;
      const hex = await this._readKeyHex();
      if (hex) {
        state.key = hexToBytes(hex);
        return state.key;
      }
      if (!create) return null;
      const newHex = bytesToHex(this.deps.randomBytes(32));
      await this.deps.secureStore.setItemAsync(KEY_NAME_V2, newHex, this._keyOptions());
      state.key = hexToBytes(newHex);
      return state.key;
    });
    state.lock = run.catch(() => {});
    return run;
  }

  // 복호화 — 패딩이 맞지 않거나 글자가 깨지면 null (쓰레기 값을 돌려주지 않는다)
  _decrypt(keyBytes, encryptedHex) {
    const { aes } = this.deps;
    try {
      const bytes = hexToBytes(encryptedHex);
      if (bytes.length < 32 || bytes.length % 16 !== 0) return null;
      const iv = bytes.slice(0, 16);
      const cipher = bytes.slice(16);
      const plain = new aes.ModeOfOperation.cbc(keyBytes, iv).decrypt(cipher);
      const padLen = plain[plain.length - 1];
      if (padLen < 1 || padLen > 16) return null;
      for (let i = plain.length - padLen; i < plain.length; i += 1) {
        if (plain[i] !== padLen) return null;
      }
      const text = aes.utils.utf8.fromBytes(plain.slice(0, plain.length - padLen));
      if (text.includes('�')) return null;
      return text;
    } catch (_) {
      return null;
    }
  }

  async getItem(key) {
    const encryptedHex = await this.deps.storage.getItem(key);
    if (!encryptedHex) return null;
    let encKey;
    try {
      encKey = await this._getKey(false);
    } catch (e) {
      if (!(e instanceof KeychainUnavailableError)) throw e;
      // 키체인 잠김 → 데이터는 지우지 않고, "못 읽음"만 기록한 뒤 null
      this.deps.keyState.readFailed = true;
      return null;
    }
    if (!encKey) return null; // 키 자체가 없음(복구 불가) — 그래도 지우지는 않는다(새 로그인이 덮어쓴다)
    return this._decrypt(encKey, encryptedHex);
  }

  async setItem(key, value) {
    const { aes, storage, randomBytes } = this.deps;
    const encKey = await this._getKey(true);

    // 평문 → UTF-8 바이트 + PKCS#7 패딩 → 랜덤 IV 로 CBC 암호화 → IV+암호문 hex 로 저장
    const plainBytes = aes.utils.utf8.toBytes(value);
    const padLen = 16 - (plainBytes.length % 16);
    const padded = new Uint8Array(plainBytes.length + padLen);
    padded.set(plainBytes);
    padded.fill(padLen, plainBytes.length);
    const iv = randomBytes(16);
    const cipherBytes = new aes.ModeOfOperation.cbc(encKey, Array.from(iv)).encrypt(padded);
    const combined = new Uint8Array(iv.length + cipherBytes.length);
    combined.set(iv);
    combined.set(cipherBytes, iv.length);
    await storage.setItem(key, bytesToHex(combined));
  }

  async removeItem(key) {
    await this.deps.storage.removeItem(key);
  }
}
