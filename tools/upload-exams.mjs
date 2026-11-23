#!/usr/bin/env node
// Tải đề luyện tập lên ngân hàng đề (sau khi đã kiểm tra).
//   node tools/upload-exams.mjs de-thi/toan-6/so-nguyen-*.json
// Đọc SUPABASE_URL và EXAM_IMPORT_TOKEN từ file .env.local ở thư mục gốc (không đưa lên Git).
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkFiles } from './check-exams.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = resolve(root, '.env.local');
if (!existsSync(envPath)) { console.error('Thiếu file .env.local (SUPABASE_URL, EXAM_IMPORT_TOKEN).'); process.exit(2); }
const env = Object.fromEntries(readFileSync(envPath, 'utf8').split(/\r?\n/)
  .filter((l) => /^\s*[A-Z_]+\s*=/.test(l)).map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const url = env.SUPABASE_URL;
const token = env.EXAM_IMPORT_TOKEN;
if (!url || !token) { console.error('.env.local cần SUPABASE_URL và EXAM_IMPORT_TOKEN'); process.exit(2); }

const files = process.argv.slice(2);
if (!files.length) { console.error('Cách dùng: node tools/upload-exams.mjs <file.json> [...]'); process.exit(2); }

const { errors, exams } = checkFiles(files);
if (errors.length) {
  for (const e of errors) console.log(`LỖI   ${e}`);
  console.error(`\nKhông tải lên: còn ${errors.length} lỗi. Chạy tools/check-exams.mjs để xem chi tiết.`);
  process.exit(1);
}

// Gửi đi phần dữ liệu cần thiết (bỏ trường verify, _file).
const payload = exams.map((e) => ({
  slug: e.slug, title: e.title, grade: e.grade, topic: e.topic, level: e.level,
  time_limit_min: e.time_limit_min, description: e.description ?? null, sort_order: e.sort_order ?? 0,
  questions: e.questions.map(({ kind, prompt, options, points, answer, explanation }) =>
    ({ kind, prompt, options: kind === 'short' ? undefined : options, points, answer, explanation })),
}));

let ok = 0, fail = 0;
for (let i = 0; i < payload.length; i += 10) {
  const batch = payload.slice(i, i + 10);
  const res = await fetch(`${url}/functions/v1/import-exams`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-import-token': token },
    body: JSON.stringify({ exams: batch }),
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) { console.error(`Lỗi máy chủ (${res.status}): ${out.error ?? JSON.stringify(out)}`); process.exit(1); }
  for (const r of out.results) {
    const good = r.status === 'created' || r.status === 'updated';
    good ? ok++ : fail++;
    console.log(`${good ? 'OK  ' : 'BỎ QUA'}  ${r.slug}: ${r.status}${r.reason ? ' — ' + r.reason : ''}${r.questions ? ` (${r.questions} câu)` : ''}`);
  }
}
console.log(`\nĐã tải ${ok} đề, ${fail} đề không tải.`);
process.exit(fail ? 1 : 0);
