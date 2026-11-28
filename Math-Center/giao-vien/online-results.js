// Trang giáo viên — tab "Kết quả trực tuyến": mọi bài học sinh làm trên website
// (luyện đề theo chuyên đề, bài về nhà theo bài học, đề trực tuyến của lớp).
//   * Quản trị viên: thấy mọi học sinh (cả em chưa xếp lớp) và được "Cho làm lại".
//   * Giáo viên khác: chỉ xem bài của học sinh các lớp mình.
//   * Không ai sửa được điểm.
import { sb, el, fmtNum, errMsg, fmtDateTime, openDialog, toast, askConfirm } from '../portal/common.js?v=20261202a';
import { imageUrls, reviewQuestion } from '../portal/quiz-common.js?v=20261202a';

const LEVEL_NAME = { tb: 'Mức độ 1', kha: 'Mức độ 2', gioi: 'Mức độ 3' };
const PAGE = 50;
const NO_CLASS = 'none';
const filter = { classId: '', studentId: '', kind: '', status: '' };

function kindOf(z) {
  if (z?.homework_id) return { key: 'homework', label: 'Bài về nhà' };
  if (z && z.class_id == null) return { key: 'practice', label: 'Luyện đề' };
  return { key: 'class', label: 'Bài của lớp' };
}

function quizName(z) {
  if (!z) return '—';
  if (z.class_id == null) return [`Toán ${z.grade}`, z.topic, LEVEL_NAME[z.level], z.title].filter(Boolean).join(' · ');
  return z.homework_id ? (z.topic || z.title) : z.title;
}

// Đọc hết (theo từng trang 1000 dòng, PostgREST giới hạn mỗi lần đọc).
async function fetchAll(build) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build().range(from, from + 999);
    if (error) return { error };
    out.push(...data);
    if (data.length < 1000) return { data: out };
  }
}

