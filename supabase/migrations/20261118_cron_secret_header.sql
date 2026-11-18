-- 자동 작업 4개에 Vault 암호 헤더 붙이기 (2026-11-18, 보안 A3)
--   지금까지 4개 함수는 공개 열쇠(anon)만 있으면 누구나 실행할 수 있었다
--   (마감 알림 재발송·푸시 재시도·토큰 정리 등을 외부인이 마음대로 돌릴 수 있음).
--   건강검진과 같은 방식: 자동 작업이 Vault 암호(health_check_secret)를 x-health-secret 헤더로 보내고,
--   함수는 _shared/cronAuth.ts 의 isCronAllowed() 로 확인한다.
--
-- ⚠️ 순서: 이 마이그레이션(헤더 추가)을 먼저 적용 → 그다음 함수 배포.
--   헤더를 먼저 보내는 건 옛 함수에 아무 영향이 없지만, 함수를 먼저 배포하면 자동 작업이 403으로 막힌다.

do $$
declare
  auth_header text;
  j record;
begin
  -- 함수 서버 입구(verify_jwt)를 통과하려면 공개 열쇠도 계속 필요 → 기존 값 그대로 재사용
  select substring(command from '"Authorization":"([^"]+)"') into auth_header
    from cron.job where jobname = 'deadline-reminder-daily';
  if auth_header is null then
    raise exception 'deadline-reminder-daily 의 Authorization 값을 찾지 못했다 (이미 바뀌었는지 확인)';
  end if;

  for j in
    select * from (values
      ('deadline-reminder-daily',   '0 9 * * *',    'deadline-reminder',   30000),
      ('expo-receipt-poller-15min', '*/15 * * * *', 'expo-receipt-poller', 30000),
      ('push-cleanup-daily',        '0 18 * * *',   'push-cleanup',        30000),
      ('push-retry-worker-hourly',  '0 * * * *',    'push-retry-worker',   30000)
    ) as t(jobname, schedule, fn, timeout_ms)
  loop
    perform cron.schedule(
      j.jobname,
      j.schedule,
      format($cmd$select net.http_post(
      url := 'https://rexnpusrxezuztxmkaex.supabase.co/functions/v1/%s',
      headers := jsonb_build_object(
        'Authorization', %L,
        'Content-Type', 'application/json',
        'x-health-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'health_check_secret')),
      timeout_milliseconds := %s);$cmd$, j.fn, auth_header, j.timeout_ms)
    );
  end loop;
end $$;
