// Trang học sinh — làm bài trực tuyến, xem điểm và lời giải.
import { sb, el, fmtNum, toast, errMsg, openDialog, fmtDateTime, askConfirm } from '../portal/common.js?v=20261124g';
import {
  rich, imageUrls, qImage, KIND_LABEL, LETTERS, TF_LETTERS, reviewQuestion, isAnswered, fmtDeadline,
} from '../portal/quiz-common.js?v=20261124g';
import { downloadQuizPdf } from '../portal/pdf-export.js?v=20261125a';

let timer = null;
let leaveGuard = null;
// Tài khoản phụ huynh: chỉ xem bài con đã làm, không làm bài.
let readOnly = false;
export function setReadOnly(v) { readOnly = !!v; }
function stopTaking() {
  if (timer) { clearInterval(timer); timer = null; }
  if (leaveGuard) { window.removeEventListener('beforeunload', leaveGuard); leaveGuard = null; }
}

// =====================================================================
// Danh sách bài: "Bài được giao" và "Luyện đề theo chuyên đề"
// =====================================================================
const LEVELS = [
  ['tb', 'Mức độ 1', 'Cơ bản'],
  ['kha', 'Mức độ 2', 'Vận dụng'],
  ['gioi', 'Mức độ 3', 'Nâng cao'],
];
const levelName = (lv) => LEVELS.find((l) => l[0] === lv)?.[1] ?? lv;
// Lựa chọn hiện tại, giữ nguyên khi quay lại từ trang làm bài / kết quả.
const nav = { mode: 'practice', grade: null, topic: null, level: null };

const ATTEMPT_COLS = 'id, quiz_id, deadline_at, submitted_at, score, max_score';
const QUIZ_COLS = 'id, title, description, time_limit_min, opens_at, due_at, show_key_after, question_count, class_id, grade, topic, level, sort_order';

async function loadAttempts(student) {
  let { data: attempts } = await sb.from('quiz_attempts').select(ATTEMPT_COLS).eq('student_id', student.id);
  // Bài đã hết giờ mà chưa bấm nộp → chốt bằng câu trả lời đã lưu.
  const expired = (attempts || []).filter((a) => !a.submitted_at && a.deadline_at && new Date(a.deadline_at) < new Date());
  if (expired.length) {
    await Promise.all(expired.map((a) => sb.rpc('submit_quiz', { p_attempt: a.id, p_answers: null })));
    ({ data: attempts } = await sb.from('quiz_attempts').select(ATTEMPT_COLS).eq('student_id', student.id));
  }
  return new Map((attempts || []).map((a) => [a.quiz_id, a]));
}

export async function renderQuizList(box, student) {
  stopTaking();
  if (readOnly) return renderChildAttempts(box, student);
  const body = el('div', {}, el('p', { class: 'muted', text: 'Đang tải…' }));
  const switcher = el('div', { class: 'child-switch' },
    [['practice', 'Luyện đề theo chuyên đề'], ['assigned', 'Bài giáo viên giao']].map(([m, label]) =>
      el('button', { class: `btn btn-sm ${nav.mode === m ? 'btn-navy' : 'btn-outline'}`, text: label,
        onclick: () => { nav.mode = m; renderQuizList(box, student); } })));
  box.replaceChildren(switcher, body);
  if (nav.mode === 'assigned') return renderAssigned(body, box, student);
  return renderPractice(body, box, student);
}

function quizItem(box, student, z, a) {
  const now = new Date();
  const nq = z.question_count ?? 0;
  const info = [`${nq} câu`, z.time_limit_min ? `${z.time_limit_min} phút` : 'Không giới hạn thời gian',
    z.due_at ? `Hạn nộp: ${fmtDeadline(z.due_at)}` : null].filter(Boolean).join(' · ');
  let right;
  if (a?.submitted_at) {
    right = el('div', { class: 'quiz-status' },
      el('div', { class: 'score' }, el('b', { text: fmtNum(a.score) }), el('span', { text: ` / ${fmtNum(a.max_score)}` })),
      el('button', { class: 'btn btn-outline btn-sm', text: 'Xem kết quả & lời giải', onclick: () => showResult(box, student, z, a.id) }));
  } else if (a) {
    right = el('button', { class: 'btn btn-gold', text: 'Làm tiếp', onclick: () => begin(box, student, z) });
  } else if (z.opens_at && new Date(z.opens_at) > now) {
    right = el('span', { class: 'badge warn', text: `Mở lúc ${fmtDeadline(z.opens_at)}` });
  } else if (z.due_at && new Date(z.due_at) <= now) {
    right = el('span', { class: 'badge warn', text: 'Đã hết hạn' });
  } else {
    right = el('button', { class: 'btn btn-gold', text: 'Bắt đầu làm bài', onclick: () => confirmStart(box, student, z, nq) });
  }
  return el('div', { class: 'item' },
    el('div', { class: 'meta' }, el('b', { text: z.title }), el('span', { class: 'muted small', text: info }),
      a && !a.submitted_at ? el('span', { class: 'badge', text: 'Đang làm dở' }) : null),
    right);
}

