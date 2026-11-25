// Kiểm thử: học sinh / phụ huynh thấy bài kiểm tra của lớp (và file đề) trước khi có điểm.
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
  insert into public.assessment_files (assessment_id, path) values (1, 'assessments/1/de.docx'), (2, 'assessments/2/de.pdf');
  grant select on storage.objects to authenticated;
  insert into storage.objects (bucket_id, name) values ('tdm', 'assessments/1/de.docx'), ('tdm', 'assessments/2/de.pdf');
`);
async function as(who, sql) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${U[who]}', false); set role authenticated;`);
  try { return (await db.query(sql)).rows; } finally { await db.exec("reset role; select set_config('request.jwt.claim.sub', '', false);"); }
}
let fail = 0;
function check(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  → ${JSON.stringify(got)} (cần ${JSON.stringify(want)})`}`);
}
const titles = (r) => r.map((x) => x.title ?? x.path ?? x.name);
check('HS lớp 6A thấy bài của lớp khi chưa có điểm', titles(await as('s1', 'select title from public.assessments order by id')), ['KT 6A']);
check('HS lớp 6A thấy file đề của lớp', titles(await as('s1', 'select path from public.assessment_files order by id')), ['assessments/1/de.docx']);
check('HS lớp 6A mở được file đề trong kho', titles(await as('s1', "select name from storage.objects order by name")), ['assessments/1/de.docx']);
check('Phụ huynh liên kết thấy bài của lớp con', titles(await as('p1', 'select title from public.assessments order by id')), ['KT 6A']);
check('HS lớp 7B không thấy bài lớp 6A', titles(await as('s2', 'select title from public.assessments order by id')), ['KT 7B']);
check('HS không thấy điểm của bạn khác', (await as('s2', 'select id from public.results')).length, 0);
// Chuyển lớp: bài cũ đã có điểm vẫn xem được
await db.exec(`insert into public.results (assessment_id, student_id, score) values (2, 2, 8); update public.students set class_id = 1 where id = 2;`);
check('HS chuyển lớp vẫn thấy bài cũ đã có điểm + bài lớp mới', titles(await as('s2', 'select title from public.assessments order by id')), ['KT 6A', 'KT 7B']);
check('Giáo viên vẫn chỉ quản lý được lớp mình', titles(await as('t1', 'select title from public.assessments order by id')), ['KT 6A']);
console.log(fail ? `${fail} test FAIL` : 'Tất cả PASS');
process.exit(fail ? 1 : 0);
