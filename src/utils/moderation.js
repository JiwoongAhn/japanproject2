// UGC 안전장치: 신고/차단 헬퍼 (PostDetail·CourseReviewDetail 공용)
// supabase 호출이 있어 community.js(순수함수)와 분리한다.
import { supabase } from '../lib/supabase';

// 콘텐츠 신고. 예: reportContent('comment_reports', 'comment_id', id, 'abuse')
// 반환: { ok } | { ok:false, already } | { ok:false, error }
export async function reportContent(table, idColumn, contentId, reason) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'auth' };
  const { error } = await supabase
    .from(table)
    .insert({ [idColumn]: contentId, user_id: user.id, reason });
  if (error) {
    if (error.code === '23505') return { ok: false, already: true };
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

// 「이 글/댓글을 쓴 사람」 차단 (2026-11-18 보안 A1)
//   익명 작성자의 ID 는 앱에 오지 않으므로, 글 ID 를 넘기면 서버(block_author)가 작성자를 찾아 차단한다.
//   kind: 'post' | 'post_comment' | 'review' | 'review_comment'
//   중복(이미 차단)은 성공 취급. 본인 글은 'self'.
export async function blockAuthor(kind, contentId) {
  if (!contentId) return { ok: false, error: 'not_found' };
  const { data, error } = await supabase.rpc('block_author', { p_kind: kind, p_id: contentId });
  if (error) return { ok: false, error: error.message };
  if (data === 'ok') return { ok: true };
  return { ok: false, error: data ?? 'unknown' };
}
