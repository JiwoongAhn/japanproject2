-- 건강검진 칸 추가: 프로필에 남은 학교 메일·학번 수 (2026-11-18, 보안 A2)
--   20261118_profiles_private 로 프로필의 school_email·student_id 를 비웠다 (같은 학교 학생에게 보이는 표라서).
--   누가 실수로 트리거를 되돌리거나 값을 다시 넣으면 매일 아침 🔴 로 알린다 (checks.js 'profile-pii').
--   함수 전체를 다시 만들지만, 바뀐 곳은 profile_pii 한 칸뿐 (원본 = 20261030_health_check_setup_funnel.sql)

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
    -- 같은 학교 학생에게 보이는 프로필에 학교 메일·학번이 남아 있는 계정 수 (2026-11-18 보안 A2, 항상 0이어야 함)
    'profile_pii', (
      select count(*) from public.profiles
      where school_email is not null or student_id is not null),
    -- manaba 통지 설정 단계별 인원 (앱 utils/manabaSetupStatus.js 의 단계와 같은 기준)
    'manaba_setup_stages', (
      select jsonb_build_object(
        'none',    count(*) filter (where not has_sub),
        'pending', count(*) filter (where has_sub and not verified),
        'no_push', count(*) filter (where verified and not has_push),
        'ready',   count(*) filter (where verified and has_push))
      from (
        select
          exists (select 1 from public.mail_subscriptions s where s.user_id = p.id) as has_sub,
          exists (select 1 from public.mail_subscriptions s where s.user_id = p.id and s.verified_at is not null) as verified,
          exists (select 1 from public.push_tokens t where t.user_id = p.id) as has_push
        from public.profiles p join auth.users u on u.id = p.id
        where p.university in ('国士舘大学', '東洋大学', '大東文化大学', '亜細亜大学')
          and u.email not like '%@unione.local'
          and u.email not like 'appreview@%'
          and u.email not like 'e2etest@%') x),
    -- 용량
    'db_size_mb', (pg_database_size(current_database()) / 1024 / 1024)
  ) into result;
  return result;
end;
$$;

revoke execute on function public.health_snapshot() from public, anon, authenticated;
grant execute on function public.health_snapshot() to service_role;
