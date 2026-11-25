import {
  sb, logout, configured, $, el, normalizeCode, mondayOf, toISODate, weekLabel, fmtNum,
  randomPassword, uploadTo, toast, errMsg, openDialog, showFiles, FILE_ACCEPT, fileKind, notConfiguredNotice, formatLinkCode, displayLogin,
  passwordField, rememberCheckbox, setRemember, rememberedLogin, saveLogin, askConfirm, copyBox, fmtDateTime,
} from '../portal/common.js?v=20261202a';
import { SUPABASE_URL } from '../portal/config.js';
import { renderQuizTab } from './quiz.js?v=20261202a';
import { renderBankTab } from './bank.js?v=20261202a';

const app = $('#app');
const top = $('#top-actions');

const state = { user: null, profile: null, classes: [], tab: 'grades', classId: null, assessmentId: null, quizId: null, quizResultsId: null, bankQuizId: null, bank: null };
const isAdmin = () => state.profile?.role === 'admin';

if (!configured) {
  notConfiguredNotice(app);
} else {
  sb.auth.onAuthStateChange((event) => { if (event === 'SIGNED_OUT') renderLogin(); });
  start();
}

async function start() {
  const { data: { session } } = await sb.auth.getSession();
  if (session) enter(session.user); else renderLogin();
}

// ---------- Đăng nhập ----------
function renderLogin() {
  top.replaceChildren();
  const msg = el('p', { class: 'error-text small', role: 'alert' });
  const btn = el('button', { class: 'btn btn-gold', type: 'submit', text: 'Đăng nhập' });
  const lastEmail = rememberedLogin('teacher');
  const form = el('form', { class: 'form-grid', novalidate: true },
    el('label', {}, 'Email', el('input', { name: 'email', type: 'email', required: true, autocomplete: 'username', value: lastEmail })),
    passwordField('Mật khẩu', { name: 'password', required: true, autocomplete: 'current-password' }),
    rememberCheckbox(),
    btn, msg);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    btn.disabled = true; msg.textContent = '';
    const email = form.email.value.trim();
    const remember = form.remember.checked;
    setRemember(remember);
    saveLogin('teacher', email, remember);
    const { data, error } = await sb.auth.signInWithPassword({ email, password: form.password.value });
    btn.disabled = false;
    if (error) { msg.textContent = 'Email hoặc mật khẩu không đúng.'; return; }
    enter(data.user);
  });
  app.replaceChildren(el('div', { class: 'panel narrow-panel' },
    el('h1', { text: 'Trang giáo viên' }),
    el('p', { class: 'muted', text: 'Đăng nhập để nhập kết quả học tập hằng tuần.' }),
    form));
  (lastEmail ? form.password : form.email).focus();
}

async function enter(user) {
  state.user = user;
  const { data: profile } = await sb.from('profiles').select('id, role, full_name').eq('id', user.id).single();
  state.profile = profile;
  if (!profile || profile.role === 'parent') {
    app.replaceChildren(el('div', { class: 'panel narrow-panel' },
      el('h2', { text: 'Tài khoản này không phải tài khoản giáo viên' }),
      el('p', {}, 'Phụ huynh vui lòng dùng ', el('a', { href: '../phu-huynh/', text: 'cổng phụ huynh' }), '.'),
      el('button', { class: 'btn btn-outline', onclick: logout, text: 'Đăng xuất' })));
    return;
  }
  top.replaceChildren(
    el('span', { class: 'who', text: profile.full_name || user.email }),
    el('button', { class: 'btn btn-outline btn-sm', onclick: logout, text: 'Đăng xuất' }));
  await Promise.all([loadClasses(), refreshTrialCount()]);
  renderShell();
}

async function loadClasses() {
  if (isAdmin()) {
    const { data } = await sb.from('classes').select('id, name, grade, active').order('grade').order('name');
    state.classes = data || [];
  } else {
    const { data } = await sb.from('teacher_classes').select('classes(id, name, grade, active)').eq('teacher_id', state.user.id);
    state.classes = (data || []).map((r) => r.classes).filter(Boolean)
      .sort((a, b) => a.grade - b.grade || a.name.localeCompare(b.name, 'vi'));
  }
  if (!state.classes.some((c) => c.id === state.classId)) state.classId = state.classes.find((c) => c.active)?.id ?? null;
}

function renderShell() {
  const tabs = [['grades', 'Nhập kết quả'], ['quiz', 'Bài tập trực tuyến'], ['bank', 'Ngân hàng đề'], ['students', 'Học sinh & tài khoản']];
  if (isAdmin()) tabs.push(['admin', 'Lớp & giáo viên'], ['trials', state.newTrials ? `Đăng ký học thử (${state.newTrials})` : 'Đăng ký học thử']);
  const view = el('div');
  app.replaceChildren(
    el('div', { class: 'tabs', role: 'tablist' }, tabs.map(([id, label]) =>
      el('button', { class: 'tab', role: 'tab', 'aria-selected': String(state.tab === id), text: label,
        onclick: () => { state.tab = id; state.quizId = null; state.quizResultsId = null; state.bankQuizId = null; renderShell(); } }))),
    view);
  if (!state.classes.length && !['admin', 'bank', 'trials'].includes(state.tab)) {
    view.append(el('div', { class: 'panel empty' },
      el('h2', { text: 'Bạn chưa được phân công lớp nào' }),
      el('p', { class: 'muted', text: isAdmin()
        ? 'Hãy tạo lớp trong thẻ "Lớp & giáo viên".'
        : 'Vui lòng nhờ quản trị viên phân công lớp cho bạn.' })));
    return;
  }
  if (state.tab === 'grades') renderGrades(view);
  else if (state.tab === 'quiz') renderQuizTab(view, { state, classSelect, rerender: renderShell });
  else if (state.tab === 'bank') renderBankTab(view, { state, classSelect, rerender: renderShell, isAdmin });
  else if (state.tab === 'students') renderStudents(view);
  else if (state.tab === 'trials') renderTrials(view);
  else renderAdmin(view);
}

function classSelect(onchange, { includeInactive = false } = {}) {
  const sel = el('select', { name: 'class', onchange: (e) => { state.classId = Number(e.target.value); onchange(); } },
    state.classes.filter((c) => includeInactive || c.active).map((c) =>
      el('option', { value: String(c.id), selected: c.id === state.classId, text: c.name })));
  return el('label', { class: 'field' }, 'Lớp', sel);
}

