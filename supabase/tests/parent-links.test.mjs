// Kiểm thử phân quyền (RLS) tài khoản phụ huynh – liên kết nhiều con, bằng PGlite.
//   npm i --no-save @electric-sql/pglite@0.2.17 && node supabase/tests/parent-links.test.mjs
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
// Chỉ chạy tới migration của cách liên kết cũ (cách mới kiểm thử ở link-codes.test.mjs).
for (const f of readdirSync(MIG).sort().filter((x) => x < '20261126')) {
  try { await db.exec(readFileSync(`${MIG}/${f}`, 'utf8')); }
  catch (e) { console.error('MIGRATION FAIL', f, e.message); process.exit(1); }
}
// Chạy lại file mới lần 2 (phải không lỗi)
await db.exec(readFileSync(`${MIG}/20261125000000_parent_links.sql`, 'utf8'));
console.log('migrations OK (chạy 2 lần)');

const id = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const U = { admin: id(1), t1: id(2), t2: id(3), hsA: id(11), hsB: id(12), hsC: id(13), ph1: id(21), ph2: id(22) };
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
  insert into public.quizzes (class_id, title, grade, topic, level, slug, published) values (null, 'Đề LT', 6, 'Số nguyên', 'tb', 'lt', true);
  insert into public.quiz_questions (quiz_id, position, kind, prompt, options, points) values (1, 1, 'mcq', 'q', '["a","b","c","d"]', 10);
  insert into public.quiz_keys (question_id, answer) values (1, '0');
