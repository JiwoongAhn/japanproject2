-- ============================================================
-- Unipas 데이터베이스 스키마
-- ============================================================
-- 사용법:
--   1. https://supabase.com/dashboard 접속
--   2. 프로젝트 선택 → SQL Editor
--   3. 이 파일 내용 전체 복사 → 붙여넣기 → Run
-- ============================================================


-- ──────────────────────────────────────────────
-- 0. 기존 트리거/함수 정리 (재실행 시 충돌 방지)
-- ──────────────────────────────────────────────
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();
DROP TABLE IF EXISTS mail_subscriptions;
DROP TABLE IF EXISTS manaba_notices;
DROP TABLE IF EXISTS push_tokens;
DROP TABLE IF EXISTS post_reports;
DROP TABLE IF EXISTS post_comments;
DROP TABLE IF EXISTS posts;
DROP TABLE IF EXISTS course_reviews;
DROP TABLE IF EXISTS assignments;
DROP TABLE IF EXISTS courses;
DROP TABLE IF EXISTS profiles;

-- ──────────────────────────────────────────────
-- 1. profiles 테이블
--    역할: 로그인한 사용자의 앱 전용 정보 저장
--    (Supabase의 기본 auth.users와 1:1 연결)
-- ──────────────────────────────────────────────
CREATE TABLE profiles (
  id               UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  -- auth.users의 id와 연결. 회원 탈퇴 시 자동 삭제
  university       TEXT NOT NULL DEFAULT '国士舘大学',
  -- 소속 대학교 이름
  nickname         TEXT UNIQUE,
  -- 공강맞추기에서 친구 ID로 사용하는 닉네임 (이메일 @ 앞부분 자동 생성)
  share_timetable  BOOLEAN NOT NULL DEFAULT false,
  -- 공강맞추기 공개 설정: true이면 다른 사용자가 시간표 조회 가능
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 새 회원가입 시 profiles 행을 자동으로 생성하는 트리거
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;  -- 중복 실행 시 무시
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- ──────────────────────────────────────────────
-- 2. courses 테이블
--    역할: 사용자의 시간표 수업 정보 저장
-- ──────────────────────────────────────────────
CREATE TABLE courses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- 이 수업을 등록한 사용자 (탈퇴 시 수업도 자동 삭제)
  name            TEXT NOT NULL,
  -- 과목명 (예: 経営学概論)
  day_of_week     SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 4),
  -- 요일: 0=월, 1=화, 2=수, 3=목, 4=금
  period          SMALLINT NOT NULL CHECK (period BETWEEN 1 AND 8),
  -- 교시: 1교시 ~ 8교시
  professor_name  TEXT,
  -- 담당 교수명 (선택 입력)
  color_index     SMALLINT,
  -- 사용자가 고른 색상 인덱스 (COURSE_COLORS 0~6). NULL이면 id 기반 자동 색 사용
  memo            TEXT,
  -- 간단 메모 (선택 입력, 최대 100자)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ──────────────────────────────────────────────
-- 3. assignments 테이블
--    역할: 과제 목록 및 제출 상태 저장
-- ──────────────────────────────────────────────
CREATE TABLE assignments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- 이 과제를 등록한 사용자
  course_id   UUID REFERENCES courses(id) ON DELETE SET NULL,
  -- 연결된 수업 (수업 삭제 시 과제는 남고 course_id만 NULL로 변경)
  title       TEXT NOT NULL,
  -- 과제 제목
  due_date    DATE NOT NULL,
  -- 마감일 (예: 2026-05-01)
  status      TEXT NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'submitted', 'overdue')),
  -- 상태: pending=미제출, submitted=제출완료, overdue=기한초과
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ──────────────────────────────────────────────
-- 4. RLS (Row Level Security) 설정
--    역할: 각 사용자가 자신의 데이터만 읽고 쓸 수 있도록 보안 설정
--    (없으면 모든 사용자가 모든 데이터를 볼 수 있음)
-- ──────────────────────────────────────────────