// =====================================================================
// Nhập kết quả
// =====================================================================
async function renderGrades(view) {
  const activeIds = state.classes.filter((c) => c.active).map((c) => c.id);
  if (!activeIds.length) {
    view.append(el('div', { class: 'panel empty' }, el('p', { text: 'Không có lớp nào đang hoạt động.' })));
    return;
  }
  if (!activeIds.includes(state.classId)) { state.classId = activeIds[0]; state.assessmentId = null; }
  const body = el('div', { class: 'section-gap' });
  view.append(el('div', { class: 'panel' },
    el('div', { class: 'row' },
      classSelect(() => { state.assessmentId = null; renderShell(); }),
      el('button', { class: 'btn btn-gold', onclick: () => newAssessment(), text: '+ Bài kiểm tra mới' }))),
    body);

  const { data: list, error } = await sb.from('assessments')
    .select('id, title, week_start, max_score').eq('class_id', state.classId)
    .order('week_start', { ascending: false }).order('id', { ascending: false });
  if (error) { body.append(el('p', { class: 'error-text', text: errMsg(error) })); return; }
  if (!list.length) {
    body.append(el('div', { class: 'panel empty' },
      el('h3', { text: 'Lớp này chưa có bài kiểm tra nào' }),
      el('p', { class: 'muted', text: 'Bấm "+ Bài kiểm tra mới" để bắt đầu nhập kết quả tuần này.' })));
    return;
  }
  if (!list.some((a) => a.id === state.assessmentId)) state.assessmentId = list[0].id;

  const pick = el('select', { onchange: (e) => { state.assessmentId = Number(e.target.value); renderShell(); } },
    list.map((a) => el('option', { value: String(a.id), selected: a.id === state.assessmentId,
      text: `${weekLabel(a.week_start)} — ${a.title}` })));
  body.append(el('label', { class: 'field' }, 'Bài kiểm tra', pick));
  renderAssessment(body, list.find((a) => a.id === state.assessmentId));
}

function newAssessment(existing) {
  const form = el('form', { class: 'form-grid' },
    el('label', {}, 'Tên bài kiểm tra', el('input', { name: 'title', required: true, value: existing?.title || '',
      placeholder: 'Ví dụ: Kiểm tra 15 phút — Phương trình bậc hai' })),
    el('div', { class: 'row' },
      el('label', { class: 'field' }, 'Ngày trong tuần kiểm tra',
        el('input', { name: 'week', type: 'date', required: true, value: existing?.week_start || toISODate(mondayOf()) })),
      el('label', { class: 'field' }, 'Điểm tối đa',
        el('input', { name: 'max', type: 'number', min: '1', step: '0.25', required: true, value: String(existing?.max_score ?? 10) }))),
    existing ? null : el('label', {}, 'File đề bài (ảnh, PDF hoặc Word, tối đa 10 MB/file, có thể chọn nhiều)',
      el('input', { name: 'files', type: 'file', accept: FILE_ACCEPT, multiple: true })),
    el('button', { class: 'btn btn-gold', type: 'submit', text: existing ? 'Lưu thay đổi' : 'Tạo bài kiểm tra' }));
  const dlg = openDialog(existing ? 'Sửa bài kiểm tra' : 'Bài kiểm tra mới', form);
  let createdId = null; // bài đã tạo nhưng tải file lỗi → "Thử lại" chỉ tải lại file, không tạo bài trùng
  const uploaded = new Set(); // file đã tải xong ở lần trước, không tải lại
  dlg.addEventListener('close', () => { if (createdId) renderShell(); });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type=submit]');
    const row = {
      title: form.title.value.trim(),
      week_start: toISODate(mondayOf(new Date(form.week.value + 'T00:00:00'))),
      max_score: Number(form.max.value),
    };
    if (!row.title || !(row.max_score > 0)) { toast('Vui lòng nhập tên và điểm tối đa hợp lệ.', 'error'); return; }
    btn.disabled = true; btn.textContent = 'Đang lưu…';
    try {
      let id = existing?.id;
      if (existing) {
        const { error } = await sb.from('assessments').update(row).eq('id', id);
        if (error) throw error;
      } else {
        if (createdId) {
          id = createdId;
          const { error } = await sb.from('assessments').update(row).eq('id', id);
          if (error) throw error;
        } else {
          const { data, error } = await sb.from('assessments').insert({ ...row, class_id: state.classId }).select('id').single();
          if (error) throw error;
          id = createdId = data.id;
          state.assessmentId = id;
        }
        await attachFiles('assessment', id, form.files.files, uploaded);
      }
      state.assessmentId = id;
      createdId = null;
      dlg.close();
      toast('Đã lưu bài kiểm tra.');
      renderShell();
    } catch (err) {
      toast(createdId
        ? `Đã tạo bài kiểm tra nhưng chưa tải được file: ${errMsg(err)} Chọn lại file rồi bấm "Thử lại", hoặc đóng hộp thoại và thêm file sau.`
        : errMsg(err), 'error');
      btn.disabled = false; btn.textContent = 'Thử lại';
    }
  });
}

// Tải file lên và ghi vào bảng tương ứng.
async function attachFiles(kind, id, files, done = new Set()) {
  const folder = kind === 'assessment' ? `assessments/${id}` : `results/${id}`;
  const table = kind === 'assessment' ? 'assessment_files' : 'result_files';
  const key = kind === 'assessment' ? 'assessment_id' : 'result_id';
  for (const f of [...files]) {
    const sig = `${f.name}|${f.size}|${f.lastModified}`;
    if (done.has(sig)) continue;
    const path = await uploadTo(folder, f);
    const { error } = await sb.from(table).insert({ [key]: id, path });
    if (error) { await sb.storage.from('tdm').remove([path]); throw error; }
    done.add(sig);
  }
}

