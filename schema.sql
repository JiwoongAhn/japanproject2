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
  category     TEXT NOT NULL CHECK (category IN ('qa', 'free', 'secret', 'info')),
  title        TEXT NOT NULL,
  body         TEXT,
  is_anonymous BOOLEAN NOT NULL DEFAULT true,
  like_count   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "로그인 사용자 게시글 조회 가능" ON posts
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "본인만 게시글 작성 가능" ON posts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

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
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "로그인 사용자 댓글 조회 가능" ON post_comments
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "본인만 댓글 작성 가능" ON post_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

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
