// Trang giáo viên — Bài tập trực tuyến: soạn đề, giao bài, xem kết quả.
import { sb, el, fmtNum, toast, errMsg, openDialog, uploadTo, BUCKET, fmtDateTime, askConfirm } from '../portal/common.js?v=20261124g';
import {
  rich, imageUrls, qImage, KIND_LABEL, DEFAULT_POINTS, LETTERS, TF_LETTERS, reviewQuestion, fmtDeadline,
} from '../portal/quiz-common.js?v=20261201a';
import { downloadQuizPdf } from '../portal/pdf-export.js?v=20261201a';

let ctx; // { state, classSelect, rerender }
let opts = {}; // { bank: true, back } khi mở từ Ngân hàng đề

export function renderQuizTab(view, context) {
  ctx = context;
  opts = {};
  if (ctx.state.quizId) return renderEditor(view, ctx.state.quizId);
  if (ctx.state.quizResultsId) return renderResults(view, ctx.state.quizResultsId);
  return renderList(view);
}

const go = (patch) => { Object.assign(ctx.state, { quizId: null, quizResultsId: null }, patch); ctx.rerender(); };
const back = () => (opts.back ? opts.back() : go({}));
const isAdmin = () => ctx.state.profile?.role === 'admin';

// Mở trình soạn đề từ thẻ khác (Ngân hàng đề).
export function renderQuizEditor(view, quizId, context, options = {}) {
  ctx = context;
  opts = options;
  return renderEditor(view, quizId);
}

