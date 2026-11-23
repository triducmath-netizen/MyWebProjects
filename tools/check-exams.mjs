#!/usr/bin/env node
// Kiểm tra file đề luyện tập trước khi tải lên.
//   node tools/check-exams.mjs de-thi/toan-6/so-nguyen-*.json
// Thoát với mã 1 nếu có lỗi. Cảnh báo (WARN) không chặn tải lên.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

export const FORMAT = {
  time_limit_min: 45,
  parts: { mcq: { count: 8, points: 0.5 }, tf: { count: 2, points: 2 }, short: { count: 4, points: 0.5 } },
  total: 10,
  perTopic: { tb: 3, kha: 4, gioi: 3 },
};
const ORDER = ['mcq', 'tf', 'short'];

// Đổi chuỗi phương án / đáp số kiểu "$-12$", "−3", "2{,}5" thành số (hoặc null).
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
  return vm.runInContext(String(expr), ctx, { timeout: 200 });
}

function balancedDollars(s) {
  const n = (String(s).replace(/\\\$/g, '').match(/\$/g) || []).length;
  return n % 2 === 0;
}

export function checkFiles(paths, { partial = false } = {}) {
  const errors = [];
  const warns = [];
  const exams = [];
  const slugs = new Map();
  for (const p of paths) {
    let doc;
    try { doc = JSON.parse(readFileSync(p, 'utf8')); } catch (e) { errors.push(`${p}: JSON lỗi — ${e.message}`); continue; }
    const where = (s) => `${p} › ${s}`;
    if (!Number.isInteger(doc.grade) || doc.grade < 6 || doc.grade > 12) errors.push(where('grade phải là số nguyên 6–12'));
    if (typeof doc.topic !== 'string' || !doc.topic.trim()) errors.push(where('thiếu topic'));
    if (!Array.isArray(doc.exams) || !doc.exams.length) { errors.push(where('exams rỗng')); continue; }

    for (const e of doc.exams) {
      const at = (s) => where(`${e.slug ?? e.title ?? '?'} › ${s}`);
      exams.push({ ...e, grade: doc.grade, topic: doc.topic, _file: p });
      if (typeof e.slug !== 'string' || !/^[a-z0-9-]{3,80}$/.test(e.slug)) errors.push(at('slug chỉ gồm a-z, 0-9, dấu -'));
      else if (slugs.has(e.slug)) errors.push(at(`slug trùng với ${slugs.get(e.slug)}`));
      else slugs.set(e.slug, p);
      if (!e.title?.trim()) errors.push(at('thiếu title'));
      if (!['tb', 'kha', 'gioi'].includes(e.level)) errors.push(at('level phải là tb | kha | gioi'));
      if (e.time_limit_min !== FORMAT.time_limit_min) errors.push(at(`time_limit_min phải là ${FORMAT.time_limit_min}`));
      if (!Array.isArray(e.questions)) { errors.push(at('thiếu questions')); continue; }

      // Đủ số câu, đúng thứ tự phần I → II → III, đúng điểm
      const kinds = e.questions.map((q) => q.kind);
      for (const k of ORDER) {
        const n = kinds.filter((x) => x === k).length;
        if (n !== FORMAT.parts[k].count) errors.push(at(`phần ${k}: cần ${FORMAT.parts[k].count} câu, đang có ${n}`));
      }
      const sorted = [...kinds].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
      if (kinds.join() !== sorted.join()) errors.push(at('thứ tự câu phải là: trắc nghiệm → đúng/sai → trả lời ngắn'));
      const total = e.questions.reduce((s, q) => s + (Number(q.points) || 0), 0);
      if (Math.abs(total - FORMAT.total) > 1e-9) errors.push(at(`tổng điểm ${total}, phải là ${FORMAT.total}`));

      const prompts = new Set();
      const mcqAnswers = [];
      e.questions.forEach((q, i) => {
        const qa = (s) => at(`câu ${i + 1} (${q.kind}) › ${s}`);
        if (FORMAT.parts[q.kind] && q.points !== FORMAT.parts[q.kind].points) errors.push(qa(`points phải là ${FORMAT.parts[q.kind].points}`));
        if (!q.prompt?.trim()) errors.push(qa('thiếu prompt'));
        else {
          const key = q.prompt.replace(/\s+/g, ' ').trim();
          if (prompts.has(key)) errors.push(qa('trùng nội dung câu khác trong cùng đề'));
          prompts.add(key);
        }
        if (!q.explanation?.trim() || q.explanation.trim().length < 20) errors.push(qa('lời giải chi tiết quá ngắn hoặc thiếu'));
        for (const t of [q.prompt, q.explanation, ...(q.options || [])]) {
          if (t != null && !balancedDollars(t)) errors.push(qa(`dấu $ không cân: ${String(t).slice(0, 60)}`));
        }

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
        if (q.kind === 'tf' && !(Array.isArray(q.answer) && q.answer.length === 4 && q.answer.every((v) => typeof v === 'boolean'))) errors.push(qa('answer phải là 4 giá trị true/false'));
        if (q.kind === 'tf' && Array.isArray(q.answer) && q.answer.every((v) => v === q.answer[0])) warns.push(qa('cả 4 ý cùng Đúng hoặc cùng Sai — nên trộn'));
        if (q.kind === 'short') {
          if (!(Array.isArray(q.answer) && q.answer.length && q.answer.every((v) => typeof v === 'string' && v.trim()))) errors.push(qa('answer phải là mảng chuỗi'));
          else if (toNumber(q.answer[0]) === null) errors.push(qa(`đáp số "${q.answer[0]}" phải là một số`));
          else if (q.answer[0].replace(/\s/g, '').length > 6) warns.push(qa(`đáp số "${q.answer[0]}" dài hơn 6 ký tự`));
        }

        // Tự tính lại đáp án nếu có biểu thức verify
        if (q.verify != null) {
          let v;
          try { v = evalVerify(q.verify); } catch (err) { errors.push(qa(`verify lỗi: ${err.message}`)); return; }
          if (q.kind === 'short') {
            const key = toNumber(q.answer?.[0]);
            if (typeof v !== 'number' || key === null || Math.abs(v - key) > 1e-9) errors.push(qa(`verify = ${v} nhưng đáp án = ${q.answer?.[0]}`));
          } else if (q.kind === 'mcq') {
            const opt = toNumber(q.options?.[q.answer]);
            if (opt === null) warns.push(qa('verify: phương án đúng không phải số, bỏ qua so sánh'));
            else if (typeof v !== 'number' || Math.abs(v - opt) > 1e-9) errors.push(qa(`verify = ${v} nhưng phương án đúng = ${q.options[q.answer]}`));
          } else if (q.kind === 'tf') {
            if (!Array.isArray(v) || v.length !== 4 || v.some((x, k) => x !== q.answer?.[k])) errors.push(qa(`verify = ${JSON.stringify(v)} nhưng đáp án = ${JSON.stringify(q.answer)}`));
          }
        } else if (q.kind !== 'mcq' || q.options?.every((o) => toNumber(o) !== null)) {
          warns.push(qa('chưa có verify để tự kiểm tra đáp án'));
        }
      });
      if (mcqAnswers.length === 8) {
        const counts = [0, 1, 2, 3].map((k) => mcqAnswers.filter((x) => x === k).length);
        if (Math.max(...counts) > 4) errors.push(at(`đáp án trắc nghiệm dồn vào một phương án (${counts.join('/')} cho A/B/C/D)`));
      }
    }
  }

  // Mỗi chuyên đề đủ 10 đề: 3 TB, 4 Khá, 3 Giỏi
  const byTopic = new Map();
  for (const e of exams) {
    const k = `Toán ${e.grade} · ${e.topic}`;
    if (!byTopic.has(k)) byTopic.set(k, { tb: 0, kha: 0, gioi: 0 });
    if (byTopic.get(k)[e.level] != null) byTopic.get(k)[e.level]++;
  }
  if (!partial) for (const [k, c] of byTopic) {
    for (const [lv, need] of Object.entries(FORMAT.perTopic)) {
      if (c[lv] < need) errors.push(`${k}: mức ${lv} cần ít nhất ${need} đề, đang có ${c[lv]}`);
    }
  }
  return { errors, warns, exams, byTopic };
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` || process.argv[1]?.endsWith('check-exams.mjs')) {
  const partial = process.argv.includes('--partial');
  const files = process.argv.slice(2).filter((a) => a !== '--partial');
  if (!files.length) { console.error('Cách dùng: node tools/check-exams.mjs [--partial] <file.json> [...]'); process.exit(2); }
  const { errors, warns, exams, byTopic } = checkFiles(files, { partial });
  for (const w of warns) console.log(`WARN  ${w}`);
  for (const e of errors) console.log(`LỖI   ${e}`);
  for (const [k, c] of byTopic) console.log(`${k}: TB ${c.tb} · Khá ${c.kha} · Giỏi ${c.gioi}`);
  console.log(`\n${exams.length} đề, ${exams.reduce((s, e) => s + (e.questions?.length || 0), 0)} câu — ${errors.length} lỗi, ${warns.length} cảnh báo`);
  process.exit(errors.length ? 1 : 0);
}
