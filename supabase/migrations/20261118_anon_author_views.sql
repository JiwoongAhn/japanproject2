-- 익명 작성자 숨기기 1단계 (2026-11-18, 보안 A1)
--   문제: posts·post_comments·course_reviews·course_review_comments 의 user_id 가 같은 학교 학생에게 그대로 보인다.
--         익명 글이라도 user_id 를 모으면 "같은 사람이 쓴 글"이 묶이고, 실명 글·프로필과 이어 누군지 추측할 수 있다.
--   1단계(이 파일): 앱이 읽을 「가린 창구」 view 4개 + 「이 글 쓴 사람 차단」 함수. 앱은 OTA 로 view 를 읽게 바뀐다.
--         원래 표의 user_id 는 아직 읽을 수 있다(옛 버전 앱이 select('*') 로 읽기 때문에 — 막으면 옛 앱 게시판이 깨진다).
--   2단계(약 2주 뒤, 업데이트가 퍼진 뒤): 원래 표의 user_id 읽기 권한 회수 + view 를 소유자 권한 방식으로 전환.
--         ⚠️ 2단계 전까지는 실제 보호가 아직 안 된 상태다.
--
--   view 규칙
--     user_id       : 익명 글이고 내 글이 아니면 null (실명 글은 닉네임 표시에 필요해서 그대로)
--     is_mine       : 내 글인가 (서버 판정 — 앱이 user_id 비교를 안 해도 되게)
--     is_post_author: (게시글 댓글만) 글쓴이 본인이 단 댓글인가 — 「作成者」 배지용
--   security_invoker = true → 원래 표의 RLS(같은 학교·숨김·차단)가 그대로 적용된다.

create or replace view public.posts_v with (security_invoker = true) as
select
  p.id,
  case when p.is_anonymous and p.user_id is distinct from (select auth.uid()) then null else p.user_id end as user_id,
  p.category, p.title, p.body, p.is_anonymous, p.like_count, p.created_at, p.university, p.image_urls, p.is_hidden,
  (p.user_id = (select auth.uid())) as is_mine
from public.posts p;

create or replace view public.post_comments_v with (security_invoker = true) as
select
  c.id, c.post_id,
  case when c.is_anonymous and c.user_id is distinct from (select auth.uid()) then null else c.user_id end as user_id,
  c.body, c.is_anonymous, c.created_at, c.like_count, c.is_hidden,
  (c.user_id = (select auth.uid())) as is_mine,
  exists (select 1 from public.posts p where p.id = c.post_id and p.user_id = c.user_id) as is_post_author
from public.post_comments c;

-- 講義評価는 전부 익명 (is_anonymous 칸 없음)
create or replace view public.course_reviews_v with (security_invoker = true) as
select
  r.id,
  case when r.user_id is distinct from (select auth.uid()) then null else r.user_id end as user_id,
  r.course_name, r.professor_name, r.rating, r.comment, r.tags, r.created_at, r.university, r.is_hidden,
  (r.user_id = (select auth.uid())) as is_mine
from public.course_reviews r;

create or replace view public.course_review_comments_v with (security_invoker = true) as
select
  c.id, c.review_id,
  case when c.is_anonymous and c.user_id is distinct from (select auth.uid()) then null else c.user_id end as user_id,
  c.body, c.is_anonymous, c.is_hidden, c.created_at,
  (c.user_id = (select auth.uid())) as is_mine
from public.course_review_comments c;

revoke all on public.posts_v, public.post_comments_v, public.course_reviews_v, public.course_review_comments_v from public, anon;
grant select on public.posts_v, public.post_comments_v, public.course_reviews_v, public.course_review_comments_v to authenticated;

-- 「이 글/댓글/평가를 쓴 사람 차단」 — 앱이 작성자 ID 를 몰라도 차단할 수 있게 서버가 찾아서 넣는다
--   p_kind: 'post' | 'post_comment' | 'review' | 'review_comment'
--   반환: 'ok' | 'self'(내 글) | 'not_found'(없거나 볼 수 없는 글)
--   같은 학교 글만 대상 (볼 수 없는 글의 작성자는 차단할 수 없게 — 남의 학교 user_id 탐색 방지)
create or replace function public.block_author(p_kind text, p_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
  v_target uuid;
begin
  if v_me is null then
    return 'not_found';
  end if;

  if p_kind = 'post' then
    select p.user_id into v_target from public.posts p
      where p.id = p_id and p.university = public.get_my_university();
  elsif p_kind = 'post_comment' then
    select c.user_id into v_target from public.post_comments c join public.posts p on p.id = c.post_id
      where c.id = p_id and p.university = public.get_my_university();
  elsif p_kind = 'review' then
    select r.user_id into v_target from public.course_reviews r
      where r.id = p_id and r.university = public.get_my_university();
  elsif p_kind = 'review_comment' then
    select c.user_id into v_target from public.course_review_comments c join public.course_reviews r on r.id = c.review_id
      where c.id = p_id and r.university = public.get_my_university();
  end if;

  if v_target is null then
    return 'not_found';
  end if;
  if v_target = v_me then
    return 'self';
  end if;

  insert into public.user_blocks (blocker_id, blocked_id) values (v_me, v_target)
    on conflict do nothing;
  return 'ok';
end;
$$;
revoke execute on function public.block_author(text, uuid) from public, anon;
grant execute on function public.block_author(text, uuid) to authenticated;