// ---------- Ngày giờ ----------
const toLocalInput = (ts) => {
  if (!ts) return '';
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const fromLocalInput = (v) => (v ? new Date(v).toISOString() : null);

// =====================================================================
// Danh sách đề
// =====================================================================
async function renderList(view) {
  const box = el('div', { class: 'list section-gap' }, el('p', { class: 'muted', text: 'Đang tải…' }));
  view.append(
    el('div', { class: 'panel' }, el('div', { class: 'row' },
      ctx.classSelect(() => ctx.rerender()),
      el('button', { class: 'btn btn-gold', text: '+ Đề mới', onclick: () => createQuiz() }))),
    box);

  const [{ data: quizzes, error }, { data: students }] = await Promise.all([
    sb.from('quizzes').select('id, title, published, time_limit_min, opens_at, due_at, quiz_questions(count), quiz_attempts(submitted_at)')
      .eq('class_id', ctx.state.classId).order('created_at', { ascending: false }),
    sb.from('students').select('id').eq('class_id', ctx.state.classId),
  ]);
  if (error) { box.replaceChildren(el('p', { class: 'error-text', text: errMsg(error) })); return; }
  if (!quizzes.length) {
    box.replaceChildren(el('div', { class: 'panel empty' },
      el('h3', { text: 'Lớp này chưa có đề trực tuyến nào' }),
      el('p', { class: 'muted', text: 'Bấm "+ Đề mới" để soạn đề cho học sinh làm trên website.' })));
    return;
  }
  const total = students?.length ?? 0;
  box.replaceChildren(...quizzes.map((z) => {
    const nq = z.quiz_questions?.[0]?.count ?? 0;
    const done = (z.quiz_attempts || []).filter((a) => a.submitted_at).length;
    const meta = [
      `${nq} câu`,
      z.time_limit_min ? `${z.time_limit_min} phút` : 'Không giới hạn giờ',
      z.due_at ? `Hạn: ${fmtDeadline(z.due_at)}` : null,
      `Đã nộp ${done}/${total}`,
    ].filter(Boolean).join(' · ');
    return el('div', { class: 'item' },
      el('div', { class: 'meta' },
        el('b', { text: z.title }),
        el('span', { class: 'muted small' },
          z.published ? el('span', { class: 'badge', text: 'Đã giao' }) : el('span', { class: 'badge warn', text: 'Nháp' }),
          ' ', meta)),
      el('div', { class: 'acts' },
        el('button', { class: 'btn btn-navy btn-sm', text: 'Soạn đề', onclick: () => go({ quizId: z.id }) }),
        el('button', { class: 'btn btn-outline btn-sm', text: 'Kết quả', onclick: () => go({ quizResultsId: z.id }) }),
        el('button', { class: 'btn btn-outline btn-sm', text: z.published ? 'Thu hồi' : 'Giao bài', onclick: () => togglePublish(z, nq) })));
  }));
}

async function createQuiz() {
  const { data, error } = await sb.from('quizzes')
    .insert({ class_id: ctx.state.classId, title: 'Đề mới', time_limit_min: 45 }).select('id').single();
  if (error) { toast(errMsg(error), 'error'); return; }
  go({ quizId: data.id });
}

async function togglePublish(z, nq) {
  if (!z.published) {
    if (!nq) { toast('Đề chưa có câu hỏi nào.', 'error'); return; }
    if (!await askConfirm(`Giao bài "${z.title}" cho học sinh? Học sinh sẽ thấy và làm được ngay.`)) return;
  } else if (!await askConfirm(`Thu hồi bài "${z.title}"? Học sinh chưa bắt đầu sẽ không thấy bài nữa. Bài đã làm vẫn được giữ.`)) return;
  const { error } = await sb.from('quizzes').update({ published: !z.published }).eq('id', z.id);
  if (error) { toast(errMsg(error), 'error'); return; }
  toast(z.published ? 'Đã thu hồi.' : 'Đã giao bài cho học sinh.');
  ctx.rerender();
}

// =====================================================================
// Soạn đề
// =====================================================================
async function renderEditor(view, quizId) {
  const [{ data: z, error }, { data: questions }, { data: keys }, { data: attempts }] = await Promise.all([
    sb.from('quizzes').select('*').eq('id', quizId).single(),
    sb.from('quiz_questions').select('*').eq('quiz_id', quizId).order('position').order('id'),
    sb.from('quiz_keys').select('*, quiz_questions!inner(quiz_id)').eq('quiz_questions.quiz_id', quizId),
    sb.from('quiz_attempts').select('id, submitted_at').eq('quiz_id', quizId),
  ]);
  if (error) { view.append(el('p', { class: 'error-text', text: errMsg(error) })); return; }
  const keyMap = new Map((keys || []).map((k) => [k.question_id, k]));
  const urls = await imageUrls([
    ...questions.map((q) => q.image_path),
    ...(keys || []).map((k) => k.explanation_image_path),
  ]);
  const submitted = (attempts || []).filter((a) => a.submitted_at).length;
  const bank = z.class_id == null;
  // Đề luyện tập đã có bài làm: không thêm/xóa câu (máy chủ cũng chặn), chỉ sửa nội dung, đáp án.
  const locked = bank && (attempts || []).length > 0;
  const canDelete = !bank || isAdmin();
  const afterSave = bank && submitted ? async () => {
    const { data: n, error: e3 } = await sb.rpc('regrade_quiz', { p_quiz: quizId });
    if (e3) toast(errMsg(e3), 'error'); else toast(`Đã lưu và chấm lại ${n} bài đã nộp.`);
  } : null;
  const totalPts = questions.reduce((s, q) => s + Number(q.points), 0);

  // --- Cài đặt đề ---
  const f = el('form', { class: 'form-grid' },
    el('label', {}, 'Tên đề', el('input', { name: 'title', required: true, value: z.title })),
    el('label', {}, 'Hướng dẫn cho học sinh (không bắt buộc)', el('textarea', { name: 'desc', rows: 2 })),
    el('div', { class: 'row' },
      el('label', { class: 'field' }, 'Thời gian làm bài (phút, để trống = không giới hạn)',
        el('input', { name: 'limit', type: 'number', min: '1', max: '600', value: z.time_limit_min ?? '' })),
      bank ? null : el('label', { class: 'field' }, 'Mở từ (không bắt buộc)',
        el('input', { name: 'opens', type: 'datetime-local', value: toLocalInput(z.opens_at) })),
      bank ? null : el('label', { class: 'field' }, 'Hạn chót nộp (không bắt buộc)',
        el('input', { name: 'due', type: 'datetime-local', value: toLocalInput(z.due_at) }))),
    bank ? null : el('label', {}, 'Hiện đáp án & lời giải cho học sinh',
      el('select', { name: 'showkey' },
        el('option', { value: 'submit', selected: z.show_key_after === 'submit', text: 'Ngay sau khi học sinh nộp bài' }),
        el('option', { value: 'due', selected: z.show_key_after === 'due', text: 'Sau hạn chót (tránh học sinh chia sẻ đáp án cho bạn chưa làm)' }))),
    el('div', { class: 'row' }, el('button', { class: 'btn btn-gold', type: 'submit', text: 'Lưu cài đặt' })));
  f.desc.value = z.description || '';
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const lim = f.limit.value.trim() === '' ? null : Number(f.limit.value);
    if (lim != null && !(Number.isInteger(lim) && lim >= 1 && lim <= 600)) { toast('Thời gian làm bài phải từ 1 đến 600 phút.', 'error'); return; }
    const row = bank
      ? { title: f.title.value.trim() || 'Đề chưa đặt tên', description: f.desc.value.trim() || null, time_limit_min: lim }
      : {
        title: f.title.value.trim() || 'Đề chưa đặt tên', description: f.desc.value.trim() || null,
        time_limit_min: lim, opens_at: fromLocalInput(f.opens.value), due_at: fromLocalInput(f.due.value),
        show_key_after: f.showkey.value,
      };
    if (row.opens_at && row.due_at && row.opens_at >= row.due_at) { toast('Giờ mở phải trước hạn chót.', 'error'); return; }
    const { data: saved, error: e2 } = await sb.from('quizzes').update(row).eq('id', quizId).select('id');
    if (e2) { toast(errMsg(e2), 'error'); return; }
    if (!saved?.length) { toast('Bạn không có quyền sửa đề này.', 'error'); return; }
    toast('Đã lưu cài đặt.');
    ctx.rerender();
  });

  const warn = submitted ? el('div', { class: 'notice' },
    el('span', { text: bank
      ? `Đã có ${submitted} bài nộp. Khi lưu câu hỏi, điểm các bài đã nộp được chấm lại tự động. Không thêm hoặc xóa câu được để giữ đúng điểm các bài cũ.`
      : `Đã có ${submitted} học sinh nộp bài. Nếu sửa đáp án hoặc điểm, hãy bấm "Chấm lại" để cập nhật điểm.` }),
    el('button', { class: 'btn btn-navy btn-sm', text: 'Chấm lại', onclick: async () => {
      const { data: n, error: e3 } = await sb.rpc('regrade_quiz', { p_quiz: quizId });
      if (e3) { toast(errMsg(e3), 'error'); return; }
      toast(`Đã chấm lại ${n} bài.`);
    } })) : null;

  const qList = el('div', { class: 'list' }, questions.length
    ? questions.map((q, i) => editorCard(q, i, keyMap.get(q.id), urls, questions, quizId, { canDelete: canDelete && !locked, afterSave }))
    : [el('p', { class: 'muted', text: 'Chưa có câu hỏi. Thêm câu bằng các nút bên dưới.' })]);

  const adders = locked ? null : el('div', { class: 'row adders' },
    ['mcq', 'tf', 'short'].map((k) => el('button', { class: 'btn btn-outline', text: `+ ${KIND_LABEL[k]}`,
      onclick: () => questionDialog(quizId, { kind: k, position: (questions.at(-1)?.position ?? 0) + 1 }, null) })));

  view.append(
    el('div', { class: 'row', style: 'margin-bottom:16px' },
      el('button', { class: 'btn btn-outline btn-sm', text: bank ? '← Ngân hàng đề' : '← Danh sách đề', onclick: back }),
      el('button', { class: 'btn btn-outline btn-sm', text: 'Xem như học sinh', onclick: () => previewAsStudent(z, questions, urls) }),
      el('button', { class: 'btn btn-navy btn-sm', text: 'Tải đề (PDF)',
        onclick: (e) => downloadQuizPdf(z, questions, urls, { button: e.currentTarget }) }),
      el('button', { class: 'btn btn-gold btn-sm', text: 'Tải đáp án (PDF)',
        onclick: (e) => downloadQuizPdf(z, questions, urls, { keyMap, withKey: true, button: e.currentTarget }) }),
      canDelete ? el('button', { class: 'btn btn-danger btn-sm', text: 'Xóa đề', disabled: locked,
        title: locked ? 'Đề đã có học sinh làm nên không xóa được' : 'Xóa đề',
        onclick: () => deleteQuiz(z, back) }) : null),
    el('div', { class: 'panel' },
      el('div', { class: 'assess-head' },
        el('h2', { text: z.title }),
        bank
          ? (z.published ? el('span', { class: 'badge', text: 'Học sinh đang luyện' }) : el('span', { class: 'badge warn', text: 'Đang ẩn' }))
          : (z.published ? el('span', { class: 'badge', text: 'Đã giao' }) : el('span', { class: 'badge warn', text: 'Nháp — học sinh chưa thấy' }))),
      bank ? el('p', { class: 'muted small', text: `Toán ${z.grade} · ${z.topic} · ${({ tb: 'Mức độ 1', kha: 'Mức độ 2', gioi: 'Mức độ 3' })[z.level] ?? z.level}` }) : null,
      f),
    ...(warn ? [warn] : []),
    el('div', { class: 'assess-head section-gap' },
      el('h3', { text: `Câu hỏi (${questions.length} câu · tổng ${fmtNum(totalPts)} điểm)` })),
    qList,
    ...(adders ? [adders] : [el('p', { class: 'muted small', text: 'Đề đã có học sinh làm nên không thêm câu được.' })]),
    el('p', { class: 'muted small', text: 'Mẹo: gõ công thức giữa hai dấu $, ví dụ $x^2 - 5x + 6 = 0$ hoặc $\\frac{1}{2}$, $\\sqrt{3}$. Công thức đứng riêng một dòng: $$...$$.' }));
}