export async function renderOnlineTab(view, { state, isAdmin, rerender }) {
  const admin = isAdmin();
  const box = el('div', {}, el('p', { class: 'muted', text: 'Đang tải…' }));
  view.append(el('div', { class: 'panel' },
    el('h2', { text: 'Kết quả làm bài trực tuyến' }),
    el('p', { class: 'muted small', text: admin
      ? 'Mọi bài học sinh làm trên website: luyện đề theo chuyên đề, bài về nhà, đề trực tuyến của lớp. Máy chấm tự động; điểm không sửa được. Chỉ quản trị viên được "Cho làm lại".'
      : 'Bài học sinh các lớp của bạn làm trên website: luyện đề theo chuyên đề, bài về nhà, đề trực tuyến của lớp. Giáo viên chỉ xem; muốn cho em làm lại, hãy báo quản trị viên.' }),
    box));

  const [{ data: students, error }, { data: attempts, error: e2 }] = await Promise.all([
    fetchAll(() => sb.from('students').select('id, code, full_name, class_id').order('full_name').order('id')),
    fetchAll(() => sb.from('quiz_attempts')
      .select('id, quiz_id, student_id, started_at, submitted_at, score, max_score, mode, answers, detail, quizzes(id, title, class_id, homework_id, grade, topic, level)')
      .order('started_at', { ascending: false }).order('id', { ascending: false })),
  ]);
  if (error || e2) { box.replaceChildren(el('p', { class: 'error-text', text: errMsg(error || e2) })); return; }

  // Giáo viên: chỉ học sinh các lớp mình (quản trị viên: tất cả).
  const myStudents = admin ? students : students.filter((s) => s.class_id != null && state.classes.some((c) => c.id === s.class_id));
  const byId = new Map(myStudents.map((s) => [s.id, s]));
  const all = attempts.filter((a) => byId.has(a.student_id));
  const className = new Map(state.classes.map((c) => [c.id, c.name]));

  const classes = state.classes.filter((c) => myStudents.some((s) => s.class_id === c.id));
  const hasNoClass = myStudents.some((s) => s.class_id == null);
  if (filter.classId && filter.classId !== NO_CLASS && !classes.some((c) => String(c.id) === filter.classId)) filter.classId = '';

  const classSel = el('select', { onchange: (e) => { filter.classId = e.target.value; filter.studentId = ''; fillStudents(); draw(true); } },
    el('option', { value: '', text: 'Tất cả lớp' }),
    classes.map((c) => el('option', { value: String(c.id), selected: String(c.id) === filter.classId, text: c.name })),
    hasNoClass ? el('option', { value: NO_CLASS, selected: filter.classId === NO_CLASS, text: 'Chưa xếp lớp' }) : null);
  const studentSel = el('select', { onchange: (e) => { filter.studentId = e.target.value; draw(true); } });
  const inClass = (s) => !filter.classId || (filter.classId === NO_CLASS ? s.class_id == null : String(s.class_id) === filter.classId);
  function fillStudents() {
    const list = myStudents.filter(inClass).filter((s) => all.some((a) => a.student_id === s.id));
    if (filter.studentId && !list.some((s) => String(s.id) === filter.studentId)) filter.studentId = '';
    studentSel.replaceChildren(el('option', { value: '', text: `Tất cả học sinh (${list.length} em đã làm)` }),
      ...list.map((s) => el('option', { value: String(s.id), selected: String(s.id) === filter.studentId, text: `${s.full_name} · ${s.code}` })));
  }
  fillStudents();
  const kindSel = el('select', { onchange: (e) => { filter.kind = e.target.value; draw(true); } },
    [['', 'Tất cả loại bài'], ['practice', 'Luyện đề'], ['homework', 'Bài về nhà'], ['class', 'Bài của lớp']]
      .map(([v, t]) => el('option', { value: v, selected: v === filter.kind, text: t })));
  const statusSel = el('select', { onchange: (e) => { filter.status = e.target.value; draw(true); } },
    [['', 'Đã nộp và đang làm'], ['done', 'Đã nộp'], ['doing', 'Đang làm']]
      .map(([v, t]) => el('option', { value: v, selected: v === filter.status, text: t })));
  const out = el('div', { class: 'section-gap' });
  box.replaceChildren(
    el('div', { class: 'row' },
      el('label', { class: 'field' }, 'Lớp', classSel),
      el('label', { class: 'field' }, 'Học sinh', studentSel),
      el('label', { class: 'field' }, 'Loại bài', kindSel),
      el('label', { class: 'field' }, 'Trạng thái', statusSel)),
    out);

  let shown = PAGE;
  function draw(reset = false) {
    if (reset) shown = PAGE;
    const rows = all.filter((a) => {
      const s = byId.get(a.student_id);
      return inClass(s)
        && (!filter.studentId || String(a.student_id) === filter.studentId)
        && (!filter.kind || kindOf(a.quizzes).key === filter.kind)
        && (!filter.status || (filter.status === 'done') === !!a.submitted_at);
    });
    if (!rows.length) { out.replaceChildren(el('p', { class: 'muted', text: 'Chưa có bài làm nào.' })); return; }
    const done = rows.filter((a) => a.submitted_at && Number(a.max_score) > 0);
    const on10 = done.map((a) => (Number(a.score) / Number(a.max_score)) * 10);
    const r2 = (x) => fmtNum(Math.round(x * 100) / 100);
    out.replaceChildren(
      el('div', { class: 'stats' },
        el('div', { class: 'stat' }, el('div', { class: 'k', text: 'Đã nộp' }), el('div', { class: 'v', text: String(done.length) })),
        el('div', { class: 'stat' }, el('div', { class: 'k', text: 'Điểm TB (thang 10)' }), el('div', { class: 'v', text: on10.length ? r2(on10.reduce((s, x) => s + x, 0) / on10.length) : '—' })),
        el('div', { class: 'stat' }, el('div', { class: 'k', text: 'Số học sinh' }), el('div', { class: 'v', text: String(new Set(rows.map((a) => a.student_id)).size) }))),
      el('div', { class: 'table-wrap' }, el('table', { class: 'results-table' },
        el('thead', {}, el('tr', {}, el('th', { text: 'Học sinh' }), el('th', { text: 'Bài' }), el('th', { text: 'Điểm' }), el('th', { text: 'Thời gian' }), el('th', { text: '' }))),
        el('tbody', {}, rows.slice(0, shown).map((a) => row(a))))),
      rows.length > shown ? el('div', { class: 'row', style: 'margin-top:12px' },
        el('button', { class: 'btn btn-outline btn-sm', text: `Xem thêm (${rows.length - shown} bài)`, onclick: () => { shown += PAGE; draw(); } })) : null);
  }

  function row(a) {
    const s = byId.get(a.student_id);
    const k = kindOf(a.quizzes);
    const ten = a.submitted_at && Number(a.max_score) > 0 ? (Number(a.score) / Number(a.max_score)) * 10 : null;
    const score = !a.submitted_at ? el('span', { class: 'badge warn', text: 'Đang làm' })
      : el('div', {}, el('b', { text: ten == null ? '—' : `${fmtNum(Math.round(ten * 100) / 100)} / 10` }),
        el('div', { class: 'muted small', text: `${fmtNum(a.score)} / ${fmtNum(a.max_score)} điểm` }),
        a.mode === 'manual' ? el('span', { class: 'badge', text: 'Bài giấy · GV chấm' }) : null,
        a.mode === 'paper' ? el('span', { class: 'badge', text: 'Bài giấy · HS nhập phiếu' }) : null);
    return el('tr', {},
      el('td', {}, el('b', { text: s.full_name }),
        el('div', { class: 'muted small', text: [s.code, s.class_id ? className.get(s.class_id) : 'Chưa xếp lớp'].filter(Boolean).join(' · ') })),
      el('td', {}, el('div', { text: quizName(a.quizzes) }), el('span', { class: 'badge', text: k.label })),
      el('td', {}, score),
      el('td', { class: 'small', text: a.submitted_at ? `Nộp ${fmtDateTime(a.submitted_at)}` : `Bắt đầu ${fmtDateTime(a.started_at)}` }),
      el('td', {}, el('div', { class: 'acts' },
        a.submitted_at && a.mode !== 'manual' ? el('button', { class: 'btn btn-outline btn-sm', text: 'Xem bài', onclick: () => showAttempt(s, a) }) : null,
        admin ? el('button', { class: 'btn btn-danger btn-sm', text: 'Cho làm lại', onclick: () => retake(s, a) }) : null)));
  }

  async function retake(s, a) {
    if (!await askConfirm(`Xóa bài làm "${quizName(a.quizzes)}" của ${s.full_name} để em làm lại từ đầu (cùng đề)? Điểm cũ sẽ mất, không khôi phục được.`)) return;
    const { data: gone, error: e3 } = await sb.from('quiz_attempts').delete().eq('id', a.id).select('id');
    if (e3) { toast(errMsg(e3), 'error'); return; }
    if (!gone?.length) { toast('Chỉ quản trị viên được cho làm lại.', 'error'); return; }
    toast(`Đã cho ${s.full_name} làm lại.`);
    rerender();
  }

  draw();
}

async function showAttempt(s, a) {
  const { data: questions, error } = await sb.from('quiz_questions').select('*').eq('quiz_id', a.quiz_id).order('position').order('id');
  if (error) { toast(errMsg(error), 'error'); return; }
  const { data: keys } = await sb.from('quiz_keys').select('*').in('question_id', (questions || []).map((q) => q.id));
  const keyMap = new Map((keys || []).map((k) => [k.question_id, k]));
  const urls = await imageUrls([...(questions || []).map((q) => q.image_path), ...(keys || []).map((k) => k.explanation_image_path)]);
  openDialog(`${s.full_name} — ${quizName(a.quizzes)} — ${fmtNum(a.score)} / ${fmtNum(a.max_score)} điểm`,
    el('div', { class: 'quiz-take' }, (questions || []).map((q, i) =>
      reviewQuestion(q, i, a.answers?.[q.id], keyMap.get(q.id), a.detail?.[q.id], urls))), { wide: true });
}
