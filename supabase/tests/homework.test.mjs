// Kiểm thử: giao bài tập về nhà theo bài học — mỗi học sinh một đề ngẫu nhiên.
//   npm i --no-save @electric-sql/pglite@0.2.17 && node supabase/tests/homework.test.mjs
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

// Lớp 12A (GV t1) có 3 học sinh; lớp 12B (GV t2) có 1 học sinh.
const U = { t1: '00000000-0000-0000-0000-0000000000b1', t2: '00000000-0000-0000-0000-0000000000b2',
  s1: '00000000-0000-0000-0000-0000000000c1', s2: '00000000-0000-0000-0000-0000000000c2',
  s3: '00000000-0000-0000-0000-0000000000c3', s4: '00000000-0000-0000-0000-0000000000c4' };
await db.exec(`
  insert into auth.users (id, email, raw_app_meta_data) values
   ('${U.t1}', 't1@x', '{"role":"teacher"}'), ('${U.t2}', 't2@x', '{"role":"teacher"}'),
   ('${U.s1}', 's1@x', '{}'), ('${U.s2}', 's2@x', '{}'), ('${U.s3}', 's3@x', '{}'), ('${U.s4}', 's4@x', '{}');
  insert into public.classes (name, grade) values ('12A', 12), ('12B', 12);
  insert into public.teacher_classes (teacher_id, class_id) values ('${U.t1}', 1), ('${U.t2}', 2);
  insert into public.students (code, full_name, class_id, parent_id) values
   ('HS1', 'Em A', 1, '${U.s1}'), ('HS2', 'Em B', 1, '${U.s2}'), ('HS3', 'Em C', 1, '${U.s3}'), ('HS4', 'Em D', 2, '${U.s4}');
`);

// Ngân hàng: Bài 12 có 3 đề tương đương (đề v có đáp án câu 1 = v, có hình), 1 đề luyện tập thường.
const LESSON = 'Bài 12. Tích phân';
const V = [];
for (let v = 1; v <= 3; v++) {
  const { rows: [z] } = await db.query(
    `insert into public.quizzes (class_id, title, grade, topic, level, slug, published, time_limit_min, usage, chapter, lesson_no, sort_order)
     values (null, $1, 12, $2, 'kha', $3, true, 90, 'homework', 'Chương IV. Nguyên hàm và tích phân', 12, $4) returning id`,
    [`${LESSON} — Đề ${v}`, LESSON, `toan12-bai12-${v}`, v]);
  const q = (await db.query(`insert into public.quiz_questions (quiz_id, position, kind, prompt, options, points, image_path)
     values ($1, 1, 'short', 'Tính tích phân', null, 10, $2) returning id`, [z.id, `quizzes/${z.id}/h.png`])).rows[0].id;
  await db.query(`insert into public.quiz_keys (question_id, answer, explanation, explanation_image_path) values ($1, $2, 'Lời giải', $3)`,
    [q, JSON.stringify([String(v)]), `quizzes/${z.id}/sol/g.png`]);
  V.push(z.id);
}
const { rows: [P] } = await db.query(
  `insert into public.quizzes (class_id, title, grade, topic, level, slug, published, time_limit_min)
   values (null, 'Luyện tập', 12, 'Ứng dụng đạo hàm', 'tb', 'p1', true, 45) returning id`);

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
const errRes = (r, e) => !!e;
const blocked = (r, e) => !!e || (r.rows.length || r.affectedRows || 0) === 0;

// --- Học sinh không thấy đề dành cho bài về nhà trong ngân hàng ---
await expect('HS: practice_topics không có Bài 12', () => as('s1', 'select * from public.practice_topics()'),
  (r, e) => !e && r.rows.length === 1 && r.rows[0].topic === 'Ứng dụng đạo hàm');
await expect('HS: không đọc được đề gốc bài về nhà', () => as('s1', 'select id from public.quizzes where id = any($1)', [V]), rows(0));
await expect('HS: không bắt đầu làm đề gốc bài về nhà', () => as('s1', 'select public.start_quiz($1)', [V[0]]), errRes);
await expect('HS: vẫn làm được đề luyện tập thường', () => as('s1', 'select public.start_quiz($1)', [P.id]), (r, e) => !e);

// --- Thanh chọn Chương → Bài ---
await expect('GV: homework_lessons(12) có Bài 12, 3 đề', () => as('t1', 'select * from public.homework_lessons(12)'),
  (r, e) => !e && r.rows.length === 1 && r.rows[0].lesson === LESSON && r.rows[0].variant_count === 3
    && r.rows[0].chapter === 'Chương IV. Nguyên hàm và tích phân');
await expect('HS: homework_lessons trả về rỗng', () => as('s1', 'select * from public.homework_lessons(12)'), rows(0));

