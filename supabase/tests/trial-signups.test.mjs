// Kiểm thử bảng đăng ký học thử (trial_signups) bằng PGlite — chạy trên máy, không đụng Supabase thật.
//   npm i --no-save @electric-sql/pglite@0.2.17 && node supabase/tests/trial-signups.test.mjs
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const MIG = fileURLToPath(new URL('../migrations', import.meta.url));
const db = new PGlite();
await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth; create schema storage;
  create table auth.users (id uuid primary key, email text, raw_app_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth, storage to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as
    $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
  grant execute on function storage.foldername(text) to authenticated;
`);
for (const f of readdirSync(MIG).sort()) {
  try { await db.exec(readFileSync(`${MIG}/${f}`, 'utf8')); }
  catch (e) { console.error('MIGRATION FAIL', f, e.message); process.exit(1); }
}
console.log('migrations OK');

const U = { admin: '00000000-0000-0000-0000-00000000000a', t1: '00000000-0000-0000-0000-0000000000b1',
  s1: '00000000-0000-0000-0000-0000000000c1' };
await db.exec(`
  insert into auth.users (id, email, raw_app_meta_data) values
   ('${U.admin}', 'a@x', '{"role":"admin"}'), ('${U.t1}', 't1@x', '{"role":"teacher"}'), ('${U.s1}', 's1@x', '{}');
`);
async function as(who, sql, params = []) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${who ? U[who] : ''}', false);`);
  await db.exec(who ? 'set role authenticated' : 'set role anon');
  try { return await db.query(sql, params); } finally { await db.exec("reset role; select set_config('request.jwt.claim.sub', '', false);"); }
}
let pass = 0, fail = 0;
async function expect(name, fn, check) {
  let res, err;
  try { res = await fn(); } catch (e) { err = e; }
  const ok = check(res, err);
  ok ? pass++ : fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  → ' + (err ? err.message : JSON.stringify(res?.rows ?? res))}`);
}
const rows = (n) => (r, e) => !e && (r.rows.length || r.affectedRows || 0) === n;
const okRes = (r, e) => !e;
const errRes = (r, e) => !!e;
const blocked = (r, e) => !!e || (r.rows.length || r.affectedRows || 0) === 0;
const ins = (name, grade, phone, note = null) => () => as(null,
  'insert into public.trial_signups (student_name, grade, parent_phone, note) values ($1, $2, $3, $4)', [name, grade, phone, note]);

await expect('Khách (anon) gửi đăng ký hợp lệ', ins('  Nguyễn  Văn A ', 8, '0912 345 678', 'Học buổi tối'), okRes);
await expect('Khách gửi lại đúng đăng ký đó trong 24h: bị chặn', ins('nguyễn văn a', 8, '0912345678'), errRes);
await expect('Cùng SĐT, con khác: nhận', ins('Nguyễn Văn B', 6, '0912345678'), okRes);
await expect('SĐT sai (9 số): bị chặn', ins('Trần C', 7, '091234567'), errRes);
await expect('Lớp 5: bị chặn', ins('Trần C', 5, '0987654321'), errRes);
await expect('Họ tên 1 ký tự: bị chặn', ins('C', 7, '0987654321'), errRes);
await expect('Ghi chú quá 500 ký tự: bị chặn', ins('Trần C', 7, '0987654321', 'x'.repeat(501)), errRes);
await expect('Khách không tự đặt contacted = true', () => as(null,
  "insert into public.trial_signups (student_name, grade, parent_phone, contacted) values ('Lê D', 9, '0911111111', true)"), errRes);
await expect('Khách KHÔNG đọc được danh sách', () => as(null, 'select * from public.trial_signups'), blocked);
await expect('Khách không sửa / xóa được', () => as(null, 'delete from public.trial_signups'), blocked);
await expect('Học sinh / phụ huynh không đọc được', () => as('s1', 'select * from public.trial_signups'), rows(0));
await expect('Giáo viên (không phải quản trị) không đọc được', () => as('t1', 'select * from public.trial_signups'), rows(0));
await expect('Quản trị đọc được 2 đăng ký, tên đã chuẩn hóa', () => as('admin', 'select student_name, parent_phone from public.trial_signups order by id'),
  (r, e) => !e && r.rows.length === 2 && r.rows[0].student_name === 'Nguyễn Văn A' && r.rows[0].parent_phone === '0912345678');
await expect('Giáo viên không đánh dấu đã liên hệ được', () => as('t1', 'update public.trial_signups set contacted = true returning id'), rows(0));
await expect('Quản trị đánh dấu đã liên hệ', () => as('admin',
  `update public.trial_signups set contacted = true, contacted_at = now(), contacted_by = '${U.admin}' where parent_phone = '0912345678' and grade = 8 returning id`), rows(1));
await expect('Quản trị không sửa được SĐT (chỉ cột trạng thái)', () => as('admin', "update public.trial_signups set parent_phone = '0900000000' where grade = 8"), errRes);
await expect('Giáo viên không xóa được', () => as('t1', 'delete from public.trial_signups returning id'), rows(0));
await expect('Quản trị xóa được', () => as('admin', 'delete from public.trial_signups where contacted = false returning id'), rows(1));

console.log(`
${pass} đạt, ${fail} lỗi`);
process.exit(fail ? 1 : 0);
