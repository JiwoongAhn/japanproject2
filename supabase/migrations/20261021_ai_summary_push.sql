-- 「通知にAI要約を表示」 (2026-10-21)
--   켠 학생만 mail-inbound 가 manaba 통지 본문을 AI 요약해 푸시 본문에 넣는다 (기본 OFF, 앱에서 동의 후 ON)
--   요약 결과는 통지 행에 저장 → 앱 미리보기·「AIで要約」 버튼이 다시 부르지 않음(비용 1회)

alter table public.mail_subscriptions
  add column if not exists ai_summary_push boolean not null default false;

alter table public.manaba_notices
  add column if not exists ai_summary text;

-- mail_subscriptions 는 service_role 만 쓰기 가능 → 본인 설정 한 칸만 바꾸는 함수로 연다
create or replace function public.set_ai_summary_push(enabled boolean)
returns boolean
language sql
security definer
set search_path = public
as $$
  update public.mail_subscriptions
     set ai_summary_push = enabled, updated_at = now()
   where user_id = (select auth.uid())
  returning ai_summary_push;
$$;

revoke execute on function public.set_ai_summary_push(boolean) from public, anon;
grant execute on function public.set_ai_summary_push(boolean) to authenticated;
