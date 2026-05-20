// manaba 공지 캐시 (홈 화면 미리보기용)
//
// 앱을 켜자마자 인터넷 파싱 전이라도 지난 공지를 즉시 보여주기 위해
// 마지막으로 파싱한 공지를 기기에 저장해 둔다.
// ※ 공지는 민감정보가 아니므로 일반 저장소(AsyncStorage) 사용.
//    (비밀번호/쿠키 같은 민감정보는 LargeSecureStore로 암호화 저장)
import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEY = 'manaba_notices_cache';

// 캐시된 공지 읽기 → { notices: [...], fetchedAt: <ms> } 또는 null
export async function getCachedNotices() {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.notices)) return null;
    return parsed;
  } catch {
    return null;
  }
}

// 공지 저장 (파싱 시각과 함께)
export async function setCachedNotices(notices) {
  try {
    const payload = { notices: notices || [], fetchedAt: Date.now() };
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    // 저장 실패는 조용히 무시 (캐시는 보조 수단)
  }
}

// 캐시 삭제 (manaba 로그아웃 시 홈 카드를 로그아웃 상태로 되돌리기 위함)
export async function clearCachedNotices() {
  try {
    await AsyncStorage.removeItem(CACHE_KEY);
  } catch {
    // 무시
  }
}