// --- Giao bài ---
const due = new Date(Date.now() + 7 * 864e5).toISOString();
await expect('GV2 không giao được cho lớp 12A', () => as('t2', 'select public.assign_homework(1, $1, $2, null)', [LESSON, due]), errRes);
await expect('GV1 không giao bài chưa có đề', () => as('t1', 'select public.assign_homework(1, $1, $2, null)', ['Bài 99. Không có', due]), errRes);
await expect('GV1 không giao với hạn nộp đã qua', () => as('t1', 'select public.assign_homework(1, $1, $2, null)', [LESSON, '2020-01-01T00:00:00Z']), errRes);
let hw;
await expect('GV1 giao Bài 12 cho lớp 12A: 3 em', async () => {
  const r = await as('t1', 'select public.assign_homework(1, $1, $2, null) as r', [LESSON, due]);
  hw = r.rows[0].r.homework_id; return r;
}, (r, e) => !e && r.rows[0].r.students === 3 && r.rows[0].r.variants === 3);

const copies = (await db.query('select id, student_id, source_quiz_id, class_id, due_at, title from public.quizzes where homework_id=$1 order by student_id', [hw])).rows;
await expect('Mỗi em một bản chép riêng', async () => ({ rows: copies }), (r) => r.rows.length === 3 && new Set(r.rows.map((c) => c.student_id)).size === 3);
await expect('3 em nhận 3 đề khác nhau (lớp ≤ số đề)', async () => ({ rows: copies }), (r) => new Set(r.rows.map((c) => Number(c.source_quiz_id))).size === 3);
await expect('Bản chép có hạn nộp và tiêu đề theo bài', async () => ({ rows: copies }),
  (r) => r.rows.every((c) => c.due_at && c.title === 'Bài tập về nhà: ' + LESSON && Number(c.class_id) === 1));
await expect('Bản chép có đủ câu hỏi + đáp án + hình của đề gốc', () => db.query(
  `select q.image_path, k.answer, k.explanation_image_path, z.source_quiz_id from public.quizzes z
   join public.quiz_questions q on q.quiz_id = z.id join public.quiz_keys k on k.question_id = q.id where z.homework_id = $1`, [hw]),
  (r, e) => !e && r.rows.length === 3 && r.rows.every((x) => x.image_path === `quizzes/${x.source_quiz_id}/h.png`
    && x.answer[0] === String(V.indexOf(Number(x.source_quiz_id)) + 1)));

// --- Học sinh chỉ thấy đề của mình ---
const mine = copies[0];
await expect('HS1 chỉ thấy 1 bài về nhà (của mình)', () => as('s1', 'select id from public.quizzes where homework_id is not null'),
  (r, e) => !e && r.rows.length === 1 && Number(r.rows[0].id) === Number(mine.id));
await expect('HS1 không bắt đầu được bài của HS2', () => as('s1', 'select public.start_quiz($1)', [copies[1].id]), errRes);
await expect('HS4 (lớp khác) không thấy bài nào', () => as('s4', 'select id from public.quizzes where homework_id is not null'), rows(0));
await expect('HS1 xem được hình câu hỏi của đề mình (thư mục đề gốc)', () => as('s1', 'select public.storage_can_view($1) as ok', [`quizzes/${mine.source_quiz_id}/h.png`]),
  (r, e) => !e && r.rows[0].ok === true);
const other = copies.find((c) => c.source_quiz_id !== mine.source_quiz_id);
await expect('HS1 không xem được hình đề của bạn', () => as('s1', 'select public.storage_can_view($1) as ok', [`quizzes/${other.source_quiz_id}/h.png`]),
  (r, e) => !e && r.rows[0].ok === false);
await expect('HS1 chưa nộp: chưa xem được hình lời giải', () => as('s1', 'select public.storage_can_view($1) as ok', [`quizzes/${mine.source_quiz_id}/sol/g.png`]),
  (r, e) => !e && r.rows[0].ok === false);

// --- Làm bài và chấm ---
const right = String(V.indexOf(Number(mine.source_quiz_id)) + 1);
await expect('HS1 làm và nộp đúng → 10/10', async () => {
  const s = await as('s1', 'select public.start_quiz($1) as r', [mine.id]);
  const qid = (await db.query('select id from public.quiz_questions where quiz_id=$1', [mine.id])).rows[0].id;
  return as('s1', 'select public.submit_quiz($1, $2) as r', [s.rows[0].r.attempt_id, { [qid]: right }]);
}, (r, e) => !e && Number(r.rows[0].r.score) === 10);
await expect('HS1 đã nộp: xem được hình lời giải', () => as('s1', 'select public.storage_can_view($1) as ok', [`quizzes/${mine.source_quiz_id}/sol/g.png`]),
  (r, e) => !e && r.rows[0].ok === true);
await expect('GV1 thấy bài làm của HS1', () => as('t1', 'select a.id from public.quiz_attempts a join public.quizzes z on z.id=a.quiz_id where z.homework_id=$1', [hw]), rows(1));

