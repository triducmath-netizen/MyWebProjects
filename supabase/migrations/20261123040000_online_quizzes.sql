-- =====================================================================
-- Trí Đức Math — Bài kiểm tra trực tuyến
-- Trắc nghiệm 4 phương án, Đúng/Sai (4 ý), Trả lời ngắn.
-- Chấm điểm hoàn toàn trên máy chủ; đáp án chỉ hiện sau khi nộp bài.
-- Học sinh làm bài bằng tài khoản mã học sinh (students.parent_id = auth.uid()).
-- =====================================================================

create type public.question_kind as enum ('mcq', 'tf', 'short');

create table public.quizzes (
  id              bigint generated always as identity primary key,
  class_id        bigint not null references public.classes (id) on delete cascade,
  title           text not null check (length(trim(title)) > 0),
  description     text,
  time_limit_min  integer check (time_limit_min is null or time_limit_min between 1 and 600),
  opens_at        timestamptz,
  due_at          timestamptz,
  show_key_after  text not null default 'submit' check (show_key_after in ('submit', 'due')),
  published       boolean not null default false,
  created_by      uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at      timestamptz not null default now(),
  check (opens_at is null or due_at is null or opens_at < due_at)
);

-- Câu hỏi: KHÔNG chứa đáp án.
--   mcq:   options = ["nội dung A", "B", "C", "D"]
--   tf:    options = ["ý a", "ý b", "ý c", "ý d"]
--   short: options = null
create table public.quiz_questions (
  id          bigint generated always as identity primary key,
  quiz_id     bigint not null references public.quizzes (id) on delete cascade,
  position    integer not null default 0,
  kind        public.question_kind not null,
  prompt      text not null default '',
  image_path  text,
  options     jsonb,
  points      numeric(5, 2) not null check (points > 0),
  check (
    (kind in ('mcq', 'tf') and jsonb_typeof(options) = 'array' and jsonb_array_length(options) = 4)
    or (kind = 'short' and options is null)
  )
);

-- Đáp án + lời giải, tách riêng để học sinh không đọc được trước khi nộp.
--   mcq:   answer = 0..3            (chỉ số phương án đúng)
--   tf:    answer = [true,false,..] (4 giá trị)
--   short: answer = ["1.5", "3/2"]  (các đáp án được chấp nhận)
create table public.quiz_keys (
  question_id           bigint primary key references public.quiz_questions (id) on delete cascade,
  answer                jsonb not null,
  explanation           text,
  explanation_image_path text
);

-- Lượt làm bài: mỗi học sinh 1 lượt / bài.
create table public.quiz_attempts (
  id            bigint generated always as identity primary key,
  quiz_id       bigint not null references public.quizzes (id) on delete cascade,
  student_id    bigint not null references public.students (id) on delete cascade,
  started_at    timestamptz not null default now(),
  deadline_at   timestamptz,
  submitted_at  timestamptz,
  answers       jsonb not null default '{}'::jsonb,
  score         numeric(6, 2),
  max_score     numeric(6, 2),
  detail        jsonb,
  unique (quiz_id, student_id)
);

create index on public.quizzes (class_id, created_at desc);
create index on public.quiz_questions (quiz_id, position);
create index on public.quiz_attempts (student_id);

-- ---------- Hàm quyền ----------

create function public.can_manage_quiz(qid bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.quizzes z where z.id = qid and public.can_manage_class(z.class_id));
$$;

-- Mã học sinh của người đang đăng nhập trong lớp của bài (null nếu không phải).
create function public.my_student_for_quiz(qid bigint) returns bigint
language sql stable security definer set search_path = '' as $$
  select s.id from public.students s
  join public.quizzes z on z.class_id = s.class_id
  where z.id = qid and s.parent_id = (select auth.uid())
  order by s.id limit 1;
$$;

create function public.has_my_attempt(qid bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.quiz_attempts a
    join public.students s on s.id = a.student_id
    where a.quiz_id = qid and s.parent_id = (select auth.uid())
  );
$$;