function editorCard(q, i, key, urls, all, quizId, { canDelete = true, afterSave = null } = {}) {
  const move = async (dir) => {
    const j = i + dir;
    if (j < 0 || j >= all.length) return;
    const other = all[j];
    const a = await sb.from('quiz_questions').update({ position: j }).eq('id', q.id);
    const b = await sb.from('quiz_questions').update({ position: i }).eq('id', other.id);
    if (a.error || b.error) { toast(errMsg(a.error || b.error), 'error'); return; }
    // Chuẩn hóa vị trí cho các câu còn lại
    await Promise.all(all.map((x, k) => (x.id === q.id || x.id === other.id) ? null
      : sb.from('quiz_questions').update({ position: k }).eq('id', x.id)));
    ctx.rerender();
  };
  let answerView;
  if (!key) answerView = el('p', { class: 'error-text small', text: 'Chưa có đáp án!' });
  else if (q.kind === 'mcq') answerView = el('p', { class: 'small' }, 'Đáp án: ', el('b', { text: LETTERS[key.answer] }));
  else if (q.kind === 'tf') answerView = el('p', { class: 'small' }, 'Đáp án: ',
    el('b', { text: key.answer.map((v, k) => `${TF_LETTERS[k]}) ${v ? 'Đúng' : 'Sai'}`).join('   ') }));
  else answerView = el('p', { class: 'small' }, 'Đáp án chấp nhận: ', el('b', { text: key.answer.join('  |  ') }));

  return el('article', { class: 'q-card' },
    el('div', { class: 'q-head' },
      el('span', { class: 'q-num', text: `Câu ${i + 1}` }),
      el('span', { class: 'q-kind', text: KIND_LABEL[q.kind] }),
      el('span', { class: 'q-pts', text: `${fmtNum(q.points)} điểm` }),
      el('span', { class: 'q-tools' },
        el('button', { class: 'icon-btn', title: 'Lên', 'aria-label': 'Chuyển câu lên', disabled: i === 0, text: '↑', onclick: () => move(-1) }),
        el('button', { class: 'icon-btn', title: 'Xuống', 'aria-label': 'Chuyển câu xuống', disabled: i === all.length - 1, text: '↓', onclick: () => move(1) }),
        el('button', { class: 'btn btn-outline btn-sm', text: 'Sửa', onclick: () => questionDialog(quizId, q, key, afterSave) }),
        canDelete ? el('button', { class: 'btn btn-danger btn-sm', text: 'Xóa', onclick: async () => {
          if (!await askConfirm(`Xóa câu ${i + 1}? Không thể khôi phục.`)) return;
          const paths = [q.image_path, key?.explanation_image_path].filter(Boolean);
          if (paths.length) await sb.storage.from(BUCKET).remove(paths);
          const { data: gone, error } = await sb.from('quiz_questions').delete().eq('id', q.id).select('id');
          if (error) { toast(errMsg(error), 'error'); return; }
          if (!gone?.length) { toast('Bạn không có quyền xóa câu này.', 'error'); return; }
          ctx.rerender();
        } }) : null)),
    rich(q.prompt),
    qImage(q.image_path, urls, `Hình câu ${i + 1}`),
    q.kind === 'mcq' ? el('div', { class: 'opts' }, q.options.map((o, k) =>
      el('div', { class: `opt${key && key.answer === k ? ' correct' : ''}` }, el('b', { text: `${LETTERS[k]}.` }), rich(o, 'rich inline')))) : null,
    q.kind === 'tf' ? el('div', { class: 'opts' }, q.options.map((o, k) =>
      el('div', { class: 'opt' }, el('b', { text: `${TF_LETTERS[k]})` }), rich(o, 'rich inline')))) : null,
    answerView,
    key?.explanation || key?.explanation_image_path ? el('div', { class: 'explain' },
      el('span', { class: 'lbl', text: 'Lời giải' }), key.explanation ? rich(key.explanation) : null,
      qImage(key.explanation_image_path, urls, `Lời giải câu ${i + 1}`)) : null);
}

