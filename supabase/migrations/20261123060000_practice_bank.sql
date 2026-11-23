-- =====================================================================
-- Ngân hàng đề luyện tập theo chuyên đề
-- Đề luyện tập: class_id = null, có khối lớp, chuyên đề, mức độ.
-- Mọi học sinh đã đăng nhập đều thấy và làm được (mỗi đề 1 lần).
-- Đề do agent soạn và nhập qua hàm máy chủ import-exams.
-- =====================================================================

alter table public.quizzes alter column class_id drop not null;
alter table public.quizzes
  add column grade  smallint check (grade between 6 and 12),
  add column topic  text,
  add column level  text check (level in ('tb', 'kha', 'gioi')),
  add column slug   text unique,
  add column sort_order integer not null default 0;

alter table public.quizzes add constraint quizzes_class_or_bank check (
  class_id is not null
  or (grade is not null and topic is not null and length(trim(topic)) > 0 and level is not null)
);

create index on public.quizzes (grade, topic, level) where class_id is null;

-- Học sinh đang đăng nhập dùng cho đề này:
--   đề của lớp  → học sinh thuộc lớp đó
--   đề luyện tập → học sinh gắn với tài khoản (bất kỳ lớp nào)
create or replace function public.my_student_for_quiz(qid bigint) returns bigint
language sql stable security definer set search_path = '' as $$
  select s.id from public.students s
  join public.quizzes z on z.id = qid
  where s.parent_id = (select auth.uid())
    and (z.class_id is null or z.class_id = s.class_id)
  order by s.id limit 1;
$$;

-- Đề luyện tập đã xuất bản: mọi học sinh xem được.
drop policy if exists "quizzes_select" on public.quizzes;
create policy "quizzes_select" on public.quizzes for select to authenticated
  using (public.can_manage_class(class_id)
         or (published and class_id is null
             and exists (select 1 from public.students s where s.parent_id = (select auth.uid())))
         or (published and exists (select 1 from public.students s
                                   where s.parent_id = (select auth.uid()) and s.class_id = quizzes.class_id))
         or public.has_my_attempt(id));

-- Danh sách chuyên đề cho học sinh chọn (chỉ thống kê, không lộ câu hỏi).
create or replace function public.practice_topics()
returns table (grade smallint, topic text, level text, quiz_count integer)
language sql stable security definer set search_path = '' as $$
  select z.grade, z.topic, z.level, count(*)::int
  from public.quizzes z
  where z.class_id is null and z.published
    and (public.is_admin() or public.my_role() = 'teacher'
         or exists (select 1 from public.students s where s.parent_id = (select auth.uid())))
  group by z.grade, z.topic, z.level
  order by z.grade, z.topic, z.level;
$$;
revoke execute on function public.practice_topics() from public, anon;
grant execute on function public.practice_topics() to authenticated, service_role;
