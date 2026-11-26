#!/usr/bin/env node
// Kiểm tra file đề kiểm tra theo bài (22 câu, thang THPT 2025) trước khi tải lên.
//   node <SKILL>/scripts/check-lesson-exams.mjs [--partial] [--matrix ma-tran.md] de-thi/toan-12/theo-bai/bai-12-tich-phan.json
// Thoát với mã 1 nếu có lỗi. Cảnh báo (WARN) không chặn tải lên.
//   --partial        : chưa đủ 20 đề của bài (từng đề vẫn phải đạt).
//   --matrix <file>  : ghi ma trận đề (mức độ, cờ thực tế) cho giáo viên ra file Markdown.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname, extname } from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { loadCatalog, findLesson } from './tien-do.mjs';

const require = createRequire(import.meta.url);

export const FORMAT = {
  time_limit_min: 90,
  parts: { mcq: { count: 12, points: 0.25 }, tf: { count: 4, points: 1 }, short: { count: 6, points: 0.5 } },
  total: 10,
  examsPerLesson: 20,
  levels: { NB: [8, 10], TH: [6, 8], VD: [5, 7] }, // mục tiêu 4:3:3 ≈ 9–10 / 6–7 / 6
  minPractical: 2,
  maxCalc: 3, // tối đa số câu bấm máy ra ngay (chỉ Phần I, mức NB)
};
const ORDER = ['mcq', 'tf', 'short'];
const LETTERS = 'ABCD';

// "$-12$", "−3", "2{,}5" → số (hoặc null).
export function toNumber(s) {
  if (typeof s === 'number') return s;
  if (typeof s !== 'string') return null;
  let t = s.replace(/\$/g, '').replace(/\\,|\\;|\\!|\s/g, '').replace(/[−–]/g, '-').replace(/\{,\}/g, '.').replace(/,/g, '.');
  t = t.replace(/^\\left\(|\\right\)$/g, '').replace(/^\((-?[\d.]+)\)$/, '$1');
  if (!/^-?\d+(\.\d+)?$/.test(t)) return null;
  return Number(t);
}

function evalVerify(expr) {
  const ctx = vm.createContext({ Math, Number, Array, gcd: (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; } });
  return vm.runInContext(String(expr), ctx, { timeout: 500 });
}

const balancedDollars = (s) => ((String(s).replace(/\\\$/g, '').match(/\$/g) || []).length % 2) === 0;

let katex = null;
try { katex = require('katex'); } catch { /* chưa cài: bỏ qua bước dựng công thức */ }
const MATH_RE = /\$\$([\s\S]+?)\$\$|\$((?:\\\$|[^$\n])+?)\$/g;
function mathErrors(text) {
  if (!katex || text == null) return [];
  const out = [];
  for (const m of String(text).matchAll(MATH_RE)) {
    const tex = m[1] ?? m[2];
    try { katex.renderToString(tex, { throwOnError: true, displayMode: m[1] != null, strict: 'ignore' }); }
    catch (e) { out.push(`$${tex}$ → ${String(e.message).replace(/^KaTeX parse error: /, '').slice(0, 70)}`); }
  }
  return out;
}

let Resvg = null;
try { ({ Resvg } = require('@resvg/resvg-js')); } catch { /* chưa cài: không dựng thử hình */ }

// Đổi file hình (SVG hoặc PNG) thành bytes PNG. Ném lỗi nếu hỏng.
export function figureToPng(path) {
  const ext = extname(path).toLowerCase();
  const buf = readFileSync(path);
  if (ext === '.png') {
    if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('không phải file PNG');
    return buf;
  }
  if (ext !== '.svg') throw new Error('hình phải là .svg hoặc .png');
  if (!Resvg) throw new Error('chưa cài @resvg/resvg-js (chạy npm install trong thư mục skill)');
  const svg = buf.toString('utf8');
  if (!/<svg[\s>]/.test(svg)) throw new Error('file SVG không có thẻ <svg>');
  if (/<script|<foreignObject|xlink:href="http|href="http/i.test(svg)) throw new Error('SVG không được chứa script, foreignObject hay liên kết ngoài');
  const png = new Resvg(svg, {
    fitTo: { mode: 'width', value: 900 }, background: 'white',
    font: { loadSystemFonts: true, defaultFontFamily: 'Times New Roman' },
  }).render().asPng();
  return Buffer.from(png);
}