// Ô soạn có xem trước công thức.
function texArea(label, name, value, rows = 3) {
  const ta = el('textarea', { name, rows });
  ta.value = value || '';
  const prev = el('div', { class: 'tex-preview' });
  const upd = () => prev.replaceChildren(ta.value.trim() ? rich(ta.value) : el('span', { class: 'muted small', text: 'Xem trước' }));
  ta.addEventListener('input', upd);
  upd();
  return el('label', {}, label, ta, prev);
}

function imagePicker(label, currentPath) {
  const state = { remove: false };
  const input = el('input', { type: 'file', accept: 'image/*' });
  const wrap = el('div', { class: 'field' }, label, input);
  if (currentPath) {
    const cb = el('input', { type: 'checkbox', onchange: (e) => { state.remove = e.target.checked; } });
    wrap.append(el('label', { class: 'remember' }, cb, el('span', { text: 'Xóa hình hiện có' })));
  }
  return { node: wrap, input, state };
}

function questionDialog(quizId, q, key, afterSave = null) {
  const kind = q.kind;
  const isNew = !q.id;
  const form = el('form', { class: 'form-grid' });
  form.append(texArea('Nội dung câu hỏi', 'prompt', q.prompt));
  const img = imagePicker('Hình minh họa (không bắt buộc)', q.image_path);
  form.append(img.node);

  const optInputs = [];
  let correctRadios = [];
  const tfSelects = [];
  let shortInput;
  if (kind === 'mcq') {
    form.append(el('p', { class: 'small muted', text: 'Nhập 4 phương án và chọn phương án đúng.' }));
    LETTERS.forEach((L, i) => {
      const inp = el('input', { value: q.options?.[i] ?? '', placeholder: `Phương án ${L}` });
      const r = el('input', { type: 'radio', name: 'correct', value: String(i), checked: key ? key.answer === i : i === 0, 'aria-label': `${L} là đáp án đúng` });
      optInputs.push(inp); correctRadios.push(r);
      form.append(el('div', { class: 'opt-edit' }, el('b', { text: `${L}.` }), inp, el('label', { class: 'remember' }, r, el('span', { text: 'Đúng' }))));
    });
  } else if (kind === 'tf') {
    form.append(el('p', { class: 'small muted', text: 'Nhập 4 ý a, b, c, d và chọn Đúng/Sai cho từng ý.' }));
    TF_LETTERS.forEach((L, i) => {
      const inp = el('input', { value: q.options?.[i] ?? '', placeholder: `Ý ${L}` });
      const sel = el('select', { 'aria-label': `Ý ${L} đúng hay sai` },
        el('option', { value: 'true', selected: key ? key.answer[i] === true : true, text: 'Đúng' }),
        el('option', { value: 'false', selected: key ? key.answer[i] === false : false, text: 'Sai' }));
      optInputs.push(inp); tfSelects.push(sel);
      form.append(el('div', { class: 'opt-edit' }, el('b', { text: `${L})` }), inp, sel));
    });
  } else {
    shortInput = el('input', { value: key ? key.answer.join('; ') : '', placeholder: 'Ví dụ: 1.5; 3/2' });
    form.append(el('label', {}, 'Đáp án đúng (nhiều đáp án chấp nhận thì cách nhau bằng dấu ;)', shortInput,
      el('small', { class: 'muted', text: 'Số thập phân viết dấu phẩy hay dấu chấm đều được chấm đúng (1,5 = 1.5).' })));
  }
  const pts = el('input', { name: 'points', type: 'number', min: '0.05', step: '0.05', value: String(q.points ?? DEFAULT_POINTS[kind]) });
  form.append(el('label', {}, kind === 'tf' ? 'Điểm câu (đúng 1/2/3/4 ý được 10%/25%/50%/100%)' : 'Điểm câu', pts));
  form.append(texArea('Lời giải chi tiết (hiện cho học sinh sau khi nộp)', 'explanation', key?.explanation, 4));
  const solImg = imagePicker('Hình lời giải (không bắt buộc)', key?.explanation_image_path);
  form.append(solImg.node);
  const btn = el('button', { class: 'btn btn-gold', type: 'submit', text: isNew ? 'Thêm câu hỏi' : 'Lưu câu hỏi' });
  form.append(btn);

  const dlg = openDialog(`${isNew ? 'Thêm' : 'Sửa'} câu ${KIND_LABEL[kind].toLowerCase()}`, form, { wide: true });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const prompt = form.prompt.value.trim();
    const points = Number(pts.value);
    if (!prompt && !img.input.files.length && !q.image_path) { toast('Vui lòng nhập nội dung câu hỏi.', 'error'); return; }
    if (!(points > 0)) { toast('Điểm phải lớn hơn 0.', 'error'); return; }
    let options = null;
    let answer;
    if (kind === 'mcq' || kind === 'tf') {
      options = optInputs.map((x) => x.value.trim());
      if (options.some((o) => !o)) { toast('Vui lòng nhập đủ 4 phương án / 4 ý.', 'error'); return; }
      answer = kind === 'mcq'
        ? Number(correctRadios.find((r) => r.checked)?.value ?? 0)
        : tfSelects.map((s) => s.value === 'true');
    } else {
      answer = shortInput.value.split(';').map((s) => s.trim()).filter(Boolean);
      if (!answer.length) { toast('Vui lòng nhập đáp án đúng.', 'error'); return; }
    }
    btn.disabled = true; btn.textContent = 'Đang lưu…';
    try {
      let image_path = img.state.remove ? null : q.image_path ?? null;
      let explanation_image_path = solImg.state.remove ? null : key?.explanation_image_path ?? null;
      const oldPaths = [];
      if (img.input.files[0]) { if (q.image_path) oldPaths.push(q.image_path); image_path = await uploadTo(`quizzes/${quizId}`, img.input.files[0]); }
      else if (img.state.remove && q.image_path) oldPaths.push(q.image_path);
      if (solImg.input.files[0]) { if (key?.explanation_image_path) oldPaths.push(key.explanation_image_path); explanation_image_path = await uploadTo(`quizzes/${quizId}/sol`, solImg.input.files[0]); }
      else if (solImg.state.remove && key?.explanation_image_path) oldPaths.push(key.explanation_image_path);

      const row = { prompt, options, points, image_path };
      let qid = q.id;
      if (isNew) {
        const { data, error } = await sb.from('quiz_questions')
          .insert({ ...row, quiz_id: quizId, kind, position: q.position }).select('id').single();
        if (error) throw error;
        qid = data.id;
      } else {
        const { data: upd, error } = await sb.from('quiz_questions').update(row).eq('id', qid).select('id');
        if (error) throw error;
        if (!upd?.length) throw new Error('Bạn không có quyền sửa câu này.');
      }
      const { error: ke } = await sb.from('quiz_keys').upsert({
        question_id: qid, answer, explanation: form.explanation.value.trim() || null, explanation_image_path,
      }, { onConflict: 'question_id' });
      if (ke) throw ke;
      if (oldPaths.length) await sb.storage.from(BUCKET).remove(oldPaths);
      dlg.close();
      toast(isNew ? 'Đã thêm câu hỏi.' : 'Đã lưu câu hỏi.');
      if (afterSave) await afterSave();
      ctx.rerender();
    } catch (err) {
      toast(errMsg(err), 'error');
      btn.disabled = false; btn.textContent = 'Thử lại';
    }
  });
}