async function manageFiles(kind, id, title, onDone) {
  const table = kind === 'assessment' ? 'assessment_files' : 'result_files';
  const key = kind === 'assessment' ? 'assessment_id' : 'result_id';
  const { data: rows, error } = await sb.from(table).select('id, path').eq(key, id).order('id');
  if (error) { toast(errMsg(error), 'error'); return; }
  const list = el('div', { class: 'list' }, rows.length ? rows.map((r, i) => el('div', { class: 'item' },
    el('span', { text: `File ${i + 1} (${fileKind(r.path)})` }),
    el('div', { class: 'acts' },
      el('button', { class: 'btn btn-outline btn-sm', text: 'Xem', onclick: () => showFiles(title, [r.path]) }),
      el('button', { class: 'btn btn-danger btn-sm', text: 'Xóa', onclick: async () => {
        if (!await askConfirm('Xóa file này? Không thể khôi phục.')) return;
        const { error: e1 } = await sb.storage.from('tdm').remove([r.path]);
        const { error: e2 } = await sb.from(table).delete().eq('id', r.id);
        if (e1 || e2) { toast(errMsg(e1 || e2), 'error'); return; }
        dlg.close(); toast('Đã xóa file.'); onDone();
      } })))) : [el('p', { class: 'muted', text: 'Chưa có file nào.' })]);
  const dlg = openDialog(title, list);
}

async function renderAssessment(body, a) {
  const testCount = el('span', { style: 'margin-left:6px' });
  const head = el('div', { class: 'panel section-gap' },
    el('div', { class: 'assess-head' },
      el('div', {},
        el('div', { class: 'eyebrow dark', text: weekLabel(a.week_start) }),
        el('h2', { text: a.title }),
        el('p', { class: 'muted', text: `Điểm tối đa: ${fmtNum(a.max_score)}` })),
      el('div', { class: 'acts row' },
        el('button', { class: 'btn btn-outline btn-sm', text: 'Sửa', onclick: () => newAssessment(a) }),
        el('button', { class: 'btn btn-danger btn-sm', text: 'Xóa bài', onclick: () => deleteAssessment(a) }))),
    el('div', { class: 'row section-gap' },
      el('label', { class: 'field' }, 'Thêm file đề bài',
        el('input', { type: 'file', accept: FILE_ACCEPT, multiple: true, onchange: async (e) => {
          const input = e.target;
          try { await attachFiles('assessment', a.id, input.files); toast('Đã tải đề bài lên.'); renderShell(); }
          catch (err) { toast(errMsg(err), 'error'); input.value = ''; }
        } })),
      el('button', { class: 'btn btn-outline', onclick: () => manageFiles('assessment', a.id, `Đề bài — ${a.title}`, renderShell) }, 'Đề bài đã tải ', testCount)));
  body.append(head);

  const [{ data: students, error: e1 }, { data: results, error: e2 }, { count }] = await Promise.all([
    sb.from('students').select('id, code, full_name').eq('class_id', state.classId).order('full_name'),
    sb.from('results').select('id, student_id, score, comment, result_files(id)').eq('assessment_id', a.id),
    sb.from('assessment_files').select('id', { count: 'exact', head: true }).eq('assessment_id', a.id),
  ]);
  testCount.textContent = `(${count ?? 0})`;
  if (e1 || e2) { body.append(el('p', { class: 'error-text', text: errMsg(e1 || e2) })); return; }
  if (!students.length) {
    body.append(el('div', { class: 'panel empty section-gap' },
      el('p', { text: isAdmin()
        ? 'Lớp này chưa có học sinh. Thêm học sinh ở thẻ "Học sinh & tài khoản".'
        : 'Lớp này chưa có học sinh. Vui lòng nhờ quản trị viên thêm học sinh.' })));
    return;
  }
  const byStudent = new Map(results.map((r) => [r.student_id, r]));
  const done = results.filter((r) => r.score != null).length;
  body.append(
    el('h3', { class: 'section-gap', text: `Kết quả học sinh (${done}/${students.length} đã chấm)` }),
    el('div', { class: 'list' }, students.map((s) => gradeCard(a, s, byStudent.get(s.id)))));
}

function gradeCard(a, s, r) {
  let current = r;
  const score = el('input', { type: 'number', min: '0', max: String(a.max_score), step: '0.25', inputmode: 'decimal',
    value: r?.score != null ? String(r.score) : '', 'aria-label': `Điểm của ${s.full_name}` });
  const comment = el('textarea', { rows: 2, placeholder: 'Nhận xét cho phụ huynh…', 'aria-label': `Nhận xét cho ${s.full_name}` });
  comment.value = r?.comment || '';
  const files = el('input', { type: 'file', accept: FILE_ACCEPT, multiple: true, 'aria-label': `Bài làm của ${s.full_name}` });
  const fileInfo = el('button', { class: 'btn btn-outline btn-sm', type: 'button' });
  const setInfo = (n) => { fileInfo.textContent = `Bài làm (${n})`; fileInfo.disabled = !current; };
  setInfo(r?.result_files?.length ?? 0);
  fileInfo.addEventListener('click', () => manageFiles('result', current.id, `Bài làm — ${s.full_name}`, renderShell));
  const save = el('button', { class: 'btn btn-gold btn-sm', type: 'button', text: 'Lưu' });

  const card = el('div', { class: `grade-card${r?.score != null ? ' saved' : ''}` },
    el('div', { class: 'who' }, el('b', { text: s.full_name }), el('span', { class: 'muted small', text: s.code })),
    el('label', { class: 'field' }, `Điểm /${fmtNum(a.max_score)}`, score),
    el('label', { class: 'field cmt' }, 'Nhận xét', comment),
    el('div', { class: 'files' }, files, fileInfo, save));

  save.addEventListener('click', async () => {
    const val = score.value.trim() === '' ? null : Number(score.value);
    if (val != null && (Number.isNaN(val) || val < 0 || val > Number(a.max_score))) {
      toast(`Điểm phải từ 0 đến ${fmtNum(a.max_score)}.`, 'error'); score.focus(); return;
    }
    save.disabled = true; save.textContent = 'Đang lưu…';
    try {
      const { data, error } = await sb.from('results')
        .upsert({ assessment_id: a.id, student_id: s.id, score: val, comment: comment.value.trim() || null },
          { onConflict: 'assessment_id,student_id' })
        .select('id, result_files(id)').single();
      if (error) throw error;
      current = data;
      if (files.files.length) { await attachFiles('result', data.id, files.files); files.value = ''; }
      const { count } = await sb.from('result_files').select('id', { count: 'exact', head: true }).eq('result_id', data.id);
      setInfo(count ?? 0);
      card.classList.toggle('saved', val != null);
      toast(`Đã lưu kết quả của ${s.full_name}.`);
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      save.disabled = false; save.textContent = 'Lưu';
    }
  });
  return card;
}

