-- 데모 로그인 시도 횟수 제한 (2026-11-18, 보안 A4)
--   demo-login 은 고정 6자리 번호라 무한히 시도하면 언젠가 맞힌다.
--   틀린 시도를 기록해서, 최근 15분에 10번 넘게 틀렸으면 잠시 막는다 (함수 쪽: demo-login/index.ts).
--   학생·외부인은 이 표를 못 읽고 못 쓴다(서버 함수만).
create table if not exists public.demo_login_failures (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now()
);
create index if not exists demo_login_failures_created_at_idx on public.demo_login_failures (created_at);
alter table public.demo_login_failures enable row level security;
revoke all on public.demo_login_failures from public, anon, authenticated;
grant all on public.demo_login_failures to service_role;
