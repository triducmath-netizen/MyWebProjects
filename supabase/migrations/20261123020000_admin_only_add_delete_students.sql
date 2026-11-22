-- Chỉ quản trị viên được thêm và xóa học sinh.
-- Giáo viên vẫn xem, sửa tên/lớp (trong các lớp mình phụ trách) và nhập kết quả.

drop policy if exists "students_insert" on public.students;
create policy "students_insert" on public.students for insert to authenticated
  with check (parent_id is null and public.is_admin());

drop policy if exists "students_delete" on public.students;
create policy "students_delete" on public.students for delete to authenticated
  using (public.is_admin());