async function deleteAssessment(a) {
  if (!await askConfirm(`Xóa bài "${a.title}" cùng toàn bộ điểm, nhận xét và file của bài này? Không thể khôi phục.`)) return;
  try {
    const { data: rf } = await sb.from('result_files').select('path, results!inner(assessment_id)').eq('results.assessment_id', a.id);
    const { data: af } = await sb.from('assessment_files').select('path').eq('assessment_id', a.id);
    const paths = [...(rf || []), ...(af || [])].map((x) => x.path);
    if (paths.length) await sb.storage.from('tdm').remove(paths);
    const { error } = await sb.from('assessments').delete().eq('id', a.id);
    if (error) throw error;
    state.assessmentId = null;
    toast('Đã xóa bài kiểm tra.');
    renderShell();
  } catch (err) { toast(errMsg(err), 'error'); }
}

// Xóa lớp (chỉ quản trị viên). Lớp còn học sinh thì không xóa được.
async function deleteClass(c) {
  const count = (t) => sb.from(t).select('id', { count: 'exact', head: true }).eq('class_id', c.id);
  const [{ count: hs }, { count: kt }, { count: bt }] = await Promise.all([count('students'), count('assessments'), count('quizzes')]);
  if (hs) {
    toast(`Lớp ${c.name} còn ${hs} học sinh. Hãy chuyển lớp (nút "Sửa" ở tab Học sinh & tài khoản) hoặc xóa các em trước khi xóa lớp.`, 'error');
    return;
  }
  const lost = [kt ? `${kt} bài kiểm tra tuần` : '', bt ? `${bt} bài tập trực tuyến` : ''].filter(Boolean).join(' và ');
  if (!await askConfirm(`Xóa lớp ${c.name}?${lost ? ` Sẽ xóa luôn ${lost} của lớp.` : ''} Giáo viên phụ trách sẽ không còn lớp này. Không thể khôi phục.`)) return;
  const { data: gone, error } = await sb.from('classes').delete().eq('id', c.id).select('id');
  if (error) { toast(errMsg(error), 'error'); return; }
  if (!gone?.length) { toast('Không xóa được lớp (chỉ quản trị viên được xóa lớp).', 'error'); return; }
  toast(`Đã xóa lớp ${c.name}.`);
  await loadClasses(); renderShell();
}

// =====================================================================
// Học sinh & tài khoản phụ huynh
// =====================================================================
async function renderStudents(view) {
  const listBox = el('div', { class: 'list section-gap' }, el('p', { class: 'muted', text: 'Đang tải…' }));
  const addForm = el('form', { class: 'row' },
    el('label', { class: 'field' }, 'Họ tên học sinh', el('input', { name: 'name', required: true })),
    el('label', { class: 'field' }, 'Ngày sinh (DD/MM/YYYY)', birthInput('birth')),
    el('button', { class: 'btn btn-gold', type: 'submit', text: 'Thêm học sinh' }));
  addForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const full_name = addForm.name.value.trim();
    const birth_date = parseBirth(addForm.birth.value);
    if (!full_name) { toast('Vui lòng nhập họ tên học sinh.', 'error'); return; }
    if (!addForm.birth.value.trim()) { toast('Vui lòng nhập ngày sinh của học sinh.', 'error'); return; }
    if (!birth_date) { toast('Ngày sinh chưa đúng. Nhập theo dạng DD/MM/YYYY, ví dụ 09/12/2013.', 'error'); return; }
    const btn = addForm.querySelector('button');
    btn.disabled = true;
    // Mã học sinh (TDM + 6 chữ số) và mã liên kết do máy chủ tự sinh.
    const { data: s, error } = await sb.from('students')
      .insert({ full_name, birth_date, class_id: state.classId }).select('id, code, full_name').single();
    if (error) { btn.disabled = false; toast(errMsg(error), 'error'); return; }
    try {
      const out = await callAccounts({ action: 'create_parent', student_id: s.id });
      await showStudentInfo(s, out.password);
    } catch (err) {
      toast(`Đã thêm ${s.code} nhưng chưa tạo được tài khoản: ${errMsg(err)}. Bấm "Tạo TK học sinh" để thử lại.`, 'error');
    }
    renderShell();
  });

  view.append(
    el('div', { class: 'panel' }, el('div', { class: 'row' }, classSelect(renderShell, { includeInactive: true }))),
    isAdmin()
      ? el('div', { class: 'panel section-gap' }, el('h3', { text: 'Thêm học sinh vào lớp này' }),
          el('p', { class: 'muted small', text: 'Điền họ tên và ngày sinh. Máy tự sinh mã học sinh (TDM000001, TDM000002, …; không đổi được), mật khẩu ban đầu (6 chữ số ngẫu nhiên, chỉ hiện một lần — hãy chép lại; lần đầu đăng nhập em phải đổi) và mã liên kết cho phụ huynh. Gửi cả 3 cho học sinh và phụ huynh.' }),
          addForm)
      : el('p', { class: 'muted small section-gap', text: 'Chỉ quản trị viên được thêm, sửa, chuyển lớp hoặc xóa học sinh. Cần thay đổi, vui lòng liên hệ quản trị viên.' }),
    listBox);

  const [{ data: students, error }, { data: links }] = await Promise.all([
    sb.from('students').select('id, code, full_name, birth_date, class_id, parent_id, password_changed').eq('class_id', state.classId).order('full_name'),
    sb.rpc('class_parent_links', { p_class: state.classId }),
  ]);
  if (error) { listBox.replaceChildren(el('p', { class: 'error-text', text: errMsg(error) })); return; }
  if (!students.length) { listBox.replaceChildren(el('p', { class: 'muted', text: 'Lớp này chưa có học sinh.' })); return; }
  const parentsOf = (sid) => (links || []).filter((l) => l.student_id === sid);
  // Mã liên kết của từng em (để cấp lại cho phụ huynh khi cần).
  const linkCodes = new Map(await Promise.all(students.map(async (s) => {
    const { data } = await sb.rpc('student_link_code', { p_student: s.id });
    return [s.id, data?.code || null];
  })));

  listBox.replaceChildren(
    el('p', { class: 'muted small', text: 'Mỗi học sinh có 1 tài khoản đăng nhập bằng mã học sinh để làm bài. Phụ huynh tự đăng ký tài khoản riêng (số điện thoại hoặc email) rồi nhập mã liên kết của con — bấm "Mã liên kết" để xem mã và gửi qua Zalo. Bố và mẹ dùng chung một mã; một phụ huynh theo dõi được các con của mình.' }),
    ...students.map((s) => el('div', { class: 'item' },
      el('div', { class: 'meta' },
        el('b', { text: s.full_name }),
        el('span', { class: 'muted small' }, `Mã: ${s.code} · ${s.birth_date ? `Sinh ngày ${fmtBirth(s.birth_date)} · ` : ''}`,
          !s.parent_id ? el('span', { class: 'badge warn', text: 'Chưa có TK học sinh' })
            : s.password_changed ? el('span', { class: 'badge', text: 'Đã có TK học sinh' })
              : el('span', { class: 'badge warn', text: 'Chưa đổi mật khẩu ban đầu' })),
        linkCodes.get(s.id)
          ? el('span', { class: 'small' }, 'Mã liên kết phụ huynh: ', el('code', { text: formatLinkCode(linkCodes.get(s.id)) }))
          : null,
        el('div', { class: 'small parent-list' },
          parentsOf(s.id).length
            ? parentsOf(s.id).map((p) => el('div', { class: 'parent-row' },
                el('span', { text: `Phụ huynh: ${p.full_name || '(chưa có tên)'} · ${displayLogin(p.login)} ` }),
                el('button', { class: 'btn btn-outline btn-sm', text: 'Cấp lại MK', onclick: () => resetLinkedParent(s, p) }),
                ...(isAdmin() ? [
                  el('button', { class: 'btn btn-outline btn-sm', text: 'Gỡ liên kết', onclick: () => unlinkParent(s, p) }),
                  el('button', { class: 'btn btn-danger btn-sm', text: 'Xóa TK', onclick: () => deleteParentAccount(p) })] : [])))
            : el('span', { class: 'muted', text: 'Chưa có phụ huynh liên kết' }))),
      el('div', { class: 'acts' },
        s.parent_id
          ? el('button', { class: 'btn btn-outline btn-sm', text: 'Cấp lại MK học sinh', onclick: () => parentAccount(s, 'reset_parent') })
          : el('button', { class: 'btn btn-navy btn-sm', text: 'Tạo TK học sinh', onclick: () => parentAccount(s, 'create_parent') }),
        el('button', { class: 'btn btn-gold btn-sm', text: 'Mã liên kết', onclick: () => showLinkCode(s) }),
        isAdmin() ? el('button', { class: 'btn btn-outline btn-sm', text: 'Sửa', onclick: () => editStudent(s) }) : null,
        isAdmin() ? el('button', { class: 'btn btn-danger btn-sm', text: 'Xóa', onclick: () => deleteStudent(s) }) : null))));
}