`);

async function as(who, sql, params = []) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${who ? U[who] : ''}', false);`);
  await db.exec(who === 'service' ? 'set role service_role' : who ? 'set role authenticated' : 'set role anon');
  try { return await db.query(sql, params); }
  finally { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`); }
}
U.service = '';
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
const blocked = (r, e) => !!e || (r.rows.length || r.affectedRows || 0) === 0;
const okJson = (r, e) => !e && r.rows[0]?.r?.ok === true;
const badJson = (r, e) => !e && r.rows[0]?.r?.ok === false;

// Học sinh A làm và nộp đề luyện tập
const st = await as('hsA', 'select public.start_quiz(1) as r');
await as('hsA', 'select public.submit_quiz($1, $2)', [st.rows[0].r.attempt_id, { 1: 0 }]);

// --- Tạo mã liên kết ---
let codeA, codeB;
await expect('GV lớp 6A tạo mã cho em A', async () => { const r = await as('t1', 'select public.create_parent_link_code(1) as r'); codeA = r.rows[0].r.code; return r; },
  (r, e) => !e && /^[A-Z2-9]{8}$/.test(codeA));
await expect('GV lớp khác KHÔNG tạo mã cho em A', () => as('t2', 'select public.create_parent_link_code(1)'), errRes);
await expect('Học sinh B CHƯA đổi mật khẩu ban đầu: KHÔNG tự mời phụ huynh', () => as('hsB', 'select public.create_parent_link_code(2)'), errRes);
await db.query('update public.students set password_changed = true where id = 2'); // máy chủ ghi sau khi em đổi mật khẩu
await expect('Học sinh B tự tạo mã cho mình', async () => { const r = await as('hsB', 'select public.create_parent_link_code(2) as r'); codeB = r.rows[0].r.code; return r; }, (r, e) => !e && !!codeB);
await expect('Học sinh B KHÔNG tạo mã cho em A', () => as('hsB', 'select public.create_parent_link_code(1)'), errRes);
await expect('Phụ huynh KHÔNG tạo mã', () => as('ph1', 'select public.create_parent_link_code(1)'), errRes);
await expect('Không ai đọc được bảng mã', () => as('t1', 'select * from public.parent_link_codes'), errRes);
await expect('Mã lưu dạng băm (không có mã gốc)', () => db.query('select code_hash from public.parent_link_codes where student_id=1'),
  (r) => r.rows[0].code_hash !== codeA && r.rows[0].code_hash.length === 64);

// --- Liên kết ---
await expect('PH1 nhập sai mã → từ chối', () => as('ph1', `select public.link_child('HSA', 'SAIMA123') as r`), badJson);
await expect('Số lần sai được lưu lại (1)', () => db.query('select attempts from public.parent_link_codes where student_id=1'), (r) => r.rows[0].attempts === 1);
await expect('PH1 nhập đúng (chữ thường, có dấu cách) → liên kết em A', () => as('ph1', `select public.link_child(' hsa ', $1) as r`, [codeA.toLowerCase().slice(0, 4) + ' ' + codeA.slice(4)]), okJson);
await expect('Mã đã dùng thì hết hiệu lực', () => as('ph2', `select public.link_child('HSA', $1) as r`, [codeA]), badJson);
await expect('PH1 liên kết thêm em B (lớp khác) → 1 PH nhiều con', () => as('ph1', `select public.link_child('HSB', $1) as r`, [codeB]), okJson);
await expect('Tài khoản học sinh KHÔNG dùng link_child', async () => { const r = await as('t1', 'select public.create_parent_link_code(3) as r');
  return as('hsA', `select public.link_child('HSC', $1) as r`, [r.rows[0].r.code]); }, badJson);
await expect('Giáo viên KHÔNG dùng link_child', () => as('t1', `select public.link_child('HSC', 'XXXXXXXX') as r`), badJson);
await expect('Nhập sai 5 lần thì khóa mã (kể cả nhập đúng sau đó)', async () => {
  const r = await as('t1', 'select public.create_parent_link_code(3) as r'); const good = r.rows[0].r.code;
  for (let i = 0; i < 5; i++) await as('ph2', `select public.link_child('HSC', 'ZZZZZZZZ')`);
  return as('ph2', `select public.link_child('HSC', $1) as r`, [good]); }, badJson);
await expect('PH KHÔNG gọi được link_child_internal', () => as('ph2', `select public.link_child_internal($1, 'HSC', 'X')`, [U.ph2]), errRes);
await expect('PH KHÔNG tự thêm dòng liên kết', () => as('ph2', `insert into public.parent_links (parent_id, student_id) values ($1, 3)`, [U.ph2]), errRes);
await expect('Máy chủ (đăng ký) kiểm tra mã không dùng mã', async () => {
  const r = await as('t1', 'select public.create_parent_link_code(3) as r'); const good = r.rows[0].r.code;
  const chk = await as('service', `select public.link_child_internal(null, 'HSC', $1) as r`, [good]);
  const use = await as('service', `select public.link_child_internal($1, 'HSC', $2) as r`, [U.ph2, good]);
  return { rows: [{ r: { ok: chk.rows[0].r.ok && use.rows[0].r.ok } }] }; }, okJson);
await expect('anon KHÔNG gọi được', () => as(null, `select public.link_child('HSA', 'X')`), errRes);

// --- Phụ huynh chỉ xem con mình ---
await expect('PH1 thấy đúng 2 con (A, B)', () => as('ph1', 'select code from public.students order by code'), (r, e) => !e && r.rows.map((x) => x.code).join() === 'HSA,HSB');
await expect('PH2 chỉ thấy em C', () => as('ph2', 'select code from public.students'), (r, e) => !e && r.rows.map((x) => x.code).join() === 'HSC');
await expect('PH1 thấy kết quả của A và B, không thấy C', () => as('ph1', 'select student_id from public.results order by student_id'), (r, e) => !e && r.rows.map((x) => x.student_id).join() === '1,2');
await expect('PH1 thấy bài kiểm tra của cả 2 lớp', () => as('ph1', 'select id from public.assessments'), rows(2));
await expect('PH1 thấy bài làm trực tuyến của A', () => as('ph1', 'select * from public.quiz_attempts'), rows(1));
await expect('PH1 xem câu hỏi + đáp án đề A đã nộp', async () => {
  const q = await as('ph1', 'select * from public.quiz_questions where quiz_id=1'); const k = await as('ph1', 'select * from public.quiz_keys');
  return { rows: [...q.rows, ...k.rows] }; }, rows(2));
await expect('PH2 KHÔNG xem đáp án đề (con chưa làm)', () => as('ph2', 'select * from public.quiz_keys'), rows(0));
await expect('PH1 KHÔNG làm bài thay con', () => as('ph1', 'select public.start_quiz(1)'), errRes);
await expect('PH1 KHÔNG sửa điểm', () => as('ph1', 'update public.results set score=10 where student_id=1'), blocked);
await expect('PH1 KHÔNG sửa học sinh', () => as('ph1', `update public.students set full_name='x' where id=1`), blocked);
await expect('PH1 KHÔNG xem danh sách liên kết của PH2', () => as('ph1', 'select * from public.parent_links where parent_id=$1', [U.ph2]), rows(0));

// --- Học sinh vẫn như cũ ---
await expect('Học sinh A chỉ thấy mình', () => as('hsA', 'select code from public.students'), (r, e) => !e && r.rows.map((x) => x.code).join() === 'HSA');
await expect('Học sinh A vẫn làm bài được', () => as('hsA', `select public.start_quiz(1) as r`), (r, e) => !e && r.rows[0].r.submitted === true);
await expect('Học sinh C chưa nộp: không thấy đáp án', () => as('hsC', 'select * from public.quiz_keys'), rows(0));

// --- Giáo viên quản lý liên kết ---
await expect('GV 6A thấy phụ huynh của lớp mình', () => as('t1', 'select * from public.class_parent_links(1)'), rows(2)); // PH1–A, PH2–C
await expect('GV 7A không xem được lớp 6A', () => as('t2', 'select * from public.class_parent_links(1)'), rows(0));
await expect('GV 7A không gỡ liên kết lớp 6A', () => as('t2', 'select public.unlink_parent(1, $1)', [U.ph1]), errRes);
await expect('GV 6A gỡ PH1 khỏi em A → PH1 chỉ còn thấy em B', async () => {
  await as('t1', 'select public.unlink_parent(1, $1)', [U.ph1]);
  return as('ph1', 'select code from public.students'); }, (r, e) => !e && r.rows.map((x) => x.code).join() === 'HSB');
await expect('Sau khi gỡ, PH1 hết thấy bài làm của A', () => as('ph1', 'select * from public.quiz_attempts'), rows(0));

// --- Mã học sinh tự sinh, không đổi được ---
await expect('Quản trị thêm học sinh không nhập mã → TDM000001', () => as('admin', `insert into public.students (full_name, class_id) values ('Em D', 1) returning code, password_changed`),
  (r, e) => !e && r.rows[0].code === 'TDM000001' && r.rows[0].password_changed === false);
await expect('Học sinh tiếp theo → TDM000002', () => as('admin', `insert into public.students (full_name, class_id) values ('Em E', 1) returning code`), (r, e) => !e && r.rows[0].code === 'TDM000002');
await expect('Bỏ qua mã đã có sẵn (TDM000003 bị chiếm → TDM000004)', async () => {
  await db.query(`insert into public.students (code, full_name, class_id) values ('TDM000003', 'Em cũ', 1)`);
  return as('admin', `insert into public.students (full_name, class_id) values ('Em F', 1) returning code`); }, (r, e) => !e && r.rows[0].code === 'TDM000004');
await expect('Quản trị KHÔNG đổi được mã học sinh', () => as('admin', `update public.students set code='ABC123' where code='TDM000001'`), errRes);
await expect('Kể cả máy chủ cũng không đổi mã', () => as('service', `update public.students set code='ABC123' where code='TDM000001'`), errRes);
await expect('Quản trị KHÔNG tự đặt cờ đã đổi mật khẩu', () => as('admin', `update public.students set password_changed=true where code='TDM000001'`), errRes);
await expect('Quản trị vẫn sửa tên, chuyển lớp', () => as('admin', `update public.students set full_name='Em D2', class_id=2 where code='TDM000001'`), (r, e) => !e && r.affectedRows === 1);
await expect('Giáo viên KHÔNG thêm học sinh', () => as('t1', `insert into public.students (full_name, class_id) values ('X', 1)`), errRes);

console.log(`\n${pass} đạt, ${fail} lỗi`);
process.exit(fail ? 1 : 0);