// --- Hình dùng chung không được xóa ---
await expect('Hình đề gốc còn bản chép dùng → báo dùng chung', () => as('t1', 'select public.quiz_images_shared($1, $2) as s', [V[0], [`quizzes/${V[0]}/h.png`, `quizzes/${V[0]}/x.png`]]),
  (r, e) => !e && r.rows[0].s.length === 1 && r.rows[0].s[0] === `quizzes/${V[0]}/h.png`);

// --- Học sinh mới vào lớp ---
await db.exec(`insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000c5', 's5@x');
  insert into public.students (code, full_name, class_id, parent_id) values ('HS5', 'Em E', 1, '00000000-0000-0000-0000-0000000000c5');`);
await expect('Giao thêm cho học sinh mới: 1 em', () => as('t1', 'select public.homework_add_missing($1) as n', [hw]), (r, e) => !e && r.rows[0].n === 1);
await expect('Giao thêm lần nữa: 0 em', () => as('t1', 'select public.homework_add_missing($1) as n', [hw]), (r, e) => !e && r.rows[0].n === 0);
await expect('GV2 không giao thêm được', () => as('t2', 'select public.homework_add_missing($1)', [hw]), errRes);

// --- Thu hồi, đổi hạn, xóa ---
await expect('GV1 thu hồi → HS2 không thấy bài', async () => {
  await as('t1', 'select public.homework_set_published($1, false)', [hw]);
  return as('s2', 'select id from public.quizzes where homework_id is not null');
}, rows(0));
await expect('Thu hồi: HS1 (đã làm) vẫn xem được bài của mình', () => as('s1', 'select id from public.quizzes where homework_id is not null'), rows(1));
await expect('GV1 giao lại + đổi hạn', async () => {
  await as('t1', 'select public.homework_set_published($1, true)', [hw]);
  await as('t1', 'select public.homework_update($1, $2, 60)', [hw, new Date(Date.now() + 864e5).toISOString()]);
  return db.query('select distinct time_limit_min from public.quizzes where homework_id=$1', [hw]);
}, (r, e) => !e && r.rows.length === 1 && r.rows[0].time_limit_min === 60);
await expect('GV1 thấy lượt giao; GV2 không thấy', async () => {
  const a = await as('t1', 'select id from public.homework'); const b = await as('t2', 'select id from public.homework');
  return { rows: [a.rows.length, b.rows.length] };
}, (r) => r.rows[0] === 1 && r.rows[1] === 0);
await expect('Không xóa được lượt giao đã có bài làm', () => as('t1', 'delete from public.homework where id=$1', [hw]), errRes);
await expect('Xóa được lượt giao chưa ai làm', async () => {
  const r = await as('t1', 'select public.assign_homework(2, $1, null, null) as r', [LESSON]).catch(() => null);
  if (r) throw new Error('GV1 không dạy 12B mà vẫn giao được');
  const r2 = await as('t2', 'select public.assign_homework(2, $1, null, null) as r', [LESSON]);
  return as('t2', 'delete from public.homework where id=$1', [r2.rows[0].r.homework_id]);
}, rows(1));
await expect('Xóa lượt giao → bản chép cũng mất', () => db.query('select id from public.quizzes where class_id=2'), rows(0));

// --- Đề lớp thường và học sinh không bị ảnh hưởng ---
await expect('HS không tạo được lượt giao', () => as('s1', 'select public.assign_homework(1, $1, null, null)', [LESSON]), errRes);
await expect('HS không đọc được bảng homework', () => as('s1', 'select * from public.homework'), rows(0));
await expect('anon không gọi được assign_homework', () => as(null, 'select public.assign_homework(1, $1, null, null)', [LESSON]), errRes);
await expect('HS không gọi trực tiếp homework_fill', () => as('s1', 'select public.homework_fill($1)', [hw]), blocked);

// --- Giáo viên xem bài TỰ LUYỆN (đề ngân hàng) của học sinh lớp mình (tab Nhập kết quả) ---
{
  const att = (await db.query('select id from public.quiz_attempts where quiz_id = $1 and student_id = 1', [P.id])).rows[0];
  await as('s1', 'select public.submit_quiz($1, $2::jsonb)', [att.id, {}]);
  const ONLINE = `select a.id, z.topic from public.quiz_attempts a join public.quizzes z on z.id = a.quiz_id
                  where a.student_id in (select id from public.students where class_id = 1) and a.submitted_at is not null and z.class_id is null`;
  await expect('GV lớp: thấy bài tự luyện đã nộp của HS lớp mình', () => as('t1', ONLINE),
    (r, e) => !e && r.rows.some((x) => x.topic === 'Ứng dụng đạo hàm'));
  await expect('GV lớp: đọc được câu hỏi đề tự luyện để xem bài', () => as('t1', 'select id from public.quiz_questions where quiz_id = $1', [P.id]), (r, e) => !e);
}

console.log(`\n${pass} đạt, ${fail} lỗi`);
process.exit(fail ? 1 : 0);
