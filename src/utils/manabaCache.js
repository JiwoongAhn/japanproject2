// manaba 공지 캐시 (홈 화면 미리보기용)
//
// 앱을 켜자마자 인터넷 파싱 전이라도 지난 공지를 즉시 보여주기 위해
// 마지막으로 파싱한 공지를 기기에 저장해 둔다.
// ※ 공지는 민감정보가 아니므로 일반 저장소(AsyncStorage) 사용.
//    (비밀번호/쿠키 같은 민감정보는 LargeSecureStore로 암호화 저장)
import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEY = 'manaba_notices_cache';
// WebView 캐시 공지는 DB에 없어 읽음 추적이 안 되므로, 사용자가 既読(삭제)한
// 공지의 식별자를 따로 저장해 두고 화면에서 가려준다(다시 파싱돼도 안 보이게).
const DISMISS_KEY = 'manaba_dismissed_notices';

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
// 숨김 목록도 함께 비워 다른 계정으로 로그인했을 때 섞이지 않게 한다.
export async function clearCachedNotices() {
  try {
    await AsyncStorage.multiRemove([CACHE_KEY, DISMISS_KEY]);
  } catch {
    // 무시
  }
}

// 공지 1건의 고유 식별자 — WebView 공지는 id가 없으므로 원본 URL(href) 기준,
// href가 없으면 제목+날짜 조합으로 대체한다.
export function noticeKey(notice) {
  if (!notice) return '';
  return notice.href || `${notice.title || ''}|${notice.date || ''}`;
}

// 숨김(既読) 처리된 공지 식별자 목록 읽기 → 문자열 배열
export async function getDismissedKeys() {
  try {
    const raw = await AsyncStorage.getItem(DISMISS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

// 공지 1건을 숨김 목록에 추가 (최근 300개만 유지 — 무한 누적 방지)
export async function addDismissedKey(key) {
  if (!key) return;
  try {
    const cur = await getDismissedKeys();
    if (cur.includes(key)) return;
    const next = [key, ...cur].slice(0, 300);
    await AsyncStorage.setItem(DISMISS_KEY, JSON.stringify(next));
  } catch {
    // 무시
  }
}