const fmtBirth = (iso) => String(iso).slice(0, 10).split('-').reverse().join('/');

// Ô ngày sinh dạng DD/MM/YYYY (gõ số, máy tự chèn dấu "/").
function birthInput(name, iso = '') {
  const inp = el('input', { name, inputmode: 'numeric', autocomplete: 'off', placeholder: 'DD/MM/YYYY', maxlength: '10',
    value: iso ? fmtBirth(iso) : '' });
  inp.addEventListener('input', (e) => {
    if (e.inputType && e.inputType.startsWith('delete')) return;
    const d = inp.value.replace(/\D/g, '').slice(0, 8);
    inp.value = [d.slice(0, 2), d.slice(2, 4), d.slice(4)].filter(Boolean).join('/') + (d.length === 2 || d.length === 4 ? '/' : '');
  });
  return inp;
}
// "09/12/2013" → "2013-12-09"; sai định dạng hoặc ngày không có thật → null.
function parseBirth(text) {
  const m = String(text).trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (!m) return null;
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  if (y < 1990 || dt > new Date()) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// Tin nhắn gửi học sinh và phụ huynh (qua Zalo).
function studentInfoText(name, code, password, link) {
  const portal = new URL('../phu-huynh/', location.href).href;
  const lines = [`Trí Đức Math — Thông tin tài khoản của em ${name}`, `Trang đăng nhập: ${portal}`];
  if (password) {
    lines.push(`• Học sinh: đăng nhập bằng mã học sinh ${code}, mật khẩu ban đầu ${password}. Lần đầu đăng nhập, em đặt mật khẩu mới gồm 6 chữ số.`);
  } else {
    lines.push(`• Mã học sinh: ${code}`);
  }
  lines.push(`• Phụ huynh: bấm "Đăng ký tài khoản phụ huynh", đăng ký bằng số điện thoại hoặc email và nhập mã liên kết ${formatLinkCode(link)}. ` +
    'Nếu đã có tài khoản thì đăng nhập rồi nhập mã ở ô "Liên kết với học sinh". Bố và mẹ dùng chung mã này.');
  return lines.join('\n');
}

const copyButton = (text) => copyBox(text);

// Sau khi tạo / cấp lại tài khoản học sinh: hiện mã học sinh, mật khẩu và mã liên kết.
async function showStudentInfo(s, password) {
  const { data, error } = await sb.rpc('student_link_code', { p_student: s.id });
  const link = error ? null : data.code;
  openDialog(`Tài khoản học sinh — ${s.full_name}`, el('div', { class: 'form-grid' },
    el('p', { class: 'muted', text: 'Gửi thông tin này cho học sinh và phụ huynh. Mật khẩu chỉ hiện một lần — hãy sao chép ngay.' }),
    el('div', { class: 'cred' },
      el('div', {}, 'Mã học sinh: ', el('code', { text: s.code })),
      el('div', {}, 'Mật khẩu ban đầu: ', el('code', { text: password })),
      link ? el('div', {}, 'Mã liên kết (cho phụ huynh): ', el('code', { text: formatLinkCode(link) }))
        : el('div', { class: 'error-text small', text: 'Chưa lấy được mã liên kết — bấm "Mã liên kết" ở danh sách để xem.' })),
    link ? copyButton(studentInfoText(s.full_name, s.code, password, link))
      : copyButton(`Trí Đức Math — Tài khoản học sinh ${s.full_name}\nMã học sinh: ${s.code}\nMật khẩu ban đầu: ${password}`)));
}

// Xem mã liên kết của một học sinh (để gửi phụ huynh), hoặc đổi mã mới.
async function showLinkCode(s, renew = false) {
  const { data, error } = await sb.rpc('student_link_code', { p_student: s.id, p_renew: renew });
  if (error) { toast(errMsg(error), 'error'); return; }
  const dlg = openDialog(`Mã liên kết — ${s.full_name}`, el('div', { class: 'form-grid' },
    el('p', { class: 'muted', text: 'Phụ huynh nhập mã này khi đăng ký, hoặc ở ô "Liên kết với học sinh" sau khi đăng nhập. Bố và mẹ dùng chung một mã; mã không hết hạn.' }),
    el('div', { class: 'cred' },
      el('div', {}, 'Mã học sinh: ', el('code', { text: s.code })),
      el('div', {}, 'Mã liên kết: ', el('code', { text: formatLinkCode(data.code) }))),
    copyButton(studentInfoText(s.full_name, s.code, null, data.code)),
    el('button', { class: 'btn btn-outline btn-sm', type: 'button', text: 'Đổi mã mới', onclick: async () => {
      if (!await askConfirm('Đổi mã liên kết mới? Mã cũ sẽ không dùng được nữa. Phụ huynh đã liên kết vẫn giữ nguyên.')) return;
      dlg.close();
      showLinkCode(s, true);
    } })));
  if (renew) toast('Đã đổi mã liên kết mới.');
}

async function unlinkParent(s, p) {
  if (!await askConfirm(`Gỡ liên kết phụ huynh ${p.full_name || displayLogin(p.login)} khỏi em ${s.full_name}? Phụ huynh sẽ không xem được kết quả của em nữa.`)) return;
  const { error } = await sb.rpc('unlink_parent', { p_student: s.id, p_parent: p.parent_id });
  if (error) { toast(errMsg(error), 'error'); return; }
  toast('Đã gỡ liên kết.');
  renderShell();
}

async function deleteParentAccount(p) {
  const who = `${p.full_name || '(chưa có tên)'} · ${displayLogin(p.login)}`;
  if (!await askConfirm(`Xóa tài khoản phụ huynh ${who}? Phụ huynh sẽ không đăng nhập được nữa và mất liên kết với tất cả các con. Không thể khôi phục.`)) return;
  try {
    await callAccounts({ action: 'delete_linked_parent', parent_id: p.parent_id });
    toast('Đã xóa tài khoản phụ huynh.');
    renderShell();
  } catch (err) { toast(errMsg(err), 'error'); }
}

async function resetLinkedParent(s, p) {
  if (!await askConfirm(`Cấp lại mật khẩu cho phụ huynh ${p.full_name || displayLogin(p.login)}?`)) return;
  const password = randomPassword();
  try {
    const out = await callAccounts({ action: 'reset_linked_parent', student_id: s.id, parent_id: p.parent_id, password });
    showCredentials(`Phụ huynh — ${p.full_name || ''}`, displayLogin(out.login || p.login), password, 'Tên đăng nhập');
  } catch (err) { toast(errMsg(err), 'error'); }
}

async function callAccounts(payload) {
  const { data: { session } } = await sb.auth.getSession();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/manage-accounts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify(payload),
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(out.error || `Lỗi máy chủ (${res.status})`);
  return out;
}

async function parentAccount(s, action) {
  const msg = action === 'create_parent'
    ? `Tạo tài khoản học sinh cho em ${s.full_name}?`
    : `Cấp lại mật khẩu cho em ${s.full_name}? Em sẽ nhận một mật khẩu tạm mới (6 chữ số ngẫu nhiên) và phải đổi lại khi đăng nhập.`;
  if (!await askConfirm(msg)) return;
  try {
    const out = await callAccounts({ action, student_id: s.id });
    await showStudentInfo(s, out.password);
    renderShell();
  } catch (err) { toast(errMsg(err), 'error'); }
}

function showCredentials(title, login, password, loginLabel) {
  const portal = new URL('../phu-huynh/', location.href).href;
  const text = loginLabel === 'Mã học sinh'
    ? `Trí Đức Math — Tài khoản học sinh\n${portal}\nMã học sinh: ${login}\nMật khẩu ban đầu: ${password}\n(Lần đầu đăng nhập, em đặt mật khẩu mới gồm 6 chữ số.)`
    : loginLabel === 'Tên đăng nhập'
      ? `Trí Đức Math — Tài khoản phụ huynh\n${portal}\nTên đăng nhập: ${login}\nMật khẩu mới: ${password}\n(Vui lòng đổi mật khẩu sau khi đăng nhập.)`
      : `Trí Đức Math — Trang giáo viên\n${new URL('./', location.href).href}\nEmail: ${login}\nMật khẩu: ${password}`;
  openDialog(title, el('div', { class: 'form-grid' },
    el('p', { class: 'muted', text: 'Gửi thông tin này cho người dùng. Mật khẩu chỉ hiện một lần — hãy sao chép ngay.' }),
    el('div', { class: 'cred' },
      el('div', {}, `${loginLabel}: `, el('code', { text: login })),
      el('div', {}, 'Mật khẩu: ', el('code', { text: password }))),
    copyBox(text)));
}

function editStudent(s) {
  const form = el('form', { class: 'form-grid' },
    el('label', {}, 'Họ tên', el('input', { name: 'name', required: true, value: s.full_name })),
    el('label', {}, 'Ngày sinh (DD/MM/YYYY)', birthInput('birth', s.birth_date)),
    el('label', {}, 'Lớp', el('select', { name: 'cls' }, state.classes.map((c) =>
      el('option', { value: String(c.id), selected: c.id === s.class_id, text: c.name })))),
    el('p', { class: 'muted small', text: `Mã học sinh ${s.code} là tên đăng nhập của học sinh nên không đổi được.` }),
    el('button', { class: 'btn btn-gold', type: 'submit', text: 'Lưu' }));
  const dlg = openDialog(`Sửa học sinh ${s.code}`, form);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const birthText = form.birth.value.trim();
    const birth_date = birthText ? parseBirth(birthText) : null;
    if (birthText && !birth_date) { toast('Ngày sinh chưa đúng. Nhập theo dạng DD/MM/YYYY, ví dụ 09/12/2013.', 'error'); return; }
    const { error } = await sb.from('students')
      .update({ full_name: form.name.value.trim(), birth_date, class_id: Number(form.cls.value) }).eq('id', s.id);
    if (error) { toast(errMsg(error), 'error'); return; }
    dlg.close(); toast('Đã lưu.'); renderShell();
  });
}

