// Kiểm thử: học sinh tự gửi bài làm (chỉ bài của lớp mình, chỉ khi chưa chấm).
//   npm i --no-save @electric-sql/pglite@0.2.17 && node supabase/tests/paper-quizzes.test.mjs
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
for (const f of readdirSync(MIG).sort()) {
  try { await db.exec(readFileSync(`${MIG}/${f}`, 'utf8')); }
  catch (e) { console.error('MIGRATION FAIL', f, e.message); process.exit(1); }
}
console.log('migrations OK');

const U = { t1: '00000000-0000-0000-0000-0000000000b1', s1: '00000000-0000-0000-0000-0000000000c1',
  s2: '00000000-0000-0000-0000-0000000000c2', p1: '00000000-0000-0000-0000-0000000000d1' };
await db.exec(`
  insert into auth.users (id, email, raw_app_meta_data) values
   ('${U.t1}', 't1@x', '{"role":"teacher"}'), ('${U.s1}', 's1@x', '{}'), ('${U.s2}', 's2@x', '{}'), ('${U.p1}', 'p1@x', '{"role":"parent"}');
  insert into public.classes (name, grade) values ('6A', 6), ('7B', 7);
  insert into public.teacher_classes (teacher_id, class_id) values ('${U.t1}', 1);
  insert into public.students (code, full_name, class_id, parent_id) values ('HS1', 'Em A', 1, '${U.s1}'), ('HS2', 'Em B', 2, '${U.s2}');
  insert into public.parent_links (parent_id, student_id) values ('${U.p1}', 1);
  insert into public.assessments (class_id, title, week_start, max_score) values (1, 'KT 6A', '2026-11-23', 10), (2, 'KT 7B', '2026-11-23', 10);
  grant select, insert, delete on storage.objects to authenticated;
`);
async function as(who, sql, params = []) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${U[who]}', false); set role authenticated;`);
  try { return await db.query(sql, params); } finally { await db.exec("reset role; select set_config('request.jwt.claim.sub', '', false);"); }
}
let fail = 0;
async function expect(name, fn, ok) {
  let res, err; try { res = await fn(); } catch (e) { err = e; }
  const pass = ok(res, err); if (!pass) fail++;
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${pass ? '' : '  → ' + (err ? err.message : JSON.stringify(res?.rows))}`);
}
const okR = (r, e) => !e;
const errR = (r, e) => !!e;
const n = (k) => (r, e) => !e && (r.rows.length || r.affectedRows || 0) === k;

let rid;
await expect('HS1 bắt đầu gửi bài lớp mình', async () => { const r = await as('s1', 'select public.start_submission(1, 1) as id'); rid = r.rows[0].id; return r; }, (r, e) => !e && rid > 0);
await expect('Gọi lại trả cùng dòng kết quả', () => as('s1', 'select public.start_submission(1, 1) as id'), (r, e) => !e && r.rows[0].id === rid);
await expect('HS1 tải ảnh vào kho results/<id>', () => as('s1', `insert into storage.objects (bucket_id, name) values ('tdm', 'results/${rid}/a.jpg')`), okR);
await expect('HS1 ghi result_files', () => as('s1', `insert into public.result_files (result_id, path) values (${rid}, 'results/${rid}/a.jpg')`), okR);
await expect('Phụ huynh liên kết cũng gửi được', () => as('p1', `insert into public.result_files (result_id, path) values (${rid}, 'results/${rid}/b.jpg')`), okR);
await expect('HS1 xem lại bài đã gửi', () => as('s1', `select path from public.result_files where result_id = ${rid}`), n(2));
await expect('HS1 xóa ảnh gửi nhầm', () => as('s1', `delete from public.result_files where path = 'results/${rid}/b.jpg'`), n(1));
await expect('HS1 không tự cho điểm', () => as('s1', `update public.results set score = 10 where id = ${rid}`), (r, e) => !!e || r.affectedRows === 0);
await expect('HS1 không gửi bài lớp khác', () => as('s1', 'select public.start_submission(2, 1)'), errR);
await expect('HS1 không gửi thay HS2', () => as('s1', 'select public.start_submission(2, 2)'), errR);
await expect('HS2 không ghi file vào kết quả của HS1', () => as('s2', `insert into public.result_files (result_id, path) values (${rid}, 'results/${rid}/x.jpg')`), errR);
await expect('HS2 không tải vào thư mục của HS1', () => as('s2', `insert into storage.objects (bucket_id, name) values ('tdm', 'results/${rid}/x.jpg')`), errR);
await expect('Giáo viên thấy bài HS gửi', () => as('t1', `select path from public.result_files where result_id = ${rid}`), n(1));
await expect('Giáo viên chấm điểm', () => as('t1', `update public.results set score = 8 where id = ${rid}`), n(1));
await expect('Chấm rồi: HS không gửi thêm', () => as('s1', 'select public.start_submission(1, 1)'), errR);
await expect('Chấm rồi: HS không thêm file', () => as('s1', `insert into public.result_files (result_id, path) values (${rid}, 'results/${rid}/c.jpg')`), errR);
await expect('Chấm rồi: HS không xóa file', () => as('s1', `delete from public.result_files where result_id = ${rid}`), n(0));
await expect('Chấm rồi: HS vẫn xem được bài làm', () => as('s1', `select path from public.result_files where result_id = ${rid}`), n(1));
console.log(fail ? `${fail} test FAIL` : 'Tất cả PASS');
process.exit(fail ? 1 : 0);
