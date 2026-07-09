// 게시글 북마크(관심글 저장) 데이터 접근 함수 모음.
// post_bookmarks 테이블 사용 (본인 행만 RLS로 접근 가능).
import { supabase } from '../lib/supabase';

// 특정 글이 내 북마크에 있는지 여부
export async function isBookmarked(postId, userId) {
  if (!postId || !userId) return false;
  const { data } = await supabase
    .from('post_bookmarks')
    .select('id')
    .eq('post_id', postId)
    .eq('user_id', userId)
    .maybeSingle();
  return !!data;
}

// 북마크 추가 (중복은 UNIQUE 제약 + upsert로 무해 처리)
export async function addBookmark(postId, userId) {
  const { error } = await supabase
    .from('post_bookmarks')
    .upsert({ post_id: postId, user_id: userId }, { onConflict: 'post_id,user_id' });
  return !error;
}

// 북마크 해제
export async function removeBookmark(postId, userId) {
  const { error } = await supabase
    .from('post_bookmarks')
    .delete()
    .eq('post_id', postId)
    .eq('user_id', userId);
  return !error;
}

// 내가 저장한 글 목록 (원글 조인). 삭제·숨김된 글은 제외.
// 반환: posts 형태 배열 + bookmarked_at 필드
export async function getMyBookmarkedPosts(userId) {
  if (!userId) return [];
  const { data } = await supabase
    .from('post_bookmarks')
    .select(
      'post_id, created_at, posts(id, title, category, body, created_at, like_count, is_hidden, post_comments(count))'
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  return (data ?? [])
    .filter((b) => b.posts && !b.posts.is_hidden)
    .map((b) => ({ ...b.posts, bookmarked_at: b.created_at }));
}
