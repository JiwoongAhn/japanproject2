-- 보안 수정 1 (2026-10-29) — 앱 업데이트 없이 DB 규칙만 바꾼다
--   2026-10-29 e2etest 계정 ROLLBACK 시험으로 확인한 구멍:
--     · profiles.university 를 본인이 바꿔 다른 학교 게시판·메일 열람
--     · 가입 도메인 제한이 없고 university 기본값이 '国士舘大学' → 아무 메일로 가입해도 국사관 학생이 됨
--     · 본인 글의 is_hidden(신고 숨김)·like_count 수정, 강의평가를 다른 학교 이름으로 작성
--     · 로그인 안 한 사람(anon)도 좋아요 기록 열람, increment_like 로 좋아요 무한 증가
--   ⚠️ 새 학교를 추가하면 아래 university_domains 에도 추가하는 새 마이그레이션을 만들 것
--      (빠뜨리면 그 학교는 가입이 거절된다 — Jest US-DOM 이 잡는다)

-- ───────────────────────── ① 학교는 「인증된 메일 도메인」으로 서버가 정한다
create table if not exists public.university_domains (
  domain     text primary key,
  university text not null
);
alter table public.university_domains enable row level security;
revoke all on public.university_domains from anon, authenticated;

insert into public.university_domains (domain, university) values
  ('kokushikan.ac.jp', '国士舘大学'),
  ('g.nihon-u.ac.jp', '日本大学'),
  ('toyo.jp', '東洋大学'),
  ('komazawa-u.ac.jp', '駒澤大学'),
  ('senshu-u.jp', '専修大学'),
  ('stu.teikyo-u.ac.jp', '帝京大学'),
  ('jindai.jp', '神奈川大学'),
  ('mail.u-tokai.ac.jp', '東海大学'),
  ('st.daito.ac.jp', '大東文化大学'),
  ('asia-u.ac.jp', '亜細亜大学'),
  ('st.takushoku-u.ac.jp', '拓殖大学'),
  ('ms.dendai.ac.jp', '東京電機大学'),
  ('stu.tamagawa.ac.jp', '玉川大学'),
  ('nodai.ac.jp', '東京農業大学'),
  ('tcu.ac.jp', '東京都市大学'),
  ('oiu.jp', '大阪国際大学'),
  ('nbu.ac.jp', '日本文理大学'),
  ('mail.doshisha.ac.jp', '同志社大学'),
  ('meiji.ac.jp', '明治大学'),
  -- 시딩 계정(seed01~08, 관리자 생성 전용 — 실제 메일을 받을 수 없는 주소라 일반 가입 불가)
  ('unione.local', '国士舘大学')
on conflict (domain) do update set university = excluded.university;

create or replace function public.university_for_email(p_email text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select university from public.university_domains
   where domain = lower(split_part(coalesce(p_email, ''), '@', 2));
$$;
revoke execute on function public.university_for_email(text) from public, anon, authenticated;

-- 기본값 '国士舘大学' 제거 — 모르는 사람이 자동으로 국사관 학생이 되던 원인
alter table public.profiles alter column university drop default;

-- 가입(auth.users 생성) 시 프로필의 학교를 메일로 정한다. 지원 학교 메일이 아니면 가입 자체를 거절
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  uni text := public.university_for_email(NEW.email);
begin
  if uni is null then
    raise exception 'UniOne: 지원하지 않는 메일 도메인입니다';
  end if;
  insert into public.profiles (id, university) values (NEW.id, uni)
  on conflict (id) do nothing;
  return NEW;
end;
$$;

-- 학생이 프로필을 저장할 때 학교·학교 메일·학번은 서버가 덮어쓴다 (앱이 무엇을 보내든)
--   앱 가입 화면이 upsert 로 university·school_email 을 보내므로 막지 않고 「올바른 값으로 바꿔치기」 한다
--   서버 관리자(service_role)·마이그레이션·가입 트리거(역할 없음)는 그대로 통과
create or replace function public.guard_profile_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
begin
  if coalesce((select auth.role()), '') not in ('authenticated', 'anon') then
    return NEW;
  end if;
  select email into v_email from auth.users where id = NEW.id;
  NEW.university := public.university_for_email(v_email);
  if NEW.school_email is not null then
    NEW.school_email := v_email;
  end if;
  if TG_OP = 'UPDATE' then
    NEW.student_id := OLD.student_id;
  else
    NEW.student_id := null;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_guard_profile_identity on public.profiles;
create trigger trg_guard_profile_identity
  before insert or update on public.profiles
  for each row execute function public.guard_profile_identity();
revoke execute on function public.guard_profile_identity() from public, anon, authenticated;

-- 기존 데이터 바로잡기 (가입을 중단한 亜細亜 메일 계정 1개가 기본값 때문에 国士舘 으로 저장돼 있었다)
update public.profiles p
   set university = d.university
  from auth.users u
  join public.university_domains d on d.domain = lower(split_part(u.email, '@', 2))
 where u.id = p.id
   and p.university is distinct from d.university;

-- ───────────────────────── ② 추가·수정할 수 있는 칸을 「허용 목록」으로
--   앱이 실제로 보내는 칸만 허용 (PostCreate·PostEdit·PostDetail·CourseReviewCreate·review.js·courseReviewComments·manabaNotices)
revoke insert, update on public.posts from authenticated, anon;
grant insert (user_id, university, category, title, body, is_anonymous, image_urls) on public.posts to authenticated;
grant update (title, body, image_urls) on public.posts to authenticated;

revoke insert, update on public.post_comments from authenticated, anon;
grant insert (post_id, user_id, body, is_anonymous) on public.post_comments to authenticated;

revoke insert, update on public.course_reviews from authenticated, anon;
grant insert (user_id, university, course_name, professor_name, rating, comment, tags) on public.course_reviews to authenticated;
grant update (rating, comment, tags) on public.course_reviews to authenticated;

revoke insert, update on public.course_review_comments from authenticated, anon;
grant insert (review_id, user_id, body) on public.course_review_comments to authenticated;

revoke update on public.manaba_notices from authenticated, anon;
grant update (is_read, read_at) on public.manaba_notices to authenticated;

-- 강의평가도 게시글처럼 「내 학교」 이름으로만 작성
drop policy if exists "본인만 강의평가 작성 가능" on public.course_reviews;
create policy "본인만 강의평가 작성 가능" on public.course_reviews
  for insert with check ((select auth.uid()) = user_id and university = public.get_my_university());

-- ───────────────────────── ③ 좋아요 기록은 본인 것만
drop policy if exists "likes viewable by everyone" on public.post_likes;   -- 본인 것은 "users can manage own likes"(ALL)로 조회
drop policy if exists "누구나 읽기" on public.comment_likes;
drop policy if exists "본인 좋아요만 조회" on public.comment_likes;
create policy "본인 좋아요만 조회" on public.comment_likes
  for select using ((select auth.uid()) = user_id);

-- 앱이 쓰지 않는 increment_like — 로그인한 누구나 좋아요 수를 무한히 올릴 수 있었다
revoke execute on function public.increment_like(uuid) from public, anon, authenticated;

-- ───────────────────────── ④ 로그인 안 한 사람(anon)의 표 권한 회수
--   앱은 로그인 전에 표를 직접 읽지 않는다 (가입 전 단계는 Edge Function 만 사용)
revoke all on all tables in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
revoke execute on function public.get_my_university() from public, anon;
grant execute on function public.get_my_university() to authenticated, service_role;
