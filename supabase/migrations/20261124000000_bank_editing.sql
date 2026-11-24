-- =====================================================================
-- Ngân hàng đề trên trang giáo viên
--   * Giáo viên (và quản trị) xem, sửa đề luyện tập (class_id = null):
--     tiêu đề, thời gian, câu hỏi, phương án, đáp án, lời giải.
--   * Chỉ quản trị viên được xóa câu hỏi hoặc xóa đề luyện tập,
--     ẩn/hiện đề, đổi lớp/chuyên đề/mức độ.
--   * Đề luyện tập đã có học sinh làm: KHÔNG xóa được đề, không thêm/xóa câu
--     (để điểm các bài đã nộp không bị sai). Vẫn sửa nội dung/đáp án được,
--     sau đó chấm lại.
-- Đề của lớp (class_id có giá trị) giữ nguyên quy tắc cũ.
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

-- Xóa câu hỏi / đáp án / bài làm của một đề: đề lớp → giáo viên lớp; đề luyện tập → chỉ quản trị.
create or replace function public.can_delete_quiz_content(qid bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.quizzes z
    where z.id = qid
      and (case when z.class_id is null then public.is_admin() else public.can_manage_class(z.class_id) end)
  );
$$;

revoke execute on function public.is_staff(), public.can_delete_quiz_content(bigint) from public, anon;
grant execute on function public.is_staff(), public.can_delete_quiz_content(bigint) to authenticated, service_role;

-- ---------- quizzes ----------
-- quizzes_write (cũ) cho phép giáo viên lớp + quản trị (với đề luyện tập vì can_manage_class(null) = is_admin()).
-- Thêm: giáo viên được SỬA đề luyện tập (không chuyển thành đề lớp).
drop policy if exists "quizzes_bank_update" on public.quizzes;
create policy "quizzes_bank_update" on public.quizzes for update to authenticated
  using (class_id is null and public.is_staff())
  with check (class_id is null and public.is_staff());

-- Giáo viên xem được toàn bộ đề luyện tập (kể cả đề đang ẩn).
drop policy if exists "quizzes_select" on public.quizzes;
create policy "quizzes_select" on public.quizzes for select to authenticated
  using (public.can_manage_class(class_id)
         or (class_id is null and public.is_staff())
         or (published and class_id is null
             and exists (select 1 from public.students s where s.parent_id = (select auth.uid())))
         or (published and exists (select 1 from public.students s
                                   where s.parent_id = (select auth.uid()) and s.class_id = quizzes.class_id))
         or public.has_my_attempt(id));

-- Giáo viên không phải quản trị: không được đổi ẩn/hiện, khối lớp, chuyên đề, mức độ, mã đề của đề luyện tập.
-- (Máy chủ nhập đề / SQL Editor không đăng nhập → auth.uid() rỗng → được phép.)
create or replace function public.guard_bank_quiz_update() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.class_id is null and (select auth.uid()) is not null and not public.is_admin() then
    if new.published is distinct from old.published
       or new.grade is distinct from old.grade or new.topic is distinct from old.topic
       or new.level is distinct from old.level or new.slug is distinct from old.slug
       or new.sort_order is distinct from old.sort_order or new.class_id is distinct from old.class_id then
      raise exception 'Chỉ quản trị viên được ẩn/hiện đề hoặc đổi lớp, chuyên đề, mức độ của đề luyện tập';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists guard_bank_quiz_update on public.quizzes;
create trigger guard_bank_quiz_update before update on public.quizzes
  for each row execute function public.guard_bank_quiz_update();

-- Không xóa đề luyện tập đã có học sinh làm.
create or replace function public.guard_bank_quiz_delete() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.class_id is null and exists (select 1 from public.quiz_attempts a where a.quiz_id = old.id) then
    raise exception 'Đề "%" đã có học sinh làm bài nên không xóa được', old.title;
  end if;
  return old;
end $$;
drop trigger if exists guard_bank_quiz_delete on public.quizzes;
create trigger guard_bank_quiz_delete before delete on public.quizzes
  for each row execute function public.guard_bank_quiz_delete();

-- ---------- quiz_questions ----------
drop policy if exists "qq_write" on public.quiz_questions;
drop policy if exists "qq_insert" on public.quiz_questions;
drop policy if exists "qq_update" on public.quiz_questions;
drop policy if exists "qq_delete" on public.quiz_questions;
create policy "qq_insert" on public.quiz_questions for insert to authenticated
  with check (public.can_manage_quiz(quiz_id));
create policy "qq_update" on public.quiz_questions for update to authenticated
  using (public.can_manage_quiz(quiz_id)) with check (public.can_manage_quiz(quiz_id));
create policy "qq_delete" on public.quiz_questions for delete to authenticated
  using (public.can_delete_quiz_content(quiz_id));

-- Đề luyện tập đã có bài làm: không thêm/xóa câu, không đổi loại câu, không chuyển câu sang đề khác.
create or replace function public.guard_bank_question() returns trigger
language plpgsql security definer set search_path = '' as $$
declare qid bigint := case when tg_op = 'DELETE' then old.quiz_id else new.quiz_id end;
begin
  if exists (select 1 from public.quizzes z where z.id = qid and z.class_id is null)
     and exists (select 1 from public.quiz_attempts a where a.quiz_id = qid) then
    if tg_op = 'INSERT' then
      raise exception 'Đề luyện tập đã có học sinh làm: không thêm câu được (chỉ sửa nội dung, đáp án)';
    elsif tg_op = 'DELETE' then
      raise exception 'Đề luyện tập đã có học sinh làm: không xóa câu được (chỉ sửa nội dung, đáp án)';
    elsif new.kind is distinct from old.kind or new.quiz_id is distinct from old.quiz_id then
      raise exception 'Đề luyện tập đã có học sinh làm: không đổi loại câu được';
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
drop trigger if exists guard_bank_question on public.quiz_questions;
create trigger guard_bank_question before insert or update or delete on public.quiz_questions
  for each row execute function public.guard_bank_question();

-- ---------- quiz_keys ----------
drop policy if exists "qk_write" on public.quiz_keys;
drop policy if exists "qk_insert" on public.quiz_keys;
drop policy if exists "qk_update" on public.quiz_keys;
drop policy if exists "qk_delete" on public.quiz_keys;
create policy "qk_insert" on public.quiz_keys for insert to authenticated
  with check (public.can_manage_quiz((select q.quiz_id from public.quiz_questions q where q.id = question_id)));
create policy "qk_update" on public.quiz_keys for update to authenticated
  using (public.can_manage_quiz((select q.quiz_id from public.quiz_questions q where q.id = question_id)))
  with check (public.can_manage_quiz((select q.quiz_id from public.quiz_questions q where q.id = question_id)));
create policy "qk_delete" on public.quiz_keys for delete to authenticated
  using (public.can_delete_quiz_content((select q.quiz_id from public.quiz_questions q where q.id = question_id)));

-- ---------- quiz_attempts ----------
-- "Cho làm lại" (xóa bài làm): đề lớp → giáo viên lớp; đề luyện tập → chỉ quản trị.
drop policy if exists "qa_delete" on public.quiz_attempts;
create policy "qa_delete" on public.quiz_attempts for delete to authenticated
  using (public.can_delete_quiz_content(quiz_id));

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
revoke execute on function public.bank_quizzes() from public, anon;
grant execute on function public.bank_quizzes() to authenticated, service_role;
