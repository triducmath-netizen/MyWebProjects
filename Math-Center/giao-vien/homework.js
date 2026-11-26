// Trang giáo viên — Giao bài tập về nhà theo bài học (Lớp → Chương → Bài, SGK Kết nối tri thức).
// Mỗi bài có một bộ đề tương đương trong ngân hàng; khi giao, máy chủ chọn ngẫu nhiên
// cho mỗi học sinh một đề riêng (lớp ≤ số đề thì không em nào trùng đề).
import { sb, el, fmtNum, toast, errMsg, fmtDateTime, askConfirm, openDialog } from '../portal/common.js?v=20261202a';
import { imageUrls, reviewQuestion, fmtDeadline } from '../portal/quiz-common.js?v=20261202a';

const p2 = (n) => String(n).padStart(2, '0');
const toLocalInput = (ts) => {
  if (!ts) return '';
  const d = new Date(ts);
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}`;
};
const fromLocalInput = (v) => (v ? new Date(v).toISOString() : null);
// Mặc định: 21:00 tối ngày này tuần sau.
const defaultDue = () => { const d = new Date(Date.now() + 7 * 864e5); d.setHours(21, 0, 0, 0); return toLocalInput(d.toISOString()); };

// Nhớ lựa chọn Chương / Bài khi trang vẽ lại.
const pickState = { classId: null, chapter: '', lesson: '' };

// Khung "Giao bài về nhà" + danh sách các lượt đã giao của lớp.
export async function renderHomeworkPanel(container, ctx, openResults) {
  const cls = ctx.state.classes.find((c) => c.id === ctx.state.classId);
  if (!cls) return;
  if (pickState.classId !== cls.id) Object.assign(pickState, { classId: cls.id, chapter: '', lesson: '' });

  const form = el('div', { class: 'panel' }, el('p', { class: 'muted', text: 'Đang tải danh sách bài…' }));
  const list = el('div', { class: 'list section-gap' });
  container.append(form, list);

  const [{ data: lessons, error }, { data: hws, error: e2 }] = await Promise.all([
    sb.rpc('homework_lessons', { p_grade: cls.grade }),
    sb.from('homework').select('id, title, chapter, lesson, due_at, time_limit_min, published, created_at, quizzes(id, quiz_attempts(submitted_at))')
      .eq('class_id', cls.id).order('created_at', { ascending: false }),
  ]);
  if (error || e2) { form.replaceChildren(el('p', { class: 'error-text', text: errMsg(error || e2) })); return; }

  // ----- Chọn Chương → Bài -----
  const chapters = [...new Map((lessons || []).map((l) => [l.chapter || 'Chưa ghi chương', l.lesson_no ?? 9999])).entries()]
    .sort((a, b) => a[1] - b[1]).map(([c]) => c);
  if (pickState.chapter && !chapters.includes(pickState.chapter)) pickState.chapter = '';
  if (!pickState.chapter && chapters.length) pickState.chapter = chapters[0];
  const inChapter = (lessons || []).filter((l) => (l.chapter || 'Chưa ghi chương') === pickState.chapter);
  if (pickState.lesson && !inChapter.some((l) => l.lesson === pickState.lesson)) pickState.lesson = '';
  if (!pickState.lesson && inChapter.length) pickState.lesson = inChapter[0].lesson;

  const rerenderForm = () => { container.replaceChildren(); renderHomeworkPanel(container, ctx, openResults); };
  const chapterSel = el('select', { onchange: (e) => { pickState.chapter = e.target.value; pickState.lesson = ''; rerenderForm(); } },
    chapters.map((c) => el('option', { value: c, selected: c === pickState.chapter, text: c })));
  const lessonSel = el('select', { onchange: (e) => { pickState.lesson = e.target.value; } },
    inChapter.map((l) => el('option', { value: l.lesson, selected: l.lesson === pickState.lesson, text: `${l.lesson} (${l.variant_count} đề)` })));
  const due = el('input', { type: 'datetime-local', value: defaultDue() });
  const limit = el('input', { type: 'number', min: '1', max: '600', placeholder: 'Không giới hạn' });
  const btn = el('button', { class: 'btn btn-gold', text: 'Giao bài', disabled: !lessons?.length });

  btn.addEventListener('click', async () => {
    const lesson = lessonSel.value;
    if (!lesson) { toast('Chọn bài cần giao.', 'error'); return; }
    const dueAt = fromLocalInput(due.value);
    if (!dueAt) { toast('Chọn hạn nộp.', 'error'); return; }
    if (new Date(dueAt) <= new Date()) { toast('Hạn nộp phải sau thời điểm hiện tại.', 'error'); return; }
    const lim = limit.value.trim() === '' ? null : Number(limit.value);
    if (lim != null && !(Number.isInteger(lim) && lim >= 1 && lim <= 600)) { toast('Thời gian làm bài phải từ 1 đến 600 phút.', 'error'); return; }
    if (!await askConfirm(`Giao "${lesson}" cho lớp ${cls.name}? Mỗi học sinh nhận ngẫu nhiên một đề riêng, hạn nộp ${fmtDeadline(dueAt)}.`)) return;
    btn.disabled = true; btn.textContent = 'Đang giao…';
    const { data, error: e3 } = await sb.rpc('assign_homework', { p_class: cls.id, p_lesson: lesson, p_due: dueAt, p_time_limit: lim });
    if (e3) { toast(errMsg(e3), 'error'); btn.disabled = false; btn.textContent = 'Giao bài'; return; }
    toast(`Đã giao bài cho ${data.students} học sinh (${Math.min(data.students, data.variants)} đề khác nhau).`);
    ctx.rerender();
  });

  form.replaceChildren(
    el('h2', { text: 'Giao bài tập về nhà theo bài học' }),
    el('p', { class: 'muted small', text: `Toán ${cls.grade} · SGK Kết nối tri thức với cuộc sống. Mỗi học sinh nhận ngẫu nhiên một đề riêng (cùng cấu trúc, khác số liệu); bài hiện ở mục "Bài giáo viên giao" của học sinh.` }),
    lessons?.length
      ? el('div', { class: 'row' },
        el('label', { class: 'field' }, 'Chương', chapterSel),
        el('label', { class: 'field' }, 'Bài', lessonSel),
        el('label', { class: 'field' }, 'Hạn nộp', due),
        el('label', { class: 'field' }, 'Thời gian làm (phút)', limit),
        btn)
      : el('p', { class: 'notice', text: `Toán ${cls.grade} chưa có bài nào có đề về nhà trong ngân hàng.` }));

  // ----- Các lượt đã giao -----
  const total = await classSize(cls.id);
  if (!hws?.length) { list.replaceChildren(); return; }
  list.replaceChildren(el('h3', { text: 'Bài về nhà đã giao' }), ...hws.map((h) => {
    const given = h.quizzes?.length ?? 0;
    const done = (h.quizzes || []).filter((z) => z.quiz_attempts?.some((a) => a.submitted_at)).length;
    const meta = [h.chapter, h.due_at ? `Hạn: ${fmtDeadline(h.due_at)}` : null,
      h.time_limit_min ? `${h.time_limit_min} phút` : 'Không giới hạn giờ', `Đã nộp ${done}/${given}`].filter(Boolean).join(' · ');
    const missing = total - given;
    return el('div', { class: 'item' },
      el('div', { class: 'meta' }, el('b', { text: h.lesson }),
        el('span', { class: 'muted small' },
          h.published ? el('span', { class: 'badge', text: 'Đã giao' }) : el('span', { class: 'badge warn', text: 'Đã thu hồi' }), ' ', meta),
        missing > 0 ? el('span', { class: 'muted small', text: `${missing} học sinh vào lớp sau chưa có đề.` }) : null),
      el('div', { class: 'acts' },
        el('button', { class: 'btn btn-navy btn-sm', text: 'Kết quả', onclick: () => openResults(h.id) }),
        missing > 0 ? el('button', { class: 'btn btn-outline btn-sm', text: 'Giao cho HS mới', onclick: async () => {
          const { data: n, error: e4 } = await sb.rpc('homework_add_missing', { p_homework: h.id });
          if (e4) { toast(errMsg(e4), 'error'); return; }
          toast(`Đã giao thêm cho ${n} học sinh.`); ctx.rerender();
        } }) : null,
        el('button', { class: 'btn btn-outline btn-sm', text: 'Đổi hạn', onclick: () => editDialog(h, ctx) }),
        el('button', { class: 'btn btn-outline btn-sm', text: h.published ? 'Thu hồi' : 'Giao lại', onclick: async () => {
          if (h.published && !await askConfirm(`Thu hồi "${h.lesson}"? Học sinh chưa làm sẽ không thấy bài nữa. Bài đã làm vẫn được giữ.`)) return;
          const { error: e5 } = await sb.rpc('homework_set_published', { p_homework: h.id, p_published: !h.published });
          if (e5) { toast(errMsg(e5), 'error'); return; }
          toast(h.published ? 'Đã thu hồi.' : 'Đã giao lại.'); ctx.rerender();
        } }),
        done === 0 && !(h.quizzes || []).some((z) => z.quiz_attempts?.length) ? el('button', { class: 'btn btn-danger btn-sm', text: 'Xóa', onclick: async () => {
          if (!await askConfirm(`Xóa lượt giao "${h.lesson}"? Đề riêng của từng học sinh sẽ bị xóa (đề gốc trong ngân hàng vẫn giữ).`)) return;
          const { data: gone, error: e6 } = await sb.from('homework').delete().eq('id', h.id).select('id');
          if (e6) { toast(errMsg(e6), 'error'); return; }
          if (!gone?.length) { toast('Bạn không có quyền xóa lượt giao này.', 'error'); return; }
          toast('Đã xóa.'); ctx.rerender();
        } }) : null));
  }));
}

async function classSize(classId) {
  const { count } = await sb.from('students').select('id', { count: 'exact', head: true }).eq('class_id', classId);
  return count ?? 0;
}

function editDialog(h, ctx) {
  const due = el('input', { type: 'datetime-local', value: toLocalInput(h.due_at) });
  const limit = el('input', { type: 'number', min: '1', max: '600', placeholder: 'Không giới hạn', value: h.time_limit_min ?? '' });
  const save = el('button', { class: 'btn btn-gold', text: 'Lưu' });
  const dlg = openDialog(`Đổi hạn: ${h.lesson}`, el('div', { class: 'form-grid' },
    el('label', {}, 'Hạn nộp (để trống = không có hạn)', due),
    el('label', {}, 'Thời gian làm bài (phút, để trống = không giới hạn)', limit),
    el('div', { class: 'row' }, save)));
  save.addEventListener('click', async () => {
    const lim = limit.value.trim() === '' ? null : Number(limit.value);
    if (lim != null && !(Number.isInteger(lim) && lim >= 1 && lim <= 600)) { toast('Thời gian làm bài phải từ 1 đến 600 phút.', 'error'); return; }
    const { error } = await sb.rpc('homework_update', { p_homework: h.id, p_due: fromLocalInput(due.value), p_time_limit: lim });
    if (error) { toast(errMsg(error), 'error'); return; }
    dlg.close(); toast('Đã lưu.'); ctx.rerender();
  });
}

// Kết quả một lượt giao: từng học sinh, đề số mấy, điểm.
export async function renderHomeworkResults(view, homeworkId, ctx, back) {
  const { data: h, error } = await sb.from('homework').select('*').eq('id', homeworkId).single();
  if (error) { view.append(el('p', { class: 'error-text', text: errMsg(error) })); return; }
  const { data: copies } = await sb.from('quizzes').select('id, student_id, sort_order').eq('homework_id', homeworkId);
  const ids = (copies || []).map((z) => z.id);
  await Promise.all(ids.map((id) => sb.rpc('finalize_expired_attempts', { p_quiz: id })));
  const [{ data: attempts }, { data: students }] = await Promise.all([
    ids.length ? sb.from('quiz_attempts').select('*').in('quiz_id', ids) : Promise.resolve({ data: [] }),
    sb.from('students').select('id, code, full_name').in('id', (copies || []).map((z) => z.student_id)).order('full_name'),
  ]);
  const copyOf = new Map((copies || []).map((z) => [z.student_id, z]));
  const attemptOf = new Map((attempts || []).map((a) => [a.quiz_id, a]));
  const done = (attempts || []).filter((a) => a.submitted_at);
  const on10 = done.map((a) => (Number(a.score) / Number(a.max_score || 1)) * 10);
  const avg = on10.length ? on10.reduce((s, x) => s + x, 0) / on10.length : null;

  const rows = (students || []).map((s) => {
    const z = copyOf.get(s.id);
    const a = z && attemptOf.get(z.id);
    const status = !a ? el('span', { class: 'badge warn', text: 'Chưa làm' })
      : !a.submitted_at ? el('span', { class: 'badge', text: 'Đang làm' })
        : el('b', { text: `${fmtNum(a.score)} / ${fmtNum(a.max_score)}` });
    return el('tr', {},
      el('td', {}, el('b', { text: s.full_name }), el('div', { class: 'muted small', text: s.code })),
      el('td', { text: z?.sort_order ? `Đề ${z.sort_order}` : '—' }),
      el('td', {}, status),
      el('td', { class: 'small', text: a?.submitted_at ? fmtDateTime(a.submitted_at) : '' }),
      el('td', {}, el('div', { class: 'acts' },
        a?.submitted_at ? el('button', { class: 'btn btn-outline btn-sm', text: 'Xem bài', onclick: () => showAttempt(s, a, z.id) }) : null,
        a ? el('button', { class: 'btn btn-danger btn-sm', text: 'Cho làm lại', onclick: async () => {
          if (!await askConfirm(`Xóa bài làm của ${s.full_name} để em làm lại từ đầu (cùng đề)?`)) return;
          const { error: e2 } = await sb.from('quiz_attempts').delete().eq('id', a.id);
          if (e2) { toast(errMsg(e2), 'error'); return; }
          toast('Đã cho làm lại.'); ctx.rerender();
        } }) : null)));
  });

  view.append(
    el('div', { class: 'row', style: 'margin-bottom:16px' },
      el('button', { class: 'btn btn-outline btn-sm', text: '← Danh sách bài', onclick: back })),
    el('div', { class: 'panel' },
      el('h2', { text: `Kết quả: ${h.lesson}` }),
      el('p', { class: 'muted small', text: [h.chapter, h.due_at ? `Hạn nộp ${fmtDeadline(h.due_at)}` : 'Không có hạn nộp'].filter(Boolean).join(' · ') }),
      el('div', { class: 'stats' },
        el('div', { class: 'stat' }, el('div', { class: 'k', text: 'Đã nộp' }), el('div', { class: 'v', text: `${done.length}/${students?.length ?? 0}` })),
        el('div', { class: 'stat' }, el('div', { class: 'k', text: 'Điểm TB (thang 10)' }), el('div', { class: 'v', text: avg == null ? '—' : fmtNum(Math.round(avg * 100) / 100) })),
        el('div', { class: 'stat' }, el('div', { class: 'k', text: 'Cao nhất (thang 10)' }), el('div', { class: 'v', text: on10.length ? fmtNum(Math.round(Math.max(...on10) * 100) / 100) : '—' })))),
    el('div', { class: 'table-wrap section-gap' }, el('table', { class: 'results-table' },
      el('thead', {}, el('tr', {}, el('th', { text: 'Học sinh' }), el('th', { text: 'Đề' }), el('th', { text: 'Điểm' }), el('th', { text: 'Nộp lúc' }), el('th', { text: '' }))),
      el('tbody', {}, rows))));
}

async function showAttempt(s, a, quizId) {
  const { data: questions } = await sb.from('quiz_questions').select('*').eq('quiz_id', quizId).order('position').order('id');
  const { data: keys } = await sb.from('quiz_keys').select('*').in('question_id', (questions || []).map((q) => q.id));
  const keyMap = new Map((keys || []).map((k) => [k.question_id, k]));
  const urls = await imageUrls([...(questions || []).map((q) => q.image_path), ...(keys || []).map((k) => k.explanation_image_path)]);
  openDialog(`${s.full_name} — ${fmtNum(a.score)} / ${fmtNum(a.max_score)} điểm`,
    el('div', { class: 'quiz-take' }, (questions || []).map((q, i) =>
      reviewQuestion(q, i, a.answers?.[q.id], keyMap.get(q.id), a.detail?.[q.id], urls))), { wide: true });
}
