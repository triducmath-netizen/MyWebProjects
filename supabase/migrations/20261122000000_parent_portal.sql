-- =====================================================================
-- Trí Đức Math — Cổng phụ huynh
-- Bảng dữ liệu, phân quyền (RLS) và kho lưu file bài kiểm tra / bài làm.
-- Chạy toàn bộ file này một lần trong Supabase → SQL Editor.
-- =====================================================================

-- ---------- Bảng ----------

create type public.user_role as enum ('admin', 'teacher', 'parent');

-- Hồ sơ người dùng, mỗi tài khoản đăng nhập có đúng một hồ sơ.
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  role        public.user_role not null default 'parent',
  full_name   text not null default '',
  email       text,
  created_at  timestamptz not null default now()
);

create table public.classes (
  id      bigint generated always as identity primary key,
  name    text not null unique,
  grade   smallint not null check (grade between 6 and 12),
  active  boolean not null default true
);

-- Giáo viên nào phụ trách lớp nào.
create table public.teacher_classes (
  teacher_id  uuid   not null references public.profiles (id) on delete cascade,
  class_id    bigint not null references public.classes (id) on delete cascade,
  primary key (teacher_id, class_id)
);

-- Học sinh. parent_id là tài khoản phụ huynh đăng nhập bằng mã học sinh.
create table public.students (
  id          bigint generated always as identity primary key,
  code        text not null unique check (code ~ '^[A-Z0-9]{3,20}$'),
  full_name   text not null check (length(trim(full_name)) > 0),
  class_id    bigint references public.classes (id) on delete set null,
  parent_id   uuid unique references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

-- Bài kiểm tra hằng tuần của một lớp.
create table public.assessments (
  id          bigint generated always as identity primary key,
  class_id    bigint not null references public.classes (id) on delete cascade,
  week_start  date not null,
  title       text not null check (length(trim(title)) > 0),
  max_score   numeric(5, 2) not null default 10 check (max_score > 0),
  created_by  uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now()
);

-- File đề bài (ảnh / PDF) của bài kiểm tra.
create table public.assessment_files (
  id             bigint generated always as identity primary key,
  assessment_id  bigint not null references public.assessments (id) on delete cascade,
  path           text not null unique,
  created_at     timestamptz not null default now()
);

-- Kết quả của từng học sinh cho một bài kiểm tra.
create table public.results (
  id             bigint generated always as identity primary key,
  assessment_id  bigint not null references public.assessments (id) on delete cascade,
  student_id     bigint not null references public.students (id) on delete cascade,
  score          numeric(5, 2) check (score >= 0),
  comment        text,
  updated_by     uuid references public.profiles (id) on delete set null default auth.uid(),
  updated_at     timestamptz not null default now(),
  unique (assessment_id, student_id)
);

-- File bài làm (ảnh / PDF) của học sinh.
create table public.result_files (
  id          bigint generated always as identity primary key,
  result_id   bigint not null references public.results (id) on delete cascade,
  path        text not null unique,
  created_at  timestamptz not null default now()
);

create index on public.students (class_id);
create index on public.students (parent_id);
create index on public.assessments (class_id, week_start desc);
create index on public.assessment_files (assessment_id);
create index on public.results (student_id);
create index on public.result_files (result_id);

-- Không cho điểm vượt điểm tối đa của bài kiểm tra.
create function public.check_score_max() returns trigger
language plpgsql set search_path = '' as $$
declare m numeric;
begin
  select max_score into m from public.assessments where id = new.assessment_id;
  if new.score is not null and new.score > m then
    raise exception 'Điểm % vượt quá điểm tối đa %', new.score, m;
  end if;
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;

create trigger results_check_score
  before insert or update on public.results
  for each row execute function public.check_score_max();

-- Tự tạo hồ sơ khi có tài khoản mới. Vai trò lấy từ app_metadata,
-- phần chỉ máy chủ (service role) mới ghi được, nên người dùng không tự nâng quyền.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, role, full_name, email)
  values (
    new.id,
    coalesce((new.raw_app_meta_data ->> 'role')::public.user_role, 'parent'),
    coalesce(new.raw_app_meta_data ->> 'full_name', ''),
    new.email
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Hàm kiểm tra quyền ----------
-- security definer để tránh vòng lặp RLS; chỉ đọc, không ghi.

create function public.my_role() returns public.user_role
language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = (select auth.uid());
$$;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.my_role() = 'admin', false);
$$;

