import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from '../lib/supabase';

const BUCKET = 'post-images';
const MAX_WIDTH = 1920;
const COMPRESS_QUALITY = 0.85;

// 갤러리 권한 요청 → 권한 있으면 true
export async function ensureMediaLibraryPermission() {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return status === 'granted';
}

// 갤러리에서 이미지 1장 선택 → 리사이즈+압축 후 로컬 URI 반환
// EXIF 메타데이터는 ImageManipulator가 재인코딩하면서 자동 제거됨
export async function pickAndProcessImage() {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 1,
    allowsMultipleSelection: false,
  });

  if (result.canceled || !result.assets?.[0]) return null;

  const asset = result.assets[0];

  // 1920px 이하로 리사이즈 + JPEG 85% 압축 (EXIF 제거 효과)
  const processed = await ImageManipulator.manipulateAsync(
    asset.uri,
    asset.width > MAX_WIDTH ? [{ resize: { width: MAX_WIDTH } }] : [],
    {
      compress: COMPRESS_QUALITY,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    }
  );

  return processed; // { uri, width, height, base64 }
}

// base64 문자열 → ArrayBuffer (Supabase Storage 업로드용)
function base64ToArrayBuffer(base64) {
  const binary = global.atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

// 처리된 이미지를 Supabase Storage에 업로드 → public URL 반환
export async function uploadImageToStorage(processedImage, userId) {
  if (!processedImage?.base64) throw new Error('image base64 missing');

  const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
  const path = `${userId}/${fileName}`;
  const arrayBuffer = base64ToArrayBuffer(processedImage.base64);

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, arrayBuffer, {
      contentType: 'image/jpeg',
      upsert: false,
    });

  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

// public URL에서 Storage 경로 추출 (삭제용)
export function extractStoragePathFromUrl(publicUrl) {
  const marker = `/${BUCKET}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return null;
  return publicUrl.slice(idx + marker.length);
}

// 여러 이미지를 Storage에서 삭제
export async function deleteImagesFromStorage(publicUrls) {
  const paths = publicUrls
    .map(extractStoragePathFromUrl)
    .filter(Boolean);
  if (paths.length === 0) return;
  await supabase.storage.from(BUCKET).remove(paths);
}
