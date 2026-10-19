// AI 시간표 읽기 — 서버 호출·사진 준비 (부수효과가 있어 순수 함수와 분리)
//
// 서버 = Supabase Edge Function `parse-timetable` (Claude 로 시간표를 읽는다)
// 결과 정리·학기 분리는 utils/aiTimetable.js 의 순수 함수가 맡는다.
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from '../lib/supabase';
import { normalizeAiCourses, cleanPageHtml } from './aiTimetable';

const MAX_IMAGES = 3;
const IMAGE_MAX_WIDTH = 1600; // 시간표 글자를 읽기에 충분하고, 서버 한도(약 1.5MB) 안에 들어온다
const FALLBACK_ERROR = '読み取りに失敗しました。もう一度お試しください';

// 서버 호출 → { parsed, unparsed } (학기 분리 전 전체)
// input: { page?: 원본 HTML, text?: 붙여넣은 글, images?: [{mediaType, data}] }, universityName
export async function requestAiTimetable({ page, text, images, universityName } = {}) {
  const body = { universityName };
  if (page) body.page = cleanPageHtml(page);
  if (text) body.text = text;
  if (images?.length) body.images = images;

  const { data, error } = await supabase.functions.invoke('parse-timetable', { body });
  if (error) {
    // 함수가 4xx/5xx 를 돌려주면 서버의 일본어 안내가 응답 본문에 있다
    let message = FALLBACK_ERROR;
    try {
      const res = await error.context?.json?.();
      if (res?.error) message = res.error;
    } catch {
      // 본문이 JSON 이 아니면 기본 안내 문구 사용
    }
    throw new Error(message);
  }
  return normalizeAiCourses(data?.courses);
}

// 사진첩에서 시간표 스크린샷 최대 3장 → 축소·JPEG 압축한 base64 (null = 취소)
export async function pickTimetableImages() {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (perm.status !== 'granted') {
    throw new Error('写真へのアクセスを許可してください（設定アプリ → UniOne → 写真）');
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 1,
    allowsMultipleSelection: true,
    selectionLimit: MAX_IMAGES,
    orderedSelection: true,
  });
  if (result.canceled || !result.assets?.length) return null;

  const images = [];
  for (const asset of result.assets.slice(0, MAX_IMAGES)) {
    const processed = await ImageManipulator.manipulateAsync(
      asset.uri,
      asset.width > IMAGE_MAX_WIDTH ? [{ resize: { width: IMAGE_MAX_WIDTH } }] : [],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true },
    );
    images.push({ mediaType: 'image/jpeg', data: processed.base64 });
  }
  return images;
}
