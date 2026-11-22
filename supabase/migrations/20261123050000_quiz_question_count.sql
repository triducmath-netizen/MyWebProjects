-- Số câu hỏi của một đề (học sinh thấy được số câu trước khi bắt đầu, nhưng không thấy nội dung).
-- Dùng như cột tính toán: select('id, title, question_count')
create or replace function public.question_count(z public.quizzes) returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.quiz_questions q where q.quiz_id = z.id;
$$;
revoke execute on function public.question_count(public.quizzes) from public, anon;
grant execute on function public.question_count(public.quizzes) to authenticated, service_role;
