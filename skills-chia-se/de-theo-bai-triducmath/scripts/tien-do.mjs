#!/usr/bin/env node
// Tiến độ ra đề theo bài: bài nào đã có đề trên web, bài nào đang soạn, bài nào chưa làm.
//   node <SKILL>/scripts/tien-do.mjs                 tóm tắt mọi lớp + các bài nên làm tiếp
//   node <SKILL>/scripts/tien-do.mjs --lop 12        danh sách đầy đủ của Toán 12
//   node <SKILL>/scripts/tien-do.mjs --danh-dau 12 11 [--ghi-chu "..."]   ghi tay: Toán 12 Bài 11 đã có đề
//   node <SKILL>/scripts/tien-do.mjs --bo-danh-dau 12 11                  xóa ghi chú đã làm
// Sổ tiến độ: de-thi/theo-bai-tien-do.json (thư mục làm việc) — công cụ tải lên tự ghi sau
// khi tải đủ 20 đề của một bài. Bản để đọc: de-thi/TIEN-DO-DE-THEO-BAI.md.
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const skillDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const GRADES = ['6', '7', '8', '9', '10', '11', '12'];
const deThi = () => resolve(process.cwd(), 'de-thi');
const bookPath = () => resolve(deThi(), 'theo-bai-tien-do.json');

export function loadCatalog() {
  return JSON.parse(readFileSync(resolve(skillDir, 'tai-lieu', 'muc-luc-sgk.json'), 'utf8'));
}

// Tra một bài: { grade, no, lesson: "Bài 12. Tích phân", chapter: "Chương IV. ..." } hoặc null.
export function findLesson(catalog, grade, no) {
  for (const c of catalog[String(grade)] || []) {
    for (const [n, name] of c.bai) if (n === Number(no)) return { grade: Number(grade), no: n, lesson: `Bài ${n}. ${name}`, chapter: c.chuong };
  }
  return null;
}

// Tên file gợi ý: bai-12-tich-phan
export function lessonSlug(no, name) {
  const s = name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').split('-').slice(0, 6).join('-');
  return `bai-${no}-${s}`;
}

export function loadBook() {
  if (!existsSync(bookPath())) return {};
  try { return JSON.parse(readFileSync(bookPath(), 'utf8')); } catch { return {}; }
}

export function saveBook(book) {
  mkdirSync(deThi(), { recursive: true });
  writeFileSync(bookPath(), JSON.stringify(book, null, 2) + '\n', 'utf8');
  writeFileSync(resolve(deThi(), 'TIEN-DO-DE-THEO-BAI.md'), markdown(loadCatalog(), book), 'utf8');
}

// Ghi một bài là đã có đề trên web.
export function markDone(grade, no, info = {}) {
  const book = loadBook();
  book[String(grade)] ??= {};
  book[String(grade)][String(no)] = { trang_thai: 'da-tai', ngay: new Date().toISOString().slice(0, 10), ...info };
  saveBook(book);
}

// File đề đang có trong de-thi/toan-<lớp>/theo-bai/ (đã soạn nhưng có thể chưa tải).
function draftFiles(grade) {
  const dir = resolve(deThi(), `toan-${grade}`, 'theo-bai');
  if (!existsSync(dir)) return new Map();
  const m = new Map();
  const nhap = resolve(dir, '_nhap');
  // Phần nháp (đề gốc, phần của subagent) trước; file đã gộp ghi đè lên.
  for (const [d, rel] of [[nhap, `de-thi/toan-${grade}/theo-bai/_nhap`], [dir, `de-thi/toan-${grade}/theo-bai`]]) {
    if (!existsSync(d)) continue;
    for (const f of readdirSync(d)) {
      const k = /^bai-(\d+)-.*\.json$/.exec(f);
      if (k) m.set(Number(k[1]), `${rel}/${f}`);
    }
  }
  return m;
}