function previewAsStudent(z, questions, urls) {
  const body = el('div', { class: 'quiz-take preview' },
    z.description ? rich(z.description, 'rich muted') : null,
    questions.map((q, i) => el('article', { class: 'q-card' },
      el('div', { class: 'q-head' }, el('span', { class: 'q-num', text: `Câu ${i + 1}` }),
        el('span', { class: 'q-kind', text: KIND_LABEL[q.kind] }), el('span', { class: 'q-pts', text: `${fmtNum(q.points)} điểm` })),
      rich(q.prompt), qImage(q.image_path, urls, `Hình câu ${i + 1}`),
      q.kind === 'mcq' ? el('div', { class: 'opts' }, q.options.map((o, k) => el('div', { class: 'opt' }, el('b', { text: `${LETTERS[k]}.` }), rich(o, 'rich inline')))) : null,
      q.kind === 'tf' ? el('div', { class: 'opts' }, q.options.map((o, k) => el('div', { class: 'opt' }, el('b', { text: `${TF_LETTERS[k]})` }), rich(o, 'rich inline'), el('span', { class: 'muted small', text: ' Đúng / Sai' })))) : null,
      q.kind === 'short' ? el('input', { disabled: true, placeholder: 'Ô trả lời' }) : null)));
  openDialog(`Xem trước: ${z.title}`, body, { wide: true });
}

