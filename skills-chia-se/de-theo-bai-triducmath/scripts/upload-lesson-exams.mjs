#!/usr/bin/env node
// Tải đề kiểm tra theo bài lên ngân hàng đề triducmath.vn (sau khi đã kiểm tra).
//   node <SKILL>/scripts/upload-lesson-exams.mjs [--partial] de-thi/toan-12/theo-bai/bai-12-tich-phan.json
// Hình SVG được đổi sang PNG rồi gửi kèm (hàm máy chủ import-exams lưu vào kho ảnh).
//
// Thông tin kết nối đọc theo thứ tự ưu tiên (không bao giờ in ra màn hình):
//   1. Biến môi trường SUPABASE_URL, EXAM_IMPORT_TOKEN, EXAM_IMPORT_FUNCTION, SUPABASE_PUBLISHABLE_KEY
//   2. File .env trong thư mục skill này
//   3. File .env trong thư mục skill lam-de-triducmath đặt cạnh (dùng chung token)
//   4. File .env.local ở thư mục đang làm việc
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkFiles, figureToPng } from './check-lesson-exams.mjs';
import { markDone } from './tien-do.mjs';

const skillDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const KEYS = ['SUPABASE_URL', 'EXAM_IMPORT_TOKEN', 'EXAM_IMPORT_FUNCTION', 'SUPABASE_PUBLISHABLE_KEY'];

function readEnvFile(path) {
  if (!existsSync(path)) return {};
  return Object.fromEntries(readFileSync(path, 'utf8').split(/\r?\n/)
    .filter((l) => /^\s*[A-Z_]+\s*=/.test(l))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; }));
}
const fromFiles = {
  ...readEnvFile(resolve(process.cwd(), '.env.local')),
  ...readEnvFile(resolve(skillDir, '..', 'lam-de-triducmath', '.env')),
  ...readEnvFile(resolve(skillDir, '.env')),
};
const env = Object.fromEntries(KEYS.map((k) => [k, process.env[k] || fromFiles[k] || '']));
if (!env.SUPABASE_URL || !env.EXAM_IMPORT_TOKEN) {
  console.error('Chưa có thông tin kết nối. Tạo file .env trong thư mục skill (xem .env.example) gồm SUPABASE_URL, EXAM_IMPORT_TOKEN, EXAM_IMPORT_FUNCTION, SUPABASE_PUBLISHABLE_KEY.');
  process.exit(2);
}

const partial = process.argv.includes('--partial');
const files = process.argv.slice(2).filter((a) => a !== '--partial');
if (!files.length) { console.error('Cách dùng: node upload-lesson-exams.mjs [--partial] <file.json> [...]'); process.exit(2); }

const { errors, exams, lessons } = checkFiles(files, { partial });
if (errors.length) {
  for (const e of errors) console.log(`LỖI   ${e}`);
  console.error(`\nKhông tải lên: còn ${errors.length} lỗi. Chạy scripts/check-lesson-exams.mjs để xem chi tiết.`);
  process.exit(1);
}

const png64 = (dir, rel) => (rel ? figureToPng(resolve(dir, rel)).toString('base64') : undefined);

// Chỉ gửi phần dữ liệu web dùng (bỏ verify, muc, thuc_te — các trường này chỉ để kiểm tra nội bộ).
const payload = exams.map((e) => ({
  slug: e.slug, title: e.title, grade: e.grade, topic: e.topic, level: e.level,
  usage: 'homework', chapter: e.chapter, lesson_no: e.lesson_no ?? undefined,
  time_limit_min: e.time_limit_min, description: e.description ?? null, sort_order: e.sort_order ?? 0,
  questions: e.questions.map((q) => ({
    kind: q.kind, prompt: q.prompt, options: q.kind === 'short' ? undefined : q.options,
    points: q.points, answer: q.answer, explanation: q.explanation,
    image_png: png64(e._dir, q.image), explanation_image_png: png64(e._dir, q.explanation_image),
  })),
}));

// Gửi theo lô: tối đa 10 đề và khoảng 4 MB mỗi lần.
const batches = [];
let cur = [], size = 0;
for (const ex of payload) {
  const n = JSON.stringify(ex).length;
  if (cur.length && (cur.length >= 10 || size + n > 4e6)) { batches.push(cur); cur = []; size = 0; }
  cur.push(ex); size += n;
}
if (cur.length) batches.push(cur);

let ok = 0, fail = 0, imageMissing = 0;
for (const batch of batches) {
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
  if (!res.ok) {
    console.error(`Lỗi máy chủ (${res.status}): ${out.error ?? JSON.stringify(out)}`);
    if (String(out.error ?? '').includes('image_png')) console.error('→ Hàm import-exams trên Supabase có thể chưa được cập nhật bản nhận ảnh. Báo chủ website deploy lại hàm.');
    process.exit(1);
  }
  for (const r of out.results) {
    const good = r.status === 'created' || r.status === 'updated';
    const sent = batch.find((x) => x.slug === r.slug);
    const want = sent ? sent.questions.reduce((n, q) => n + (q.image_png ? 1 : 0) + (q.explanation_image_png ? 1 : 0), 0) : 0;
    if (good && want && r.images !== want) {
      imageMissing++;
      console.log(`THIẾU HÌNH  ${r.slug}: gửi ${want} hình nhưng máy chủ lưu ${r.images ?? 0} — hàm import-exams chưa được cập nhật bản nhận ảnh`);
    }
    good ? ok++ : fail++;
    console.log(`${good ? 'OK    ' : 'BỎ QUA'}  ${r.slug}: ${r.status}${r.reason ? ' — ' + r.reason : ''}${r.questions ? ` (${r.questions} câu${r.images ? `, ${r.images} hình` : ''})` : ''}`);
  }
}
console.log(`\nĐã tải ${ok} đề, ${fail} đề không tải.`);
if (imageMissing) console.error(`${imageMissing} đề bị mất hình trên web. Báo chủ website deploy lại hàm import-exams (bản nhận ảnh), rồi tải lại — đề chưa có học sinh làm sẽ được ghi đè.`);
// Tải trọn bộ thành công → ghi vào sổ tiến độ để lần sau không hỏi lại bài này.
if (!partial && !fail && !imageMissing) {
  for (const list of lessons.values()) {
    const e = list[0];
    markDone(e.grade, e.lesson_no, { so_de: list.length, file: e._file.split('\\').join('/') });
    console.log(`Đã ghi tiến độ: Toán ${e.grade} · ${e.topic} — đã có đề.`);
  }
}
process.exit(fail || imageMissing ? 1 : 0);