export function status(catalog, book) {
  const out = [];
  for (const g of GRADES) {
    const drafts = draftFiles(g);
    for (const c of catalog[g] || []) {
      for (const [n, name] of c.bai) {
        const rec = book[g]?.[String(n)];
        out.push({ grade: Number(g), no: n, lesson: `Bài ${n}. ${name}`, chapter: c.chuong,
          state: rec ? 'da-tai' : drafts.has(n) ? 'dang-soan' : 'chua-lam', rec, file: drafts.get(n) ?? null,
          suggest: `de-thi/toan-${g}/theo-bai/${lessonSlug(n, name)}.json` });
      }
    }
  }
  return out;
}

const MARK = { 'da-tai': '✅ đã có đề', 'dang-soan': '✏️ đang soạn', 'chua-lam': '⬜ chưa làm' };

function markdown(catalog, book) {
  const rows = status(catalog, book);
  const lines = ['# Tiến độ đề bài tập về nhà theo bài (20 đề/bài)', '',
    'File này do `scripts/tien-do.mjs` sinh ra — không sửa tay. Ghi tay bằng `--danh-dau` / `--bo-danh-dau`.', ''];
  for (const g of GRADES) {
    const list = rows.filter((r) => r.grade === Number(g));
    const done = list.filter((r) => r.state === 'da-tai').length;
    lines.push(`## Toán ${g} — ${done}/${list.length} bài có đề`, '', '| Bài | Chương | Trạng thái |', '|---|---|---|');
    for (const r of list) {
      const extra = r.rec ? ` (${r.rec.ngay}${r.rec.so_de ? `, ${r.rec.so_de} đề` : ''}${r.rec.ghi_chu ? `, ${r.rec.ghi_chu}` : ''})` : '';
      lines.push(`| ${r.lesson} | ${r.chapter} | ${MARK[r.state]}${extra} |`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

if (process.argv[1]?.endsWith('tien-do.mjs')) {
  const args = process.argv.slice(2);
  const catalog = loadCatalog();
  const arg = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };

  if (args.includes('--danh-dau') || args.includes('--bo-danh-dau')) {
    const k = args.includes('--danh-dau') ? '--danh-dau' : '--bo-danh-dau';
    const i = args.indexOf(k);
    const [g, n] = [args[i + 1], args[i + 2]];
    const l = findLesson(catalog, g, n);
    if (!l) { console.error(`Không có Toán ${g} Bài ${n} trong mục lục.`); process.exit(2); }
    if (k === '--danh-dau') { markDone(g, n, { ghi_chu: arg('--ghi-chu') ?? 'ghi tay' }); console.log(`Đã ghi: Toán ${g} · ${l.lesson} — đã có đề.`); }
    else { const b = loadBook(); delete b[g]?.[String(n)]; saveBook(b); console.log(`Đã xóa ghi chú: Toán ${g} · ${l.lesson}.`); }
    process.exit(0);
  }

  const rows = status(catalog, loadBook());
  const g = arg('--lop');
  if (g) {
    let chap = null;
    for (const r of rows.filter((x) => x.grade === Number(g))) {
      if (r.chapter !== chap) { chap = r.chapter; console.log(`\n${chap}`); }
      console.log(`  ${MARK[r.state].padEnd(14)} ${r.lesson}${r.file ? `  [${r.file}]` : ''}`);
    }
    process.exit(0);
  }
  console.log('Tiến độ đề bài tập về nhà theo bài:');
  for (const gr of GRADES) {
    const list = rows.filter((r) => r.grade === Number(gr));
    const c = (s) => list.filter((r) => r.state === s).length;
    console.log(`  Toán ${gr.padEnd(2)}: ${c('da-tai')} có đề · ${c('dang-soan')} đang soạn · ${c('chua-lam')} chưa làm (tổng ${list.length})`);
  }
  const draft = rows.filter((r) => r.state === 'dang-soan');
  if (draft.length) {
    console.log('\nĐang soạn dở (làm tiếp trước):');
    for (const r of draft) console.log(`  Toán ${r.grade} · ${r.lesson}  [${r.file}]`);
  }
  console.log('\nBài chưa làm đầu tiên của mỗi lớp:');
  for (const gr of GRADES) {
    const next = rows.filter((r) => r.grade === Number(gr) && r.state === 'chua-lam').slice(0, 3);
    if (next.length) console.log(`  Toán ${gr}: ${next.map((r) => r.lesson).join(' | ')}`);
  }
}
