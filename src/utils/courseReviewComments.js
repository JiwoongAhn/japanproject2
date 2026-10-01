// 강의평가 댓글 — 데이터 접근 + 입력 검증 순수 함수
// 테스트 대상: __tests__/utils/courseReviewComments.test.js
//
// 게시판 댓글(post_comments)과 같은 규칙을 따른다. 다른 점은 좋아요가 없다는 것뿐이다.
// 권한(같은 학교만/차단 반영/본인만 삭제)은 전부 DB 쪽 RLS 가 담당하므로
// 여기서는 막지 않는다. 클라이언트 검사는 어차피 우회될 수 있어 믿을 수 없다.

import { supabase } from '../lib/supabase';

// 댓글 본문 최대 길이. 게시판 댓글 입력칸과 같은 값으로 맞춘다.
export const COMMENT_MAX_LENGTH = 300;

// 보낼 수 있는 댓글인지 판단하는 순수 함수.
//   text     : 입력칸의 현재 값
//   sending  : 이미 전송 중인가(중복 전송 방지)
// 반환: { ok } | { ok:false, reason:'empty'|'tooLong'|'sending' }
//
// 공백만 입력한 경우를 반드시 걸러야 한다. 눈에는 빈 댓글로 보이는데
// 목록에는 자리를 차지하는 줄이 생겨 버린다.
export function validateComment(text, sending = false) {
  if (sending) return { ok: false, reason: 'sending' };
  const body = (text ?? '').trim();
  if (!body) return { ok: false, reason: 'empty' };
  if (body.length > COMMENT_MAX_LENGTH) return { ok: false, reason: 'tooLong' };
  return { ok: true, body };
}

// 여러 평가의 댓글을 한 번에 가져온다.
// 평가마다 따로 조회하면 평가 수만큼 요청이 나가므로(N+1) 한 번에 받아 묶는다.
//   reviewIds : 평가 id 배열
// 반환: { [reviewId]: [댓글...] } — 댓글이 없는 평가는 키 자체가 없다
export async function fetchCommentsByReviewIds(reviewIds) {
  if (!Array.isArray(reviewIds) || reviewIds.length === 0) return {};
  const { data, error } = await supabase
    .from('course_review_comments')
    .select('*')
    .in('review_id', reviewIds)
    .order('created_at', { ascending: true }); // 대화 순서대로 위에서 아래로
  if (error) throw error;
  return groupByReviewId(data ?? []);
}

// 조회 결과를 평가별로 묶는 순수 함수(테스트 대상).
export function groupByReviewId(rows) {
  const map = {};
  for (const row of rows ?? []) {
    if (!row?.review_id) continue;
    if (!map[row.review_id]) map[row.review_id] = [];
    map[row.review_id].push(row);
  }
  return map;
}

// 댓글 작성. 성공하면 만들어진 행을 돌려준다(목록에 바로 끼워 넣기 위해).
export async function addComment(reviewId, body) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('auth');
  const { data, error } = await supabase
    .from('course_review_comments')
    .insert({ review_id: reviewId, user_id: user.id, body })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// 댓글 삭제(본인 것만 — 실제 제한은 RLS 가 건다)
export async function deleteComment(commentId) {
  const { error } = await supabase
    .from('course_review_comments')
    .delete()
    .eq('id', commentId);
  if (error) throw error;
}
