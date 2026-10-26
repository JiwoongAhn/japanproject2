-- 締切前日 알림 (2026-10-26)
--   매일 JST 18:00 deadline-reminder 함수가 마감 30시간 안의 未提出 課題를 사람당 1통으로 묶어 푸시한다.
--   reminded_at : 이 課題를 이미 알렸는지 (같은 課題 중복 알림 방지, 마감이 바뀌면 mail-inbound 가 비운다)
--   profiles.deadline_reminder : 마이페이지 「締切前日に通知」 (기본 ON, 본인 프로필은 RLS 로 수정 가능)

alter table public.assignments
  add column if not exists reminded_at timestamptz;

alter table public.profiles
  add column if not exists deadline_reminder boolean not null default true;

-- 매일 후보를 날짜로 거르므로 未提出·미알림 행만 담는 부분 인덱스
create index if not exists assignments_reminder_due_idx
  on public.assignments (due_date)
  where status = 'pending' and reminded_at is null;
