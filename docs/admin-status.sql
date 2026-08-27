-- UniOne 운영 현황 한눈에 보기 (관리자용)
-- 사용법: Supabase MCP(execute_sql) 또는 Supabase Dashboard > SQL Editor 에 붙여넣어 실행
-- "현황 보여줘" 라고 하면 Claude가 이 쿼리를 돌려서 보고함
-- 최초 스냅샷: 2026-08-25 (총 가입 6명 / DB 38MB / 푸시 발송 이력 0)

-- ── 1) 가입 · 온보딩 · 활성 ──────────────────────────────
SELECT
  (SELECT count(*) FROM auth.users)                                            AS 총가입자,
  (SELECT count(*) FROM auth.users WHERE email_confirmed_at IS NOT NULL)        AS 이메일인증완료,
  (SELECT count(*) FROM public.profiles)                                        AS 온보딩완료,  -- 총가입자와 같으면 이탈 0
  (SELECT count(*) FROM auth.users WHERE created_at > now() - interval '1 day') AS 최근1일가입,
  (SELECT count(*) FROM auth.users WHERE created_at > now() - interval '7 days')AS 최근7일가입,
  (SELECT count(*) FROM auth.users WHERE last_sign_in_at > now() - interval '7 days') AS 최근7일활성,
  (SELECT max(created_at)     FROM auth.users)                                  AS 마지막가입시각,
  (SELECT max(last_sign_in_at) FROM auth.users)                                 AS 마지막로그인시각;

-- ── 2) 기능 사용 · 콘텐츠 ────────────────────────────────
SELECT
  (SELECT count(DISTINCT user_id) FROM public.courses)      AS 시간표등록_인원,
  (SELECT count(*) FROM public.courses)                     AS 강의행수,
  (SELECT count(*) FROM public.assignments)                 AS 과제수,
  (SELECT count(*) FROM public.posts)                       AS 게시글수,
  (SELECT count(*) FROM public.post_comments)               AS 댓글수,
  (SELECT count(*) FROM public.course_reviews)              AS 강의평가수,
  (SELECT count(DISTINCT user_id) FROM public.push_tokens)  AS 푸시등록_인원,
  (SELECT count(*) FROM public.mail_subscriptions)          AS 메일구독수;

-- ── 3) 푸시 파이프라인 (학기 시작 후 첫 실전 관찰용) ──────────
--   manaba_notices=0 & push_delivery_logs=0 이면 아직 실제 공지/발송 없음
SELECT
  (SELECT count(*) FROM public.manaba_notices)              AS 수집된공지,
  (SELECT count(*) FROM public.push_delivery_logs)          AS 푸시발송로그,
  (SELECT count(*) FROM public.post_reports)
    + (SELECT count(*) FROM public.comment_reports)
    + (SELECT count(*) FROM public.course_review_reports)   AS 신고건수_전체,
  pg_size_pretty(pg_database_size(current_database()))      AS DB용량;  -- 무료 한도 500MB
