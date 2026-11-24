// Kiểm thử phân quyền (RLS) ngân hàng đề bằng PGlite — chạy trên máy, không đụng Supabase thật.
//   npm i --no-save @electric-sql/pglite@0.2.17 && node supabase/tests/bank-rls.test.mjs
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
  t2: '00000000-0000-0000-0000-0000000000b2', s1: '00000000-0000-0000-0000-0000000000c1' };
await db.exec(`
  insert into auth.users (id, email, raw_app_meta_data) values
   ('${U.admin}', 'a@x', '{"role":"admin"}'), ('${U.t1}', 't1@x', '{"role":"teacher"}'),
   ('${U.t2}', 't2@x', '{"role":"teacher"}'), ('${U.s1}', 's1@x', '{}');
  insert into public.classes (name, grade) values ('6A', 6);
  insert into public.teacher_classes (teacher_id, class_id) values ('${U.t1}', 1);
  insert into public.students (code, full_name, class_id, parent_id) values ('HS1', 'Em A', 1, '${U.s1}');
`);
// Đề luyện tập B1 (chưa ai làm), B2 (sẽ có bài làm), đề lớp C1
async function mkQuiz(cls, slug) {
  const { rows: [z] } = await db.query(
    `insert into public.quizzes (class_id, title, grade, topic, level, slug, published, time_limit_min)
     values ($1, $2, 6, 'Số nguyên', 'tb', $3, true, 45) returning id`, [cls, 'Đề ' + slug, cls ? null : slug]);
  const q1 = (await db.query(`insert into public.quiz_questions (quiz_id, position, kind, prompt, options, points)
     values ($1, 1, 'mcq', 'Tính $-3+5$', '["$2$","$-2$","$8$","$-8$"]', 5) returning id`, [z.id])).rows[0].id;
  const q2 = (await db.query(`insert into public.quiz_questions (quiz_id, position, kind, prompt, points)
     values ($1, 2, 'short', 'Tính $-2 \\cdot 3$', 5) returning id`, [z.id])).rows[0].id;
  await db.query(`insert into public.quiz_keys (question_id, answer, explanation) values ($1, '0', 'Vì...'), ($2, '["-6"]', null)`, [q1, q2]);
  return { id: z.id, q1, q2 };
}
const B1 = await mkQuiz(null, 'b1'), B2 = await mkQuiz(null, 'b2'), C1 = await mkQuiz(1, 'c1');

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
const blocked = (r, e) => !!e || (r.rows.length || r.affectedRows || 0) === 0; // bị chặn: báo lỗi hoặc 0 dòng

// Học sinh làm B2 và nộp (đúng câu 1, sai câu 2) → 5/10
const st = await as('s1', `select public.start_quiz($1) as r`, [B2.id]);
const att = st.rows[0].r.attempt_id;
await expect('HS nộp bài B2, chấm máy chủ 5/10', () => as('s1', `select public.submit_quiz($1, $2) as r`, [att, { [B2.q1]: 0, [B2.q2]: '5' }]),
  (r, e) => !e && Number(r.rows[0].r.score) === 5 && Number(r.rows[0].r.max_score) === 10);

// Giáo viên xem
await expect('GV1 thấy danh sách ngân hàng (2 đề)', () => as('t1', 'select * from public.bank_quizzes()'), rows(2));
await expect('GV2 (chưa phân lớp) cũng thấy ngân hàng', () => as('t2', 'select * from public.bank_quizzes()'), rows(2));
await expect('bank_quizzes đếm bài đã nộp B2 = 1', () => as('t1', 'select submitted_count from public.bank_quizzes() where id=$1', [B2.id]), (r) => r.rows[0]?.submitted_count === 1);
await expect('HS gọi bank_quizzes → không có dòng', () => as('s1', 'select * from public.bank_quizzes()'), rows(0));
await expect('anon không gọi được bank_quizzes', () => as(null, 'select * from public.bank_quizzes()'), errRes);
await expect('GV xem câu hỏi B1', () => as('t1', 'select * from public.quiz_questions where quiz_id=$1', [B1.id]), rows(2));
await expect('GV xem đáp án B1', () => as('t2', 'select k.* from public.quiz_keys k join public.quiz_questions q on q.id=k.question_id where q.quiz_id=$1', [B1.id]), rows(2));
await expect('GV xem đề ẩn trong ngân hàng', async () => { await db.query('update public.quizzes set published=false where id=$1', [B1.id]);
  const r = await as('t2', 'select id from public.quizzes where id=$1', [B1.id]);
  await db.query('update public.quizzes set published=true where id=$1', [B1.id]); return r; }, rows(1));

// Giáo viên sửa
await expect('GV sửa tiêu đề + thời gian B1', () => as('t2', `update public.quizzes set title='Đề mới', time_limit_min=30 where id=$1`, [B1.id]), rows(1));
await expect('GV sửa câu hỏi + phương án B1', () => as('t2', `update public.quiz_questions set prompt='$\\frac{1}{2}$', options='["a","b","c","d"]' where id=$1`, [B1.q1]), rows(1));
await expect('GV sửa đáp án + lời giải (upsert)', () => as('t2', `insert into public.quiz_keys (question_id, answer, explanation) values ($1, '2', 'Lời giải $x^2$')
  on conflict (question_id) do update set answer=excluded.answer, explanation=excluded.explanation`, [B1.q1]), rows(1));