create function public.can_view_quiz_key(qid bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.can_manage_quiz(qid) or exists (
    select 1 from public.quiz_attempts a
    join public.students s on s.id = a.student_id
    join public.quizzes z on z.id = a.quiz_id
    where a.quiz_id = qid and s.parent_id = (select auth.uid())
      and a.submitted_at is not null
      and (z.show_key_after = 'submit' or z.due_at is null or now() >= z.due_at)
  );
$$;

-- ---------- Chấm điểm ----------

create function public.normalize_short(t text) returns text
language sql immutable set search_path = '' as $$
  select lower(replace(regexp_replace(coalesce(t, ''), '\s+', '', 'g'), ',', '.'));
$$;

create function public.short_answer_match(ans text, keys jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare a text := public.normalize_short(ans); k text;
begin
  if a = '' or jsonb_typeof(keys) <> 'array' then return false; end if;
  for k in select public.normalize_short(v) from jsonb_array_elements_text(keys) v loop
    if k = '' then continue; end if;
    if a ~ '^-?[0-9]+(\.[0-9]+)?$' and k ~ '^-?[0-9]+(\.[0-9]+)?$' then
      if a::numeric = k::numeric then return true; end if;
    elsif a = k then
      return true;
    end if;
  end loop;
  return false;
end $$;

-- Điểm Đúng/Sai theo thi THPT 2025: đúng 1/2/3/4 ý → 10% / 25% / 50% / 100% điểm câu.
create function public.grade_answers(p_quiz bigint, p_answers jsonb,
  out total numeric, out max_total numeric, out detail jsonb)
language plpgsql stable security definer set search_path = '' as $$
declare
  q record; a jsonb; pts numeric; nc int; i int;
  tf_scale numeric[] := array[0, 0.1, 0.25, 0.5, 1];
begin
  total := 0; max_total := 0; detail := '{}'::jsonb;
  for q in
    select qq.id, qq.kind, qq.points, k.answer
    from public.quiz_questions qq
    left join public.quiz_keys k on k.question_id = qq.id
    where qq.quiz_id = p_quiz
  loop
    a := p_answers -> q.id::text;
    pts := 0;
    if q.answer is not null and a is not null then
      if q.kind = 'mcq' then
        if jsonb_typeof(a) = 'number' and jsonb_typeof(q.answer) = 'number' and a = q.answer then
          pts := q.points;
        end if;
      elsif q.kind = 'tf' then
        nc := 0;
        if jsonb_typeof(a) = 'array' and jsonb_typeof(q.answer) = 'array' then
          for i in 0..3 loop
            if jsonb_typeof(a -> i) = 'boolean' and (a -> i) = (q.answer -> i) then nc := nc + 1; end if;
          end loop;
        end if;
        pts := q.points * tf_scale[nc + 1];
      elsif q.kind = 'short' then
        if jsonb_typeof(a) = 'string' and public.short_answer_match(a #>> '{}', q.answer) then
          pts := q.points;
        end if;
      end if;
    end if;
    pts := round(pts, 2);
    total := total + pts;
    max_total := max_total + q.points;
    detail := detail || jsonb_build_object(q.id::text, pts);
  end loop;
  total := round(total, 2);
end $$;

-- ---------- Làm bài (chỉ qua các hàm này) ----------

-- Bắt đầu làm bài: tạo lượt làm (hoặc trả lại lượt đang làm).
create function public.start_quiz(p_quiz bigint) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare z public.quizzes; sid bigint; att public.quiz_attempts; dl timestamptz;
begin
  select * into z from public.quizzes where id = p_quiz;
  if not found then raise exception 'Không tìm thấy bài kiểm tra'; end if;
  sid := public.my_student_for_quiz(p_quiz);
  if sid is null then raise exception 'Bài kiểm tra này không dành cho lớp của bạn'; end if;

  select * into att from public.quiz_attempts where quiz_id = p_quiz and student_id = sid;
  if found then
    return jsonb_build_object('attempt_id', att.id, 'deadline_at', att.deadline_at,
                              'submitted', att.submitted_at is not null, 'answers', att.answers);
  end if;

  if not z.published then raise exception 'Bài kiểm tra chưa được mở'; end if;
  if z.opens_at is not null and now() < z.opens_at then raise exception 'Bài kiểm tra chưa đến giờ mở'; end if;
  if z.due_at is not null and now() >= z.due_at then raise exception 'Bài kiểm tra đã hết hạn nộp'; end if;

  dl := case when z.time_limit_min is null then null else now() + make_interval(mins => z.time_limit_min) end;
  if z.due_at is not null and (dl is null or z.due_at < dl) then dl := z.due_at; end if;

  insert into public.quiz_attempts (quiz_id, student_id, deadline_at)
  values (p_quiz, sid, dl) returning * into att;
  return jsonb_build_object('attempt_id', att.id, 'deadline_at', att.deadline_at,
                            'submitted', false, 'answers', att.answers);
end $$;

-- Lưu tạm câu trả lời trong lúc làm (để không mất khi mất mạng / đổi máy).
create function public.save_quiz_answers(p_attempt bigint, p_answers jsonb) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare att public.quiz_attempts;
begin
  if jsonb_typeof(p_answers) <> 'object' then raise exception 'Dữ liệu không hợp lệ'; end if;
  select a.* into att from public.quiz_attempts a
  join public.students s on s.id = a.student_id
  where a.id = p_attempt and s.parent_id = (select auth.uid());
  if not found then raise exception 'Không tìm thấy bài làm'; end if;
  if att.submitted_at is not null then raise exception 'Bài đã nộp'; end if;
  if att.deadline_at is not null and now() > att.deadline_at + interval '30 seconds' then
    raise exception 'Đã hết giờ làm bài';
  end if;
  update public.quiz_attempts set answers = p_answers where id = p_attempt;
end $$;

-- Chấm và lưu một lượt làm.
create function public.finalize_attempt(p_attempt bigint, p_answers jsonb) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare att public.quiz_attempts; g record; ans jsonb;
begin
  select * into att from public.quiz_attempts where id = p_attempt for update;
  if att.submitted_at is not null then
    return jsonb_build_object('score', att.score, 'max_score', att.max_score);
  end if;
  -- Nộp trong giờ (cho trễ 60 giây vì mạng): dùng câu trả lời gửi lên.
  -- Quá giờ: dùng câu trả lời đã lưu tạm gần nhất.
  if p_answers is not null and jsonb_typeof(p_answers) = 'object'
     and (att.deadline_at is null or now() <= att.deadline_at + interval '60 seconds') then
    ans := p_answers;
  else
    ans := att.answers;
  end if;
  select * into g from public.grade_answers(att.quiz_id, ans);
  update public.quiz_attempts
    set answers = ans, submitted_at = now(), score = g.total, max_score = g.max_total, detail = g.detail
    where id = p_attempt;
  return jsonb_build_object('score', g.total, 'max_score', g.max_total);
end $$;
revoke execute on function public.finalize_attempt(bigint, jsonb) from public, anon, authenticated;

-- Học sinh nộp bài (cũng dùng để chốt bài khi đã hết giờ mà chưa nộp).
create function public.submit_quiz(p_attempt bigint, p_answers jsonb default null) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.quiz_attempts a join public.students s on s.id = a.student_id
    where a.id = p_attempt and s.parent_id = (select auth.uid())
  ) then raise exception 'Không tìm thấy bài làm'; end if;
  return public.finalize_attempt(p_attempt, p_answers);
end $$;

-- Giáo viên: chốt các bài đã hết giờ mà học sinh chưa bấm nộp.
create function public.finalize_expired_attempts(p_quiz bigint) returns integer
language plpgsql volatile security definer set search_path = '' as $$
declare r record; n int := 0;
begin
  if not public.can_manage_quiz(p_quiz) then raise exception 'Không có quyền'; end if;
  for r in select a.id from public.quiz_attempts a
           where a.quiz_id = p_quiz and a.submitted_at is null
             and a.deadline_at is not null and now() > a.deadline_at + interval '60 seconds'
  loop
    perform public.finalize_attempt(r.id, null);
    n := n + 1;
  end loop;
  return n;
end $$;

-- Giáo viên: chấm lại toàn bộ bài đã nộp (sau khi sửa đáp án).
create function public.regrade_quiz(p_quiz bigint) returns integer
language plpgsql volatile security definer set search_path = '' as $$
declare r record; g record; n int := 0;
begin
  if not public.can_manage_quiz(p_quiz) then raise exception 'Không có quyền'; end if;
  for r in select id, answers from public.quiz_attempts where quiz_id = p_quiz and submitted_at is not null loop
    select * into g from public.grade_answers(p_quiz, r.answers);
    update public.quiz_attempts set score = g.total, max_score = g.max_total, detail = g.detail where id = r.id;
    n := n + 1;
  end loop;
  return n;
end $$;

-- ---------- Quyền bảng ----------

grant select, insert, update, delete on public.quizzes, public.quiz_questions, public.quiz_keys to authenticated;
grant select, delete on public.quiz_attempts to authenticated;
grant all on public.quizzes, public.quiz_questions, public.quiz_keys, public.quiz_attempts to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;

revoke execute on function
  public.can_manage_quiz(bigint), public.my_student_for_quiz(bigint), public.has_my_attempt(bigint),
  public.can_view_quiz_key(bigint), public.grade_answers(bigint, jsonb),
  public.start_quiz(bigint), public.save_quiz_answers(bigint, jsonb),
  public.submit_quiz(bigint, jsonb), public.finalize_expired_attempts(bigint), public.regrade_quiz(bigint)
  from public, anon;
grant execute on function
  public.can_manage_quiz(bigint), public.my_student_for_quiz(bigint), public.has_my_attempt(bigint),
  public.can_view_quiz_key(bigint),
  public.start_quiz(bigint), public.save_quiz_answers(bigint, jsonb),
  public.submit_quiz(bigint, jsonb), public.finalize_expired_attempts(bigint), public.regrade_quiz(bigint)
  to authenticated;
-- grade_answers chỉ được gọi từ bên trong các hàm trên, không gọi trực tiếp (tránh dò đáp án).
revoke execute on function public.grade_answers(bigint, jsonb) from authenticated;
grant execute on all functions in schema public to service_role;

alter table public.quizzes        enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_keys      enable row level security;
alter table public.quiz_attempts  enable row level security;

-- quizzes: giáo viên lớp đó quản lý; học sinh thấy bài đã mở của lớp mình (hoặc bài mình đã làm).
create policy "quizzes_select" on public.quizzes for select to authenticated
  using (public.can_manage_class(class_id)
         or (published and exists (select 1 from public.students s
                                   where s.parent_id = (select auth.uid()) and s.class_id = quizzes.class_id))
         or public.has_my_attempt(id));
create policy "quizzes_write" on public.quizzes for all to authenticated
  using (public.can_manage_class(class_id)) with check (public.can_manage_class(class_id));

-- quiz_questions: học sinh chỉ thấy câu hỏi sau khi bấm Bắt đầu.
create policy "qq_select" on public.quiz_questions for select to authenticated
  using (public.can_manage_quiz(quiz_id) or public.has_my_attempt(quiz_id));
create policy "qq_write" on public.quiz_questions for all to authenticated
  using (public.can_manage_quiz(quiz_id)) with check (public.can_manage_quiz(quiz_id));

-- quiz_keys: học sinh chỉ thấy đáp án sau khi nộp.
create policy "qk_select" on public.quiz_keys for select to authenticated
  using (public.can_view_quiz_key((select q.quiz_id from public.quiz_questions q where q.id = question_id)));
create policy "qk_write" on public.quiz_keys for all to authenticated
  using (public.can_manage_quiz((select q.quiz_id from public.quiz_questions q where q.id = question_id)))
  with check (public.can_manage_quiz((select q.quiz_id from public.quiz_questions q where q.id = question_id)));

-- quiz_attempts: học sinh xem lượt của mình; giáo viên xem và xóa (cho làm lại).
-- Không ai ghi trực tiếp — chỉ qua start_quiz / save_quiz_answers / submit_quiz.
create policy "qa_select" on public.quiz_attempts for select to authenticated
  using (public.can_manage_quiz(quiz_id)
         or exists (select 1 from public.students s where s.id = student_id and s.parent_id = (select auth.uid())));
create policy "qa_delete" on public.quiz_attempts for delete to authenticated
  using (public.can_manage_quiz(quiz_id));

-- ---------- Kho file: thêm thư mục quizzes ----------
--   quizzes/<id>/<file>      hình trong đề: xem được sau khi bắt đầu làm
--   quizzes/<id>/sol/<file>  hình lời giải: xem được sau khi nộp

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
    when (storage.foldername(object_name))[1] = 'quizzes'
      then public.can_manage_quiz(((storage.foldername(object_name))[2])::bigint)
        or public.has_my_attempt(((storage.foldername(object_name))[2])::bigint)
    else false
  end;
$$;

create or replace function public.storage_can_manage(object_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when (storage.foldername(object_name))[2] !~ '^[0-9]+$' then false
    when (storage.foldername(object_name))[1] = 'assessments'
      then public.can_manage_assessment(((storage.foldername(object_name))[2])::bigint)
    when (storage.foldername(object_name))[1] = 'results'
      then public.can_manage_result(((storage.foldername(object_name))[2])::bigint)
    when (storage.foldername(object_name))[1] = 'quizzes'
      then public.can_manage_quiz(((storage.foldername(object_name))[2])::bigint)
    else false
  end;
$$;
