-- AI 기능 사용 기록 (남용 방지용 하루 횟수 제한)
-- parse-timetable Edge Function 이 service role 로만 읽고 쓴다.
-- 앱(anon/로그인 사용자)은 직접 접근하지 않으므로 RLS 를 켜고 정책을 두지 않는다 = 전면 차단.
-- 본문(이미지·텍스트)은 저장하지 않는다 — 누가 언제 몇 번 썼는지만 남긴다.

create table if not exists public.ai_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,                       -- 'timetable' (나중에 'assignment' 등 추가)
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_user_kind_created_idx
  on public.ai_usage (user_id, kind, created_at desc);

alter table public.ai_usage enable row level security;
