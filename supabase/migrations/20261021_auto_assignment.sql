-- manaba 課題 메일 → 課題 자동 추가 (2026-10-21)
--   운영 데이터: 課題 메일 22건을 받은 6명의 수동 등록 0건 → 버튼이 아니라 자동이어야 한다.
--   mail-inbound 가 「レポート/小テスト公開」 메일이면 課題를 넣고, 「提出」 메일이면 提出済 로 바꾼다.
--   읽기는 정규식(_shared/manabaAssignment.js) — AI 미사용.

alter table public.assignments
  add column if not exists due_at timestamptz,                 -- 시각까지 (due_date 는 날짜만이라 그대로 두고 호환)
  add column if not exists source text not null default 'manual',
  add column if not exists source_notice_id uuid references public.manaba_notices(id) on delete set null,
  add column if not exists source_key text,                    -- "과목|課題名" 정규화 — 공개·제출 메일을 잇는 열쇠
  add column if not exists course_label text;                  -- 시간표에 없는 과목일 때 표시용 과목명

do $$ begin
  alter table public.assignments
    add constraint assignments_source_check check (source in ('manual', 'manaba'));
exception when duplicate_object then null; end $$;

-- 같은 課題 중복 방지. 수동 등록(source_key NULL)끼리는 NULL 이라 서로 충돌하지 않는다
do $$ begin
  alter table public.assignments
    add constraint assignments_user_source_key_key unique (user_id, source_key);
exception when duplicate_object then null; end $$;

-- 「課題を自動で追加」 (마이페이지, 기본 ON — 외부 전송이 없어 동의가 필요 없다)
alter table public.mail_subscriptions
  add column if not exists auto_assignment boolean not null default true;

-- mail_subscriptions 는 service_role 만 쓰기 가능 → 본인 설정 한 칸만 바꾸는 함수 (set_ai_summary_push 와 같은 방식)
create or replace function public.set_auto_assignment(enabled boolean)
returns boolean
language sql
security definer
set search_path = public
as $$
  update public.mail_subscriptions
     set auto_assignment = enabled, updated_at = now()
   where user_id = (select auth.uid())
  returning auto_assignment;
$$;

revoke execute on function public.set_auto_assignment(boolean) from public, anon;
grant execute on function public.set_auto_assignment(boolean) to authenticated;