// Câu nhắc tới hình mà không có hình → lỗi; nói tới đối tượng hình học → nhắc nên có hình.
const NEEDS_FIGURE = /hình vẽ|hình bên|hình dưới|như hình|trong hình|bảng biến thiên|đồ thị (?:như|ở|trong) hình|cho đồ thị/i;
const SHOULD_FIGURE = /parabol|đường tròn|hình phẳng|miền (?:được )?giới hạn|đồ thị hàm số|hình chóp|hình lăng trụ|hình hộp|tam giác|hình thang|hình chữ nhật/i;
// Mẫu câu học sinh nhập thẳng vào máy tính là ra đáp án (Casio fx-580VN X...).
// Cận / số trong LaTeX: 2, -1, {3}, 1.5, \pi, \frac{1}{2}
const NUM = String.raw`\{?-?(?:\d+(?:[.,]\d+)?|\\pi|\\frac\{\d+\}\{\d+\})\}?`;
const CALC_PATTERNS = [
  [new RegExp(String.raw`\\int_${NUM}\^${NUM}`), 'tích phân có cận là số'],
  [/(?:f|y|g)'+\s*\(\s*-?\d/, 'đạo hàm tại một điểm'],
  [/(?:giải|nghiệm của)\s+(?:các\s+)?(?:bất\s+)?phương trình/i, 'giải phương trình / bất phương trình'],
  [/(?:tính|giá trị của)[^.?]*\\(?:log|ln|sin|cos|tan|sqrt|binom)|\b[CA]_\{?\d+\}?\^\{?\d+/i, 'tính giá trị biểu thức số'],
];
// Dấu hiệu câu đã có yếu tố máy không làm thay: tham số (a, b, m, k đứng riêng), hàm ẩn f(x)
// (không cho công thức), đọc hình / bảng / đồ thị, dữ kiện "biết…", "thỏa mãn…", "sao cho…".
const ANTI_CALC = /(?<![\p{L}\\])[abmk](?![\p{L}(])|f\(x\)(?!\s*=)|hình|bảng|đồ thị|biết\s|thỏa mãn|sao cho/iu;

const BIG_NUMBER = /(?<![\d.,])\d{5,}(?![\d])|\d{1,3}(?:[ .]\d{3}){2,}/; // ≥ 5 chữ số liền: dễ phải bấm máy

export function checkFiles(paths, { partial = false } = {}) {
  const errors = [];
  const warns = [];
  const exams = [];
  const slugs = new Map();
  const prompts = new Map(); // nội dung câu → đề đầu tiên có câu đó (chống trùng giữa các đề)
  const lessons = new Map();
  const catalog = loadCatalog();

  for (const p of paths) {
    let doc;
    try { doc = JSON.parse(readFileSync(p, 'utf8')); } catch (e) { errors.push(`${p}: JSON lỗi — ${e.message}`); continue; }
    const where = (s) => `${p} › ${s}`;
    const baseDir = dirname(resolve(p));
    if (!Number.isInteger(doc.grade) || doc.grade < 6 || doc.grade > 12) errors.push(where('grade phải là số nguyên 6–12'));
    if (typeof doc.topic !== 'string' || !/^Bài \d+\. \S/.test(doc.topic)) errors.push(where('topic phải có dạng "Bài <số>. <tên bài đúng SGK>"'));
    if (typeof doc.chapter !== 'string' || !/^Chương [IVXL]+\. \S/.test(doc.chapter)) errors.push(where('chapter phải có dạng "Chương <số La Mã>. <tên chương đúng SGK>"'));
    const lessonNo = Number(/^Bài (\d+)\./.exec(doc.topic ?? '')?.[1]) || null;
    // Tên chương, tên bài phải khớp nguyên văn mục lục SGK (tai-lieu/muc-luc-sgk.json).
    const sgk = lessonNo && findLesson(catalog, doc.grade, lessonNo);
    if (lessonNo && !sgk) errors.push(where(`không có Toán ${doc.grade} Bài ${lessonNo} trong mục lục SGK`));
    else if (sgk) {
      if (doc.topic !== sgk.lesson) errors.push(where(`topic phải đúng nguyên văn SGK: "${sgk.lesson}"`));
      if (doc.chapter !== sgk.chapter) errors.push(where(`chapter phải đúng nguyên văn SGK: "${sgk.chapter}"`));
    }
    if (!['tb', 'kha', 'gioi'].includes(doc.level ?? 'kha')) errors.push(where('level phải là tb | kha | gioi'));
    if (!Array.isArray(doc.exams) || !doc.exams.length) { errors.push(where('exams rỗng')); continue; }
    const lessonKey = `Toán ${doc.grade} · ${doc.topic}`;
    if (!lessons.has(lessonKey)) lessons.set(lessonKey, []);

    for (const e of doc.exams) {
      const at = (s) => where(`${e.slug ?? e.title ?? '?'} › ${s}`);
      const exam = { ...e, grade: doc.grade, topic: doc.topic, chapter: doc.chapter, lesson_no: lessonNo,
        level: e.level ?? doc.level ?? 'kha', _file: p, _dir: baseDir };
      exams.push(exam);
      lessons.get(lessonKey).push(exam);
      if (typeof e.slug !== 'string' || !/^[a-z0-9-]{3,80}$/.test(e.slug)) errors.push(at('slug chỉ gồm a-z, 0-9, dấu -'));
      else if (slugs.has(e.slug)) errors.push(at(`slug trùng với ${slugs.get(e.slug)}`));
      else slugs.set(e.slug, p);
      if (!e.title?.trim()) errors.push(at('thiếu title'));
      if (!['tb', 'kha', 'gioi'].includes(exam.level)) errors.push(at('level phải là tb | kha | gioi'));
      if (e.time_limit_min !== FORMAT.time_limit_min) errors.push(at(`time_limit_min phải là ${FORMAT.time_limit_min}`));
      if (!Array.isArray(e.questions)) { errors.push(at('thiếu questions')); continue; }

      const kinds = e.questions.map((q) => q.kind);
      for (const k of ORDER) {
        const n = kinds.filter((x) => x === k).length;
        if (n !== FORMAT.parts[k].count) errors.push(at(`phần ${k}: cần ${FORMAT.parts[k].count} câu, đang có ${n}`));
      }
      const sorted = [...kinds].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
      if (kinds.join() !== sorted.join()) errors.push(at('thứ tự câu phải là: 12 trắc nghiệm → 4 đúng/sai → 6 trả lời ngắn'));
      const total = e.questions.reduce((s, q) => s + (Number(q.points) || 0), 0);
      if (Math.abs(total - FORMAT.total) > 1e-9) errors.push(at(`tổng điểm ${total}, phải là ${FORMAT.total}`));

      const mcqAnswers = [];
      const tfPatterns = [];
      const levelCount = { NB: 0, TH: 0, VD: 0 };
      let practical = 0;
      let calcCount = 0;

      e.questions.forEach((q, i) => {
        const qa = (s) => at(`câu ${i + 1} (${q.kind}) › ${s}`);
        if (FORMAT.parts[q.kind] && q.points !== FORMAT.parts[q.kind].points) errors.push(qa(`points phải là ${FORMAT.parts[q.kind].points}`));
        if (!['NB', 'TH', 'VD'].includes(q.muc)) errors.push(qa('muc phải là NB | TH | VD'));
        else levelCount[q.muc]++;
        if (typeof q.thuc_te !== 'boolean') errors.push(qa('thuc_te phải là true/false'));
        else if (q.thuc_te) practical += Number(q.points) || 0;
        if (typeof q.bam_may !== 'boolean') errors.push(qa('bam_may phải là true/false (câu nhập thẳng vào máy tính có ra đáp án không)'));
        else if (q.bam_may) {
          calcCount++;
          if (q.kind !== 'mcq' || q.muc !== 'NB') errors.push(qa('chỉ câu trắc nghiệm mức NB mới được bam_may: true — đổi câu để máy không giải thay'));
        } else {
          const text = String(q.prompt ?? '') + ' ' + (q.options || []).join(' ');
          const hit = CALC_PATTERNS.find(([re]) => re.test(text));
          if (hit && !ANTI_CALC.test(String(q.prompt ?? '')) && !q.ly_do_khong_bam_may) {
            errors.push(qa(`có vẻ bấm máy ra ngay (${hit[1]}) nhưng ghi bam_may: false — đổi câu (tham số, hàm ẩn, đọc hình, mô hình hoá…), ghi bam_may: true, hoặc ghi "ly_do_khong_bam_may" giải thích`));
          }
        }

        if (!q.prompt?.trim()) errors.push(qa('thiếu prompt'));
        else {
          // So sau khi bỏ khác biệt cách viết LaTeX (\displaystyle, \,, \left, \right, ngoặc {}, khoảng trắng).
          // Tính cả phương án và nội dung hình: câu đọc hình có lời dẫn giống nhau nhưng hình khác nhau thì không trùng.
          const norm = (s) => String(s ?? '').replace(/\\displaystyle|\\,|\\left|\\right|[\s{}]/g, '');
          let figKey = '';
          if (q.image) { try { figKey = createHash('md5').update(readFileSync(resolve(baseDir, String(q.image)))).digest('hex'); } catch { figKey = String(q.image); } }
          const key = norm(q.prompt) + '|' + norm((q.options || []).join('|')) + '|' + figKey;
          if (prompts.has(key)) errors.push(qa(`trùng nguyên văn câu trong ${prompts.get(key)} — các đề tương đương phải đổi số liệu`));
          else prompts.set(key, `${e.slug} câu ${i + 1}`);
        }
        if (!q.explanation?.trim() || q.explanation.trim().length < 20) errors.push(qa('lời giải chi tiết quá ngắn hoặc thiếu'));
        const texts = [q.prompt, q.explanation, ...(q.options || [])];
        for (const t of texts) {
          if (t != null && !balancedDollars(t)) errors.push(qa(`dấu $ không cân: ${String(t).slice(0, 60)}`));
          for (const me of mathErrors(t)) errors.push(qa(`công thức lỗi hiển thị: ${me}`));
          // Lệnh LaTeX bị mất dấu "\" (KaTeX vẫn dựng được nhưng hiện thành chữ thường, ví dụ "0 le t le 6").
          for (const m of String(t ?? '').matchAll(/\$([^$]+)\$/g)) {
            const lost = /(?<![\\\p{L}])(displaystyle|dfrac|frac\{|int_|le|ge|cdot|sqrt|mathbb|infty|Leftrightarrow|Big)(?![\p{L}])/u.exec(m[1]);
            if (lost) { errors.push(qa(`công thức mất dấu "\\" trước "${lost[1]}": $${m[1].slice(0, 50)}$`)); break; }
          }
        }
        if (BIG_NUMBER.test(String(q.prompt ?? '') + ' ' + (q.options || []).join(' '))) warns.push(qa('có số từ 5 chữ số trở lên — xem lại có phải bấm máy không'));

        // Hình vẽ
        for (const [field, label] of [['image', 'hình câu hỏi'], ['explanation_image', 'hình lời giải']]) {
          if (q[field] == null) continue;
          const fp = resolve(baseDir, String(q[field]));
          if (!existsSync(fp)) { errors.push(qa(`${label}: không thấy file ${q[field]}`)); continue; }
          try {
            const png = figureToPng(fp);
            if (png.length > 2 * 1024 * 1024) errors.push(qa(`${label}: ảnh PNG quá 2 MB`));
          } catch (err) { errors.push(qa(`${label}: ${err.message}`)); }
        }
        if (!q.image && NEEDS_FIGURE.test(q.prompt ?? '')) errors.push(qa('câu nhắc tới hình / bảng biến thiên nhưng chưa có "image"'));
        else if (!q.image && SHOULD_FIGURE.test(q.prompt ?? '')) warns.push(qa('câu có đối tượng hình học / đồ thị — nên có hình vẽ'));

        if (q.kind === 'mcq' || q.kind === 'tf') {
          if (!Array.isArray(q.options) || q.options.length !== 4 || q.options.some((o) => typeof o !== 'string' || !o.trim())) errors.push(qa('cần đúng 4 options không rỗng'));
          else if (new Set(q.options.map((o) => o.replace(/\s+/g, ''))).size !== 4) errors.push(qa('4 options phải khác nhau'));
        }
        if (q.kind === 'mcq') {
          if (!(Number.isInteger(q.answer) && q.answer >= 0 && q.answer <= 3)) errors.push(qa('answer phải là 0–3'));
          else mcqAnswers.push(q.answer);
          if (Array.isArray(q.options)) {
            const nums = q.options.map(toNumber);
            if (nums.every((x) => x !== null) && new Set(nums).size !== 4) errors.push(qa('các phương án số bị trùng giá trị'));
          }
        }
        if (q.kind === 'tf') {
          if (!(Array.isArray(q.answer) && q.answer.length === 4 && q.answer.every((v) => typeof v === 'boolean'))) errors.push(qa('answer phải là 4 giá trị true/false'));
          else {
            if (q.answer.every((v) => v === q.answer[0])) errors.push(qa('cả 4 ý cùng Đúng hoặc cùng Sai — phải trộn'));
            tfPatterns.push(q.answer.map((v) => (v ? 'Đ' : 'S')).join(''));
          }
        }
        if (q.kind === 'short') {
          if (!(Array.isArray(q.answer) && q.answer.length && q.answer.every((v) => typeof v === 'string' && v.trim()))) errors.push(qa('answer phải là mảng chuỗi'));
          else if (toNumber(q.answer[0]) === null) errors.push(qa(`đáp số "${q.answer[0]}" phải là một số (số nguyên hoặc thập phân hữu hạn) — web chấm bằng so số`));
          else {
            const len = q.answer[0].replace(/\s|\$/g, '').length;
            if (len > 6) errors.push(qa(`đáp số "${q.answer[0]}" dài hơn 6 ký tự`));
            else if (len > 4) warns.push(qa(`đáp số "${q.answer[0]}" dài hơn 4 ký tự (phiếu THPT chỉ có 4 ô)`));
          }
        }

        if (q.verify != null) {
          let v;
          try { v = evalVerify(q.verify); } catch (err) { errors.push(qa(`verify lỗi: ${err.message}`)); return; }
          if (q.kind === 'short') {
            const key = toNumber(q.answer?.[0]);
            if (typeof v !== 'number' || key === null || Math.abs(v - key) > 1e-9) errors.push(qa(`verify = ${v} nhưng đáp án = ${q.answer?.[0]}`));
          } else if (q.kind === 'mcq') {
            const opt = toNumber(q.options?.[q.answer]);
            if (opt === null) {
              if (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 3) { if (v !== q.answer) errors.push(qa(`verify chọn ${LETTERS[v]} nhưng đáp án = ${LETTERS[q.answer]}`)); }
              else warns.push(qa('verify: phương án đúng không phải số — cho verify trả về chỉ số 0–3 của phương án đúng'));
            } else if (typeof v !== 'number' || Math.abs(v - opt) > 1e-9) errors.push(qa(`verify = ${v} nhưng phương án đúng = ${q.options[q.answer]}`));
          } else if (q.kind === 'tf') {
            if (!Array.isArray(v) || v.length !== 4 || v.some((x, k) => x !== q.answer?.[k])) errors.push(qa(`verify = ${JSON.stringify(v)} nhưng đáp án = ${JSON.stringify(q.answer)}`));
          }
        } else if (q.kind !== 'mcq' || q.options?.every((o) => toNumber(o) !== null)) {
          warns.push(qa('chưa có verify để tự kiểm tra đáp án'));
        }
      });

      exam._levels = levelCount;
      exam._practical = practical;
      for (const [lv, [lo, hi]] of Object.entries(FORMAT.levels)) {
        if (levelCount[lv] < lo || levelCount[lv] > hi) errors.push(at(`số câu ${lv} = ${levelCount[lv]}, cần ${lo}–${hi} (tỉ lệ NB:TH:VD ≈ 4:3:3)`));
      }
      exam._calc = calcCount;
      if (calcCount > FORMAT.maxCalc) errors.push(at(`${calcCount} câu bấm máy ra ngay, tối đa ${FORMAT.maxCalc}`));
      if (practical + 1e-9 < FORMAT.minPractical) errors.push(at(`câu thực tế mới được ${practical} điểm, cần ít nhất ${FORMAT.minPractical} điểm (20%)`));
      if (mcqAnswers.length === 12) {
        const counts = [0, 1, 2, 3].map((k) => mcqAnswers.filter((x) => x === k).length);
        if (Math.max(...counts) > 5 || Math.min(...counts) < 1) errors.push(at(`đáp án trắc nghiệm phân bố lệch (${counts.join('/')} cho A/B/C/D)`));
      }
      if (tfPatterns.length === 4 && new Set(tfPatterns).size === 1) warns.push(at(`4 câu Đúng/Sai cùng mẫu đáp án ${tfPatterns[0]} — nên đổi`));
    }
  }

  // Mỗi bài: đủ 20 đề, các đề tương đương (cùng dạng, mức độ, cờ thực tế ở từng vị trí câu).
  for (const [k, list] of lessons) {
    if (!partial && list.length !== FORMAT.examsPerLesson) errors.push(`${k}: cần đúng ${FORMAT.examsPerLesson} đề, đang có ${list.length}`);
    const ref = list.find((x) => Array.isArray(x.questions));
    for (const x of list) {
      if (x === ref || !Array.isArray(x.questions) || x.questions.length !== ref.questions.length) continue;
      x.questions.forEach((q, i) => {
        const r = ref.questions[i];
        if (q.kind !== r.kind || q.muc !== r.muc || q.thuc_te !== r.thuc_te || q.bam_may !== r.bam_may) {
          errors.push(`${k} › ${x.slug} câu ${i + 1}: khác đề ${ref.slug} (dạng/mức độ/thực tế/bấm máy phải giống nhau ở cùng vị trí câu)`);
        }
        if (!!q.image !== !!r.image) warns.push(`${k} › ${x.slug} câu ${i + 1}: có/không có hình khác với đề ${ref.slug}`);
      });
    }
  }
  return { errors, warns, exams, lessons };
}

// Ma trận đề cho giáo viên (Markdown).
export function matrixMarkdown(lessons) {
  const lines = [];
  for (const [k, list] of lessons) {
    lines.push(`# Ma trận đề — ${k}`, '', `${list.length} đề · 22 câu/đề · 90 phút · thang điểm THPT 2025`, '');
    const ref = list[0];
    if (ref?.questions) {
      lines.push('## Cấu trúc chung (giống nhau ở mọi đề)', '', '| Câu | Phần | Dạng | Mức độ | Thực tế | Bấm máy ra ngay | Điểm | Hình |', '|---|---|---|---|---|---|---|---|');
      const part = { mcq: 'I', tf: 'II', short: 'III' };
      const name = { mcq: 'Trắc nghiệm', tf: 'Đúng/Sai', short: 'Trả lời ngắn' };
      ref.questions.forEach((q, i) => lines.push(`| ${i + 1} | ${part[q.kind] ?? '?'} | ${name[q.kind] ?? q.kind} | ${q.muc ?? '?'} | ${q.thuc_te ? '✓' : ''} | ${q.bam_may ? '⚠' : ''} | ${String(q.points).replace('.', ',')} | ${q.image ? '✓' : ''} |`));
      lines.push('');
    }
    lines.push('## Từng đề', '', '| Đề | NB | TH | VD | Điểm thực tế | Câu bấm máy | Đáp án trắc nghiệm |', '|---|---|---|---|---|---|---|');
    for (const x of list) {
      const mcq = (x.questions || []).filter((q) => q.kind === 'mcq').map((q) => LETTERS[q.answer] ?? '?').join('');
      lines.push(`| ${x.slug} | ${x._levels?.NB ?? '?'} | ${x._levels?.TH ?? '?'} | ${x._levels?.VD ?? '?'} | ${String(x._practical ?? '?').replace('.', ',')} | ${x._calc ?? '?'} | ${mcq} |`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

if (process.argv[1]?.endsWith('check-lesson-exams.mjs')) {
  const args = process.argv.slice(2);
  const partial = args.includes('--partial');
  const mi = args.indexOf('--matrix');
  const matrixPath = mi >= 0 ? args[mi + 1] : null;
  const files = args.filter((a, i) => a !== '--partial' && (mi < 0 || (i !== mi && i !== mi + 1)));
  if (!files.length) { console.error('Cách dùng: node check-lesson-exams.mjs [--partial] [--matrix ma-tran.md] <file.json> [...]'); process.exit(2); }
  if (!katex) console.log('WARN  chưa cài katex — không dựng thử công thức (chạy npm install trong thư mục skill)');
  if (!Resvg) console.log('WARN  chưa cài @resvg/resvg-js — không kiểm tra được hình SVG');
  const { errors, warns, exams, lessons } = checkFiles(files, { partial });
  for (const w of warns) console.log(`WARN  ${w}`);
  for (const e of errors) console.log(`LỖI   ${e}`);
  for (const [k, list] of lessons) console.log(`${k}: ${list.length} đề`);
  if (matrixPath) { writeFileSync(matrixPath, matrixMarkdown(lessons), 'utf8'); console.log(`Đã ghi ma trận đề: ${matrixPath}`); }
  console.log(`\n${exams.length} đề, ${exams.reduce((s, e) => s + (e.questions?.length || 0), 0)} câu — ${errors.length} lỗi, ${warns.length} cảnh báo`);
  process.exit(errors.length ? 1 : 0);
}
