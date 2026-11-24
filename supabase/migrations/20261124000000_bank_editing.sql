-- =====================================================================
-- Ngân hàng đề trên trang giáo viên
--   * Giáo viên (và quản trị) xem, sửa đề luyện tập (class_id = null):
--     tiêu đề, thời gian, câu hỏi, phương án, đáp án, lời giải.
--   * Chỉ quản trị viên được xóa câu / đáp án / bài làm / đề luyện tập,
--     ẩn/hiện đề, đổi lớp/chuyên đề/mức độ.
--   * Đề luyện tập đã có học sinh làm: KHÔNG xóa được đề, không thêm/xóa câu
--     (để điểm các bài đã nộp không bị sai). Vẫn sửa nội dung, đáp án được.
-- Đề của lớp (class_id có giá trị) giữ nguyên quy tắc cũ.
-- File này không xóa dữ liệu nào; chạy lại nhiều lần cũng được.
-- =====================================================================

-- Người đang đăng nhập là giáo viên hoặc quản trị viên.
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.my_role() in ('admin', 'teacher'), false);
$$;

-- Quản lý (xem đáp án, sửa) một đề: đề lớp → giáo viên lớp đó; đề luyện tập → mọi giáo viên.
create or replace function public.can_manage_quiz(qid bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.quizzes z
    where z.id = qid
      and (public.can_manage_class(z.class_id) or (z.class_id is null and public.is_staff()))
  );
$$;

grant execute on function public.is_staff() to authenticated, service_role;
revoke execute on function public.is_staff() from public, anon;

-- Giáo viên xem được toàn bộ đề luyện tập (kể cả đề đang ẩn).
alter policy "quizzes_select" on public.quizzes
  using (public.can_manage_class(class_id)
         or (class_id is null and public.is_staff())
         or (published and class_id is null
             and exists (select 1 from public.students s where s.parent_id = (select auth.uid())))
         or (published and exists (select 1 from public.students s
                                   where s.parent_id = (select auth.uid()) and s.class_id = quizzes.class_id))
         or public.has_my_attempt(id));

-- Giáo viên được SỬA đề luyện tập (không chuyển thành đề lớp).
-- Chỉ tạo nếu chưa có (không dùng lệnh xóa).
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'quizzes'
                 and policyname = 'quizzes_bank_update') then
    create policy "quizzes_bank_update" on public.quizzes for update to authenticated
      using (class_id is null and public.is_staff())
      with check (class_id is null and public.is_staff());
  end if;
end $$;

-- ---------- Kiểm tra trên máy chủ (trigger) ----------
-- Ai đang đăng nhập: auth.uid() rỗng = máy chủ nhập đề / SQL Editor → luôn được phép.

-- quizzes: sửa / xóa
create or replace function public.guard_bank_quiz() returns trigger
language plpgsql security definer set search_path = '' as $$
declare logged_in boolean := (select auth.uid()) is not null;
begin
  if old.class_id is not null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'DELETE' then
    if logged_in and not public.is_admin() then
      raise exception 'Chỉ quản trị viên được xóa đề luyện tập';
    end if;
    if exists (select 1 from public.quiz_attempts a where a.quiz_id = old.id) then
      raise exception 'Đề "%" đã có học sinh làm bài nên không xóa được. Có thể bấm "Ẩn đề".', old.title;
    end if;
    return old;
  end if;
  -- UPDATE
  if logged_in and not public.is_admin() and (
       new.published is distinct from old.published
       or new.grade is distinct from old.grade or new.topic is distinct from old.topic
       or new.level is distinct from old.level or new.slug is distinct from old.slug
       or new.sort_order is distinct from old.sort_order or new.class_id is distinct from old.class_id) then
    raise exception 'Chỉ quản trị viên được ẩn/hiện đề hoặc đổi lớp, chuyên đề, mức độ của đề luyện tập';
  end if;
  return new;
end $$;

