-- ────────────────────────────────────────────────────────────
-- post_bookmarks: 게시글 북마크(관심글 저장)
--   좋아요(post_likes)와 달리 "본인만" 조회 가능한 프라이빗 저장함.
--   같은 (post_id, user_id)는 UNIQUE로 중복 저장 방지.
--   원글 삭제 시 ON DELETE CASCADE로 북마크도 자동 정리.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS post_bookmarks (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);

ALTER TABLE post_bookmarks ENABLE ROW LEVEL SECURITY;

-- 본인 북마크만 조회/추가/삭제 가능 (프라이빗)
CREATE POLICY "본인 북마크만 조회" ON post_bookmarks
  FOR SELECT USING ((select auth.uid()) = user_id);
CREATE POLICY "본인만 북마크 추가" ON post_bookmarks
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "본인만 북마크 삭제" ON post_bookmarks
  FOR DELETE USING ((select auth.uid()) = user_id);

CREATE INDEX IF NOT EXISTS idx_post_bookmarks_user_id ON post_bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_post_bookmarks_post_id ON post_bookmarks(post_id);
