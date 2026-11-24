-- =====================================================================
-- Ngày sinh học sinh + MÃ LIÊN KẾT CỐ ĐỊNH cho từng học sinh
--   * Khi thêm học sinh, máy chủ tự sinh: mã học sinh (TDM…), mật khẩu ban đầu
--     và 1 mã liên kết (8 ký tự). Giáo viên gửi cả 3 cho học sinh và phụ huynh.
--   * Phụ huynh chỉ cần nhập MÃ LIÊN KẾT là liên kết được với đúng em có mã đó.
--     Mã dùng được nhiều lần (bố và mẹ cùng liên kết), không hết hạn.
--     Giáo viên có thể đổi mã mới; phụ huynh đã liên kết vẫn giữ liên kết.
--   * Nhập sai quá 10 lần trong 1 giờ (theo tài khoản hoặc theo máy) thì tạm khóa.
-- File này không xóa dữ liệu nào; chạy lại nhiều lần cũng được.
-- =====================================================================

alter table public.students add column if not exists birth_date date;

-- Giáo viên/quản trị được ghi họ tên, ngày sinh, lớp (vẫn không sửa được mã học sinh).
grant update (full_name, birth_date, class_id) on public.students to authenticated;
grant insert (code, full_name, birth_date, class_id) on public.students to authenticated;

create table if not exists public.student_link_codes (
  student_id bigint primary key references public.students (id) on delete cascade,
  code       text not null unique,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.parent_link_failures (
  key text not null,
  at  timestamptz not null default now()
);
create index if not exists parent_link_failures_key_idx on public.parent_link_failures (key, at);

alter table public.student_link_codes   enable row level security;
alter table public.parent_link_failures enable row level security;
-- Không ai đọc/ghi trực tiếp; chỉ qua các hàm bên dưới.
revoke all on public.student_link_codes, public.parent_link_failures from anon, authenticated;
grant all on public.student_link_codes, public.parent_link_failures to service_role;

-- Sinh một mã liên kết mới, không trùng (8 ký tự, bỏ các chữ dễ nhầm O/0, I/1).
create or replace function public.new_link_code() returns text
language plpgsql volatile security definer set search_path = '' as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  raw bytea;
  c text;
  i int;
begin
  loop
    raw := uuid_send(gen_random_uuid());
    c := '';
    for i in 0..7 loop
      c := c || substr(alphabet, (get_byte(raw, i) % 32) + 1, 1);
    end loop;
    exit when not exists (select 1 from public.student_link_codes where code = c);
  end loop;
  return c;
end $$;

-- Học sinh mới tự có mã liên kết.
create or replace function public.students_after_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.student_link_codes (student_id, code, created_by)
  values (new.id, public.new_link_code(), (select auth.uid()))
  on conflict (student_id) do nothing;
  return new;
end $$;
create or replace trigger students_after_insert
  after insert on public.students
  for each row execute function public.students_after_insert();

-- Học sinh đã có từ trước: cấp mã liên kết luôn.
insert into public.student_link_codes (student_id, code)
select s.id, public.new_link_code() from public.students s
where not exists (select 1 from public.student_link_codes c where c.student_id = s.id);

-- Giáo viên lớp đó / quản trị: xem mã liên kết của học sinh (p_renew = true: đổi mã mới).
create or replace function public.student_link_code(p_student bigint, p_renew boolean default false)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  s public.students;
  c text;
begin
  select * into s from public.students where id = p_student;
  if not found or not public.can_manage_class(s.class_id) then
    raise exception 'Không có quyền';
  end if;
  if p_renew then
    c := public.new_link_code();
    insert into public.student_link_codes (student_id, code, created_by, created_at)
    values (s.id, c, (select auth.uid()), now())
    on conflict (student_id) do update
      set code = excluded.code, created_by = excluded.created_by, created_at = excluded.created_at;
  else
    select code into c from public.student_link_codes where student_id = s.id;
    if c is null then
      c := public.new_link_code();
      insert into public.student_link_codes (student_id, code, created_by) values (s.id, c, (select auth.uid()));
    end if;
  end if;
  return jsonb_build_object('code', c, 'student_code', s.code, 'full_name', s.full_name);
end $$;

-- Kiểm tra / dùng mã liên kết. p_parent = null: chỉ kiểm tra (lúc đăng ký).
-- p_key: khóa đếm số lần nhập sai (tài khoản phụ huynh, hoặc địa chỉ máy khi đăng ký).
-- Trả về {ok, ...} thay vì báo lỗi, để số lần nhập sai vẫn được lưu lại.
create or replace function public.link_by_code_internal(p_parent uuid, p_link_code text, p_key text)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  k text := coalesce(p_parent::text, nullif(p_key, ''), 'khong-ro');
  link text := upper(regexp_replace(coalesce(p_link_code, ''), '[^A-Za-z0-9]', '', 'g'));
  s public.students;
begin
  delete from public.parent_link_failures where at < now() - interval '1 day';
  if (select count(*) from public.parent_link_failures
      where key = k and at > now() - interval '1 hour') >= 10 then
    return jsonb_build_object('ok', false,
      'error', 'Nhập sai mã quá nhiều lần. Vui lòng thử lại sau 1 giờ.');
  end if;
  select st.* into s from public.student_link_codes c
  join public.students st on st.id = c.student_id
  where c.code = link;
  if not found then
    insert into public.parent_link_failures (key) values (k);
    return jsonb_build_object('ok', false,
      'error', 'Mã liên kết không đúng. Vui lòng kiểm tra lại mã giáo viên Trí Đức Math đã gửi.');
  end if;
  if p_parent is not null then
    if exists (select 1 from public.parent_links where parent_id = p_parent and student_id = s.id) then
      return jsonb_build_object('ok', false,
        'error', 'Tài khoản đã liên kết với em ' || s.full_name || ' rồi.');
    end if;
    insert into public.parent_links (parent_id, student_id) values (p_parent, s.id);
  end if;
  return jsonb_build_object('ok', true, 'student_id', s.id, 'full_name', s.full_name);
end $$;

-- Phụ huynh đã đăng nhập: liên kết với một học sinh bằng mã liên kết.
create or replace function public.link_child_by_code(p_link_code text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'Chưa đăng nhập'; end if;
  if public.my_role() is distinct from 'parent' then
    return jsonb_build_object('ok', false, 'error', 'Tài khoản giáo viên không liên kết với học sinh được.');
  end if;
  if exists (select 1 from public.students s where s.parent_id = (select auth.uid())) then
    return jsonb_build_object('ok', false,
      'error', 'Đây là tài khoản học sinh. Phụ huynh hãy đăng ký tài khoản phụ huynh riêng.');
  end if;
  return public.link_by_code_internal((select auth.uid()), p_link_code, null);
end $$;

-- ---------- Quyền gọi hàm ----------
revoke execute on function
  public.new_link_code(), public.students_after_insert(),
  public.student_link_code(bigint, boolean),
  public.link_by_code_internal(uuid, text, text), public.link_child_by_code(text)
  from public, anon, authenticated;
grant execute on function public.student_link_code(bigint, boolean), public.link_child_by_code(text)
  to authenticated;
grant execute on function
  public.new_link_code(), public.student_link_code(bigint, boolean),
  public.link_by_code_internal(uuid, text, text), public.link_child_by_code(text)
  to service_role;

-- Cách cũ (mã học sinh + mã dùng 1 lần) thôi dùng.
revoke execute on function
  public.create_parent_link_code(bigint), public.link_child(text, text)
  from authenticated;

notify pgrst, 'reload schema';