-- profiles RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "닉네임으로 다른 프로필 조회 가능" ON profiles
  FOR SELECT USING (auth.uid() IS NOT NULL);
  -- 인증된 사용자라면 누구든 프로필 조회 가능 (공강맞추기 친구 검색용)

CREATE POLICY "본인 프로필만 수정 가능" ON profiles
  FOR UPDATE USING (auth.uid() = id);


-- courses RLS
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "시간표 opt-in 공유" ON courses
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = courses.user_id
        AND profiles.share_timetable = true
    )
  );
  -- 자신의 시간표는 항상 조회 가능
  -- 타인의 시간표는 share_timetable = true 인 경우에만 조회 가능 (opt-in)

CREATE POLICY "본인 수업만 추가 가능" ON courses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "본인 수업만 수정 가능" ON courses
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
  -- USING: 본인 행만 수정 대상으로 선택 / WITH CHECK: 수정 후에도 user_id가 본인이어야 함

CREATE POLICY "본인 수업만 삭제 가능" ON courses
  FOR DELETE USING (auth.uid() = user_id);


-- assignments RLS
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "본인 과제만 조회 가능" ON assignments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "본인 과제만 추가 가능" ON assignments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "본인 과제만 수정 가능" ON assignments
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "본인 과제만 삭제 가능" ON assignments
  FOR DELETE USING (auth.uid() = user_id);


-- ──────────────────────────────────────────────
-- 5. posts 테이블
--    역할: 게시판 글 저장 (익명 포함)
--    category: 'qa'=質問, 'free'=フリー, 'flea'=フリマ
-- ──────────────────────────────────────────────
CREATE TABLE posts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  university   TEXT NOT NULL,                -- 작성자 대학 (학교별 게시판 분리용)
  category     TEXT NOT NULL CHECK (category IN ('qa', 'free', 'secret', 'info')),
  title        TEXT NOT NULL,
  body         TEXT,
  image_urls   TEXT[] DEFAULT '{}',          -- 첨부 이미지 URL 배열
  is_anonymous BOOLEAN NOT NULL DEFAULT true,
  like_count   INTEGER NOT NULL DEFAULT 0,
  is_hidden    BOOLEAN NOT NULL DEFAULT false,   -- 누적신고(3명) 자동숨김
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- 현재 로그인 사용자의 대학 이름 반환 (RLS 정책에서 학교 비교에 사용)
-- SECURITY DEFINER: profiles 정책에 영향받지 않고 안전하게 조회
CREATE OR REPLACE FUNCTION get_my_university()
RETURNS TEXT LANGUAGE sql SECURITY DEFINER AS $$
  SELECT university FROM profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- 게시판은 학교 단위로 분리: 본인 대학 게시글만 조회/작성 가능
CREATE POLICY "같은 학교 게시글만 조회" ON posts
  FOR SELECT USING (university = get_my_university());

CREATE POLICY "같은 학교 게시글만 작성" ON posts
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND university = get_my_university()
  );

CREATE POLICY "본인만 게시글 수정 가능" ON posts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "본인만 게시글 삭제 가능" ON posts
  FOR DELETE USING (auth.uid() = user_id);


-- ──────────────────────────────────────────────
-- 6. post_comments 테이블
--    역할: 게시글 댓글 저장
-- ──────────────────────────────────────────────
CREATE TABLE post_comments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id      UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body         TEXT NOT NULL,
  is_anonymous BOOLEAN NOT NULL DEFAULT true,
  is_hidden    BOOLEAN NOT NULL DEFAULT false,   -- 누적신고(3명) 자동숨김
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;

-- 댓글도 학교 단위로 분리: 같은 학교 게시글의 댓글만 조회/작성 가능
CREATE POLICY "같은 학교 댓글만 조회" ON post_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM posts
      WHERE posts.id = post_comments.post_id
        AND posts.university = get_my_university()
    )
  );

CREATE POLICY "같은 학교 게시글에만 댓글 작성" ON post_comments
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM posts
      WHERE posts.id = post_comments.post_id
        AND posts.university = get_my_university()
    )
  );