export async function deleteQuiz(z, done = () => go({})) {
  if (z.class_id == null) {
    const { count } = await sb.from('quiz_attempts').select('id', { count: 'exact', head: true }).eq('quiz_id', z.id);
    if (count) { toast('Đề đã có học sinh làm bài nên không xóa được. Có thể bấm "Ẩn đề".', 'error'); return; }
    if (!await askConfirm(`Xóa đề "${z.title}" cùng toàn bộ câu hỏi, đáp án, lời giải? Không thể khôi phục.`)) return;
  } else if (!await askConfirm(`Xóa đề "${z.title}" cùng toàn bộ câu hỏi và bài làm của học sinh? Không thể khôi phục.`)) return;
  const { data: files } = await sb.storage.from(BUCKET).list(`quizzes/${z.id}`, { limit: 1000 });
  const { data: sol } = await sb.storage.from(BUCKET).list(`quizzes/${z.id}/sol`, { limit: 1000 });
  const paths = [
    ...(files || []).filter((f) => f.id).map((f) => `quizzes/${z.id}/${f.name}`),
    ...(sol || []).filter((f) => f.id).map((f) => `quizzes/${z.id}/sol/${f.name}`),
  ];
  // Xóa hình trước (sau khi xóa đề thì không còn quyền với thư mục hình của đề).
  if (paths.length) await sb.storage.from(BUCKET).remove(paths);
  const { data: gone, error } = await sb.from('quizzes').delete().eq('id', z.id).select('id');
  if (error) { toast(errMsg(error), 'error'); return; }
  if (!gone?.length) { toast('Bạn không có quyền xóa đề này.', 'error'); return; }
  toast('Đã xóa đề.');
  done();
}

