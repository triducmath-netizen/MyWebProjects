-- =====================================================================
-- Chỉ quản trị viên được gỡ liên kết phụ huynh – học sinh.
-- (Xóa học sinh, xóa giáo viên, xóa tài khoản phụ huynh vốn đã chỉ quản trị viên làm được.)
-- File này không xóa dữ liệu nào; chạy lại nhiều lần cũng được.
-- =====================================================================

create or replace function public.unlink_parent(p_student bigint, p_parent uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Chỉ quản trị viên được gỡ liên kết phụ huynh';
  end if;
  delete from public.parent_links where student_id = p_student and parent_id = p_parent;
end $$;

notify pgrst, 'reload schema';
