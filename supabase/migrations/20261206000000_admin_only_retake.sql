-- =====================================================================
-- Bài làm trực tuyến (luyện đề, bài về nhà, đề của lớp):
--   * Quản trị viên xem được mọi bài làm của mọi học sinh (đã có sẵn qua can_manage_quiz).
--   * Giáo viên khác CHỈ XEM (bài của học sinh lớp mình và bài luyện đề).
--   * CHỈ quản trị viên được "Cho làm lại" (xóa bài làm để em làm lại).
--   * KHÔNG AI sửa được điểm: bảng quiz_attempts không có quyền ghi trực tiếp; điểm bài giấy
--     đã nhập thì không ghi đè được — muốn đổi phải nhờ quản trị viên xóa rồi nhập lại.
-- File này không xóa dữ liệu nào; chạy lại nhiều lần cũng được.
-- =====================================================================

-- Chỉ quản trị viên xóa bài làm.
alter policy "qa_delete" on public.quiz_attempts
  using (public.is_admin());

-- Không ai ghi trực tiếp vào bảng bài làm (chỉ qua các hàm của máy chủ).
revoke insert, update on public.quiz_attempts from authenticated, anon;

-- Nhập điểm bài giấy: chỉ nhập khi em chưa có bài làm / điểm nào; không ghi đè điểm đã có.
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
    raise exception 'Học sinh đã có điểm / bài làm cho bài này. Điểm không sửa được; chỉ quản trị viên được xóa để làm lại.';
  end if;
  insert into public.quiz_attempts (quiz_id, student_id, deadline_at, submitted_at, score, max_score, mode)
  values (p_quiz, p_student, null, now(), round(p_score, 2), mx, 'manual') returning * into att;
  return jsonb_build_object('attempt_id', att.id, 'score', round(p_score, 2), 'max_score', mx);
end $$;
