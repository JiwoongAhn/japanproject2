-- 건강검진 (2026-10-29)
--   매일 JST 09:00 health-check 함수가 health_snapshot() 숫자를 받아
--   supabase/functions/health-check/checks.js 규칙으로 판정 → 개발자에게 푸시·요약 메일.
--   health_snapshot() 는 개수·시각만 돌려준다(개인정보 없음). service_role 전용.
--   ⚠️ 점검 항목에 새 숫자가 필요하면 이 함수에 칸을 추가하는 새 마이그레이션을 만든다.

-- ① 실행 기록 (나중에 unione-ops 사건 기록·추세 확인에 사용)
create table if not exists public.health_check_runs (
  id          bigint generated always as identity primary key,
  ran_at      timestamptz not null default now(),
  worst_level text not null,
  results     jsonb not null
);
alter table public.health_check_runs enable row level security;
revoke all on public.health_check_runs from anon, authenticated;

-- ② 점검에 쓰는 숫자 묶음
create or replace function public.health_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'now', now(),
    -- manaba 수신
    'verified_subscriptions', (select count(*) from public.mail_subscriptions where verified_at is not null),
    'last_notice_at',         (select max(created_at) from public.manaba_notices),
    'notices_24h',            (select count(*) from public.manaba_notices where created_at > now() - interval '24 hours'),
    -- 수신 설정을 마쳤는데 폰 알림 주소(push_tokens)가 0개 → 알림을 하나도 못 받는 학생
    'subs_without_push_token', (
      select count(*) from public.mail_subscriptions s
      where s.verified_at is not null
        and not exists (select 1 from public.push_tokens t where t.user_id = s.user_id)),
    -- AI 요약: 요약 푸시를 켠 학생(알림 주소 있음)에게 최근 24시간 온 공지 중 요약이 비어 있는 것
    --   알림 주소가 없으면 mail-inbound 가 요약을 일부러 건너뛰므로 제외한다
    'ai_push_notices_24h', (
      select count(*) from public.manaba_notices n
      join public.mail_subscriptions s on s.user_id = n.user_id and s.ai_summary_push
      where n.pushed_at > now() - interval '24 hours'
        and exists (select 1 from public.push_tokens t where t.user_id = n.user_id)),
    'ai_push_missing_24h', (
      select count(*) from public.manaba_notices n
      join public.mail_subscriptions s on s.user_id = n.user_id and s.ai_summary_push
      where n.pushed_at > now() - interval '24 hours' and n.ai_summary is null
        and exists (select 1 from public.push_tokens t where t.user_id = n.user_id)),
    -- 푸시
    'push_24h', (
      select coalesce(jsonb_object_agg(status, c), '{}'::jsonb) from (
        select status, count(*) c from public.push_delivery_logs
        where created_at > now() - interval '24 hours' group by status) t),
    'push_retry_stuck', (
      select count(*) from public.push_delivery_logs
      where status = 'retry_pending' and created_at < now() - interval '6 hours'),
    -- 자동 작업(pg_cron): 마지막 성공 시각, 24시간 실패 수
    'cron_jobs', (
      select coalesce(jsonb_object_agg(j.jobname, jsonb_build_object(
        'last_success', (select max(d.start_time) from cron.job_run_details d
                          where d.jobid = j.jobid and d.status = 'succeeded'),
        'failures_24h', (select count(*) from cron.job_run_details d
                          where d.jobid = j.jobid and d.status = 'failed'
                            and d.start_time > now() - interval '24 hours'))), '{}'::jsonb)
      from cron.job j),
    -- 자동 작업이 부른 서버 함수의 실패 응답 (net 은 몇 시간만 보관)
    'http_errors_recent', (
      select count(*) from net._http_response
      where status_code is null or status_code >= 300 or timed_out),
    -- 게시판·가입
    'reports_24h', (
      (select count(*) from public.post_reports where created_at > now() - interval '24 hours') +
      (select count(*) from public.comment_reports where created_at > now() - interval '24 hours') +
      (select count(*) from public.course_review_reports where created_at > now() - interval '24 hours') +
      (select count(*) from public.course_review_comment_reports where created_at > now() - interval '24 hours')),
    'signups_24h', (select count(*) from public.profiles where created_at > now() - interval '24 hours'),
    'posts_24h',   (select count(*) from public.posts where created_at > now() - interval '24 hours'),
    -- 용량
    'db_size_mb', (pg_database_size(current_database()) / 1024 / 1024)
  ) into result;
  return result;
end;
$$;

revoke execute on function public.health_snapshot() from public, anon, authenticated;
grant execute on function public.health_snapshot() to service_role;

-- ③ 매일 00:00 UTC (= JST 09:00) 실행
--   서버 열쇠를 이 파일(공개 저장소)에 적지 않으려고, 기존 deadline-reminder 작업의 명령을 복사해 주소만 바꾼다.
--   첫 실행은 다음 JST 09:00 이므로, 이 마이그레이션 → health-check 함수 배포를 그 전에 끝내면 된다
select cron.schedule(
  'health-check-daily',
  '0 0 * * *',
  (select replace(command, '/functions/v1/deadline-reminder', '/functions/v1/health-check')
     from cron.job where jobname = 'deadline-reminder-daily')
);
