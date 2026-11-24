-- =====================================================================
-- Tài khoản phụ huynh riêng, một phụ huynh theo dõi nhiều con
--   * Tài khoản học sinh (đăng nhập bằng mã học sinh) giữ nguyên:
--     students.parent_id = tài khoản của chính học sinh (tên cột giữ để không phá mã cũ).
--   * Phụ huynh tự đăng ký bằng số điện thoại hoặc email, rồi liên kết với từng con
--     bằng MÃ LIÊN KẾT do giáo viên (hoặc chính học sinh) tạo: dùng một lần,
--     hết hạn sau 14 ngày, nhập sai 5 lần thì khóa.
--   * Phụ huynh CHỈ XEM kết quả của các con đã liên kết; không làm bài thay con.
-- File này không xóa dữ liệu nào; chạy lại nhiều lần cũng được.
-- =====================================================================

create table if not exists public.parent_links (
  parent_id  uuid   not null references public.profiles (id) on delete cascade,
  student_id bigint not null references public.students (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (parent_id, student_id)
);
create index if not exists parent_links_student_idx on public.parent_links (student_id);

-- Mã liên kết đang chờ dùng (lưu dạng băm, không lưu mã gốc).
create table if not exists public.parent_link_codes (
  student_id bigint primary key references public.students (id) on delete cascade,
  code_hash  text not null,
  expires_at timestamptz not null,
  attempts   integer not null default 0,
  created_by uuid,
  created_at timestamptz not null default now()
);

-- ---------- Mã học sinh tự sinh: TDM + 6 chữ số (TDM000001, TDM000002, ...) ----------
-- Mật khẩu ban đầu = 6 chữ số trong mã; học sinh phải tự đổi (6 chữ số) ở lần đăng nhập đầu.
-- password_changed: chỉ máy chủ (manage-accounts) ghi. Học sinh cũ (mật khẩu ngẫu nhiên) coi như đã đổi.
alter table public.students add column if not exists password_changed boolean not null default true;
alter table public.students alter column password_changed set default false;

create sequence if not exists public.student_code_seq start 1;
grant usage, select on sequence public.student_code_seq to service_role;

create or replace function public.next_student_code() returns text
language plpgsql volatile security definer set search_path = '' as $$
declare c text;
begin
  loop
    c := 'TDM' || lpad(nextval('public.student_code_seq')::text, 6, '0');
    exit when not exists (select 1 from public.students where code = c);
  end loop;
  return c;
end $$;

create or replace function public.students_before_write() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.code is null or btrim(new.code) = '' then
      new.code := public.next_student_code();
    end if;
    new.password_changed := false;
  elsif new.code is distinct from old.code then
    raise exception 'Không được đổi mã học sinh';
  end if;
  return new;
end $$;
create or replace trigger students_before_write
  before insert or update on public.students
  for each row execute function public.students_before_write();

-- Giáo viên/quản trị chỉ sửa được họ tên và lớp (không sửa mã, không sửa cờ mật khẩu).
revoke update on public.students from authenticated;
grant update (full_name, class_id) on public.students to authenticated;
revoke insert on public.students from authenticated;
grant insert (code, full_name, class_id) on public.students to authenticated;
revoke execute on function public.next_student_code() from public, anon, authenticated;

alter table public.parent_links      enable row level security;
alter table public.parent_link_codes enable row level security;
-- Không ai đọc/ghi trực tiếp bảng mã; bảng liên kết chỉ đọc, ghi qua hàm.
revoke all on public.parent_link_codes from anon, authenticated;
revoke all on public.parent_links from anon, authenticated;
grant select on public.parent_links to authenticated;
grant all on public.parent_links, public.parent_link_codes to service_role;

-- ---------- Hàm quyền ----------

-- Người đang đăng nhập là phụ huynh đã liên kết với học sinh này.
create or replace function public.is_linked_parent(sid bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.parent_links l
                 where l.student_id = sid and l.parent_id = (select auth.uid()));
$$;

-- Tài khoản của chính học sinh, hoặc phụ huynh đã liên kết.
create or replace function public.is_parent_of(sid bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.students s where s.id = sid and s.parent_id = (select auth.uid()))
      or public.is_linked_parent(sid);
$$;

create or replace function public.parent_can_view_assessment(aid bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.results r
                 where r.assessment_id = aid and public.is_parent_of(r.student_id));
$$;

create or replace function public.can_view_assessment(aid bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.can_manage_assessment(aid) or public.parent_can_view_assessment(aid);
$$;

-- Học sinh: đã bắt đầu làm bài này. Phụ huynh: con đã NỘP bài này.
create or replace function public.has_my_attempt(qid bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.quiz_attempts a
    join public.students s on s.id = a.student_id
    where a.quiz_id = qid
      and (s.parent_id = (select auth.uid())
           or (a.submitted_at is not null and public.is_linked_parent(s.id)))
  );
$$;

create or replace function public.can_view_quiz_key(qid bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.can_manage_quiz(qid) or exists (
    select 1 from public.quiz_attempts a
    join public.students s on s.id = a.student_id
    join public.quizzes z on z.id = a.quiz_id
    where a.quiz_id = qid
      and (s.parent_id = (select auth.uid()) or public.is_linked_parent(s.id))
      and a.submitted_at is not null
      and (z.show_key_after = 'submit' or z.due_at is null or now() >= z.due_at)
  );
$$;

-- ---------- Chính sách xem ----------

alter policy "students_select" on public.students
  using (parent_id = (select auth.uid()) or public.is_linked_parent(id) or public.can_manage_class(class_id));

alter policy "qa_select" on public.quiz_attempts
  using (public.can_manage_quiz(quiz_id)
         or exists (select 1 from public.students s where s.id = student_id and s.parent_id = (select auth.uid()))
         or public.is_linked_parent(student_id));

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'parent_links'
                 and policyname = 'parent_links_select') then
    create policy "parent_links_select" on public.parent_links for select to authenticated
      using (parent_id = (select auth.uid())
             or exists (select 1 from public.students s where s.id = student_id
                        and public.can_manage_class(s.class_id)));
  end if;
end $$;

-- ---------- Mã liên kết ----------

-- Tạo (hoặc tạo lại) mã liên kết cho một học sinh. Giáo viên lớp đó, quản trị,
-- hoặc chính tài khoản học sinh được tạo. Mã cũ (nếu có) mất hiệu lực.
create or replace function public.create_parent_link_code(p_student bigint) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  s public.students;
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  raw bytea := uuid_send(gen_random_uuid()) || uuid_send(gen_random_uuid());
  code text := '';
  exp timestamptz := now() + interval '14 days';
  i int;
begin
  select * into s from public.students where id = p_student;
  if not found then raise exception 'Không tìm thấy học sinh'; end if;
  if not (public.can_manage_class(s.class_id) or s.parent_id = (select auth.uid())) then
    raise exception 'Không có quyền';
  end if;
  -- Học sinh tự mời: phải đổi mật khẩu ban đầu trước (mật khẩu ban đầu đoán được từ mã).
  if not public.can_manage_class(s.class_id) and not s.password_changed then
    raise exception 'Em hãy đổi mật khẩu trước khi mời phụ huynh';
  end if;
  for i in 0..7 loop
    code := code || substr(alphabet, (get_byte(raw, i) % 32) + 1, 1);
  end loop;
  insert into public.parent_link_codes (student_id, code_hash, expires_at, attempts, created_by, created_at)
  values (p_student, encode(sha256(convert_to(code, 'UTF8')), 'hex'), exp, 0, (select auth.uid()), now())
  on conflict (student_id) do update
    set code_hash = excluded.code_hash, expires_at = excluded.expires_at, attempts = 0,
        created_by = excluded.created_by, created_at = excluded.created_at;
  return jsonb_build_object('code', code, 'expires_at', exp, 'student_code', s.code, 'full_name', s.full_name);
end $$;

-- Kiểm tra / dùng mã liên kết. p_parent = null: chỉ kiểm tra (không dùng mã).
-- Trả về {ok, ...} thay vì báo lỗi, để số lần nhập sai vẫn được lưu lại.
create or replace function public.link_child_internal(p_parent uuid, p_student_code text, p_link_code text)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  s public.students;
  c public.parent_link_codes;
  link text := upper(regexp_replace(coalesce(p_link_code, ''), '[^A-Za-z0-9]', '', 'g'));
  bad constant jsonb := jsonb_build_object('ok', false,
    'error', 'Mã học sinh hoặc mã liên kết không đúng, hoặc mã đã hết hạn. Hãy xin giáo viên mã mới.');
begin
  select * into s from public.students
  where code = upper(regexp_replace(coalesce(p_student_code, ''), '\s+', '', 'g'));
  if not found then return bad; end if;
  select * into c from public.parent_link_codes where student_id = s.id for update;
  if not found or c.expires_at < now() or c.attempts >= 5 then return bad; end if;
  if c.code_hash <> encode(sha256(convert_to(link, 'UTF8')), 'hex') then
    update public.parent_link_codes set attempts = attempts + 1 where student_id = s.id;
    return bad;
  end if;
  if p_parent is not null then
    insert into public.parent_links (parent_id, student_id) values (p_parent, s.id)
    on conflict do nothing;
    delete from public.parent_link_codes where student_id = s.id;
  end if;
  return jsonb_build_object('ok', true, 'student_id', s.id, 'full_name', s.full_name);
end $$;

-- Phụ huynh đã đăng nhập: thêm con bằng mã học sinh + mã liên kết.
create or replace function public.link_child(p_student_code text, p_link_code text) returns jsonb
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
  return public.link_child_internal((select auth.uid()), p_student_code, p_link_code);
end $$;

-- Giáo viên: danh sách phụ huynh đã liên kết của một lớp.
create or replace function public.class_parent_links(p_class bigint)
returns table (student_id bigint, parent_id uuid, full_name text, login text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select l.student_id, l.parent_id, p.full_name, p.email, l.created_at
  from public.parent_links l
  join public.students s on s.id = l.student_id
  join public.profiles p on p.id = l.parent_id
  where s.class_id = p_class and public.can_manage_class(p_class)
  order by l.created_at;
$$;

-- Giáo viên: gỡ liên kết phụ huynh – học sinh.
create or replace function public.unlink_parent(p_student bigint, p_parent uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.students s where s.id = p_student and public.can_manage_class(s.class_id)) then
    raise exception 'Không có quyền';
  end if;
  delete from public.parent_links where student_id = p_student and parent_id = p_parent;
end $$;

-- ---------- Quyền gọi hàm ----------
revoke execute on function
  public.is_linked_parent(bigint), public.create_parent_link_code(bigint),
  public.link_child_internal(uuid, text, text), public.link_child(text, text),
  public.class_parent_links(bigint), public.unlink_parent(bigint, uuid)
  from public, anon;
grant execute on function
  public.is_linked_parent(bigint), public.create_parent_link_code(bigint), public.link_child(text, text),
  public.class_parent_links(bigint), public.unlink_parent(bigint, uuid)
  to authenticated;
-- link_child_internal chỉ máy chủ (đăng ký phụ huynh) và các hàm trên được gọi.
revoke execute on function public.link_child_internal(uuid, text, text) from authenticated;
grant execute on function
  public.is_linked_parent(bigint), public.create_parent_link_code(bigint),
  public.link_child_internal(uuid, text, text), public.link_child(text, text),
  public.class_parent_links(bigint), public.unlink_parent(bigint, uuid)
  to service_role;

notify pgrst, 'reload schema';
