-- 건강검진 점검 추가: 학교 판정 방어 장치 (2026-10-29)
--   계기: 보안 수정 1 (20261029_security_fix_1.sql) — 학생이 프로필의 학교를 바꿔 다른 학교를 열람할 수 있었다.
--   이제 학교는 가입 메일 도메인으로 서버가 정한다. 그런데도 「메일 도메인과 프로필 학교가 다른 계정」이 생기면
--   방어 장치(트리거)가 깨졌다는 뜻이므로 health_snapshot() 에 identity_mismatch 칸을 추가한다.
--   (함수 전체를 다시 만들지만, 바뀐 곳은 identity_mismatch 한 칸뿐)

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
    -- 학교 판정 방어 장치: 메일 도메인이 정하는 학교와 프로필의 학교가 다른 계정 (정상이면 0)
    'identity_mismatch', (
      select count(*) from public.profiles p join auth.users u on u.id = p.id
      where p.university is distinct from public.university_for_email(u.email)),
    -- 용량
    'db_size_mb', (pg_database_size(current_database()) / 1024 / 1024)
  ) into result;
  return result;
end;
$$;

revoke execute on function public.health_snapshot() from public, anon, authenticated;
grant execute on function public.health_snapshot() to service_role;
