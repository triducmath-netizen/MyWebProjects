#!/usr/bin/env node
// Tải đề luyện tập lên ngân hàng đề triducmath.vn (sau khi đã kiểm tra).
//   node <thư-mục-skill>/scripts/upload-exams.mjs [--partial] de-thi/toan-6/so-nguyen-*.json
//
// Thông tin kết nối đọc theo thứ tự ưu tiên:
//   1. Biến môi trường SUPABASE_URL, EXAM_IMPORT_TOKEN, EXAM_IMPORT_FUNCTION, SUPABASE_PUBLISHABLE_KEY
//   2. File .env trong thư mục skill (cạnh SKILL.md)
//   3. File .env.local ở thư mục đang làm việc
// Không bao giờ in các giá trị này ra màn hình.
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkFiles } from './check-exams.mjs';

const skillDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const KEYS = ['SUPABASE_URL', 'EXAM_IMPORT_TOKEN', 'EXAM_IMPORT_FUNCTION', 'SUPABASE_PUBLISHABLE_KEY'];

function readEnvFile(path) {
  if (!existsSync(path)) return {};
  return Object.fromEntries(readFileSync(path, 'utf8').split(/\r?\n/)
    .filter((l) => /^\s*[A-Z_]+\s*=/.test(l))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; }));
}
const fromFiles = { ...readEnvFile(resolve(process.cwd(), '.env.local')), ...readEnvFile(resolve(skillDir, '.env')) };
const env = Object.fromEntries(KEYS.map((k) => [k, process.env[k] || fromFiles[k] || '']));

if (!env.SUPABASE_URL || !env.EXAM_IMPORT_TOKEN) {
  console.error('Chưa có thông tin kết nối. Tạo file .env trong thư mục skill (xem .env.example) gồm SUPABASE_URL, EXAM_IMPORT_TOKEN, EXAM_IMPORT_FUNCTION, SUPABASE_PUBLISHABLE_KEY.');
  process.exit(2);
}

// --partial: cho phép tải lên chương chưa đủ 10 đề (từng đề vẫn phải đạt kiểm tra).
const partial = process.argv.includes('--partial');
const files = process.argv.slice(2).filter((a) => a !== '--partial');
if (!files.length) { console.error('Cách dùng: node scripts/upload-exams.mjs [--partial] <file.json> [...]'); process.exit(2); }

const { errors, exams } = checkFiles(files, { partial });
if (errors.length) {
  for (const e of errors) console.log(`LỖI   ${e}`);
  console.error(`\nKhông tải lên: còn ${errors.length} lỗi. Chạy scripts/check-exams.mjs để xem chi tiết.`);
  process.exit(1);
}

// Chỉ gửi phần dữ liệu cần thiết (bỏ trường verify, _file).
const payload = exams.map((e) => ({
  slug: e.slug, title: e.title, grade: e.grade, topic: e.topic, level: e.level,
  time_limit_min: e.time_limit_min, description: e.description ?? null, sort_order: e.sort_order ?? 0,
  questions: e.questions.map(({ kind, prompt, options, points, answer, explanation }) =>
    ({ kind, prompt, options: kind === 'short' ? undefined : options, points, answer, explanation })),
}));

let ok = 0, fail = 0;
for (let i = 0; i < payload.length; i += 10) {
  const batch = payload.slice(i, i + 10);
  const res = await fetch(`${env.SUPABASE_URL}/functions/v1/${env.EXAM_IMPORT_FUNCTION || 'import-exams'}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-import-token': env.EXAM_IMPORT_TOKEN,
      ...(env.SUPABASE_PUBLISHABLE_KEY ? { apikey: env.SUPABASE_PUBLISHABLE_KEY } : {}),
    },
    body: JSON.stringify({ exams: batch }),
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) { console.error(`Lỗi máy chủ (${res.status}): ${out.error ?? JSON.stringify(out)}`); process.exit(1); }
  for (const r of out.results) {
    const good = r.status === 'created' || r.status === 'updated';
    good ? ok++ : fail++;
    console.log(`${good ? 'OK    ' : 'BỎ QUA'}  ${r.slug}: ${r.status}${r.reason ? ' — ' + r.reason : ''}${r.questions ? ` (${r.questions} câu)` : ''}`);
  }
}
console.log(`\nĐã tải ${ok} đề, ${fail} đề không tải.`);
process.exit(fail ? 1 : 0);
