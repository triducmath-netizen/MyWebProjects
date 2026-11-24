// Kiểm thử mã liên kết cố định + ngày sinh học sinh (migration 20261126), bằng PGlite.
//   npm i --no-save @electric-sql/pglite@0.2.17 && node supabase/tests/link-codes.test.mjs
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const MIG = process.env.MIG_DIR || fileURLToPath(new URL('../migrations', import.meta.url));
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
const id = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const U = { admin: id(1), t1: id(2), t2: id(3), hsA: id(11), hsB: id(12), hsC: id(13), ph1: id(21), ph2: id(22) };

// Chạy các migration cũ, tạo dữ liệu (học sinh có từ trước), rồi mới chạy migration mới.
const files = readdirSync(MIG).sort();
const NEW = '20261126000000_student_link_codes.sql';
for (const f of files.filter((x) => x < NEW)) {
  try { await db.exec(readFileSync(`${MIG}/${f}`, 'utf8')); }
  catch (e) { console.error('MIGRATION FAIL', f, e.message); process.exit(1); }
}
await db.exec(`
  insert into auth.users (id, email, raw_app_meta_data) values
   ('${U.admin}', 'a@x', '{"role":"admin"}'), ('${U.t1}', 't1@x', '{"role":"teacher"}'), ('${U.t2}', 't2@x', '{"role":"teacher"}'),
   ('${U.hsA}', 'hsa@hs.triducmath.vn', '{}'), ('${U.hsB}', 'hsb@hs.triducmath.vn', '{}'), ('${U.hsC}', 'hsc@hs.triducmath.vn', '{}'),
   ('${U.ph1}', '0912345678@ph.triducmath.vn', '{}'), ('${U.ph2}', 'ph2@gmail.com', '{}');
  insert into public.classes (name, grade) values ('6A', 6), ('7A', 7);
  insert into public.teacher_classes (teacher_id, class_id) values ('${U.t1}', 1), ('${U.t2}', 2);
  insert into public.students (code, full_name, class_id, parent_id) values
   ('HSA', 'Em A', 1, '${U.hsA}'), ('HSB', 'Em B', 2, '${U.hsB}'), ('HSC', 'Em C', 1, '${U.hsC}');
  insert into public.assessments (class_id, week_start, title) values (1, '2026-11-23', 'KT 6A'), (2, '2026-11-23', 'KT 7A');
  insert into public.results (assessment_id, student_id, score) values (1, 1, 8), (2, 2, 9), (1, 3, 5);
`);
for (const f of files.filter((x) => x >= NEW)) {
  try { await db.exec(readFileSync(`${MIG}/${f}`, 'utf8')); await db.exec(readFileSync(`${MIG}/${f}`, 'utf8')); }
  catch (e) { console.error('MIGRATION FAIL', f, e.message); process.exit(1); }
}
console.log('migrations OK (file mới chạy 2 lần)');

async function as(who, sql, params = []) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${who && who !== 'service' ? U[who] : ''}', false);`);
  await db.exec(who === 'service' ? 'set role service_role' : who ? 'set role authenticated' : 'set role anon');
  try { return await db.query(sql, params); }
  finally { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`); }
}
let pass = 0, fail = 0;
async function expect(name, fn, check) {
  let res, err;
  try { res = await fn(); } catch (e) { err = e; }
  const ok = check(res, err);
  ok ? pass++ : fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  → ' + (err ? err.message : JSON.stringify(res?.rows ?? res))}`);
}
const rows = (n) => (r, e) => !e && r.rows.length === n;
const errRes = (r, e) => !!e;
const blocked = (r, e) => !!e || (r.affectedRows || 0) === 0;
const okJson = (r, e) => !e && r.rows[0]?.r?.ok === true;
const badJson = (r, e) => !e && r.rows[0]?.r?.ok === false;
const code = async (who, sid, renew = false) =>
  (await as(who, 'select public.student_link_code($1, $2) as r', [sid, renew])).rows[0].r.code;