async function deleteStudent(s) {
  if (!await askConfirm(`Xóa học sinh ${s.full_name} (${s.code}) cùng toàn bộ kết quả và tài khoản học sinh? Phụ huynh liên kết sẽ không xem được em này nữa. Không thể khôi phục.`)) return;
  if (s.parent_id) {
    try { await callAccounts({ action: 'delete_parent', student_id: s.id }); }
    catch (err) { toast(`Không xóa được tài khoản học sinh: ${errMsg(err)}`, 'error'); return; }
  }
  const { data: rf } = await sb.from('result_files').select('path, results!inner(student_id)').eq('results.student_id', s.id);
  if (rf?.length) await sb.storage.from('tdm').remove(rf.map((x) => x.path));
  const { error } = await sb.from('students').delete().eq('id', s.id);
  if (error) { toast(errMsg(error), 'error'); return; }
  toast('Đã xóa học sinh.');
  renderShell();
}

// =====================================================================
// Quản trị: lớp & giáo viên
// =====================================================================
async function renderAdmin(view) {
  const classForm = el('form', { class: 'row' },
    el('label', { class: 'field' }, 'Tên lớp', el('input', { name: 'name', required: true, placeholder: 'Ví dụ: Toán 9A' })),
    el('label', { class: 'field' }, 'Khối', el('select', { name: 'grade', required: true },
      el('option', { value: '', text: 'Chọn khối', disabled: true, selected: true }),
      ...[6, 7, 8, 9, 10, 11, 12].map((g) => el('option', { value: String(g), text: `Khối ${g}` })))),
    el('button', { class: 'btn btn-gold', type: 'submit', text: 'Tạo lớp', disabled: true }));
  // Chỉ bấm "Tạo lớp" được khi đã nhập tên lớp và chọn khối.
  const syncClassBtn = () => {
    classForm.querySelector('button').disabled = !classForm.name.value.trim() || !classForm.grade.value;
  };
  classForm.addEventListener('input', syncClassBtn);
  classForm.addEventListener('change', syncClassBtn);
  classForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!classForm.name.value.trim()) { toast('Vui lòng nhập tên lớp.', 'error'); return; }
    if (!classForm.grade.value) { toast('Vui lòng chọn khối.', 'error'); return; }
    const { error } = await sb.from('classes').insert({ name: classForm.name.value.trim(), grade: Number(classForm.grade.value) });
    if (error) { toast(errMsg(error), 'error'); return; }
    toast('Đã tạo lớp.'); await loadClasses(); renderShell();
  });

  const teacherForm = el('form', { class: 'row' },
    el('label', { class: 'field' }, 'Họ tên giáo viên', el('input', { name: 'name', required: true })),
    el('label', { class: 'field' }, 'Email đăng nhập', el('input', { name: 'email', type: 'email', required: true })),
    el('button', { class: 'btn btn-gold', type: 'submit', text: 'Tạo tài khoản' }));
  teacherForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = randomPassword();
    const email = teacherForm.email.value.trim().toLowerCase();
    try {
      await callAccounts({ action: 'create_teacher', email, full_name: teacherForm.name.value.trim(), password });
      showCredentials(`Tài khoản giáo viên — ${teacherForm.name.value.trim()}`, email, password, 'Email');
      renderShell();
    } catch (err) { toast(errMsg(err), 'error'); }
  });

  const classList = el('div', { class: 'list' }, state.classes.map((c) => el('div', { class: 'item' },
    el('div', { class: 'meta' }, el('b', { text: c.name }), el('span', { class: 'muted small', text: `Khối ${c.grade}${c.active ? '' : ' · đã ẩn'}` })),
    el('div', { class: 'acts' },
      // Lớp đã ẩn từ trước vẫn hiện lại được; lớp mới không còn nút ẩn.
      ...(c.active ? [] : [el('button', { class: 'btn btn-outline btn-sm', text: 'Hiện lại', onclick: async () => {
        const { error } = await sb.from('classes').update({ active: true }).eq('id', c.id);
        if (error) { toast(errMsg(error), 'error'); return; }
        await loadClasses(); renderShell();
      } })]),
      el('button', { class: 'btn btn-danger btn-sm', text: 'Xóa', onclick: () => deleteClass(c) })))));

  const teacherList = el('div', { class: 'list' }, el('p', { class: 'muted', text: 'Đang tải…' }));

  view.append(
    el('div', { class: 'panel' }, el('h3', { text: 'Lớp học' }), classForm, el('div', { class: 'section-gap' }, classList)),
    el('div', { class: 'panel section-gap' }, el('h3', { text: 'Giáo viên' }), teacherForm, el('div', { class: 'section-gap' }, teacherList)));

  const [{ data: teachers }, { data: links }] = await Promise.all([
    sb.from('profiles').select('id, full_name, email, role').eq('role', 'teacher').order('full_name'),
    sb.from('teacher_classes').select('teacher_id, class_id'),
  ]);
  if (!teachers?.length) { teacherList.replaceChildren(el('p', { class: 'muted', text: 'Chưa có giáo viên nào.' })); return; }
  teacherList.replaceChildren(...teachers.map((t) => {
    const mine = new Set((links || []).filter((l) => l.teacher_id === t.id).map((l) => l.class_id));
    const checks = el('div', { class: 'checks' }, state.classes.map((c) => el('label', {},
      el('input', { type: 'checkbox', checked: mine.has(c.id), onchange: async (e) => {
        const on = e.target.checked;
        const q = on
          ? sb.from('teacher_classes').insert({ teacher_id: t.id, class_id: c.id })
          : sb.from('teacher_classes').delete().eq('teacher_id', t.id).eq('class_id', c.id);
        const { error } = await q;
        if (error) { e.target.checked = !on; toast(errMsg(error), 'error'); return; }
        toast(on ? `Đã giao lớp ${c.name}.` : `Đã bỏ lớp ${c.name}.`);
      } }), c.name)));
    return el('div', { class: 'item' },
      el('div', { class: 'meta', style: 'flex:1 1 100%' },
        el('b', { text: t.full_name || '(chưa có tên)' }),
        el('span', { class: 'muted small', text: t.email || '' }),
        el('span', { class: 'muted small', text: 'Lớp phụ trách:' }), checks),
      el('div', { class: 'acts' },
        el('button', { class: 'btn btn-outline btn-sm', text: 'Cấp lại mật khẩu', onclick: async () => {
          if (!await askConfirm(`Cấp lại mật khẩu cho ${t.full_name}?`)) return;
          const password = randomPassword();
          try {
            await callAccounts({ action: 'reset_teacher', teacher_id: t.id, password });
            showCredentials(`Mật khẩu mới — ${t.full_name}`, t.email || t.full_name, password, 'Email');
          } catch (err) { toast(errMsg(err), 'error'); }
        } }),
        el('button', { class: 'btn btn-danger btn-sm', text: 'Xóa giáo viên', onclick: async () => {
          if (!await askConfirm(`Xóa tài khoản giáo viên ${t.full_name}? Giáo viên này sẽ không đăng nhập được nữa. Điểm và nhận xét đã nhập vẫn được giữ nguyên.`)) return;
          try {
            await callAccounts({ action: 'delete_teacher', teacher_id: t.id });
            toast(`Đã xóa tài khoản ${t.full_name}.`);
            renderShell();
          } catch (err) { toast(errMsg(err), 'error'); }
        } })));
  }));
}

