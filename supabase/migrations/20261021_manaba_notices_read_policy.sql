-- manaba 통지 「읽음 처리」가 한 번도 저장되지 않던 문제 (2026-10-21 발견: 242건 전부 is_read=false)
--   원인: 앱이 manaba_notices.is_read 를 update 하는데, RLS 에 본인 UPDATE 정책이 없어(service_role 만)
--         오류 없이 0건 갱신 → 홈에서 읽은 통지가 다시 들어오면 또 보였다
--   수정: 본인 행만 update 허용 + 바꿀 수 있는 칸을 is_read·read_at 으로 한정 (본문·요약 등은 못 바꾼다)

create policy "본인 공지 읽음 처리" on public.manaba_notices
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke update on public.manaba_notices from anon, authenticated;
grant update (is_read, read_at) on public.manaba_notices to authenticated;