CREATE POLICY "본인만 댓글 삭제 가능" ON post_comments
  FOR DELETE USING (auth.uid() = user_id);


-- ──────────────────────────────────────────────
-- 7. course_reviews 테이블
--    역할: 강의평가 저장
--    rating: 1~5점 별점
-- ──────────────────────────────────────────────
CREATE TABLE course_reviews (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_name    TEXT NOT NULL,
  professor_name TEXT,
  rating         SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment        TEXT,
  tags           TEXT[] DEFAULT '{}',
  is_hidden      BOOLEAN NOT NULL DEFAULT false,   -- 누적신고(3명) 자동숨김
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE course_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "로그인 사용자 강의평가 조회 가능" ON course_reviews
  FOR SELECT USING (auth.role() = 'authenticated');


-- ──────────────────────────────────────────────
-- 8. increment_like RPC 함수
--    역할: 좋아요 카운트 증가 (RLS 우회 목적 — SECURITY DEFINER)
--    Posts 테이블의 UPDATE RLS는 본인만 허용하므로,
--    타인의 게시글에 좋아요를 누를 수 있도록 RPC로 처리
-- ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION increment_like(post_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE posts SET like_count = like_count + 1 WHERE id = post_id;
END;
$$;


-- ──────────────────────────────────────────────
-- 9. post_reports 테이블
--    역할: 게시글 신고 저장 (익명/실명 게시글 모두 신고 가능)
--    reason: 'insult'=侮辱, 'abuse'=暴言, 'defamation'=誹謗中傷
-- ──────────────────────────────────────────────
CREATE TABLE post_reports (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason     TEXT NOT NULL CHECK (reason IN ('insult', 'abuse', 'defamation')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (post_id, user_id)
  -- 같은 사용자가 같은 게시글을 중복 신고할 수 없음
);

ALTER TABLE post_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "로그인 사용자 신고 가능" ON post_reports
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "본인 신고 내역 조회" ON post_reports
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "본인만 강의평가 작성 가능" ON course_reviews
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "본인만 강의평가 수정 가능" ON course_reviews
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "본인만 강의평가 삭제 가능" ON course_reviews
  FOR DELETE USING (auth.uid() = user_id);


-- ──────────────────────────────────────────────
-- 10. push_tokens 테이블 (Phase 3)
--    역할: 디바이스별 Expo Push Token 저장 (푸시 알림 발송용)
-- ──────────────────────────────────────────────
CREATE TABLE push_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expo_token  TEXT NOT NULL UNIQUE,
  -- Expo Push Token (ExponentPushToken[...] 형식). 디바이스 고유값
  platform    TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "본인 토큰 조회" ON push_tokens
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "본인 토큰 삽입" ON push_tokens
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "본인 토큰 수정" ON push_tokens
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "본인 토큰 삭제" ON push_tokens
  FOR DELETE USING (auth.uid() = user_id);


-- ──────────────────────────────────────────────
-- 11. manaba_notices 테이블 (Phase 3)
--    역할: MS Graph webhook으로 수신한 manaba 공지 메일 캐시
--    중복 방지: 같은 사용자 + 같은 notice_url 조합은 1개만
-- ──────────────────────────────────────────────
CREATE TABLE manaba_notices (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject      TEXT,             -- 메일 제목
  sender       TEXT,             -- 발신자 주소 (manaba 진위 검증용)
  received_at  TIMESTAMPTZ,      -- 메일 수신 시각
  body_html    TEXT,             -- 본문 HTML (미리보기 렌더용)
  notice_url   TEXT,             -- manaba 원본 공지 URL (탭 시 이동)
  course_hint  TEXT,             -- 추정 강의명 (제목에서 파싱)
  pushed_at    TIMESTAMPTZ,      -- 푸시 발송 시각 (NULL이면 미발송)
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT manaba_notices_user_notice_unique UNIQUE (user_id, notice_url)
);

ALTER TABLE manaba_notices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "본인 공지 조회" ON manaba_notices
  FOR SELECT USING (auth.uid() = user_id);

-- INSERT/UPDATE는 Edge Functions(service_role)에서만 수행
CREATE POLICY "service_role insert" ON manaba_notices
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "service_role update" ON manaba_notices
  FOR UPDATE USING (auth.role() = 'service_role');


-- ──────────────────────────────────────────────
-- 12. mail_subscriptions 테이블 (Phase 3)
--    역할: 메일전달(Cloudflare Email Routing) 방식 푸시용 학생 식별 정보
--    사용자당 1개 (UNIQUE user_id)
--    forward_token: 학생 전용 전달주소 {token}@unipas.app 의 식별 토큰
-- ──────────────────────────────────────────────
CREATE TABLE mail_subscriptions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  forward_token     TEXT NOT NULL UNIQUE,  -- {token}@unipas.app 의 토큰 (추측 불가 랜덤)
  ms_account_email  TEXT,                  -- (선택) 학생이 입력한 학교 메일 주소, 안내용
  verified_at       TIMESTAMPTZ,           -- 첫 정상 메일 수신 시각 (전달설정 성공 신호)
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE mail_subscriptions ENABLE ROW LEVEL SECURITY;

-- INSERT/UPDATE/DELETE는 Edge Functions(service_role)에서만 수행 (forward_token 발급·검증 통제)
CREATE POLICY "service_role 쓰기 전용" ON mail_subscriptions
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 본인 row는 조회 허용 (앱이 전달주소/전달확인 상태를 마이페이지·온보딩에 표시)
CREATE POLICY "본인 구독 조회" ON mail_subscriptions
  FOR SELECT USING (auth.uid() = user_id);


-- ══════════════════════════════════════════════
-- UGC 안전장치 (App Store 1.2): 신고 확장 / 사용자 차단 / 누적신고 자동숨김
-- ══════════════════════════════════════════════

-- ── 사용자 차단 ──
CREATE TABLE user_blocks (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (blocker_id, blocked_id)
);
CREATE INDEX idx_user_blocks_blocker ON user_blocks(blocker_id);
ALTER TABLE user_blocks ENABLE ROW LEVEL SECURITY;

-- 본인이 차단한 내역만 보고/추가/삭제 가능
CREATE POLICY "본인 차단 관리" ON user_blocks
  FOR ALL USING (auth.uid() = blocker_id) WITH CHECK (auth.uid() = blocker_id);

-- ── 댓글 신고 (post_reports 패턴 복제) ──
CREATE TABLE comment_reports (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES post_comments(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason     TEXT NOT NULL CHECK (reason IN ('insult', 'abuse', 'defamation')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (comment_id, user_id)
);
ALTER TABLE comment_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "로그인 사용자 댓글신고 가능" ON comment_reports
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "본인 댓글신고 조회" ON comment_reports
  FOR SELECT USING (auth.uid() = user_id);

-- ── 수업평가 신고 (post_reports 패턴 복제) ──
CREATE TABLE course_review_reports (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id  UUID NOT NULL REFERENCES course_reviews(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason     TEXT NOT NULL CHECK (reason IN ('insult', 'abuse', 'defamation')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (review_id, user_id)
);
ALTER TABLE course_review_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "로그인 사용자 평가신고 가능" ON course_review_reports
  FOR INSERT WITH CHECK (auth.uid() = user_id);
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
CREATE TRIGGER trg_hide_review AFTER INSERT ON course_review_reports
  FOR EACH ROW EXECUTE FUNCTION hide_review_on_reports();

-- ── SELECT RLS 재정의: 숨김 제외 + 차단 사용자 제외 (본인 콘텐츠는 항상 노출) ──
DROP POLICY "같은 학교 게시글만 조회" ON posts;
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

DROP POLICY "같은 학교 댓글만 조회" ON post_comments;
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

DROP POLICY "같은 학교 강의평가만 조회" ON course_reviews;
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