create function public.can_manage_class(cid bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_admin() or exists (
    select 1 from public.teacher_classes tc
    join public.profiles p on p.id = tc.teacher_id and p.role = 'teacher'
    where tc.teacher_id = (select auth.uid()) and tc.class_id = cid
  );
$$;

create function public.can_manage_assessment(aid bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.assessments a
    where a.id = aid and public.can_manage_class(a.class_id)
  );
$$;

create function public.is_parent_of(sid bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.students s
    where s.id = sid and s.parent_id = (select auth.uid())
  );
$$;

create function public.can_view_student(sid bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_parent_of(sid) or exists (
    select 1 from public.students s
    where s.id = sid and public.can_manage_class(s.class_id)
  );
$$;

-- Phụ huynh chỉ thấy bài kiểm tra mà con mình có kết quả.
create function public.can_view_assessment(aid bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.can_manage_assessment(aid) or exists (
    select 1 from public.results r
    join public.students s on s.id = r.student_id
    where r.assessment_id = aid and s.parent_id = (select auth.uid())
  );
$$;

create function public.can_view_result(rid bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.results r
    where r.id = rid
      and (public.is_parent_of(r.student_id) or public.can_manage_assessment(r.assessment_id))
  );
$$;

create function public.can_manage_result(rid bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.results r
    where r.id = rid and public.can_manage_assessment(r.assessment_id)
  );
$$;

-- Học sinh phải thuộc đúng lớp của bài kiểm tra.
create function public.student_in_assessment_class(sid bigint, aid bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.students s
    join public.assessments a on a.class_id = s.class_id
    where s.id = sid and a.id = aid
  );
$$;

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;

-- ---------- Bật RLS ----------

alter table public.profiles         enable row level security;
alter table public.classes          enable row level security;
alter table public.teacher_classes  enable row level security;
alter table public.students         enable row level security;
alter table public.assessments      enable row level security;
alter table public.assessment_files enable row level security;
alter table public.results          enable row level security;
alter table public.result_files     enable row level security;

-- Người chưa đăng nhập không đọc được gì.
revoke all on all tables in schema public from anon;

-- profiles: xem hồ sơ của mình; quản trị xem và sửa tất cả.
-- Giáo viên xem được tên giáo viên khác (để hiện ai phụ trách lớp).
create policy "profiles_select" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.is_admin()
         or (role = 'teacher' and public.my_role() = 'teacher'));
create policy "profiles_admin_update" on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- classes: mọi người đã đăng nhập xem được tên lớp; chỉ quản trị sửa.
create policy "classes_select" on public.classes for select to authenticated using (true);
create policy "classes_admin_write" on public.classes for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- teacher_classes
create policy "tc_select" on public.teacher_classes for select to authenticated
  using (public.is_admin() or teacher_id = (select auth.uid()));
create policy "tc_admin_write" on public.teacher_classes for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- students: phụ huynh xem con mình; giáo viên xem và quản lý học sinh lớp mình.
-- parent_id chỉ được gán bởi hàm máy chủ manage-accounts.
create policy "students_select" on public.students for select to authenticated
  using (public.can_view_student(id));
create policy "students_insert" on public.students for insert to authenticated
  with check (parent_id is null and public.can_manage_class(class_id));
create policy "students_update" on public.students for update to authenticated
  using (public.can_manage_class(class_id)) with check (public.can_manage_class(class_id));
create policy "students_delete" on public.students for delete to authenticated
  using (public.can_manage_class(class_id));
revoke update on public.students from authenticated;
grant update (code, full_name, class_id) on public.students to authenticated;

-- assessments
create policy "assessments_select" on public.assessments for select to authenticated
  using (public.can_view_assessment(id));
create policy "assessments_write" on public.assessments for all to authenticated
  using (public.can_manage_class(class_id)) with check (public.can_manage_class(class_id));

-- assessment_files
create policy "afiles_select" on public.assessment_files for select to authenticated
  using (public.can_view_assessment(assessment_id));
create policy "afiles_write" on public.assessment_files for all to authenticated
  using (public.can_manage_assessment(assessment_id))
  with check (public.can_manage_assessment(assessment_id));

-- results
create policy "results_select" on public.results for select to authenticated
  using (public.is_parent_of(student_id) or public.can_manage_assessment(assessment_id));
create policy "results_insert" on public.results for insert to authenticated
  with check (public.can_manage_assessment(assessment_id)
              and public.student_in_assessment_class(student_id, assessment_id));
create policy "results_update" on public.results for update to authenticated
  using (public.can_manage_assessment(assessment_id))
  with check (public.can_manage_assessment(assessment_id)
              and public.student_in_assessment_class(student_id, assessment_id));
create policy "results_delete" on public.results for delete to authenticated
  using (public.can_manage_assessment(assessment_id));

-- result_files
create policy "rfiles_select" on public.result_files for select to authenticated
  using (public.can_view_result(result_id));
create policy "rfiles_write" on public.result_files for all to authenticated
  using (public.can_manage_result(result_id)) with check (public.can_manage_result(result_id));

-- ---------- Kho file (riêng tư) ----------
-- Đường dẫn: assessments/<id bài kiểm tra>/<tên file>
--            results/<id kết quả>/<tên file>

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tdm', 'tdm', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

create function public.storage_can_view(object_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when (storage.foldername(object_name))[2] !~ '^[0-9]+$' then false
    when (storage.foldername(object_name))[1] = 'assessments'
      then public.can_view_assessment(((storage.foldername(object_name))[2])::bigint)
    when (storage.foldername(object_name))[1] = 'results'
      then public.can_view_result(((storage.foldername(object_name))[2])::bigint)
    else false
  end;
$$;

create function public.storage_can_manage(object_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when (storage.foldername(object_name))[2] !~ '^[0-9]+$' then false
    when (storage.foldername(object_name))[1] = 'assessments'
      then public.can_manage_assessment(((storage.foldername(object_name))[2])::bigint)
    when (storage.foldername(object_name))[1] = 'results'
      then public.can_manage_result(((storage.foldername(object_name))[2])::bigint)
    else false
  end;
$$;

revoke execute on function public.storage_can_view(text), public.storage_can_manage(text) from public, anon;
grant execute on function public.storage_can_view(text), public.storage_can_manage(text) to authenticated;

create policy "tdm_select" on storage.objects for select to authenticated
  using (bucket_id = 'tdm' and public.storage_can_view(name));
create policy "tdm_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'tdm' and public.storage_can_manage(name));
create policy "tdm_update" on storage.objects for update to authenticated
  using (bucket_id = 'tdm' and public.storage_can_manage(name))
  with check (bucket_id = 'tdm' and public.storage_can_manage(name));
create policy "tdm_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'tdm' and public.storage_can_manage(name));
