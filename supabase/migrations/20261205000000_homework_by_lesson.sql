-- =====================================================================
-- Bài tập về nhà theo bài học (Lớp → Chương → Bài, theo SGK Kết nối tri thức)
--
--   * Mỗi bài SGK có một bộ đề tương đương (thường 20 đề) trong ngân hàng đề,
--     đánh dấu usage = 'homework', kèm tên chương (chapter) và số bài (lesson_no);
--     tên bài nằm ở topic. Học sinh KHÔNG thấy các đề này ở mục luyện đề.
--   * Giáo viên giao bài cho một lớp: máy chủ chọn ngẫu nhiên cho mỗi học sinh một đề
--     (dùng hết các đề khác nhau trước khi lặp lại) và chép đề đó thành một bài của lớp
--     chỉ dành riêng cho em (quizzes.student_id). Bạn cùng lớp không thấy đề của nhau.
--   * Bản chép dùng chung hình với đề gốc (không chép file); quyền xem hình đi theo câu hỏi.
-- File này không xóa dữ liệu nào; chạy lại nhiều lần cũng được.
-- =====================================================================

-- ---------- Cột mới của quizzes ----------
alter table public.quizzes
  add column if not exists usage text not null default 'practice',
  add column if not exists chapter text,
  add column if not exists lesson_no smallint;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'quizzes_usage_check') then
    alter table public.quizzes add constraint quizzes_usage_check check (usage in ('practice', 'homework'));
  end if;
end $$;

-- ---------- Lượt giao bài về nhà ----------
create table if not exists public.homework (
  id              bigint generated always as identity primary key,
  class_id        bigint not null references public.classes (id) on delete cascade,
  grade           smallint not null check (grade between 6 and 12),
  chapter         text,
  lesson          text not null check (length(trim(lesson)) > 0),
  lesson_no       smallint,
  title           text not null check (length(trim(title)) > 0),
  due_at          timestamptz,
  time_limit_min  integer check (time_limit_min is null or time_limit_min between 1 and 600),
  published       boolean not null default true,
  created_by      uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at      timestamptz not null default now()
);
create index if not exists homework_class_idx on public.homework (class_id, created_at desc);

alter table public.quizzes
  add column if not exists homework_id    bigint references public.homework (id) on delete cascade,
  add column if not exists student_id     bigint references public.students (id) on delete cascade,
  add column if not exists source_quiz_id bigint references public.quizzes (id) on delete set null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'quizzes_student_needs_class') then
    alter table public.quizzes add constraint quizzes_student_needs_class
      check (student_id is null or class_id is not null);
  end if;
end $$;

create index if not exists quizzes_homework_idx on public.quizzes (homework_id) where homework_id is not null;
create index if not exists quizzes_student_idx  on public.quizzes (student_id)  where student_id is not null;
create index if not exists quizzes_lesson_idx   on public.quizzes (grade, topic) where class_id is null and usage = 'homework';
create index if not exists quiz_questions_image_idx on public.quiz_questions (image_path) where image_path is not null;
create index if not exists quiz_keys_image_idx on public.quiz_keys (explanation_image_path) where explanation_image_path is not null;

-- ---------- Học sinh dùng cho đề ----------
--   bài riêng của một học sinh → đúng em đó (kể cả khi em đã chuyển lớp)
--   đề của lớp                 → học sinh thuộc lớp đó
--   đề luyện tập               → mọi học sinh (không gồm đề dành cho bài về nhà)
create or replace function public.my_student_for_quiz(qid bigint) returns bigint
language sql stable security definer set search_path = '' as $$
  select s.id from public.students s
  join public.quizzes z on z.id = qid
  where s.parent_id = (select auth.uid())
    and case
          when z.student_id is not null then z.student_id = s.id
          when z.class_id is null then z.usage = 'practice'
          else z.class_id = s.class_id
        end
  order by s.id limit 1;
$$;

