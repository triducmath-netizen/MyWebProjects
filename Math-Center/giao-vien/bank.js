// Trang giáo viên — Ngân hàng đề luyện tập theo chuyên đề.
// Giáo viên: xem, sửa đề. Chỉ quản trị viên: ẩn/hiện, xóa câu, xóa đề.
// Quyền được kiểm tra trên máy chủ (RLS); giao diện chỉ ẩn nút cho gọn.
import { sb, el, toast, errMsg } from '../portal/common.js';
import { renderQuizEditor, deleteQuiz } from './quiz.js';

export const LEVELS = [['tb', 'Mức độ 1'], ['kha', 'Mức độ 2'], ['gioi', 'Mức độ 3']];
export const levelName = (lv) => LEVELS.find((l) => l[0] === lv)?.[1] ?? lv;

let ctx; // { state, rerender, isAdmin }

export function renderBankTab(view, context) {
  ctx = context;
  ctx.state.bank ??= { grade: '', topic: '', level: '' };
  if (ctx.state.bankQuizId) {
    return renderQuizEditor(view, ctx.state.bankQuizId, context, {
      bank: true,
      back: () => { ctx.state.bankQuizId = null; ctx.rerender(); },
    });
  }
  return renderList(view);
}

async function renderList(view) {
  const f = ctx.state.bank;
  const box = el('div', { class: 'list section-gap' }, el('p', { class: 'muted', text: 'Đang tải…' }));
  const filters = el('div', { class: 'row' });
  view.append(
    el('div', { class: 'panel' },
      el('h2', { text: 'Ngân hàng đề luyện tập' }),
      el('p', { class: 'muted small', text: ctx.isAdmin()
        ? 'Đề học sinh tự luyện theo chuyên đề. Bấm "Xem / sửa" để sửa câu hỏi, đáp án, lời giải.'
        : 'Đề học sinh tự luyện theo chuyên đề. Thầy cô xem và sửa được câu hỏi, đáp án, lời giải; chỉ quản trị viên được xóa hoặc ẩn đề.' }),
      filters),
    box);

  const { data: all, error } = await sb.rpc('bank_quizzes');
  if (error) { box.replaceChildren(el('p', { class: 'error-text', text: errMsg(error) })); return; }

  const grades = [...new Set(all.map((z) => z.grade))].sort((a, b) => a - b);
  const topics = [...new Set(all.filter((z) => !f.grade || z.grade === Number(f.grade)).map((z) => z.topic))]
    .sort((a, b) => a.localeCompare(b, 'vi'));
  if (f.topic && !topics.includes(f.topic)) f.topic = '';
  const pick = (label, key, opts) => el('label', { class: 'field' }, label,
    el('select', { onchange: (e) => { f[key] = e.target.value; ctx.rerender(); } },
      el('option', { value: '', text: 'Tất cả' }),
      opts.map(([v, t]) => el('option', { value: String(v), selected: String(f[key]) === String(v), text: t }))));
  filters.append(
    pick('Lớp', 'grade', grades.map((g) => [g, `Toán ${g}`])),
    pick('Chuyên đề', 'topic', topics.map((t) => [t, t])),
    pick('Mức độ', 'level', LEVELS));

  const lvIdx = (lv) => LEVELS.findIndex((l) => l[0] === lv);
  const list = all.filter((z) => (!f.grade || z.grade === Number(f.grade))
    && (!f.topic || z.topic === f.topic) && (!f.level || z.level === f.level))
    .sort((a, b) => a.grade - b.grade || a.topic.localeCompare(b.topic, 'vi')
      || lvIdx(a.level) - lvIdx(b.level) || a.sort_order - b.sort_order || a.id - b.id);
  if (!list.length) {
    box.replaceChildren(el('div', { class: 'panel empty' },
      el('h3', { text: all.length ? 'Không có đề nào khớp bộ lọc' : 'Ngân hàng đề chưa có đề nào' })));
    return;
  }

  // Gom theo "Toán 6 · Chuyên đề"
  const groups = new Map();
  for (const z of list) {
    const k = `Toán ${z.grade} · ${z.topic}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(z);
  }
  box.replaceChildren(...[...groups.entries()].flatMap(([title, items]) => [
    el('h3', { class: 'section-gap', text: title }),
    ...items.map((z) => item(z)),
  ]));
}

function item(z) {
  const meta = [
    levelName(z.level),
    `${z.question_count} câu`,
    z.time_limit_min ? `${z.time_limit_min} phút` : 'Không giới hạn giờ',
    `${z.submitted_count} bài đã nộp`,
  ].join(' · ');
  const locked = z.attempt_count > 0;
  return el('div', { class: 'item' },
    el('div', { class: 'meta' },
      el('b', { text: z.title }),
      el('span', { class: 'muted small' },
        z.published ? null : el('span', { class: 'badge warn', text: 'Đang ẩn' }), z.published ? '' : ' ', meta)),
    el('div', { class: 'acts' },
      el('button', { class: 'btn btn-navy btn-sm', text: 'Xem / sửa',
        onclick: () => { ctx.state.bankQuizId = z.id; ctx.rerender(); } }),
      ctx.isAdmin() ? el('button', { class: 'btn btn-outline btn-sm', text: z.published ? 'Ẩn đề' : 'Hiện đề',
        title: z.published ? 'Học sinh sẽ không thấy đề này trong mục luyện tập' : 'Học sinh thấy lại đề này',
        onclick: () => togglePublish(z) }) : null,
      ctx.isAdmin() ? el('button', { class: 'btn btn-danger btn-sm', text: 'Xóa', disabled: locked,
        title: locked ? 'Đề đã có học sinh làm nên không xóa được. Có thể bấm "Ẩn đề".' : 'Xóa đề',
        onclick: () => deleteQuiz(z, () => ctx.rerender()) }) : null));
}

async function togglePublish(z) {
  const msg = z.published
    ? `Ẩn đề "${z.title}"? Học sinh sẽ không thấy đề này nữa. Bài đã làm vẫn được giữ.`
    : `Hiện lại đề "${z.title}" cho học sinh luyện tập?`;
  if (!confirm(msg)) return;
  const { error } = await sb.from('quizzes').update({ published: !z.published }).eq('id', z.id);
  if (error) { toast(errMsg(error), 'error'); return; }
  toast(z.published ? 'Đã ẩn đề.' : 'Đã hiện đề.');
  ctx.rerender();
}