create or replace trigger guard_bank_quiz
  before update or delete on public.quizzes
  for each row execute function public.guard_bank_quiz();

-- quiz_questions: thêm / sửa / xóa câu
create or replace function public.guard_bank_question() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  qid bigint;
  logged_in boolean := (select auth.uid()) is not null;
  is_bank boolean;
  has_attempts boolean;
begin
  if tg_op = 'DELETE' then qid := old.quiz_id; else qid := new.quiz_id; end if;
  select z.class_id is null into is_bank from public.quizzes z where z.id = qid;
  -- Đề không còn (đang xóa cả đề) hoặc đề của lớp: giữ quy tắc cũ.
  if is_bank is distinct from true then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
  has_attempts := exists (select 1 from public.quiz_attempts a where a.quiz_id = qid);

  if tg_op = 'DELETE' then
    if logged_in and not public.is_admin() then
      raise exception 'Chỉ quản trị viên được xóa câu trong đề luyện tập';
    end if;
    if has_attempts then
      raise exception 'Đề luyện tập đã có học sinh làm: không xóa câu được (chỉ sửa nội dung, đáp án)';
    end if;
    return old;
  elsif tg_op = 'INSERT' then
    if has_attempts then
      raise exception 'Đề luyện tập đã có học sinh làm: không thêm câu được (chỉ sửa nội dung, đáp án)';
    end if;
  elsif has_attempts and (new.kind is distinct from old.kind or new.quiz_id is distinct from old.quiz_id) then
    raise exception 'Đề luyện tập đã có học sinh làm: không đổi loại câu được';
  end if;
  return new;
end $$;

create or replace trigger guard_bank_question
  before insert or update or delete on public.quiz_questions
  for each row execute function public.guard_bank_question();

-- quiz_keys: xóa đáp án; quiz_attempts: xóa bài làm ("Cho làm lại") → đề luyện tập chỉ quản trị.
create or replace function public.guard_bank_child_delete() returns trigger
language plpgsql security definer set search_path = '' as $$
declare qid bigint;
begin
  if (select auth.uid()) is null or public.is_admin() then return old; end if;
  if tg_table_name = 'quiz_keys' then
    select q.quiz_id into qid from public.quiz_questions q where q.id = old.question_id;
  else
    qid := old.quiz_id;
  end if;
  if exists (select 1 from public.quizzes z where z.id = qid and z.class_id is null) then
    raise exception 'Chỉ quản trị viên được xóa dữ liệu của đề luyện tập';
  end if;
  return old;
end $$;

create or replace trigger guard_bank_key_delete
  before delete on public.quiz_keys
  for each row execute function public.guard_bank_child_delete();
create or replace trigger guard_bank_attempt_delete
  before delete on public.quiz_attempts
  for each row execute function public.guard_bank_child_delete();

-- ---------- Danh sách ngân hàng đề cho giáo viên ----------
create or replace function public.bank_quizzes()
returns table (id bigint, title text, grade smallint, topic text, level text, slug text,
               time_limit_min integer, published boolean, sort_order integer,
               question_count integer, attempt_count integer, submitted_count integer)
language sql stable security definer set search_path = '' as $$
  select z.id, z.title, z.grade, z.topic, z.level, z.slug, z.time_limit_min, z.published, z.sort_order,
         (select count(*)::int from public.quiz_questions q where q.quiz_id = z.id),
         (select count(*)::int from public.quiz_attempts a where a.quiz_id = z.id),
         (select count(*)::int from public.quiz_attempts a where a.quiz_id = z.id and a.submitted_at is not null)
  from public.quizzes z
  where z.class_id is null and public.is_staff()
  order by z.grade, z.topic, z.level, z.sort_order, z.id;
$$;
grant execute on function public.bank_quizzes() to authenticated, service_role;
revoke execute on function public.bank_quizzes() from public, anon;

-- Báo cho máy chủ API nạp lại danh sách hàm mới.
notify pgrst, 'reload schema';
