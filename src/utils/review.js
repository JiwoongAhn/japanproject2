// 강의평가 태그 관련 순수 함수
// 테스트 대상: review.test.js

import { supabase } from '../lib/supabase';

// 태그 토글: 이미 있으면 제거, 없으면 추가
// tag: 토글할 태그 문자열
// selectedTags: 현재 선택된 태그 배열
// 반환값: 새 태그 배열
export function toggleTag(tag, selectedTags) {
  return selectedTags.includes(tag)
    ? selectedTags.filter(t => t !== tag)
    : [...selectedTags, tag];
}

// 직접 입력 태그 추가
// tag: 추가할 태그 문자열 (앞뒤 공백 자동 제거)
// selectedTags: 현재 선택된 태그 배열
// 반환값: 새 태그 배열 (조건 미충족 시 원본 배열 그대로 반환)
export function addCustomTag(tag, selectedTags) {
  const trimmed = tag.trim();
  if (!trimmed || selectedTags.includes(trimmed) || selectedTags.length >= 8) {
    return selectedTags;
  }
  return [...selectedTags, trimmed];
}

// ── Supabase 비동기 함수 ────────────────────────────────────────────

// 내가 쓴 강의평가 전체 조회 (마이페이지 "내 글" 탭용)
// userId: 현재 로그인 사용자 UUID
export async function getMyReviews(userId) {
  const { data, error } = await supabase
    .from('course_reviews')
    .select('id, course_name, professor_name, rating, comment, tags, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// 강의평가 수정 (본인 것만 — DB RLS로 2중 보호)
// reviewId: 수정할 리뷰 UUID
// fields: { rating, comment, tags }
export async function updateReview(reviewId, { rating, comment, tags }) {
  const { error } = await supabase
    .from('course_reviews')
    .update({
      rating,
      comment: comment?.trim() || null,
      tags: tags ?? [],
    })
    .eq('id', reviewId);
  if (error) throw error;
}

// 강의평가 삭제 (본인 것만 — DB RLS로 2중 보호)
// reviewId: 삭제할 리뷰 UUID
export async function deleteReview(reviewId) {
  const { error } = await supabase
    .from('course_reviews')
    .delete()
    .eq('id', reviewId);
  if (error) throw error;
}