// =====================================================================
// Đăng ký học thử (từ form Liên hệ trên trang chủ) — chỉ quản trị
// =====================================================================
const TRIAL_STATUS = [
  ['moi', 'Mới'], ['da_goi', 'Đã gọi'], ['da_hoc_thu', 'Đã học thử'],
  ['nhap_hoc', 'Đã nhập học'], ['khong_lien_he_duoc', 'Không liên hệ được'],
];
const TRIAL_OPEN = ['moi', 'da_goi'];

// Số đăng ký học thử "Mới" (hiện trên tên thẻ) — chỉ quản trị.
async function refreshTrialCount() {
  if (!isAdmin()) { state.newTrials = 0; return; }
  const { count, error } = await sb.from('trial_signups').select('id', { count: 'exact', head: true }).eq('status', 'moi');
  state.newTrials = error ? 0 : count || 0;
}

async function renderTrials(view) {
  const list = el('div', { class: 'list' }, el('p', { class: 'muted', text: 'Đang tải…' }));
  const showDone = el('input', { type: 'checkbox', checked: !!state.trialsShowDone,
    onchange: (e) => { state.trialsShowDone = e.target.checked; renderShell(); } });
  view.append(el('div', { class: 'panel' },
    el('h3', { text: 'Đăng ký học thử' }),
    el('p', { class: 'muted small', text: 'Phụ huynh gửi từ mục Liên hệ trên trang chủ. Gọi lại rồi cập nhật trạng thái và ghi chú để không bỏ sót.' }),
    el('label', { class: 'muted small' }, showDone, ' Hiện cả các đăng ký đã xong (đã học thử, đã nhập học, không liên hệ được)'),
    el('div', { class: 'section-gap' }, list)));

  let q = sb.from('trial_signups').select('id, created_at, student_name, grade, parent_phone, note, status, admin_note, contacted_at')
    .order('created_at', { ascending: false }).limit(200);
  if (!state.trialsShowDone) q = q.in('status', TRIAL_OPEN);
  const { data, error } = await q;
  if (error) { list.replaceChildren(el('p', { class: 'error-text', text: errMsg(error) })); return; }
  if (!data.length) {
    list.replaceChildren(el('p', { class: 'muted', text: state.trialsShowDone ? 'Chưa có đăng ký nào.' : 'Không có đăng ký nào đang chờ xử lý.' }));
    return;
  }
  const phoneText = (p) => p.replace(/^(\d{4})(\d{3})(\d{3})$/, '$1 $2 $3');
  const statusName = Object.fromEntries(TRIAL_STATUS);
  list.replaceChildren(...data.map((r) => {
    const sel = el('select', { 'aria-label': `Trạng thái đăng ký của ${r.student_name}` },
      TRIAL_STATUS.map(([k, label]) => el('option', { value: k, selected: r.status === k, text: label })));
    const note = el('input', { value: r.admin_note || '', maxlength: '500', placeholder: 'Ví dụ: hẹn thứ 7, 8h' });
    const save = async () => {
      const st = sel.value;
      const { error: e } = await sb.from('trial_signups').update({
        status: st, admin_note: note.value.trim() || null,
        contacted: st !== 'moi',
        contacted_at: st === 'moi' ? null : (r.contacted_at || new Date().toISOString()),
        contacted_by: st === 'moi' ? null : state.user.id,
      }).eq('id', r.id);
      if (e) { toast(errMsg(e), 'error'); return; }
      toast('Đã lưu.');
      await refreshTrialCount();
      renderShell();
    };
    sel.addEventListener('change', save);
    note.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); save(); } });
    return el('div', { class: `item trial-item${r.status === 'moi' ? ' is-new' : ''}` },
      el('div', { class: 'meta' },
        el('b', { text: `${r.student_name} · Lớp ${r.grade}` }),
        el('span', {}, 'Phụ huynh: ', el('a', { href: `tel:${r.parent_phone}`, text: phoneText(r.parent_phone) }),
          ' · ', el('a', { href: `https://zalo.me/${r.parent_phone}`, target: '_blank', rel: 'noopener', text: 'Zalo' })),
        r.note ? el('span', { class: 'small', text: `Ghi chú của phụ huynh: ${r.note}` }) : null,
        el('span', { class: 'muted small' }, `Gửi lúc ${fmtDateTime(r.created_at)} · `,
          el('span', { class: `badge${r.status === 'moi' ? ' warn' : ''}`, text: statusName[r.status] || r.status }))),
      el('div', { class: 'trial-edit' },
        el('label', { class: 'field' }, 'Trạng thái', sel),
        el('label', { class: 'field' }, 'Ghi chú của thầy', note),
        el('div', { class: 'acts' },
          el('button', { class: 'btn btn-gold btn-sm', text: 'Lưu', onclick: save }),
          el('button', { class: 'btn btn-danger btn-sm', text: 'Xóa', onclick: async () => {
            if (!await askConfirm(`Xóa đăng ký của em ${r.student_name}? Không khôi phục được.`)) return;
            const { error: e } = await sb.from('trial_signups').delete().eq('id', r.id);
            if (e) { toast(errMsg(e), 'error'); return; }
            toast('Đã xóa đăng ký.'); await refreshTrialCount(); renderShell();
          } }))));
  }));
}
