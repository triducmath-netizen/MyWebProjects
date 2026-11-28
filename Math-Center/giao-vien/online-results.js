// Trang giáo viên — Kết quả làm bài trực tuyến của học sinh trong lớp:
// bài tự luyện (đề ngân hàng), bài về nhà theo bài học và đề trực tuyến của lớp.
// Bài tự luyện trước đây chỉ học sinh / phụ huynh thấy; giáo viên xem ở đây.
import { sb, el, fmtNum, errMsg, fmtDateTime, openDialog } from '../portal/common.js?v=20261202a';
import { imageUrls, reviewQuestion } from '../portal/quiz-common.js?v=20261202a';

const LEVEL_NAME = { tb: 'Mức độ 1', kha: 'Mức độ 2', gioi: 'Mức độ 3' };
const PAGE = 30;
const filter = { classId: null, studentId: '', kind: '' };

function kindOf(z) {
  if (!z) return { key: 'class', label: 'Bài của lớp' };
  if (z.homework_id) return { key: 'homework', label: 'Bài về nhà' };
  if (z.class_id == null) return { key: 'practice', label: 'Tự luyện' };
  return { key: 'class', label: 'Bài của lớp' };
}

function quizName(z) {
  if (!z) return '—';
  if (z.class_id == null) return [`Toán ${z.grade}`, z.topic, LEVEL_NAME[z.level]].filter(Boolean).join(' · ');
  return z.homework_id ? (z.topic || z.title) : z.title;
}

