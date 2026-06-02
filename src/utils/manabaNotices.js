// manaba 푸시 공지(manaba_notices 테이블) 접근 유틸
// Phase 3: ms-graph-webhook이 적재한 메일 기반 공지를 홈 화면에 노출/읽음 처리
// 테스트 대상: manabaNotices.test.js

import { supabase } from '../lib/supabase';

// 안 읽은 공지 목록 조회 (최신순)
// userId: auth.users.id (uuid)
// limit: 가져올 최대 개수 (기본 20)
// 반환값: manaba_notices 행 배열. 실패 시 빈 배열
export async function fetchUnreadNotices(userId, limit = 20) {
  if (!userId) return [];

  const { data, error } = await supabase
    .from('manaba_notices')
    .select('id, subject, sender, received_at, notice_url, course_hint, body_html')
    .eq('user_id', userId)
    .eq('is_read', false)
    .order('received_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[manabaNotices] fetchUnread 실패:', error.message);
    return [];
  }
  return data ?? [];
}

// 안 읽은 공지 개수만 조회 (배지 표시용 — body_html 페이로드 절약)
// userId: auth.users.id
// 반환값: 개수 (실패 시 0)
export async function countUnreadNotices(userId) {
  if (!userId) return 0;

  const { count, error } = await supabase
    .from('manaba_notices')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) {
    console.error('[manabaNotices] countUnread 실패:', error.message);
    return 0;
  }
  return count ?? 0;
}

// 단일 공지를 읽음 처리
// noticeId: manaba_notices.id
// 반환값: 성공 여부
export async function markNoticeAsRead(noticeId) {
  if (!noticeId) return false;

  const { error } = await supabase
    .from('manaba_notices')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('id', noticeId)
    .eq('is_read', false); // 이미 읽음이면 read_at 덮어쓰지 않음

  if (error) {
    console.error('[manabaNotices] markAsRead 실패:', error.message);
    return false;
  }
  return true;
}

// 해당 사용자의 안 읽은 공지를 한 번에 모두 읽음 처리 ("全て既読にする")
// userId: auth.users.id
// 반환값: 성공 여부
export async function markAllAsRead(userId) {
  if (!userId) return false;

  const { error } = await supabase
    .from('manaba_notices')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) {
    console.error('[manabaNotices] markAllAsRead 실패:', error.message);
    return false;
  }
  return true;
}
