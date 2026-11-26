#!/usr/bin/env node
// Gộp các phần đề (do nhiều subagent / AI khác soạn) thành một file cho cả bài.
//   node <SKILL>/scripts/gop-de.mjs <file-đích.json> <phần-1.json> <phần-2.json> ...
// - Mỗi phần có cùng dạng file bài (grade, chapter, topic, exams[...]).
// - Lấy grade/chapter/topic/level của phần đầu; các phần khác phải trùng, nếu không thì dừng.
// - Đề trùng slug: giữ bản ở phần ghi SAU (dùng để thay một đề đã sửa).
// - Đường dẫn hình ("image", "explanation_image") được viết lại theo vị trí file đích.
// - Sắp xếp theo sort_order; không tự đánh số lại.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';

const [out, ...parts] = process.argv.slice(2);
if (!out || !parts.length) { console.error('Cách dùng: node gop-de.mjs <file-đích.json> <phần-1.json> [...]'); process.exit(2); }

const outDir = dirname(resolve(out));
let head = null;
const bySlug = new Map();
for (const p of parts) {
  const d = JSON.parse(readFileSync(p, 'utf8'));
  const meta = { grade: d.grade, chapter: d.chapter, topic: d.topic, level: d.level ?? 'kha' };
  if (!head) head = meta;
  else for (const k of Object.keys(meta)) {
    if (meta[k] !== head[k]) { console.error(`${p}: ${k} = "${meta[k]}" khác phần đầu ("${head[k]}") — không gộp.`); process.exit(1); }
  }
  const dir = dirname(resolve(p));
  for (const e of d.exams || []) {
    for (const q of e.questions || []) {
      for (const f of ['image', 'explanation_image']) {
        if (!q[f]) continue;
        const abs = resolve(dir, q[f]);
        if (!existsSync(abs)) console.log(`WARN  ${p} › ${e.slug}: không thấy hình ${q[f]}`);
        q[f] = relative(outDir, abs).split('\\').join('/');
      }
    }
    if (bySlug.has(e.slug)) console.log(`Thay đề ${e.slug} bằng bản trong ${p}`);
    bySlug.set(e.slug, e);
  }
}
const exams = [...bySlug.values()].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
writeFileSync(out, JSON.stringify({ ...head, exams }, null, 2) + '\n', 'utf8');
console.log(`Đã gộp ${exams.length} đề vào ${out}. Chạy check-lesson-exams.mjs để kiểm tra.`);