// Phụ huynh: danh sách bài trực tuyến con đã làm.
const LEVEL_NAME = { tb: 'Mức độ 1', kha: 'Mức độ 2', gioi: 'Mức độ 3' };
async function renderChildAttempts(box, student) {
  box.replaceChildren(el('p', { class: 'muted', text: 'Đang tải…' }));
  const { data: attempts, error } = await sb.from('quiz_attempts')
    .select('id, quiz_id, submitted_at, score, max_score, started_at, quizzes(id, title, class_id, grade, topic, level, due_at, show_key_after)')
    .eq('student_id', student.id).order('started_at', { ascending: false });
  if (error) { box.replaceChildren(el('p', { class: 'error-text', text: errMsg(error) })); return; }
  const done = (attempts || []).filter((a) => a.submitted_at && a.quizzes);
  if (!done.length) {
    box.replaceChildren(el('div', { class: 'panel empty' },
      el('h2', { text: 'Con chưa nộp bài trực tuyến nào' }),
      el('p', { class: 'muted', text: 'Khi con làm và nộp bài luyện tập hoặc bài giáo viên giao, điểm và lời giải sẽ hiện ở đây.' })));
    return;
  }
  const on10 = done.map((a) => (Number(a.score) / Number(a.max_score || 1)) * 10);
  const avg = on10.reduce((x, y) => x + y, 0) / on10.length;
  box.replaceChildren(
    el('div', { class: 'stats' },
      el('div', { class: 'stat' }, el('div', { class: 'k', text: 'Số bài đã nộp' }), el('div', { class: 'v', text: String(done.length) })),
      el('div', { class: 'stat' }, el('div', { class: 'k', text: 'Điểm trung bình (thang 10)' }), el('div', { class: 'v', text: fmtNum(Math.round(avg * 10) / 10) }))),
    el('div', { class: 'list section-gap' }, done.map((a) => {
      const z = a.quizzes;
      const kind = z.class_id ? 'Bài giáo viên giao' : `Luyện tập · Toán ${z.grade} · ${z.topic} · ${LEVEL_NAME[z.level] ?? ''}`;
      return el('div', { class: 'item' },
        el('div', { class: 'meta' }, el('b', { text: z.title }),
          el('span', { class: 'muted small', text: `${kind} · Nộp lúc ${fmtDateTime(a.submitted_at)}` })),
        el('div', { class: 'quiz-status' },
          el('div', { class: 'score' }, el('b', { text: fmtNum(a.score) }), el('span', { text: ` / ${fmtNum(a.max_score)}` })),
          el('button', { class: 'btn btn-outline btn-sm', text: 'Xem bài làm & lời giải', onclick: () => showResult(box, student, z, a.id) })));
    })));
}

async function renderAssigned(body, box, student) {
  const [{ data: quizzes, error }, byQuiz] = await Promise.all([
    sb.from('quizzes').select(QUIZ_COLS).not('class_id', 'is', null).order('created_at', { ascending: false }),
    loadAttempts(student),
  ]);
  if (error) { body.replaceChildren(el('p', { class: 'error-text', text: errMsg(error) })); return; }
  if (!quizzes.length) {
    body.replaceChildren(el('div', { class: 'panel empty' },
      el('h2', { text: 'Chưa có bài giáo viên giao' }),
      el('p', { class: 'muted', text: 'Khi giáo viên giao bài cho lớp, bài sẽ hiện ở đây. Trong lúc chờ, em hãy luyện đề theo chuyên đề nhé!' })));
    return;
  }
  body.replaceChildren(el('div', { class: 'list' }, quizzes.map((z) => quizItem(box, student, z, byQuiz.get(z.id)))));
}

