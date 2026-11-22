-- Chỉ quản trị viên được sửa tên và chuyển lớp học sinh.
-- Giáo viên chỉ xem học sinh lớp mình, nhập kết quả và cấp tài khoản phụ huynh.

drop policy if exists "students_update" on public.students;
create policy "students_update" on public.students for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
