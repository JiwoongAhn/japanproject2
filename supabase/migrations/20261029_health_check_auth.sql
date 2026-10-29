-- 건강검진 호출 인증 (2026-10-29)
--   기존 자동 작업들은 공개 열쇠(anon)로 함수를 부른다 → 누가 불렀는지 구별할 수 없다.
--   그래서 비밀 암호를 Vault(DB 금고) 안에서 만들고, 자동 작업은 그 암호를 x-health-secret 헤더로 보내고,
--   health-check 함수는 health_check_secret_ok() 로 맞는지 확인한다. 암호는 DB 밖으로 나가지 않는다.

-- ① 암호 생성 (이미 있으면 그대로)
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'health_check_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'health_check_secret',
                                'health-check 함수 호출 확인용 (pg_cron 전용)');
  end if;
end $$;

-- ② 확인 함수 (service_role 전용 — 함수 서버만 부른다)
create or replace function public.health_check_secret_ok(p_secret text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(p_secret, '') <> ''
     and p_secret = (select decrypted_secret from vault.decrypted_secrets where name = 'health_check_secret');
$$;
revoke execute on function public.health_check_secret_ok(text) from public, anon, authenticated;
grant execute on function public.health_check_secret_ok(text) to service_role;

-- ③ 자동 작업을 암호 헤더를 붙이는 명령으로 다시 등록
--   함수 서버 입구(verify_jwt)를 통과하려면 공개 열쇠도 필요해서, 기존 작업의 Authorization 값을 그대로 가져온다
do $$
declare
  auth_header text;
begin
  select substring(command from '"Authorization":"([^"]+)"') into auth_header
    from cron.job where jobname = 'deadline-reminder-daily';
  perform cron.schedule(
    'health-check-daily',
    '0 0 * * *',
    format($cmd$select net.http_post(
      url := 'https://rexnpusrxezuztxmkaex.supabase.co/functions/v1/health-check',
      headers := jsonb_build_object(
        'Authorization', %L,
        'Content-Type', 'application/json',
        'x-health-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'health_check_secret')),
      timeout_milliseconds := 30000);$cmd$, auth_header)
  );
end $$;