async function renderPractice(body, box, student) {
  // Bước 3: danh sách đề của một chuyên đề + mức độ
  if (nav.topic && nav.level) {
    const [{ data: quizzes, error }, byQuiz] = await Promise.all([
      sb.from('quizzes').select(QUIZ_COLS).is('class_id', null)
        .eq('grade', nav.grade).eq('topic', nav.topic).eq('level', nav.level)
        .order('sort_order').order('id'),
      loadAttempts(student),
    ]);
    if (error) { body.replaceChildren(el('p', { class: 'error-text', text: errMsg(error) })); return; }
    const done = quizzes.filter((z) => byQuiz.get(z.id)?.submitted_at).length;
    body.replaceChildren(
      el('button', { class: 'btn btn-outline btn-sm', text: '← Chọn chuyên đề khác', onclick: () => { nav.topic = null; nav.level = null; renderQuizList(box, student); } }),
      el('div', { class: 'panel section-gap' },
        el('p', { class: 'eyebrow dark', text: `Toán ${nav.grade} · ${levelName(nav.level)}` }),
        el('h2', { text: nav.topic }),
        el('div', { class: 'child-switch' }, LEVELS.map(([lv, name]) =>
          el('button', { class: `btn btn-sm ${nav.level === lv ? 'btn-navy' : 'btn-outline'}`, text: name,
            onclick: () => { nav.level = lv; renderQuizList(box, student); } }))),
        el('p', { class: 'muted small', text: `Đã làm ${done}/${quizzes.length} đề. Mỗi đề làm được 1 lần — nộp xong em xem ngay điểm và lời giải chi tiết.` })),
      quizzes.length
        ? el('div', { class: 'list section-gap' }, quizzes.map((z) => quizItem(box, student, z, byQuiz.get(z.id))))
        : el('p', { class: 'muted section-gap', text: 'Mức độ này chưa có đề.' }));
    return;
  }

  // Bước 1–2: chọn lớp, chọn chuyên đề và mức độ
  const { data: rows, error } = await sb.rpc('practice_topics');
  if (error) { body.replaceChildren(el('p', { class: 'error-text', text: errMsg(error) })); return; }
  if (!rows?.length) {
    body.replaceChildren(el('div', { class: 'panel empty' },
      el('h2', { text: 'Ngân hàng đề đang được chuẩn bị' }),
      el('p', { class: 'muted', text: 'Các đề luyện tập theo chuyên đề sẽ sớm có ở đây.' })));
    return;
  }
  // Học sinh chỉ thấy đề của khối lớp mình (lớp chưa gán khối thì thấy tất cả).
  const myGrade = student.classes?.grade != null ? Number(student.classes.grade) : null;
  const allGrades = [...new Set(rows.map((r) => Number(r.grade)))].sort((a, b) => a - b);
  const grades = myGrade != null ? allGrades.filter((g) => g === myGrade) : allGrades;
  if (!grades.length) {
    body.replaceChildren(el('div', { class: 'panel empty' },
      el('h2', { text: `Ngân hàng đề Toán ${myGrade} đang được chuẩn bị` }),
      el('p', { class: 'muted', text: 'Các đề luyện tập theo chuyên đề của khối lớp em sẽ sớm có ở đây.' })));
    return;
  }
  if (!grades.includes(nav.grade)) nav.grade = grades[0];
  const topics = new Map();
  rows.filter((r) => Number(r.grade) === nav.grade).forEach((r) => {
    if (!topics.has(r.topic)) topics.set(r.topic, {});
    topics.get(r.topic)[r.level] = r.quiz_count;
  });

  body.replaceChildren(
    el('div', { class: 'panel' },
      el('h2', { text: 'Luyện đề theo chuyên đề' }),
      el('p', { class: 'muted', text: `${grades.length > 1 ? 'Chọn khối lớp, chuyên đề' : `Đề Toán ${nav.grade} — chọn chuyên đề`} và mức độ phù hợp với em. Mỗi đề 45 phút, thang điểm 10.` }),
      grades.length < 2 ? null : el('div', { class: 'child-switch' }, grades.map((g) =>
        el('button', { class: `btn btn-sm ${g === nav.grade ? 'btn-navy' : 'btn-outline'}`, text: `Toán ${g}`,
          onclick: () => { nav.grade = g; renderQuizList(box, student); } })))),
    el('div', { class: 'topic-grid section-gap' }, [...topics.entries()].map(([topic, counts]) =>
      el('article', { class: 'topic-card' },
        el('h3', { text: topic }),
        el('div', { class: 'level-btns' }, LEVELS.map(([lv, name, hint]) => {
          const n = counts[lv] ?? 0;
          return el('button', { class: `level-btn lv-${lv}`, disabled: !n, title: hint,
            onclick: () => { nav.topic = topic; nav.level = lv; renderQuizList(box, student); } },
            el('b', { text: name }), el('small', { text: hint }), el('span', { text: n ? `${n} đề` : 'Chưa có' }));
        }))))));
}