// =====================================================================
// Kết quả
// =====================================================================
async function renderResults(view, quizId) {
  await sb.rpc('finalize_expired_attempts', { p_quiz: quizId });
  const [{ data: z, error }, { data: attempts }, { data: questions }] = await Promise.all([
    sb.from('quizzes').select('id, title, class_id, due_at').eq('id', quizId).single(),
    sb.from('quiz_attempts').select('*').eq('quiz_id', quizId),
    sb.from('quiz_questions').select('*').eq('quiz_id', quizId).order('position').order('id'),
  ]);
  if (error) { view.append(el('p', { class: 'error-text', text: errMsg(error) })); return; }
  const { data: students } = await sb.from('students').select('id, code, full_name').eq('class_id', z.class_id).order('full_name');
  const byStudent = new Map((attempts || []).map((a) => [a.student_id, a]));
  const done = (attempts || []).filter((a) => a.submitted_at);
  const on10 = done.map((a) => (Number(a.score) / Number(a.max_score || 1)) * 10);
  const avg = on10.length ? on10.reduce((s, x) => s + x, 0) / on10.length : null;
  const maxPts = (questions || []).reduce((s, q) => s + Number(q.points), 0);

  const rows = (students || []).map((s) => {
    const a = byStudent.get(s.id);
    let status;
    if (!a) status = el('span', { class: 'badge warn', text: 'Chưa làm' });
    else if (!a.submitted_at) status = el('span', { class: 'badge', text: 'Đang làm' });
    else {
      status = el('div', {}, el('b', { text: `${fmtNum(a.score)} / ${fmtNum(a.max_score)}` }),
        a.mode === 'manual' ? el('div', {}, el('span', { class: 'badge', text: 'Bài giấy · GV chấm' })) : null,
        a.mode === 'paper' ? el('div', {}, el('span', { class: 'badge', text: 'Bài giấy · HS nhập phiếu' })) : null);
    }
    const manual = a?.mode === 'manual';
    return el('tr', {},
      el('td', {}, el('b', { text: s.full_name }), el('div', { class: 'muted small', text: s.code })),
      el('td', {}, status),
      el('td', { class: 'small', text: a?.submitted_at ? fmtDateTime(a.submitted_at) : '' }),
      el('td', {}, el('div', { class: 'acts' },
        !a || manual ? el('button', { class: 'btn btn-outline btn-sm', text: manual ? 'Sửa điểm' : 'Nhập điểm bài giấy',
          onclick: () => paperScoreDialog(z, s, a, maxPts) }) : null,
        a?.submitted_at && !manual ? el('button', { class: 'btn btn-outline btn-sm', text: 'Xem bài', onclick: () => showAttempt(s, a, questions) }) : null,
        a ? el('button', { class: 'btn btn-danger btn-sm', text: manual ? 'Xóa điểm' : 'Cho làm lại', onclick: async () => {
          if (!await askConfirm(manual
            ? `Xóa điểm bài giấy của ${s.full_name}? Em sẽ có thể làm lại bài này.`
            : `Xóa bài làm của ${s.full_name} để em làm lại từ đầu?`)) return;
          const { error: e2 } = await sb.from('quiz_attempts').delete().eq('id', a.id);
          if (e2) { toast(errMsg(e2), 'error'); return; }
          toast(manual ? 'Đã xóa điểm.' : 'Đã cho làm lại.'); ctx.rerender();
        } }) : null)));
  });

  view.append(
    el('div', { class: 'row', style: 'margin-bottom:16px' },
      el('button', { class: 'btn btn-outline btn-sm', text: '← Danh sách đề', onclick: () => go({}) }),
      el('button', { class: 'btn btn-outline btn-sm', text: 'Soạn đề', onclick: () => go({ quizId }) })),
    el('div', { class: 'panel' },
      el('h2', { text: `Kết quả: ${z.title}` }),
      el('p', { class: 'muted small', text: 'Học sinh làm trên giấy: chấm bài rồi bấm "Nhập điểm bài giấy" ở dòng của em đó. Điểm hiện ngay cho học sinh và phụ huynh.' }),
      el('div', { class: 'stats' },
        el('div', { class: 'stat' }, el('div', { class: 'k', text: 'Đã nộp' }), el('div', { class: 'v', text: `${done.length}/${students?.length ?? 0}` })),
        el('div', { class: 'stat' }, el('div', { class: 'k', text: 'Điểm TB (thang 10)' }), el('div', { class: 'v', text: avg == null ? '—' : fmtNum(Math.round(avg * 100) / 100) })),
        el('div', { class: 'stat' }, el('div', { class: 'k', text: 'Cao nhất (thang 10)' }), el('div', { class: 'v', text: on10.length ? fmtNum(Math.round(Math.max(...on10) * 100) / 100) : '—' })))),
    el('div', { class: 'table-wrap section-gap' }, el('table', { class: 'results-table' },
      el('thead', {}, el('tr', {}, el('th', { text: 'Học sinh' }), el('th', { text: 'Điểm' }), el('th', { text: 'Nộp lúc' }), el('th', { text: '' }))),
      el('tbody', {}, rows))));
}

