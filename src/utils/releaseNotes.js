// 업데이트 뒤 처음 켰을 때 「新しくなりました」 창을 띄울지 (순수 함수 + 폰에 기억)
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'release_note_seen';

// 띄울 항목을 돌려준다 (없으면 null)
//   - 이미 본 id 면 안 띄움
//   - 배포일 이후에 가입한 사람은 처음부터 새 기능을 쓰는 것이므로 안 띄움
export function pickReleaseNote(notes, lastSeenId, userCreatedAt) {
  const latest = notes.find((n) => n.popup);
  if (!latest || latest.id === lastSeenId) return null;
  const created = userCreatedAt ? new Date(userCreatedAt).getTime() : NaN;
  if (!Number.isFinite(created)) return null;
  return created < new Date(`${latest.releasedAt}T00:00:00+09:00`).getTime() ? latest : null;
}

export const getSeenReleaseId = () => AsyncStorage.getItem(KEY).catch(() => null);
export const markReleaseSeen = (id) => AsyncStorage.setItem(KEY, id).catch(() => {});