// --- Mã liên kết có sẵn cho học sinh cũ và học sinh mới ---
let codeA;
await expect('Học sinh cũ được cấp mã (3 mã, không trùng)', () => db.query('select count(distinct code)::int n from public.student_link_codes'), (r) => r.rows[0].n === 3);
await expect('GV lớp 6A xem mã của em A', async () => { codeA = await code('t1', 1); return codeA; }, (r, e) => !e && /^[A-Z2-9]{8}$/.test(codeA));
await expect('Xem lại vẫn đúng mã cũ (mã cố định)', () => code('t1', 1), (r, e) => !e && r === codeA);
await expect('GV lớp khác KHÔNG xem được mã em A', () => as('t2', 'select public.student_link_code(1)'), errRes);
await expect('Học sinh KHÔNG xem được mã', () => as('hsA', 'select public.student_link_code(1)'), errRes);
await expect('Phụ huynh KHÔNG xem được mã', () => as('ph1', 'select public.student_link_code(1)'), errRes);
await expect('Người lạ KHÔNG gọi được', () => as(null, 'select public.student_link_code(1)'), errRes);
await expect('Không ai đọc trực tiếp bảng mã', () => as('t1', 'select * from public.student_link_codes'), errRes);
await expect('Quản trị thêm học sinh có ngày sinh → mã TDM000001', () => as('admin',
  `insert into public.students (full_name, birth_date, class_id) values ('Em D', '2014-05-20', 1) returning id, code`),
  (r, e) => !e && r.rows[0].code === 'TDM000001' && r.rows[0].id === 4);
await expect('Em D có mã liên kết ngay', () => code('admin', 4), (r, e) => !e && /^[A-Z2-9]{8}$/.test(r));
await expect('Quản trị sửa ngày sinh', () => as('admin', `update public.students set birth_date='2014-06-01' where id=4`), (r, e) => !e && r.affectedRows === 1);
await expect('Giáo viên KHÔNG sửa học sinh', () => as('t1', `update public.students set birth_date='2014-06-02' where id=4`), blocked);
await expect('Giáo viên KHÔNG thêm học sinh', () => as('t1', `insert into public.students (full_name, birth_date, class_id) values ('X', '2014-01-01', 1)`), errRes);
const codeB = await code('t2', 2);

// --- Liên kết bằng mã ---
await expect('PH1 nhập sai mã → từ chối', () => as('ph1', `select public.link_child_by_code('SAIMA123') as r`), badJson);
await expect('PH1 nhập đúng mã (chữ thường, có dấu gạch) → liên kết em A', () => as('ph1', 'select public.link_child_by_code($1) as r',
  [codeA.toLowerCase().slice(0, 4) + '-' + codeA.slice(4)]), okJson);
await expect('PH1 thấy đúng em A', () => as('ph1', 'select code from public.students'), (r, e) => !e && r.rows.map((x) => x.code).join() === 'HSA');
await expect('PH1 nhập lại mã em A → báo đã liên kết', () => as('ph1', 'select public.link_child_by_code($1) as r', [codeA]), badJson);
await expect('PH2 (mẹ) dùng CÙNG mã → cũng liên kết em A', () => as('ph2', 'select public.link_child_by_code($1) as r', [codeA]), okJson);
await expect('PH1 liên kết thêm em B (lớp khác)', () => as('ph1', 'select public.link_child_by_code($1) as r', [codeB]), okJson);
await expect('PH1 thấy em A và B, không thấy em C', () => as('ph1', 'select code from public.students order by code'), (r, e) => !e && r.rows.map((x) => x.code).join() === 'HSA,HSB');
await expect('PH2 chỉ thấy em A', () => as('ph2', 'select code from public.students'), (r, e) => !e && r.rows.map((x) => x.code).join() === 'HSA');
await expect('PH2 xem kết quả của em A (1 bài)', () => as('ph2', 'select score from public.results'), rows(1));
await expect('GV 6A thấy 2 phụ huynh của em A', () => as('t1', 'select * from public.class_parent_links(1)'), rows(2));
await expect('Tài khoản học sinh KHÔNG liên kết được', () => as('hsC', 'select public.link_child_by_code($1) as r', [codeA]), badJson);
await expect('Giáo viên KHÔNG liên kết được', () => as('t1', 'select public.link_child_by_code($1) as r', [codeA]), badJson);
await expect('Người lạ KHÔNG gọi được', () => as(null, 'select public.link_child_by_code($1) as r', [codeA]), errRes);
await expect('Người dùng KHÔNG gọi hàm nội bộ', () => as('ph1', `select public.link_by_code_internal($1, $2, 'x')`, [U.ph1, codeA]), errRes);
await expect('Cách cũ (link_child) đã tắt', () => as('ph1', `select public.link_child('HSA', 'ABCDEFGH')`), errRes);
await expect('Cách cũ (create_parent_link_code) đã tắt', () => as('t1', 'select public.create_parent_link_code(1)'), errRes);

