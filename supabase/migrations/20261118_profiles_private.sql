-- 학교 메일·학번을 프로필에서 빼기 (2026-11-18, 보안 A2)
--   문제: profiles 는 같은 학교 학생끼리 읽을 수 있다(「같은 학교 프로필만 조회」).
--         그래서 다른 학생의 school_email·student_id 까지 읽혔다 → 익명 글 작성자와 연결될 위험.
--   사실: 앱은 school_email 을 불러오기만 하고 값은 어디에도 쓰지 않는다(AuthProvider select 1곳).
--         로그인 메일은 auth.users 에 따로 있고, 그건 다른 학생이 못 읽는다.
--   방법: 값은 아무도(학생) 못 읽는 보관용 표 profiles_private 로 옮기고, profiles 쪽은 비운다.
--         칸 자체는 남긴다 → 옛 버전 앱의 select 'school_email' 이 오류 없이 null 을 받는다.
--         앞으로 학생이 값을 넣어도 guard_profile_identity 가 비운다.

-- ① 보관용 표 (학생·외부인 접근 불가, 서버 함수만)
create table if not exists public.profiles_private (
  id uuid primary key references public.profiles(id) on delete cascade,
  school_email text,
  student_id text,
  moved_at timestamptz not null default now()
);
alter table public.profiles_private enable row level security;
revoke all on public.profiles_private from public, anon, authenticated;
grant all on public.profiles_private to service_role;

-- ② 기존 값 옮기기 (이미 옮긴 행은 건너뜀)
insert into public.profiles_private (id, school_email, student_id)
select id, school_email, student_id from public.profiles
where school_email is not null or student_id is not null
on conflict (id) do nothing;

-- ③ 트리거: 학생(앱)이 넣는 메일·학번은 항상 비운다. 학교는 지금처럼 로그인 메일 도메인으로 서버가 정한다
create or replace function public.guard_profile_identity()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_email text;
begin
  if coalesce((select auth.role()), '') not in ('authenticated', 'anon') then
    return NEW;
  end if;
  select email into v_email from auth.users where id = NEW.id;
  NEW.university := public.university_for_email(v_email);
  -- 같은 학교 학생에게 보이는 표라 개인 식별 정보는 두지 않는다 (2026-11-18)
  NEW.school_email := null;
  NEW.student_id := null;
  return NEW;
end;
$function$;

-- ④ 프로필에서 비우기 (②에서 보관 완료된 행만)
update public.profiles p set school_email = null, student_id = null
where (p.school_email is not null or p.student_id is not null)
  and exists (select 1 from public.profiles_private x where x.id = p.id);
