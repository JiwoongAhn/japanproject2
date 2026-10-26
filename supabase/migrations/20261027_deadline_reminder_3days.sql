-- 締切 3日前 알림 추가 (2026-10-27)
--   reminded_3d_at : 이 課題의 「3日前」 알림을 이미 보냈는지 (前日 알림은 기존 reminded_at)
--   마감이 바뀌면 mail-inbound 가 두 칸을 함께 비운다.
--   ⚠️ mail-inbound·deadline-reminder 를 새 코드로 배포하기 전에 먼저 적용할 것 (없는 칸을 쓰면 오류)

alter table public.assignments
  add column if not exists reminded_3d_at timestamptz;
