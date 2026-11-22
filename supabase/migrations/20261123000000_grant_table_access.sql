-- Dự án Supabase mới không tự cấp quyền bảng cho người đã đăng nhập.
-- Cấp quyền cơ bản; ai được xem/sửa dòng nào vẫn do các chính sách RLS quyết định.
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- Hàm máy chủ manage-accounts dùng vai trò service_role, cũng cần quyền bảng.
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- Giữ nguyên: không ai sửa trực tiếp parent_id của học sinh.
revoke update on public.students from authenticated;
grant update (code, full_name, class_id) on public.students to authenticated;
