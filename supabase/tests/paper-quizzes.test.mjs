// Kiểm thử làm bài trên giấy: tải đề, phiếu trả lời, giáo viên nhập điểm bằng PGlite — chạy trên máy, không đụng Supabase thật.
//   npm i --no-save @electric-sql/pglite@0.2.17 && node supabase/tests/paper-quizzes.test.mjs
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

// Thêm: học sinh lớp khác (s2), phụ huynh liên kết với HS1 (p1), lớp 7B do t2 dạy
U.s2 = '00000000-0000-0000-0000-0000000000c2';
U.p1 = '00000000-0000-0000-0000-0000000000d1';
await db.exec(`
  insert into auth.users (id, email, raw_app_meta_data) values ('${U.s2}', 's2@x', '{}'), ('${U.p1}', 'p1@x', '{"role":"parent"}');
  insert into public.classes (name, grade) values ('7B', 7);
  insert into public.teacher_classes (teacher_id, class_id) values ('${U.t2}', 2);
  insert into public.students (code, full_name, class_id, parent_id) values ('HS2', 'Em B', 2, '${U.s2}');
  insert into public.parent_links (parent_id, student_id) values ('${U.p1}', 1);
`);
const HS1 = 1, HS2 = 2;

// ---------- Tải đề không cần bắt đầu ----------
await expect('HS tải câu hỏi đề luyện tập chưa làm (không có đáp án)', () => as('s1', 'select * from public.quiz_paper_questions($1)', [B1.id]),
  (r, e) => !e && r.rows.length === 2 && !('answer' in r.rows[0]));
await expect('Tải đề KHÔNG tạo lượt làm (đồng hồ không chạy)', () => db.query('select * from public.quiz_attempts where quiz_id=$1', [B1.id]), rows(0));
await expect('HS vẫn không đọc thẳng bảng câu hỏi khi chưa bắt đầu', () => as('s1', 'select * from public.quiz_questions where quiz_id=$1', [B1.id]), rows(0));
await expect('HS vẫn không xem đáp án', () => as('s1', 'select * from public.quiz_keys where question_id=$1', [B1.q1]), rows(0));
await expect('HS tải đề lớp mình (C1)', () => as('s1', 'select * from public.quiz_paper_questions($1)', [C1.id]), rows(2));
await expect('HS lớp khác KHÔNG tải đề C1', () => as('s2', 'select * from public.quiz_paper_questions($1)', [C1.id]), errRes);
await expect('anon KHÔNG tải đề', () => as(null, 'select * from public.quiz_paper_questions($1)', [B1.id]), errRes);
await expect('Đề ẩn: HS KHÔNG tải được', async () => {
  await db.query('update public.quizzes set published=false where id=$1', [B2.id]);
  try { return await as('s1', 'select * from public.quiz_paper_questions($1)', [B2.id]); }
  finally { await db.query('update public.quizzes set published=true where id=$1', [B2.id]); }
}, errRes);
await expect('Đề chưa đến giờ mở: HS KHÔNG tải được', async () => {
  await db.query(`update public.quizzes set opens_at=now()+interval '1 day' where id=$1`, [C1.id]);
  try { return await as('s1', 'select * from public.quiz_paper_questions($1)', [C1.id]); }
  finally { await db.query('update public.quizzes set opens_at=null where id=$1', [C1.id]); }
}, errRes);
await expect('GV tải đề C1', () => as('t1', 'select * from public.quiz_paper_questions($1)', [C1.id]), rows(2));
await expect('Hình trong đề: HS được xem khi được in', () => as('s1', 'select public.storage_can_view($1) as v', [`quizzes/${B1.id}/a.png`]), (r, e) => !e && r.rows[0].v === true);
await expect('Hình trong đề: HS lớp khác KHÔNG xem (C1)', () => as('s2', 'select public.storage_can_view($1) as v', [`quizzes/${C1.id}/a.png`]), (r, e) => !e && r.rows[0].v === false);
await expect('Hình lời giải: HS chưa nộp KHÔNG xem', () => as('s1', 'select public.storage_can_view($1) as v', [`quizzes/${B1.id}/sol/a.png`]), (r, e) => !e && r.rows[0].v === false);

// ---------- Phiếu trả lời đề luyện tập ----------
let paperAtt;
await expect('HS nộp phiếu trả lời B1 → chấm 5/10', async () => {
  const r = await as('s1', 'select public.submit_paper_quiz($1, $2) as r', [B1.id, { [B1.q1]: 0, [B1.q2]: '5' }]);
  paperAtt = r.rows[0].r.attempt_id; return r;
}, (r, e) => !e && Number(r.rows[0].r.score) === 5 && Number(r.rows[0].r.max_score) === 10);
await expect('Lượt làm giấy: mode=paper, đã nộp, có chi tiết', () => db.query('select * from public.quiz_attempts where id=$1', [paperAtt]),
  (r) => r.rows[0]?.mode === 'paper' && !!r.rows[0].submitted_at && r.rows[0].deadline_at === null && !!r.rows[0].detail);
