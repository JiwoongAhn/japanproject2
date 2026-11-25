// 홈에 무엇을 보여줄지 — 이 폰에만 저장한다 (2026-11-25)
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'home_display_v1';

// timetable: 'today'(오늘 수업 목록) | 'week'(1주일 표) | 'off'
export const HOME_DISPLAY_DEFAULT = { timetable: 'today', shortcuts: true, notices: true, board: true, school: true };
export const TIMETABLE_MODES = ['today', 'week', 'off'];

// 저장된 값이 깨졌거나 옛 버전이어도 안전하게 기본값으로 메운다
export function parseHomeDisplay(raw) {
  let saved = null;
  try { saved = JSON.parse(raw); } catch { /* 깨진 값 = 기본값 */ }
  if (!saved || typeof saved !== 'object') return { ...HOME_DISPLAY_DEFAULT };
  const result = { ...HOME_DISPLAY_DEFAULT };
  if (TIMETABLE_MODES.includes(saved.timetable)) result.timetable = saved.timetable;
  for (const k of ['shortcuts', 'notices', 'board', 'school']) {
    if (typeof saved[k] === 'boolean') result[k] = saved[k];
  }
  return result;
}

// 홈과 マイページ 두 곳에서 바꾸므로, 바뀌면 서로 알려준다
let current = null;
const listeners = new Set();

export async function loadHomeDisplay() {
  if (!current) current = parseHomeDisplay(await AsyncStorage.getItem(KEY).catch(() => null));
  return current;
}

export function setHomeDisplay(patch) {
  current = { ...(current ?? HOME_DISPLAY_DEFAULT), ...patch };
  listeners.forEach((fn) => fn(current));
  AsyncStorage.setItem(KEY, JSON.stringify(current)).catch(() => {});
}

export function subscribeHomeDisplay(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
