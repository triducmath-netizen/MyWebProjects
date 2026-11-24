-- =====================================================================
-- Xóa lớp học: chỉ quản trị viên (đã có từ trước qua chính sách classes_admin_write),
-- và KHÔNG xóa được lớp còn học sinh (phải chuyển lớp hoặc xóa học sinh trước),
-- để học sinh không bị "mất lớp".
-- Xóa lớp sẽ xóa theo các bài kiểm tra tuần và bài tập trực tuyến riêng của lớp đó.
-- File này không xóa dữ liệu nào; chạy lại nhiều lần cũng được.
-- =====================================================================

create or replace function public.guard_class_delete() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.students where class_id = old.id) then
    raise exception 'Lớp % còn học sinh. Hãy chuyển lớp hoặc xóa các em trước khi xóa lớp.', old.name;
  end if;
  return old;
end $$;

create or replace trigger guard_class_delete
  before delete on public.classes
  for each row execute function public.guard_class_delete();

notify pgrst, 'reload schema';