await expect('GV thêm câu vào B1 (chưa ai làm)', () => as('t1', `insert into public.quiz_questions (quiz_id, position, kind, prompt, points) values ($1, 3, 'short', 'x', 1)`, [B1.id]), rows(1));
await expect('GV KHÔNG ẩn/hiện được đề', () => as('t1', `update public.quizzes set published=false where id=$1`, [B1.id]), errRes);
await expect('GV KHÔNG đổi chuyên đề/mức độ', () => as('t1', `update public.quizzes set level='gioi' where id=$1`, [B1.id]), errRes);
await expect('GV KHÔNG chuyển đề ngân hàng thành đề lớp', () => as('t1', `update public.quizzes set class_id=1 where id=$1`, [B1.id]), errRes);
await expect('GV KHÔNG xóa được câu', () => as('t1', `delete from public.quiz_questions where id=$1`, [B1.q2]), blocked);
await expect('GV KHÔNG xóa được đáp án', () => as('t1', `delete from public.quiz_keys where question_id=$1`, [B1.q2]), blocked);
await expect('GV KHÔNG xóa được đề', () => as('t1', `delete from public.quizzes where id=$1`, [B1.id]), blocked);
await expect('GV KHÔNG xóa bài làm HS của đề ngân hàng', () => as('t1', `delete from public.quiz_attempts where id=$1`, [att]), blocked);
await expect('GV KHÔNG tạo đề ngân hàng mới', () => as('t1', `insert into public.quizzes (class_id, title, grade, topic, level) values (null, 'x', 6, 't', 'tb')`), errRes);

// Đề đã có bài làm
await expect('Sửa đáp án B2 rồi chấm lại → 10/10', async () => {
  await as('t1', `update public.quiz_keys set answer='["5","-6"]' where question_id=$1`, [B2.q2]);
  await as('t1', 'select public.regrade_quiz($1)', [B2.id]);
  return db.query('select score, max_score from public.quiz_attempts where id=$1', [att]);
}, (r, e) => !e && Number(r.rows[0].score) === 10);
await expect('B2 có bài làm: KHÔNG thêm câu', () => as('admin', `insert into public.quiz_questions (quiz_id, position, kind, prompt, points) values ($1, 3, 'short', 'x', 1)`, [B2.id]), errRes);
await expect('B2 có bài làm: admin KHÔNG xóa câu', () => as('admin', `delete from public.quiz_questions where id=$1`, [B2.q1]), errRes);
await expect('B2 có bài làm: admin KHÔNG xóa đề', () => as('admin', `delete from public.quizzes where id=$1`, [B2.id]), errRes);
await expect('B2 có bài làm: GV vẫn sửa nội dung câu', () => as('t1', `update public.quiz_questions set prompt='sửa' where id=$1`, [B2.q1]), rows(1));

// Admin
await expect('Admin ẩn đề B1', () => as('admin', `update public.quizzes set published=false where id=$1`, [B1.id]), rows(1));
await expect('Admin hiện lại đề B1', () => as('admin', `update public.quizzes set published=true where id=$1`, [B1.id]), rows(1));
await expect('Admin xóa câu B1', () => as('admin', `delete from public.quiz_questions where id=$1`, [B1.q2]), rows(1));
await expect('Admin xóa đề B1 (chưa ai làm)', () => as('admin', `delete from public.quizzes where id=$1`, [B1.id]), rows(1));

// Học sinh
await expect('HS không xem đáp án đề chưa làm', async () => { const b3 = await mkQuiz(null, 'b3');
  return as('s1', 'select * from public.quiz_keys where question_id in ($1,$2)', [b3.q1, b3.q2]); }, rows(0));
await expect('HS không sửa được câu hỏi', () => as('s1', `update public.quiz_questions set prompt='x' where id=$1`, [B2.q1]), blocked);
await expect('HS không sửa được đáp án', () => as('s1', `update public.quiz_keys set answer='1' where question_id=$1`, [B2.q1]), blocked);
await expect('HS vẫn thấy đề luyện tập đã mở', () => as('s1', 'select * from public.practice_topics()'), (r, e) => !e && r.rows.length >= 1);

// Đề lớp: giữ nguyên hành vi cũ
await expect('Đề lớp: HS làm C1', async () => { const s = await as('s1', 'select public.start_quiz($1) as r', [C1.id]);
  return as('s1', 'select public.submit_quiz($1, $2) as r', [s.rows[0].r.attempt_id, { [C1.q1]: 0 }]); }, okRes);
await expect('Đề lớp: GV2 (không dạy lớp) không thấy câu C1', () => as('t2', 'select * from public.quiz_questions where quiz_id=$1', [C1.id]), rows(0));
await expect('Đề lớp: GV1 xóa câu C1 dù có bài làm', () => as('t1', `delete from public.quiz_questions where id=$1`, [C1.q2]), rows(1));
await expect('Đề lớp: GV1 xóa đề C1 (kèm bài làm)', () => as('t1', `delete from public.quizzes where id=$1`, [C1.id]), rows(1));

// Máy chủ nhập đề (service_role, không đăng nhập) vẫn cập nhật đề chưa có bài làm
await expect('Máy chủ nhập đề: cập nhật + thay câu đề chưa ai làm', async () => {
  const b4 = await mkQuiz(null, 'b4');
  await db.exec(`select set_config('request.jwt.claim.sub', '', false); set role service_role;`);
  try {
    await db.query(`update public.quizzes set title='x', sort_order=3, level='kha' where id=$1`, [b4.id]);
    return await db.query(`delete from public.quiz_questions where quiz_id=$1`, [b4.id]);
  } finally { await db.exec('reset role'); }
}, rows(2));

console.log(`\n${pass} đạt, ${fail} lỗi`);
process.exit(fail ? 1 : 0);