// Nhập / sửa điểm bài làm trên giấy (thang điểm của đề, tối đa = tổng điểm các câu).
function paperScoreDialog(z, s, a, maxPts) {
  if (!(maxPts > 0)) { toast('Đề chưa có câu hỏi nào.', 'error'); return; }
  const inp = el('input', { type: 'number', min: '0', max: String(maxPts), step: 'any', required: true,
    value: a?.mode === 'manual' ? String(Number(a.score)) : '' });
  const btn = el('button', { class: 'btn btn-gold', type: 'submit', text: 'Lưu điểm' });
  const form = el('form', { class: 'form-grid' },
    el('p', { class: 'muted small', text: `Điểm bài làm trên giấy của ${s.full_name}. Thang điểm của đề: 0 – ${fmtNum(maxPts)}.` }),
    el('label', {}, `Điểm (tối đa ${fmtNum(maxPts)})`, inp,
      el('small', { class: 'muted', text: 'Viết dấu chấm cho số thập phân, ví dụ 7.5' })),
    btn);
  const dlg = openDialog(`${a ? 'Sửa' : 'Nhập'} điểm bài giấy — ${z.title}`, form);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const v = Number(String(inp.value).replace(',', '.'));
    if (!(Number.isFinite(v) && v >= 0 && v <= maxPts)) { toast(`Điểm phải từ 0 đến ${fmtNum(maxPts)}.`, 'error'); return; }
    btn.disabled = true; btn.textContent = 'Đang lưu…';
    const { error } = await sb.rpc('record_paper_score', { p_quiz: z.id, p_student: s.id, p_score: v });
    if (error) { toast(errMsg(error), 'error'); btn.disabled = false; btn.textContent = 'Lưu điểm'; return; }
    dlg.close();
    toast(`Đã lưu điểm ${fmtNum(v)} / ${fmtNum(maxPts)} cho ${s.full_name}.`);
    ctx.rerender();
  });
}

async function showAttempt(s, a, questions) {
  const { data: keys } = await sb.from('quiz_keys').select('*').in('question_id', questions.map((q) => q.id));
  const keyMap = new Map((keys || []).map((k) => [k.question_id, k]));
  const urls = await imageUrls([...questions.map((q) => q.image_path), ...(keys || []).map((k) => k.explanation_image_path)]);
  openDialog(`${s.full_name} — ${fmtNum(a.score)} / ${fmtNum(a.max_score)} điểm`,
    el('div', { class: 'quiz-take' }, questions.map((q, i) =>
      reviewQuestion(q, i, a.answers?.[q.id], keyMap.get(q.id), a.detail?.[q.id], urls))), { wide: true });
}
