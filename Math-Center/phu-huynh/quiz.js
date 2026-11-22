// Trang học sinh — làm bài trực tuyến, xem điểm và lời giải.
import { sb, el, fmtNum, toast, errMsg, openDialog, fmtDateTime } from '../portal/common.js';
import {
  rich, imageUrls, qImage, KIND_LABEL, LETTERS, TF_LETTERS, reviewQuestion, isAnswered, fmtDeadline,
} from '../portal/quiz-common.js';

let timer = null;
let leaveGuard = null;
function stopTaking() {
  if (timer) { clearInterval(timer); timer = null; }
  if (leaveGuard) { window.removeEventListener('beforeunload', leaveGuard); leaveGuard = null; }
}

// =====================================================================
// Danh sách bài
// =====================================================================
export async function renderQuizList(box, student) {
  stopTaking();
  box.replaceChildren(el('p', { class: 'muted', text: 'Đang tải…' }));
  let [{ data: quizzes, error }, { data: attempts }] = await Promise.all([
    sb.from('quizzes').select('id, title, description, time_limit_min, opens_at, due_at, show_key_after, quiz_questions(count)')
      .order('created_at', { ascending: false }),
    sb.from('quiz_attempts').select('id, quiz_id, deadline_at, submitted_at, score, max_score').eq('student_id', student.id),
  ]);
  if (error) { box.replaceChildren(el('p', { class: 'error-text', text: errMsg(error) })); return; }

  // Bài đã hết giờ mà chưa bấm nộp → chốt bằng câu trả lời đã lưu.
  const expired = (attempts || []).filter((a) => !a.submitted_at && a.deadline_at && new Date(a.deadline_at) < new Date());
  if (expired.length) {
    await Promise.all(expired.map((a) => sb.rpc('submit_quiz', { p_attempt: a.id, p_answers: null })));
    ({ data: attempts } = await sb.from('quiz_attempts')
      .select('id, quiz_id, deadline_at, submitted_at, score, max_score').eq('student_id', student.id));
  }

  if (!quizzes.length) {
    box.replaceChildren(el('div', { class: 'panel empty' },
      el('h2', { text: 'Chưa có bài tập trực tuyến' }),
      el('p', { class: 'muted', text: 'Khi giáo viên giao bài, bài sẽ hiện ở đây.' })));
    return;
  }
  const byQuiz = new Map((attempts || []).map((a) => [a.quiz_id, a]));
  const now = new Date();
  box.replaceChildren(...quizzes.map((z) => {
    const a = byQuiz.get(z.id);
    const nq = z.quiz_questions?.[0]?.count ?? 0;
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
  }));
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
  const bar = el('div', { class: 'quiz-bar' }, el('b', { class: 'quiz-title', text: z.title }), progress, saved, clock, submitBtn);

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
      if (!confirm(msg)) return;
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
    const inp = el('input', { class: 'short-input', inputmode: 'decimal', autocomplete: 'off', placeholder: 'Nhập đáp số', 'aria-label': `Đáp số câu ${i + 1}` });
    inp.value = typeof answers[q.id] === 'string' ? answers[q.id] : '';
    inp.addEventListener('input', () => { answers[q.id] = inp.value; onChange(); });
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
      el('button', { class: 'btn btn-outline btn-sm', text: '← Danh sách bài', onclick: () => renderQuizList(box, student) })),
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