await expect('Nộp phiếu lần 2 bị chặn', () => as('s1', 'select public.submit_paper_quiz($1, $2)', [B1.id, { [B1.q1]: 0 }]), errRes);
await expect('Sau khi nộp phiếu, HS xem được đáp án', () => as('s1', 'select * from public.quiz_keys where question_id=$1', [B1.q1]), rows(1));
await expect('Phụ huynh thấy bài giấy của con', () => as('p1', 'select * from public.quiz_attempts where id=$1', [paperAtt]), rows(1));
await expect('Đang làm online thì KHÔNG nộp phiếu giấy', async () => {
  const b6 = await mkQuiz(null, 'b6');
  await as('s1', 'select public.start_quiz($1)', [b6.id]);
  return as('s1', 'select public.submit_paper_quiz($1, $2)', [b6.id, {}]);
}, errRes);
await expect('Đề lớp KHÔNG nộp phiếu (GV nhập điểm)', () => as('s1', 'select public.submit_paper_quiz($1, $2)', [C1.id, {}]), errRes);
await expect('Phụ huynh KHÔNG nộp phiếu thay con', async () => { const b5 = await mkQuiz(null, 'b5');
  return as('p1', 'select public.submit_paper_quiz($1, $2)', [b5.id, {}]); }, errRes);
await expect('HS KHÔNG gọi thẳng finalize_attempt', () => as('s1', 'select public.finalize_attempt($1, $2)', [paperAtt, {}]), errRes);

// ---------- Giáo viên nhập điểm bài giấy ----------
await expect('GV1 nhập điểm bài giấy HS1 đề C1: 7,5', () => as('t1', 'select public.record_paper_score($1, $2, $3) as r', [C1.id, HS1, 7.5]),
  (r, e) => !e && Number(r.rows[0].r.score) === 7.5 && Number(r.rows[0].r.max_score) === 10);
await expect('Lượt chấm tay: mode=manual, đã nộp', () => db.query('select * from public.quiz_attempts where quiz_id=$1 and student_id=$2', [C1.id, HS1]),
  (r) => r.rows[0]?.mode === 'manual' && !!r.rows[0].submitted_at && Number(r.rows[0].score) === 7.5);
await expect('GV1 sửa điểm thành 9', () => as('t1', 'select public.record_paper_score($1, $2, $3) as r', [C1.id, HS1, 9]), (r, e) => !e && Number(r.rows[0].r.score) === 9);
await expect('Điểm vượt tổng điểm bị chặn', () => as('t1', 'select public.record_paper_score($1, $2, $3)', [C1.id, HS1, 11]), errRes);
await expect('Điểm âm bị chặn', () => as('t1', 'select public.record_paper_score($1, $2, $3)', [C1.id, HS1, -1]), errRes);
await expect('GV2 (không dạy lớp 6A) KHÔNG nhập điểm C1', () => as('t2', 'select public.record_paper_score($1, $2, $3)', [C1.id, HS1, 5]), errRes);
await expect('HS KHÔNG tự nhập điểm', () => as('s1', 'select public.record_paper_score($1, $2, $3)', [C1.id, HS1, 10]), errRes);
await expect('Học sinh lớp khác KHÔNG nhập vào đề C1', () => as('t1', 'select public.record_paper_score($1, $2, $3)', [C1.id, HS2, 5]), errRes);
await expect('Chấm lại GIỮ NGUYÊN điểm chấm tay', async () => {
  await as('t1', 'select public.regrade_quiz($1)', [C1.id]);
  return db.query('select score from public.quiz_attempts where quiz_id=$1 and student_id=$2', [C1.id, HS1]);
}, (r) => Number(r.rows[0]?.score) === 9);
await expect('HS thấy điểm bài giấy của mình', () => as('s1', 'select score, mode from public.quiz_attempts where quiz_id=$1', [C1.id]),
  (r, e) => !e && r.rows.length === 1 && r.rows[0].mode === 'manual');
await expect('Đã có bài online thì KHÔNG ghi đè bằng điểm tay', async () => {
  const c2 = await mkQuiz(1, 'c2');
  await as('s1', 'select public.start_quiz($1)', [c2.id]);
  return as('t1', 'select public.record_paper_score($1, $2, $3)', [c2.id, HS1, 5]);
}, errRes);
await expect('GV "Cho làm lại" xóa được lượt chấm tay', () => as('t1', 'delete from public.quiz_attempts where quiz_id=$1 and student_id=$2 returning id', [C1.id, HS1]), rows(1));
await expect('Có lượt chấm tay: start_quiz trả về "đã nộp"', async () => {
  await as('t1', 'select public.record_paper_score($1, $2, $3)', [C1.id, HS1, 6]);
  return as('s1', 'select public.start_quiz($1) as r', [C1.id]);
}, (r, e) => !e && r.rows[0].r.submitted === true);

console.log(`\n${pass} đạt, ${fail} lỗi`);
process.exit(fail ? 1 : 0);
