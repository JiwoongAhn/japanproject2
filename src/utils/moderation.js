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

// 사용자 차단. 중복(이미 차단)은 성공 취급. 본인은 차단 불가.
export async function blockUser(blockedId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'auth' };
  if (user.id === blockedId) return { ok: false, error: 'self' };
  const { error } = await supabase
    .from('user_blocks')
    .insert({ blocker_id: user.id, blocked_id: blockedId });
  if (error && error.code !== '23505') return { ok: false, error: error.message };
  return { ok: true };
}
