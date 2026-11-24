-- =====================================================================
-- Đăng ký học thử: thêm trạng thái theo dõi chi tiết và ghi chú của quản trị.
--   status: moi → da_goi → da_hoc_thu → nhap_hoc (hoặc khong_lien_he_duoc)
--   admin_note: ghi chú của thầy (ví dụ "hẹn thứ 7, 8h")
-- Giữ nguyên các cột cũ (contacted, contacted_at, contacted_by); đăng ký cũ đã liên hệ được chuyển sang "Đã gọi".
-- File này không xóa dữ liệu nào; chạy lại nhiều lần cũng được.
-- =====================================================================

alter table public.trial_signups
  add column if not exists status text not null default 'moi'
    check (status in ('moi', 'da_goi', 'da_hoc_thu', 'nhap_hoc', 'khong_lien_he_duoc')),
  add column if not exists admin_note text
    check (admin_note is null or char_length(admin_note) <= 500);

update public.trial_signups set status = 'da_goi' where contacted and status = 'moi';
create index if not exists trial_signups_status_idx on public.trial_signups (status, created_at desc);

-- Khách gửi đăng ký luôn bắt đầu ở trạng thái "Mới", không tự ghi được ghi chú quản trị.
create or replace function public.trial_signup_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.student_name := btrim(regexp_replace(new.student_name, '\s+', ' ', 'g'));
  new.parent_phone := regexp_replace(new.parent_phone, '[^0-9]', '', 'g');
  new.note := nullif(btrim(new.note), '');
  new.created_at := now();
  new.contacted := false; new.contacted_at := null; new.contacted_by := null;
  new.status := 'moi'; new.admin_note := null;
  if exists (select 1 from public.trial_signups t
             where t.parent_phone = new.parent_phone
               and lower(t.student_name) = lower(new.student_name)
               and t.created_at > now() - interval '24 hours') then
    raise exception 'Trí Đức Math đã nhận đăng ký này rồi, chúng tôi sẽ sớm gọi lại.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.trial_signups where created_at > now() - interval '1 hour') >= 30 then
    raise exception 'Hệ thống đang bận, vui lòng gọi hoặc nhắn Zalo 0904 440 886.' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke execute on function public.trial_signup_guard() from public, anon, authenticated;

-- Quản trị cập nhật được trạng thái và ghi chú (RLS trial_admin_update vẫn chỉ cho quản trị viên).
grant update (status, admin_note) on public.trial_signups to authenticated;

notify pgrst, 'reload schema';
