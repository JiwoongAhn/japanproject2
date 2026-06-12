-- UGC 안전장치 (App Store 심사 가이드라인 1.2 대응)
-- Why: 사용자 생성 콘텐츠는 신고·차단·자동 모더레이션 수단이 필수.
--      게시글/댓글/수업평가에 서로 다른 3명 이상 신고 시 자동 숨김 + 차단 사용자 콘텐츠 제외.
-- 멱등성: 재실행 안전하도록 IF NOT EXISTS / DROP ... IF EXISTS 사용.

-- ── is_hidden 컬럼 (누적신고 3명 자동숨김 플래그) ──
ALTER TABLE posts          ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE post_comments  ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE course_reviews ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT false;

-- ── 사용자 차단 ──
CREATE TABLE IF NOT EXISTS user_blocks (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (blocker_id, blocked_id)
);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker ON user_blocks(blocker_id);
ALTER TABLE user_blocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "본인 차단 관리" ON user_blocks;
CREATE POLICY "본인 차단 관리" ON user_blocks
  FOR ALL USING (auth.uid() = blocker_id) WITH CHECK (auth.uid() = blocker_id);

-- ── 댓글 신고 (post_reports 패턴 복제) ──
CREATE TABLE IF NOT EXISTS comment_reports (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES post_comments(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason     TEXT NOT NULL CHECK (reason IN ('insult', 'abuse', 'defamation')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (comment_id, user_id)
);
ALTER TABLE comment_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "로그인 사용자 댓글신고 가능" ON comment_reports;
CREATE POLICY "로그인 사용자 댓글신고 가능" ON comment_reports
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "본인 댓글신고 조회" ON comment_reports;
CREATE POLICY "본인 댓글신고 조회" ON comment_reports
  FOR SELECT USING (auth.uid() = user_id);

-- ── 수업평가 신고 (post_reports 패턴 복제) ──
CREATE TABLE IF NOT EXISTS course_review_reports (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id  UUID NOT NULL REFERENCES course_reviews(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason     TEXT NOT NULL CHECK (reason IN ('insult', 'abuse', 'defamation')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (review_id, user_id)
);
ALTER TABLE course_review_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "로그인 사용자 평가신고 가능" ON course_review_reports;
CREATE POLICY "로그인 사용자 평가신고 가능" ON course_review_reports
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "본인 평가신고 조회" ON course_review_reports;
CREATE POLICY "본인 평가신고 조회" ON course_review_reports
  FOR SELECT USING (auth.uid() = user_id);

-- ── 누적신고 자동숨김 트리거: 서로 다른 3명 신고 시 is_hidden=true ──
CREATE OR REPLACE FUNCTION hide_post_on_reports()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF (SELECT count(DISTINCT user_id) FROM post_reports WHERE post_id = NEW.post_id) >= 3 THEN
    UPDATE posts SET is_hidden = true WHERE id = NEW.post_id;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_hide_post ON post_reports;
CREATE TRIGGER trg_hide_post AFTER INSERT ON post_reports
  FOR EACH ROW EXECUTE FUNCTION hide_post_on_reports();

CREATE OR REPLACE FUNCTION hide_comment_on_reports()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF (SELECT count(DISTINCT user_id) FROM comment_reports WHERE comment_id = NEW.comment_id) >= 3 THEN
    UPDATE post_comments SET is_hidden = true WHERE id = NEW.comment_id;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_hide_comment ON comment_reports;
CREATE TRIGGER trg_hide_comment AFTER INSERT ON comment_reports
  FOR EACH ROW EXECUTE FUNCTION hide_comment_on_reports();

CREATE OR REPLACE FUNCTION hide_review_on_reports()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF (SELECT count(DISTINCT user_id) FROM course_review_reports WHERE review_id = NEW.review_id) >= 3 THEN
    UPDATE course_reviews SET is_hidden = true WHERE id = NEW.review_id;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_hide_review ON course_review_reports;
CREATE TRIGGER trg_hide_review AFTER INSERT ON course_review_reports
  FOR EACH ROW EXECUTE FUNCTION hide_review_on_reports();

-- ── SELECT RLS 재정의: 숨김 제외 + 차단 사용자 제외 (본인 콘텐츠는 항상 노출) ──
-- 주의: 세 정책 모두 기존 '같은 학교' 범위를 유지한 채 숨김/차단 필터만 추가.
DROP POLICY IF EXISTS "같은 학교 게시글만 조회" ON posts;
CREATE POLICY "같은 학교 게시글만 조회" ON posts
  FOR SELECT USING (
    university = get_my_university()
    AND (
      auth.uid() = user_id
      OR (
        is_hidden = false
        AND user_id NOT IN (SELECT blocked_id FROM user_blocks WHERE blocker_id = auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "같은 학교 댓글만 조회" ON post_comments;
CREATE POLICY "같은 학교 댓글만 조회" ON post_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM posts
      WHERE posts.id = post_comments.post_id
        AND posts.university = get_my_university()
    )
    AND (
      auth.uid() = user_id
      OR (
        is_hidden = false
        AND user_id NOT IN (SELECT blocked_id FROM user_blocks WHERE blocker_id = auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "같은 학교 강의평가만 조회" ON course_reviews;
CREATE POLICY "같은 학교 강의평가만 조회" ON course_reviews
  FOR SELECT USING (
    university = get_my_university()
    AND (
      auth.uid() = user_id
      OR (
        is_hidden = false
        AND user_id NOT IN (SELECT blocked_id FROM user_blocks WHERE blocker_id = auth.uid())
      )
    )
  );