function confirmStart(box, student, z, nq) {
  const go = el('button', { class: 'btn btn-gold', text: 'Bắt đầu' });
  const dlg = openDialog(z.title, el('div', { class: 'form-grid' },
    z.description ? rich(z.description) : null,
    el('ul', { class: 'rules' },
      el('li', { text: `Đề gồm ${nq} câu.` }),
      el('li', { text: z.time_limit_min ? `Thời gian: ${z.time_limit_min} phút. Đồng hồ bắt đầu chạy ngay khi bấm "Bắt đầu" và không dừng lại kể cả khi em thoát ra.` : 'Không giới hạn thời gian.' }),
      z.due_at ? el('li', { text: `Hạn nộp: ${fmtDeadline(z.due_at)}.` }) : null,
      el('li', { text: 'Em chỉ được làm 1 lần. Hết giờ, bài sẽ tự nộp.' }),
      el('li', { text: 'Câu trả lời được lưu tự động — lỡ mất mạng hay tắt máy, em mở lại và bấm "Làm tiếp".' })),
    go));
  go.addEventListener('click', () => { dlg.close(); begin(box, student, z); });
}

// =====================================================================
// Làm bài
// =====================================================================
async function begin(box, student, z) {
  const { data: st, error } = await sb.rpc('start_quiz', { p_quiz: z.id });
  if (error) { toast(errMsg(error), 'error'); return; }
  if (st.submitted) { showResult(box, student, z, st.attempt_id); return; }
  const { data: questions, error: qe } = await sb.from('quiz_questions')
    .select('id, position, kind, prompt, image_path, options, points').eq('quiz_id', z.id).order('position').order('id');
  if (qe) { toast(errMsg(qe), 'error'); return; }
  const urls = await imageUrls(questions.map((q) => q.image_path));

  const localKey = `tdm-quiz-${st.attempt_id}`;
  let local = {};
  try { local = JSON.parse(localStorage.getItem(localKey) || '{}'); } catch { /* bỏ qua */ }
  const answers = { ...(st.answers || {}), ...local };
  const deadline = st.deadline_at ? new Date(st.deadline_at) : null;

  // --- Thanh trên cùng: giờ, tiến độ, nộp ---
  const clock = el('span', { class: 'clock', 'aria-live': 'off' });
  const progress = el('span', { class: 'progress' });
  const saved = el('span', { class: 'saved muted small', 'aria-live': 'polite' });
  const submitBtn = el('button', { class: 'btn btn-gold btn-sm', text: 'Nộp bài' });
  const pdfBtn = el('button', { class: 'btn btn-outline btn-sm', text: 'Tải đề (PDF)', title: 'Tải đề về máy để in ra giấy',
    onclick: (e) => downloadQuizPdf(z, questions, urls, { button: e.currentTarget }) });
  const bar = el('div', { class: 'quiz-bar' }, el('b', { class: 'quiz-title', text: z.title }), progress, saved, clock, pdfBtn, submitBtn);

  const nav = el('div', { class: 'q-nav', 'aria-label': 'Chuyển nhanh đến câu' });
  const updateProgress = () => {
    const n = questions.filter((q) => isAnswered(q, answers[q.id])).length;
    progress.textContent = `Đã làm ${n}/${questions.length}`;
    nav.replaceChildren(...questions.map((q, i) => el('a', {
      href: `#q-${q.id}`, class: isAnswered(q, answers[q.id]) ? 'done' : '', text: String(i + 1),
      'aria-label': `Câu ${i + 1}${isAnswered(q, answers[q.id]) ? ' (đã làm)' : ''}`,
    })));
  };

  let saveTimer = null;
  let submitting = false;
  const persist = () => {
    try { localStorage.setItem(localKey, JSON.stringify(answers)); } catch { /* bỏ qua */ }
    updateProgress();
    clearTimeout(saveTimer);
    saved.textContent = 'Đang lưu…';
    saveTimer = setTimeout(async () => {
      const { error: se } = await sb.rpc('save_quiz_answers', { p_attempt: st.attempt_id, p_answers: answers });
      if (se) {
        if (/hết giờ|đã nộp/i.test(se.message)) { doSubmit(true); return; }
        saved.textContent = 'Chưa lưu được — kiểm tra mạng';
      } else saved.textContent = 'Đã lưu ✓';
    }, 800);
  };

  const cards = questions.map((q, i) => questionInput(q, i, answers, urls, persist));

  async function doSubmit(auto = false) {
    if (submitting) return;
    if (!auto) {
      const left = questions.filter((q) => !isAnswered(q, answers[q.id])).length;
      const msg = left ? `Em còn ${left} câu chưa làm. Vẫn nộp bài?` : 'Nộp bài? Sau khi nộp em không sửa được nữa.';
      if (!await askConfirm(msg)) return;
    }
    submitting = true;
    submitBtn.disabled = true; submitBtn.textContent = 'Đang nộp…';
    clearTimeout(saveTimer);
    const { error: se } = await sb.rpc('submit_quiz', { p_attempt: st.attempt_id, p_answers: answers });
    if (se) {
      submitting = false; submitBtn.disabled = false; submitBtn.textContent = 'Nộp bài';
      toast(`Chưa nộp được: ${errMsg(se)}. Em thử bấm Nộp bài lần nữa.`, 'error');
      return;
    }
    try { localStorage.removeItem(localKey); } catch { /* bỏ qua */ }
    stopTaking();
    if (auto) toast('Đã hết giờ — bài của em đã được nộp tự động.');
    showResult(box, student, z, st.attempt_id);
  }
  submitBtn.addEventListener('click', () => doSubmit(false));

  // --- Đồng hồ ---
  stopTaking();
  const tick = () => {
    if (!deadline) { clock.textContent = ''; return; }
    const ms = deadline - Date.now();
    if (ms <= 0) { clock.textContent = '00:00'; doSubmit(true); return; }
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    clock.textContent = `⏱ ${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    clock.classList.toggle('low', ms < 5 * 60000);
  };
  tick();
  if (deadline) timer = setInterval(tick, 1000);
  leaveGuard = (e) => { e.preventDefault(); e.returnValue = ''; };
  window.addEventListener('beforeunload', leaveGuard);

  updateProgress();
  box.replaceChildren(
    bar,
    el('div', { class: 'quiz-take' },
      z.description ? el('div', { class: 'panel' }, rich(z.description)) : null,
      nav,
      ...cards,
      el('div', { class: 'quiz-end' },
        el('button', { class: 'btn btn-gold', text: 'Nộp bài', onclick: () => doSubmit(false) }))));
  window.scrollTo({ top: 0 });
}

function questionInput(q, i, answers, urls, onChange) {
  const name = `q${q.id}`;
  let input;
  if (q.kind === 'mcq') {
    input = el('div', { class: 'opts', role: 'radiogroup', 'aria-label': `Câu ${i + 1}` }, q.options.map((o, k) => {
      const r = el('input', { type: 'radio', name, value: String(k), checked: answers[q.id] === k,
        onchange: () => { answers[q.id] = k; onChange(); } });
      return el('label', { class: 'opt choice' }, r, el('b', { text: `${LETTERS[k]}.` }), rich(o, 'rich inline'));
    }));
  } else if (q.kind === 'tf') {
    const cur = Array.isArray(answers[q.id]) ? answers[q.id] : [null, null, null, null];
    input = el('table', { class: 'tf-table' },
      el('thead', {}, el('tr', {}, el('th', { text: 'Ý' }), el('th', { text: 'Nội dung' }), el('th', { text: 'Đúng' }), el('th', { text: 'Sai' }))),
      el('tbody', {}, q.options.map((o, k) => {
        const set = (v) => { const arr = Array.isArray(answers[q.id]) ? [...answers[q.id]] : [null, null, null, null]; arr[k] = v; answers[q.id] = arr; onChange(); };
        return el('tr', {},
          el('td', { text: `${TF_LETTERS[k]})` }), el('td', {}, rich(o, 'rich inline')),
          el('td', {}, el('input', { type: 'radio', name: `${name}-${k}`, checked: cur[k] === true, 'aria-label': `Ý ${TF_LETTERS[k]} đúng`, onchange: () => set(true) })),
          el('td', {}, el('input', { type: 'radio', name: `${name}-${k}`, checked: cur[k] === false, 'aria-label': `Ý ${TF_LETTERS[k]} sai`, onchange: () => set(false) })));
      })));
  } else {
    const inp = el('input', { class: 'short-input', inputmode: 'text', enterkeyhint: 'done', autocomplete: 'off', placeholder: 'Nhập đáp số', 'aria-label': `Đáp số câu ${i + 1}` });
    inp.value = typeof answers[q.id] === 'string' ? answers[q.id] : '';
    inp.addEventListener('input', () => {
      // Một số bàn phím gõ dấu trừ dạng "−" / "–" / "—": đổi về "-" để máy chấm nhận đúng.
      const v = inp.value.replace(/[−‒–—﹣－]/g, '-');
      if (v !== inp.value) { const p = inp.selectionStart; inp.value = v; inp.setSelectionRange(p, p); }
      answers[q.id] = v; onChange();
    });
    input = el('div', {}, inp, el('p', { class: 'muted small', text: 'Ghi đáp số dạng số, ví dụ 1,5 hoặc -2.' }));
  }
  return el('article', { class: 'q-card', id: `q-${q.id}` },
    el('div', { class: 'q-head' },
      el('span', { class: 'q-num', text: `Câu ${i + 1}` }),
      el('span', { class: 'q-kind', text: KIND_LABEL[q.kind] }),
      el('span', { class: 'q-pts', text: `${fmtNum(q.points)} điểm` })),
    rich(q.prompt), qImage(q.image_path, urls, `Hình câu ${i + 1}`), input);
}

// =====================================================================
// Kết quả & lời giải
// =====================================================================
async function showResult(box, student, z, attemptId) {
  stopTaking();
  box.replaceChildren(el('p', { class: 'muted', text: 'Đang tải kết quả…' }));
  const [{ data: a, error }, { data: questions }] = await Promise.all([
    sb.from('quiz_attempts').select('*').eq('id', attemptId).single(),
    sb.from('quiz_questions').select('*').eq('quiz_id', z.id).order('position').order('id'),
  ]);
  if (error) { box.replaceChildren(el('p', { class: 'error-text', text: errMsg(error) })); return; }
  const { data: keys } = await sb.from('quiz_keys').select('*').in('question_id', questions.map((q) => q.id));
  const keyMap = new Map((keys || []).map((k) => [k.question_id, k]));
  const urls = await imageUrls([...questions.map((q) => q.image_path), ...(keys || []).map((k) => k.explanation_image_path)]);
  const on10 = a.max_score ? (Number(a.score) / Number(a.max_score)) * 10 : 0;
  const full = questions.filter((q) => Number(a.detail?.[q.id] ?? 0) >= Number(q.points)).length;

  box.replaceChildren(
    el('div', { class: 'row', style: 'margin-bottom:16px' },
      el('button', { class: 'btn btn-outline btn-sm', text: '← Danh sách bài', onclick: () => renderQuizList(box, student) }),
      el('button', { class: 'btn btn-navy btn-sm', text: 'Tải đề (PDF)',
        onclick: (e) => downloadQuizPdf(z, questions, urls, { button: e.currentTarget }) })),
    el('div', { class: 'panel result-hero' },
      el('p', { class: 'eyebrow dark', text: 'Kết quả bài làm' }),
      el('h2', { text: z.title }),
      el('div', { class: 'big-score' }, el('b', { text: fmtNum(a.score) }), el('span', { text: ` / ${fmtNum(a.max_score)} điểm` })),
      el('p', { class: 'muted', text: `Quy về thang 10: ${fmtNum(Math.round(on10 * 100) / 100)} · Đúng hoàn toàn ${full}/${questions.length} câu · Nộp lúc ${fmtDateTime(a.submitted_at)}` })),
    keys?.length
      ? el('div', { class: 'quiz-take' },
          el('h3', { class: 'section-gap', text: 'Đáp án chi tiết' }),
          questions.map((q, i) => reviewQuestion(q, i, a.answers?.[q.id], keyMap.get(q.id), a.detail?.[q.id], urls)))
      : el('div', { class: 'panel empty section-gap' },
          el('p', { text: z.due_at
            ? `Đáp án và lời giải sẽ hiện sau hạn chót (${fmtDeadline(z.due_at)}).`
            : 'Đáp án và lời giải sẽ hiện sau khi giáo viên mở.' })));
  window.scrollTo({ top: 0 });
}