alter policy "quizzes_select" on public.quizzes
  using (public.can_manage_class(class_id)
         or (class_id is null and public.is_staff())
         or (published and class_id is null and usage = 'practice'
             and exists (select 1 from public.students s where s.parent_id = (select auth.uid())))
         or (published and class_id is not null and public.my_student_for_quiz(id) is not null)
         or public.has_my_attempt(id));

-- Danh sách chuyên đề luyện tập: bỏ các đề dành cho bài về nhà.
create or replace function public.practice_topics()
returns table (grade smallint, topic text, level text, quiz_count integer)
language sql stable security definer set search_path = '' as $$
  select z.grade, z.topic, z.level, count(*)::int
  from public.quizzes z
  where z.class_id is null and z.published and z.usage = 'practice'
    and (public.is_admin() or public.my_role() = 'teacher'
         or exists (select 1 from public.students s where s.parent_id = (select auth.uid())))
  group by z.grade, z.topic, z.level
  order by z.grade, z.topic, z.level;
$$;

-- ---------- Hình dùng chung giữa đề gốc và bản chép ----------
-- Hình nằm trong thư mục của đề gốc; ai xem được câu hỏi (hoặc lời giải) của bản chép
-- thì xem được hình đó.
create or replace function public.storage_can_view(object_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when (storage.foldername(object_name))[2] !~ '^[0-9]+$' then false
    when (storage.foldername(object_name))[1] = 'assessments'
      then public.can_view_assessment(((storage.foldername(object_name))[2])::bigint)
    when (storage.foldername(object_name))[1] = 'results'
      then public.can_view_result(((storage.foldername(object_name))[2])::bigint)
    when (storage.foldername(object_name))[1] = 'quizzes' and (storage.foldername(object_name))[3] = 'sol'
      then public.can_view_quiz_key(((storage.foldername(object_name))[2])::bigint)
        or exists (select 1 from public.quiz_keys k
                   join public.quiz_questions q on q.id = k.question_id
                   where k.explanation_image_path = object_name
                     and public.can_view_quiz_key(q.quiz_id))
    when (storage.foldername(object_name))[1] = 'quizzes'
      then public.can_print_quiz(((storage.foldername(object_name))[2])::bigint)
        or exists (select 1 from public.quiz_questions q
                   where q.image_path = object_name
                     and public.can_print_quiz(q.quiz_id))
    else false
  end;
$$;

-- Trong các hình của đề p_quiz, hình nào còn được câu hỏi / lời giải của đề KHÁC dùng
-- (không được xóa file đó).
create or replace function public.quiz_images_shared(p_quiz bigint, p_paths text[])
returns text[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(distinct p), '{}')
  from unnest(p_paths) p
  where public.can_manage_quiz(p_quiz)
    and (exists (select 1 from public.quiz_questions q where q.image_path = p and q.quiz_id <> p_quiz)
         or exists (select 1 from public.quiz_keys k join public.quiz_questions q on q.id = k.question_id
                    where k.explanation_image_path = p and q.quiz_id <> p_quiz));
$$;

-- ---------- Danh sách bài đã có đề (cho thanh chọn Chương → Bài) ----------
create or replace function public.homework_lessons(p_grade integer)
returns table (chapter text, lesson text, lesson_no smallint, variant_count integer)
language sql stable security definer set search_path = '' as $$
  select max(z.chapter), z.topic, min(z.lesson_no), count(*)::int
  from public.quizzes z
  where public.is_staff() and z.class_id is null and z.usage = 'homework' and z.published
    and z.grade = p_grade
  group by z.topic
  order by min(z.lesson_no) nulls last, z.topic;
$$;

-- ---------- Chép một đề thành bài riêng của một học sinh ----------
create or replace function public.homework_copy_quiz(p_homework bigint, p_source bigint, p_student bigint)
returns bigint
language plpgsql volatile security definer set search_path = '' as $$
declare h public.homework; src public.quizzes; nid bigint; qn bigint; q record;
begin
  select * into h from public.homework where id = p_homework;
  select * into src from public.quizzes where id = p_source;
  insert into public.quizzes (class_id, student_id, homework_id, source_quiz_id, title, description,
                              time_limit_min, due_at, show_key_after, published, created_by,
                              grade, topic, chapter, lesson_no, usage, sort_order)
  values (h.class_id, p_student, h.id, src.id, h.title, src.description,
          h.time_limit_min, h.due_at, 'submit', h.published, h.created_by,
          h.grade, h.lesson, h.chapter, h.lesson_no, 'homework', coalesce(src.sort_order, 0))
  returning id into nid;
  for q in select * from public.quiz_questions where quiz_id = src.id order by position, id loop
    insert into public.quiz_questions (quiz_id, position, kind, prompt, image_path, options, points)
    values (nid, q.position, q.kind, q.prompt, q.image_path, q.options, q.points)
    returning id into qn;
    insert into public.quiz_keys (question_id, answer, explanation, explanation_image_path)
    select qn, k.answer, k.explanation, k.explanation_image_path from public.quiz_keys k where k.question_id = q.id;
  end loop;
  return nid;
end $$;

-- Giao đề cho các học sinh của lớp chưa có đề trong lượt giao này. Trả về số em vừa được giao.
-- Mỗi em nhận đề đang được dùng ít nhất trong lượt giao (chọn ngẫu nhiên trong số đó), nên
-- lớp ≤ 20 em thì mỗi em một đề khác nhau.
create or replace function public.homework_fill(p_homework bigint) returns integer
language plpgsql volatile security definer set search_path = '' as $$
declare h public.homework; st record; pick bigint; n int := 0;
begin
  select * into h from public.homework where id = p_homework;
  for st in
    select s.id from public.students s
    where s.class_id = h.class_id
      and not exists (select 1 from public.quizzes c where c.homework_id = h.id and c.student_id = s.id)
    order by random()
  loop
    select v.id into pick
    from public.quizzes v
    where v.class_id is null and v.usage = 'homework' and v.published
      and v.grade = h.grade and v.topic = h.lesson
    order by (select count(*) from public.quizzes c where c.homework_id = h.id and c.source_quiz_id = v.id),
             random()
    limit 1;
    if pick is null then raise exception 'Bài "%" chưa có đề trong ngân hàng', h.lesson; end if;
    perform public.homework_copy_quiz(h.id, pick, st.id);
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.homework_copy_quiz(bigint, bigint, bigint), public.homework_fill(bigint)
  from public, anon, authenticated;

-- Giáo viên giao bài về nhà cho lớp.
create or replace function public.assign_homework(p_class bigint, p_lesson text,
  p_due timestamptz default null, p_time_limit integer default null) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare c public.classes; hid bigint; v record; n int;
begin
  if not public.can_manage_class(p_class) then raise exception 'Bạn không có quyền giao bài cho lớp này'; end if;
  select * into c from public.classes where id = p_class;
  if c.grade is null then raise exception 'Lớp chưa có khối lớp'; end if;
  if p_due is not null and p_due <= now() then raise exception 'Hạn nộp phải sau thời điểm hiện tại'; end if;
  if p_time_limit is not null and (p_time_limit < 1 or p_time_limit > 600) then raise exception 'Thời gian làm bài không hợp lệ'; end if;
  select max(z.chapter) as chapter, min(z.lesson_no) as lesson_no, count(*) as cnt into v
  from public.quizzes z
  where z.class_id is null and z.usage = 'homework' and z.published and z.grade = c.grade and z.topic = p_lesson;
  if coalesce(v.cnt, 0) = 0 then raise exception 'Bài "%" chưa có đề trong ngân hàng', p_lesson; end if;
  if not exists (select 1 from public.students s where s.class_id = p_class) then raise exception 'Lớp chưa có học sinh'; end if;

  insert into public.homework (class_id, grade, chapter, lesson, lesson_no, title, due_at, time_limit_min)
  values (p_class, c.grade, v.chapter, p_lesson, v.lesson_no, 'Bài tập về nhà: ' || p_lesson, p_due, p_time_limit)
  returning id into hid;
  n := public.homework_fill(hid);
  return jsonb_build_object('homework_id', hid, 'students', n, 'variants', v.cnt);
end $$;

-- Giao thêm cho học sinh mới vào lớp sau khi đã giao bài.
create or replace function public.homework_add_missing(p_homework bigint) returns integer
language plpgsql volatile security definer set search_path = '' as $$
declare h public.homework;
begin
  select * into h from public.homework where id = p_homework;
  if not found or not public.can_manage_class(h.class_id) then raise exception 'Không có quyền'; end if;
  return public.homework_fill(p_homework);
end $$;

-- Thu hồi / giao lại (ẩn / hiện bài với học sinh; bài đã làm vẫn giữ).
create or replace function public.homework_set_published(p_homework bigint, p_published boolean) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare h public.homework;
begin
  select * into h from public.homework where id = p_homework;
  if not found or not public.can_manage_class(h.class_id) then raise exception 'Không có quyền'; end if;
  update public.homework set published = p_published where id = p_homework;
  update public.quizzes set published = p_published where homework_id = p_homework;
end $$;

-- Đổi hạn nộp / thời gian làm bài cho cả lượt giao.
create or replace function public.homework_update(p_homework bigint, p_due timestamptz, p_time_limit integer) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare h public.homework;
begin
  select * into h from public.homework where id = p_homework;
  if not found or not public.can_manage_class(h.class_id) then raise exception 'Không có quyền'; end if;
  if p_time_limit is not null and (p_time_limit < 1 or p_time_limit > 600) then raise exception 'Thời gian làm bài không hợp lệ'; end if;
  update public.homework set due_at = p_due, time_limit_min = p_time_limit where id = p_homework;
  update public.quizzes set due_at = p_due, time_limit_min = p_time_limit where homework_id = p_homework;
end $$;

-- Không xóa lượt giao khi đã có học sinh làm bài (để không mất điểm). Có thể thu hồi.
create or replace function public.guard_homework_delete() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.quiz_attempts a join public.quizzes z on z.id = a.quiz_id
             where z.homework_id = old.id) then
    raise exception 'Đã có học sinh làm bài "%" nên không xóa được. Có thể bấm "Thu hồi".', old.title;
  end if;
  return old;