export async function renderOnlineResults(container, classId) {
  if (filter.classId !== classId) Object.assign(filter, { classId, studentId: '', kind: '' });
  const box = el('div', {}, el('p', { class: 'muted', text: 'Đang tải…' }));
  container.append(el('div', { class: 'panel section-gap' },
    el('h2', { text: 'Kết quả làm bài trực tuyến' }),
    el('p', { class: 'muted small', text: 'Điểm học sinh tự làm trên website: bài tự luyện ở mục "Luyện đề theo chuyên đề", bài về nhà và đề trực tuyến của lớp. Máy chấm tự động, quy về thang 10.' }),
    box));

  const { data: students, error } = await sb.from('students').select('id, code, full_name').eq('class_id', classId).order('full_name');
  if (error) { box.replaceChildren(el('p', { class: 'error-text', text: errMsg(error) })); return; }
  if (!students?.length) { box.replaceChildren(el('p', { class: 'muted', text: 'Lớp chưa có học sinh.' })); return; }
  const byId = new Map(students.map((s) => [s.id, s]));

  const { data: attempts, error: e2 } = await sb.from('quiz_attempts')
    .select('id, quiz_id, student_id, submitted_at, score, max_score, mode, answers, detail, quizzes(id, title, class_id, homework_id, grade, topic, level)')
    .in('student_id', students.map((s) => s.id))
    .not('submitted_at', 'is', null)
    .order('submitted_at', { ascending: false })
    .limit(1000);
  if (e2) { box.replaceChildren(el('p', { class: 'error-text', text: errMsg(e2) })); return; }

  const studentSel = el('select', { onchange: (e) => { filter.studentId = e.target.value; draw(); } },
    el('option', { value: '', text: 'Tất cả học sinh' }),
    students.map((s) => el('option', { value: String(s.id), selected: String(s.id) === filter.studentId, text: s.full_name })));
  const kindSel = el('select', { onchange: (e) => { filter.kind = e.target.value; draw(); } },
    [['', 'Tất cả loại bài'], ['practice', 'Tự luyện'], ['homework', 'Bài về nhà'], ['class', 'Bài của lớp']]
      .map(([v, t]) => el('option', { value: v, selected: v === filter.kind, text: t })));
  const out = el('div', {});
  box.replaceChildren(
    el('div', { class: 'row' }, el('label', { class: 'field' }, 'Học sinh', studentSel), el('label', { class: 'field' }, 'Loại bài', kindSel)),
    out);

  let shown = PAGE;
  function draw() {
    const rows = (attempts || []).filter((a) => (!filter.studentId || String(a.student_id) === filter.studentId)
      && (!filter.kind || kindOf(a.quizzes).key === filter.kind));
    if (!rows.length) {
      out.replaceChildren(el('p', { class: 'muted', text: 'Chưa có bài nào được nộp.' }));
      return;
    }
    const on10 = rows.filter((a) => Number(a.max_score) > 0).map((a) => (Number(a.score) / Number(a.max_score)) * 10);
    const avg = on10.length ? on10.reduce((s, x) => s + x, 0) / on10.length : null;
    const r2 = (x) => fmtNum(Math.round(x * 100) / 100);
    out.replaceChildren(
      el('div', { class: 'stats' },
        el('div', { class: 'stat' }, el('div', { class: 'k', text: 'Số bài đã nộp' }), el('div', { class: 'v', text: String(rows.length) })),
        el('div', { class: 'stat' }, el('div', { class: 'k', text: 'Điểm TB (thang 10)' }), el('div', { class: 'v', text: avg == null ? '—' : r2(avg) })),
        el('div', { class: 'stat' }, el('div', { class: 'k', text: 'Số học sinh đã làm' }), el('div', { class: 'v', text: `${new Set(rows.map((a) => a.student_id)).size}/${students.length}` }))),
      el('div', { class: 'table-wrap' }, el('table', { class: 'results-table' },
        el('thead', {}, el('tr', {}, el('th', { text: 'Học sinh' }), el('th', { text: 'Bài' }), el('th', { text: 'Điểm' }), el('th', { text: 'Nộp lúc' }), el('th', { text: '' }))),
        el('tbody', {}, rows.slice(0, shown).map((a) => {
          const s = byId.get(a.student_id);
          const k = kindOf(a.quizzes);
          const ten = Number(a.max_score) > 0 ? (Number(a.score) / Number(a.max_score)) * 10 : null;
          return el('tr', {},
            el('td', {}, el('b', { text: s?.full_name ?? '' }), el('div', { class: 'muted small', text: s?.code ?? '' })),
            el('td', {}, el('div', { text: quizName(a.quizzes) }), el('span', { class: 'badge', text: k.label })),
            el('td', {}, el('b', { text: ten == null ? '—' : `${r2(ten)} / 10` }),
              el('div', { class: 'muted small', text: `${fmtNum(a.score)} / ${fmtNum(a.max_score)} điểm` })),
            el('td', { class: 'small', text: fmtDateTime(a.submitted_at) }),
            el('td', {}, a.mode === 'manual' ? el('span', { class: 'muted small', text: 'Bài giấy' })
              : el('button', { class: 'btn btn-outline btn-sm', text: 'Xem bài', onclick: () => showAttempt(s, a) })));
        })))),
      rows.length > shown ? el('div', { class: 'row', style: 'margin-top:12px' },
        el('button', { class: 'btn btn-outline btn-sm', text: `Xem thêm (${rows.length - shown} bài)`, onclick: () => { shown += PAGE; draw(); } })) : null);
  }
  draw();
}

async function showAttempt(s, a) {
  const { data: questions, error } = await sb.from('quiz_questions').select('*').eq('quiz_id', a.quiz_id).order('position').order('id');
  if (error) { openDialog('Không mở được bài', el('p', { class: 'error-text', text: errMsg(error) })); return; }
  const { data: keys } = await sb.from('quiz_keys').select('*').in('question_id', (questions || []).map((q) => q.id));
  const keyMap = new Map((keys || []).map((k) => [k.question_id, k]));
  const urls = await imageUrls([...(questions || []).map((q) => q.image_path), ...(keys || []).map((k) => k.explanation_image_path)]);
  openDialog(`${s?.full_name ?? ''} — ${quizName(a.quizzes)} — ${fmtNum(a.score)} / ${fmtNum(a.max_score)} điểm`,
    el('div', { class: 'quiz-take' }, (questions || []).map((q, i) =>
      reviewQuestion(q, i, a.answers?.[q.id], keyMap.get(q.id), a.detail?.[q.id], urls))), { wide: true });
}
