-- =====================================================================
-- Làm bài trên giấy
--   * Học sinh tải đề (PDF) để in mà KHÔNG phải bấm "Bắt đầu" (đồng hồ không chạy).
--   * Đề luyện tập: học sinh làm trên giấy rồi tự nhập phiếu trả lời → máy chủ chấm,
--     lưu điểm và lời giải như bài làm trực tuyến (mode = 'paper').
--   * Đề giáo viên giao: giáo viên chấm bài giấy và nhập điểm (mode = 'manual').
-- =====================================================================

alter table public.quiz_attempts
  add column if not exists mode text not null default 'online';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'quiz_attempts_mode_check') then
    alter table public.quiz_attempts add constraint quiz_attempts_mode_check
      check (mode in ('online', 'paper', 'manual'));
  end if;
end $$;

-- Được xem câu hỏi (không có đáp án) để in đề:
--   giáo viên quản lý đề; người đã có lượt làm; hoặc học sinh được làm đề đã mở.
create or replace function public.can_print_quiz(qid bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.can_manage_quiz(qid)
      or public.has_my_attempt(qid)
      or exists (
        select 1 from public.quizzes z
        where z.id = qid and z.published
          and (z.opens_at is null or now() >= z.opens_at)
          and public.my_student_for_quiz(qid) is not null
      );
$$;

-- Câu hỏi của đề để in (không bao giờ trả đáp án).
create or replace function public.quiz_paper_questions(p_quiz bigint)
returns table (id bigint, "position" integer, kind public.question_kind, prompt text,
               image_path text, options jsonb, points numeric)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.can_print_quiz(p_quiz) then
    raise exception 'Bạn chưa tải được đề này';
  end if;
  return query
    select q.id, q.position, q.kind, q.prompt, q.image_path, q.options, q.points
    from public.quiz_questions q where q.quiz_id = p_quiz
    order by q.position, q.id;
end $$;

-- Đề luyện tập: học sinh nộp phiếu trả lời của bài làm trên giấy → chấm ngay.
create or replace function public.submit_paper_quiz(p_quiz bigint, p_answers jsonb) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare z public.quizzes; sid bigint; att public.quiz_attempts; res jsonb;
begin
  if p_answers is null or jsonb_typeof(p_answers) <> 'object' then raise exception 'Dữ liệu không hợp lệ'; end if;
  select * into z from public.quizzes where id = p_quiz;
  if not found then raise exception 'Không tìm thấy đề'; end if;
  if z.class_id is not null then
    raise exception 'Bài giáo viên giao: nộp bài giấy cho giáo viên để giáo viên nhập điểm';
  end if;
  if not z.published then raise exception 'Đề chưa được mở'; end if;
  sid := public.my_student_for_quiz(p_quiz);
  if sid is null then raise exception 'Chỉ tài khoản học sinh mới nộp được bài'; end if;

  select * into att from public.quiz_attempts where quiz_id = p_quiz and student_id = sid for update;
  if found then
    if att.submitted_at is not null then raise exception 'Em đã nộp đề này rồi'; end if;
    raise exception 'Em đang làm đề này trên website — hãy bấm "Làm tiếp" để nộp';
  end if;

  insert into public.quiz_attempts (quiz_id, student_id, deadline_at, mode)
  values (p_quiz, sid, null, 'paper') returning * into att;
  res := public.finalize_attempt(att.id, p_answers);
  return res || jsonb_build_object('attempt_id', att.id);
end $$;

-- Giáo viên nhập (hoặc sửa) điểm bài làm trên giấy của một học sinh.
create or replace function public.record_paper_score(p_quiz bigint, p_student bigint, p_score numeric)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare z public.quizzes; mx numeric; att public.quiz_attempts;
begin
  if not public.can_manage_quiz(p_quiz) then raise exception 'Không có quyền'; end if;
  select * into z from public.quizzes where id = p_quiz;
  if not exists (select 1 from public.students s where s.id = p_student
                 and (z.class_id is null or s.class_id = z.class_id)) then
    raise exception 'Học sinh không thuộc lớp của bài này';
  end if;
  select coalesce(sum(points), 0) into mx from public.quiz_questions where quiz_id = p_quiz;
  if mx <= 0 then raise exception 'Đề chưa có câu hỏi'; end if;
  if p_score is null or p_score < 0 or p_score > mx then
    raise exception 'Điểm phải từ 0 đến %', mx;
  end if;

  select * into att from public.quiz_attempts where quiz_id = p_quiz and student_id = p_student for update;
  if found then
    if att.mode <> 'manual' then
      raise exception 'Học sinh đã có bài làm trên website. Bấm "Cho làm lại" trước nếu muốn nhập điểm bài giấy.';
    end if;
    update public.quiz_attempts set score = round(p_score, 2), max_score = mx, submitted_at = now()
      where id = att.id;
  else
    insert into public.quiz_attempts (quiz_id, student_id, deadline_at, submitted_at, score, max_score, mode)
    values (p_quiz, p_student, null, now(), round(p_score, 2), mx, 'manual') returning * into att;
  end if;
  return jsonb_build_object('attempt_id', att.id, 'score', round(p_score, 2), 'max_score', mx);
end $$;

-- Chấm lại: bỏ qua bài giấy giáo viên chấm tay (không có câu trả lời để chấm).
create or replace function public.regrade_quiz(p_quiz bigint) returns integer
language plpgsql volatile security definer set search_path = '' as $$
declare r record; g record; n int := 0;
begin
  if not public.can_manage_quiz(p_quiz) then raise exception 'Không có quyền'; end if;
  for r in select id, answers from public.quiz_attempts
           where quiz_id = p_quiz and submitted_at is not null and mode <> 'manual' loop
    select * into g from public.grade_answers(p_quiz, r.answers);
    update public.quiz_attempts set score = g.total, max_score = g.max_total, detail = g.detail where id = r.id;
    n := n + 1;
  end loop;
  return n;
end $$;

-- Hình trong đề: xem được khi được in đề (trước đây: chỉ sau khi bắt đầu làm).
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
      then public.can_print_quiz(((storage.foldername(object_name))[2])::bigint)
    else false
  end;
$$;

revoke execute on function
  public.can_print_quiz(bigint), public.quiz_paper_questions(bigint),
  public.submit_paper_quiz(bigint, jsonb), public.record_paper_score(bigint, bigint, numeric)
  from public, anon;
grant execute on function
  public.can_print_quiz(bigint), public.quiz_paper_questions(bigint),
  public.submit_paper_quiz(bigint, jsonb), public.record_paper_score(bigint, bigint, numeric)
  to authenticated;
grant execute on all functions in schema public to service_role;
