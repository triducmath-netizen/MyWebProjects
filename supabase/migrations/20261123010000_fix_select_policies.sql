-- Sửa: khi thêm học sinh / bài kiểm tra rồi đọc lại dòng vừa thêm (insert ... returning),
-- chính sách xem cũ tra lại bảng bằng id nên chưa thấy dòng mới → bị từ chối.
-- Chính sách mới kiểm tra trực tiếp trên giá trị của dòng.

create or replace function public.parent_can_view_assessment(aid bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.results r
    join public.students s on s.id = r.student_id
    where r.assessment_id = aid and s.parent_id = (select auth.uid())
  );
$$;
revoke execute on function public.parent_can_view_assessment(bigint) from public, anon;
grant execute on function public.parent_can_view_assessment(bigint) to authenticated, service_role;

drop policy if exists "students_select" on public.students;
create policy "students_select" on public.students for select to authenticated
  using (parent_id = (select auth.uid()) or public.can_manage_class(class_id));

drop policy if exists "assessments_select" on public.assessments;
create policy "assessments_select" on public.assessments for select to authenticated
  using (public.can_manage_class(class_id) or public.parent_can_view_assessment(id));
