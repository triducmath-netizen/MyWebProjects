-- =====================================================================
-- Đăng ký học thử từ trang chủ (mục Liên hệ).
--   * Khách chưa đăng nhập (anon) CHỈ được thêm một đăng ký mới; không đọc, sửa, xóa được gì.
--   * Chỉ quản trị viên xem danh sách, đánh dấu "đã liên hệ" và xóa.
--   * Chống gửi trùng / spam: cùng số điện thoại + họ tên trong 24 giờ thì không nhận lại;
--     cả hệ thống nhận tối đa 30 đăng ký mỗi giờ.
-- File này không xóa dữ liệu nào; chạy lại nhiều lần cũng được.
-- =====================================================================

create table if not exists public.trial_signups (
  id           bigint generated always as identity primary key,
  created_at   timestamptz not null default now(),
  student_name text not null check (char_length(btrim(student_name)) between 2 and 80),
  grade        smallint not null check (grade between 6 and 12),
  parent_phone text not null check (parent_phone ~ '^0[0-9]{9}$'),
  note         text check (note is null or char_length(note) <= 500),
  contacted    boolean not null default false,
  contacted_at timestamptz,
  contacted_by uuid references auth.users (id) on delete set null
);
create index if not exists trial_signups_created_idx on public.trial_signups (created_at desc);

alter table public.trial_signups enable row level security;

-- Chuẩn hóa + chặn trùng/spam. security definer để đếm được cả các dòng mà anon không đọc được.
create or replace function public.trial_signup_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.student_name := btrim(regexp_replace(new.student_name, '\s+', ' ', 'g'));
  new.parent_phone := regexp_replace(new.parent_phone, '[^0-9]', '', 'g');
  new.note := nullif(btrim(new.note), '');
  new.created_at := now();
  new.contacted := false; new.contacted_at := null; new.contacted_by := null;
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

drop trigger if exists trial_signup_guard on public.trial_signups;
create trigger trial_signup_guard before insert on public.trial_signups
  for each row execute function public.trial_signup_guard();

-- Quyền bảng: anon chỉ INSERT các cột khách điền; quản trị làm việc qua RLS.
revoke all on public.trial_signups from anon, authenticated;
grant usage on schema public to anon;
grant insert (student_name, grade, parent_phone, note) on public.trial_signups to anon, authenticated;
grant select, delete on public.trial_signups to authenticated;
grant update (contacted, contacted_at, contacted_by) on public.trial_signups to authenticated;
grant all on public.trial_signups to service_role;

drop policy if exists "trial_insert_public" on public.trial_signups;
create policy "trial_insert_public" on public.trial_signups for insert to anon, authenticated
  with check (true);
drop policy if exists "trial_admin_select" on public.trial_signups;
create policy "trial_admin_select" on public.trial_signups for select to authenticated
  using (public.is_admin());
drop policy if exists "trial_admin_update" on public.trial_signups;
create policy "trial_admin_update" on public.trial_signups for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "trial_admin_delete" on public.trial_signups;
create policy "trial_admin_delete" on public.trial_signups for delete to authenticated
  using (public.is_admin());

notify pgrst, 'reload schema';