end $$;
create or replace trigger guard_homework_delete
  before delete on public.homework
  for each row execute function public.guard_homework_delete();

-- ---------- Quyền ----------
alter table public.homework enable row level security;
grant select, delete on public.homework to authenticated;
grant all on public.homework to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'homework' and policyname = 'homework_select') then
    create policy "homework_select" on public.homework for select to authenticated
      using (public.can_manage_class(class_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'homework' and policyname = 'homework_delete') then
    create policy "homework_delete" on public.homework for delete to authenticated
      using (public.can_manage_class(class_id));
  end if;
end $$;

revoke execute on function
  public.quiz_images_shared(bigint, text[]), public.homework_lessons(integer),
  public.assign_homework(bigint, text, timestamptz, integer), public.homework_add_missing(bigint),
  public.homework_set_published(bigint, boolean), public.homework_update(bigint, timestamptz, integer)
  from public, anon;
grant execute on function
  public.quiz_images_shared(bigint, text[]), public.homework_lessons(integer),
  public.assign_homework(bigint, text, timestamptz, integer), public.homework_add_missing(bigint),
  public.homework_set_published(bigint, boolean), public.homework_update(bigint, timestamptz, integer)
  to authenticated;
grant execute on all functions in schema public to service_role;

-- Báo cho máy chủ API nạp lại danh sách hàm mới.
notify pgrst, 'reload schema';