// --- Đổi mã ---
let newA;
await expect('GV đổi mã em A → mã mới khác mã cũ', async () => { newA = await code('t1', 1, true); return newA; }, (r, e) => !e && newA && newA !== codeA);
await expect('Mã cũ hết hiệu lực', () => as('service', 'select public.link_by_code_internal(null, $1, $2) as r', [codeA, 'may-1']), badJson);
await expect('Mã mới dùng được (kiểm tra lúc đăng ký)', () => as('service', 'select public.link_by_code_internal(null, $1, $2) as r', [newA, 'may-1']), okJson);
await expect('Đổi mã không gỡ phụ huynh đã liên kết', () => as('ph2', 'select code from public.students'), rows(1));

// --- Chặn dò mã ---
for (let i = 0; i < 10; i++) await as('service', `select public.link_by_code_internal(null, 'ZZZZZZZZ', 'may-2')`);
await expect('Máy dò sai 10 lần → khóa, kể cả mã đúng', () => as('service', 'select public.link_by_code_internal(null, $1, $2) as r', [newA, 'may-2']),
  (r, e) => !e && r.rows[0].r.ok === false && /1 giờ/.test(r.rows[0].r.error));
await expect('Máy khác không bị ảnh hưởng', () => as('service', 'select public.link_by_code_internal(null, $1, $2) as r', [newA, 'may-3']), okJson);
for (let i = 0; i < 10; i++) await as('ph2', `select public.link_child_by_code('ZZZZZZZZ')`);
await expect('Tài khoản dò sai 10 lần → khóa', () => as('ph2', 'select public.link_child_by_code($1) as r', [codeB]),
  (r, e) => !e && /1 giờ/.test(r.rows[0].r.error));

// --- Chỉ quản trị viên gỡ liên kết (migration 20261127) ---
await expect('Giáo viên lớp 6A KHÔNG gỡ được phụ huynh', () => as('t1', 'select public.unlink_parent(1, $1)', [U.ph2]), errRes);
await expect('Phụ huynh KHÔNG tự gỡ', () => as('ph2', 'select public.unlink_parent(1, $1)', [U.ph2]), errRes);
await expect('Quản trị gỡ PH2 khỏi em A', async () => { await as('admin', 'select public.unlink_parent(1, $1)', [U.ph2]);
  return as('ph2', 'select code from public.students'); }, rows(0));
await expect('Giáo viên KHÔNG xóa học sinh', () => as('t1', 'delete from public.students where id=3'), blocked);

// --- Xóa học sinh xóa luôn mã ---
await expect('Xóa học sinh D → mã của D cũng mất', async () => {
  await as('admin', 'delete from public.students where id=4');
  return db.query('select * from public.student_link_codes where student_id=4'); }, rows(0));

console.log(`\n${pass} đạt, ${fail} lỗi`);
process.exit(fail ? 1 : 0);
