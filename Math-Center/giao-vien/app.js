import {
  sb, configured, $, el, normalizeCode, mondayOf, toISODate, weekLabel, fmtNum,
  randomPassword, uploadTo, toast, errMsg, openDialog, showFiles, notConfiguredNotice,
  passwordField, rememberCheckbox, setRemember, rememberedLogin, saveLogin,
} from '../portal/common.js';
import { SUPABASE_URL } from '../portal/config.js';

const app = $('#app');
const top = $('#top-actions');

const state = { user: null, profile: null, classes: [], tab: 'grades', classId: null, assessmentId: null };
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
      el('button', { class: 'btn btn-outline', onclick: () => sb.auth.signOut(), text: 'Đăng xuất' })));
    return;
  }
  top.replaceChildren(
    el('span', { class: 'who', text: profile.full_name || user.email }),
    el('button', { class: 'btn btn-outline btn-sm', onclick: () => sb.auth.signOut(), text: 'Đăng xuất' }));
  await loadClasses();
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
  const tabs = [['grades', 'Nhập kết quả'], ['students', 'Học sinh & tài khoản']];
  if (isAdmin()) tabs.push(['admin', 'Lớp & giáo viên']);
  const view = el('div');
  app.replaceChildren(
    el('div', { class: 'tabs', role: 'tablist' }, tabs.map(([id, label]) =>
      el('button', { class: 'tab', role: 'tab', 'aria-selected': String(state.tab === id), text: label,
        onclick: () => { state.tab = id; renderShell(); } }))),
    view);
  if (!state.classes.length && state.tab !== 'admin') {
    view.append(el('div', { class: 'panel empty' },
      el('h2', { text: 'Bạn chưa được phân công lớp nào' }),
      el('p', { class: 'muted', text: isAdmin()
        ? 'Hãy tạo lớp trong thẻ "Lớp & giáo viên".'
        : 'Vui lòng nhờ quản trị viên phân công lớp cho bạn.' })));
    return;
  }
  if (state.tab === 'grades') renderGrades(view);
  else if (state.tab === 'students') renderStudents(view);
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
    existing ? null : el('label', {}, 'File đề bài (ảnh hoặc PDF, có thể chọn nhiều)',
      el('input', { name: 'files', type: 'file', accept: 'image/*,application/pdf', multiple: true })),
    el('button', { class: 'btn btn-gold', type: 'submit', text: existing ? 'Lưu thay đổi' : 'Tạo bài kiểm tra' }));
  const dlg = openDialog(existing ? 'Sửa bài kiểm tra' : 'Bài kiểm tra mới', form);
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
        const { data, error } = await sb.from('assessments').insert({ ...row, class_id: state.classId }).select('id').single();
        if (error) throw error;
        id = data.id;
        await attachFiles('assessment', id, form.files.files);
      }
      state.assessmentId = id;
      dlg.close();
      toast('Đã lưu bài kiểm tra.');
      renderShell();
    } catch (err) {
      toast(errMsg(err), 'error');
      btn.disabled = false; btn.textContent = 'Thử lại';
    }
  });
}

// Tải file lên và ghi vào bảng tương ứng.
async function attachFiles(kind, id, files) {
  const folder = kind === 'assessment' ? `assessments/${id}` : `results/${id}`;
  const table = kind === 'assessment' ? 'assessment_files' : 'result_files';
  const key = kind === 'assessment' ? 'assessment_id' : 'result_id';
  for (const f of files) {
    if (f.size > 25 * 1024 * 1024) throw new Error(`File "${f.name}" quá lớn.`);
    const path = await uploadTo(folder, f);
    const { error } = await sb.from(table).insert({ [key]: id, path });
    if (error) { await sb.storage.from('tdm').remove([path]); throw error; }
  }
}

async function manageFiles(kind, id, title, onDone) {
  const table = kind === 'assessment' ? 'assessment_files' : 'result_files';
  const key = kind === 'assessment' ? 'assessment_id' : 'result_id';
  const { data: rows, error } = await sb.from(table).select('id, path').eq(key, id).order('id');
  if (error) { toast(errMsg(error), 'error'); return; }
  const list = el('div', { class: 'list' }, rows.length ? rows.map((r, i) => el('div', { class: 'item' },
    el('span', { text: `File ${i + 1} (${r.path.endsWith('.pdf') ? 'PDF' : 'ảnh'})` }),
    el('div', { class: 'acts' },
      el('button', { class: 'btn btn-outline btn-sm', text: 'Xem', onclick: () => showFiles(title, [r.path]) }),
      el('button', { class: 'btn btn-danger btn-sm', text: 'Xóa', onclick: async () => {
        if (!confirm('Xóa file này? Không thể khôi phục.')) return;
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
        el('input', { type: 'file', accept: 'image/*,application/pdf', multiple: true, onchange: async (e) => {
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
  const files = el('input', { type: 'file', accept: 'image/*,application/pdf', multiple: true, 'aria-label': `Bài làm của ${s.full_name}` });
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
  if (!confirm(`Xóa bài "${a.title}" cùng toàn bộ điểm, nhận xét và file của bài này? Không thể khôi phục.`)) return;
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

// =====================================================================
// Học sinh & tài khoản phụ huynh
// =====================================================================
async function renderStudents(view) {
  const listBox = el('div', { class: 'list section-gap' }, el('p', { class: 'muted', text: 'Đang tải…' }));
  const addForm = el('form', { class: 'row' },
    el('label', { class: 'field' }, 'Mã học sinh', el('input', { name: 'code', required: true, placeholder: 'TD0123', autocapitalize: 'characters' })),
    el('label', { class: 'field' }, 'Họ tên học sinh', el('input', { name: 'name', required: true })),
    el('button', { class: 'btn btn-gold', type: 'submit', text: 'Thêm học sinh' }));
  addForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = normalizeCode(addForm.code.value);
    if (!/^[A-Z0-9]{3,20}$/.test(code)) { toast('Mã học sinh chỉ gồm chữ không dấu và số, 3–20 ký tự.', 'error'); return; }
    const { error } = await sb.from('students').insert({ code, full_name: addForm.name.value.trim(), class_id: state.classId });
    if (error) { toast(errMsg(error), 'error'); return; }
    toast(`Đã thêm học sinh ${code}.`);
    renderShell();
  });

  view.append(
    el('div', { class: 'panel' }, el('div', { class: 'row' }, classSelect(renderShell, { includeInactive: true }))),
    isAdmin()
      ? el('div', { class: 'panel section-gap' }, el('h3', { text: 'Thêm học sinh vào lớp này' }), addForm)
      : el('p', { class: 'muted small section-gap', text: 'Chỉ quản trị viên được thêm, sửa, chuyển lớp hoặc xóa học sinh. Cần thay đổi, vui lòng liên hệ quản trị viên.' }),
    listBox);

  const { data: students, error } = await sb.from('students')
    .select('id, code, full_name, class_id, parent_id').eq('class_id', state.classId).order('full_name');
  if (error) { listBox.replaceChildren(el('p', { class: 'error-text', text: errMsg(error) })); return; }
  if (!students.length) { listBox.replaceChildren(el('p', { class: 'muted', text: 'Lớp này chưa có học sinh.' })); return; }

  listBox.replaceChildren(...students.map((s) => el('div', { class: 'item' },
    el('div', { class: 'meta' },
      el('b', { text: s.full_name }),
      el('span', { class: 'muted small' }, `Mã: ${s.code} · `,
        s.parent_id ? el('span', { class: 'badge', text: 'Đã có tài khoản PH' }) : el('span', { class: 'badge warn', text: 'Chưa có tài khoản PH' }))),
    el('div', { class: 'acts' },
      s.parent_id
        ? el('button', { class: 'btn btn-outline btn-sm', text: 'Cấp lại mật khẩu', onclick: () => parentAccount(s, 'reset_parent') })
        : el('button', { class: 'btn btn-navy btn-sm', text: 'Tạo tài khoản PH', onclick: () => parentAccount(s, 'create_parent') }),
      isAdmin() ? el('button', { class: 'btn btn-outline btn-sm', text: 'Sửa', onclick: () => editStudent(s) }) : null,
      isAdmin() ? el('button', { class: 'btn btn-danger btn-sm', text: 'Xóa', onclick: () => deleteStudent(s) }) : null))));
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
  const verb = action === 'create_parent' ? 'Tạo tài khoản' : 'Cấp lại mật khẩu';
  if (!confirm(`${verb} cho phụ huynh của ${s.full_name}?`)) return;
  const password = randomPassword();
  try {
    await callAccounts({ action, student_id: s.id, password });
    showCredentials(`Tài khoản phụ huynh — ${s.full_name}`, s.code, password, 'Mã học sinh');
    renderShell();
  } catch (err) { toast(errMsg(err), 'error'); }
}

function showCredentials(title, login, password, loginLabel) {
  const portal = new URL('../phu-huynh/', location.href).href;
  const text = loginLabel === 'Mã học sinh'
    ? `Trí Đức Math — Cổng phụ huynh\n${portal}\nMã học sinh: ${login}\nMật khẩu: ${password}\n(Vui lòng đổi mật khẩu sau khi đăng nhập.)`
    : `Trí Đức Math — Trang giáo viên\n${new URL('./', location.href).href}\nEmail: ${login}\nMật khẩu: ${password}`;
  openDialog(title, el('div', { class: 'form-grid' },
    el('p', { class: 'muted', text: 'Gửi thông tin này cho người dùng. Mật khẩu chỉ hiện một lần — hãy sao chép ngay.' }),
    el('div', { class: 'cred' },
      el('div', {}, `${loginLabel}: `, el('code', { text: login })),
      el('div', {}, 'Mật khẩu: ', el('code', { text: password }))),
    el('button', { class: 'btn btn-gold', text: 'Sao chép để gửi qua Zalo', onclick: async (e) => {
      try { await navigator.clipboard.writeText(text); e.target.textContent = 'Đã sao chép ✓'; }
      catch { toast('Không sao chép được, vui lòng chép tay.', 'error'); }
    } })));
}

function editStudent(s) {
  const form = el('form', { class: 'form-grid' },
    el('label', {}, 'Họ tên', el('input', { name: 'name', required: true, value: s.full_name })),
    el('label', {}, 'Lớp', el('select', { name: 'cls' }, state.classes.map((c) =>
      el('option', { value: String(c.id), selected: c.id === s.class_id, text: c.name })))),
    el('p', { class: 'muted small', text: `Mã học sinh ${s.code} là tên đăng nhập của phụ huynh nên không đổi được.` }),
    el('button', { class: 'btn btn-gold', type: 'submit', text: 'Lưu' }));
  const dlg = openDialog(`Sửa học sinh ${s.code}`, form);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const { error } = await sb.from('students')
      .update({ full_name: form.name.value.trim(), class_id: Number(form.cls.value) }).eq('id', s.id);
    if (error) { toast(errMsg(error), 'error'); return; }
    dlg.close(); toast('Đã lưu.'); renderShell();
  });
}

async function deleteStudent(s) {
  if (!confirm(`Xóa học sinh ${s.full_name} (${s.code}) cùng toàn bộ kết quả và tài khoản phụ huynh? Không thể khôi phục.`)) return;
  if (s.parent_id) {
    try { await callAccounts({ action: 'delete_parent', student_id: s.id }); }
    catch (err) { toast(`Không xóa được tài khoản phụ huynh: ${errMsg(err)}`, 'error'); return; }
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
    el('label', { class: 'field' }, 'Khối', el('select', { name: 'grade' },
      [6, 7, 8, 9, 10, 11, 12].map((g) => el('option', { value: String(g), text: `Lớp ${g}` })))),
    el('button', { class: 'btn btn-gold', type: 'submit', text: 'Tạo lớp' }));
  classForm.addEventListener('submit', async (e) => {
    e.preventDefault();
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
      el('button', { class: 'btn btn-outline btn-sm', text: c.active ? 'Ẩn lớp' : 'Hiện lại', onclick: async () => {
        const { error } = await sb.from('classes').update({ active: !c.active }).eq('id', c.id);
        if (error) { toast(errMsg(error), 'error'); return; }
        await loadClasses(); renderShell();
      } })))));

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
          if (!confirm(`Cấp lại mật khẩu cho ${t.full_name}?`)) return;
          const password = randomPassword();
          try {
            await callAccounts({ action: 'reset_teacher', teacher_id: t.id, password });
            showCredentials(`Mật khẩu mới — ${t.full_name}`, t.email || t.full_name, password, 'Email');
          } catch (err) { toast(errMsg(err), 'error'); }
        } }),
        el('button', { class: 'btn btn-danger btn-sm', text: 'Xóa giáo viên', onclick: async () => {
          if (!confirm(`Xóa tài khoản giáo viên ${t.full_name}? Giáo viên này sẽ không đăng nhập được nữa. Điểm và nhận xét đã nhập vẫn được giữ nguyên.`)) return;
          try {
            await callAccounts({ action: 'delete_teacher', teacher_id: t.id });
            toast(`Đã xóa tài khoản ${t.full_name}.`);
            renderShell();
          } catch (err) { toast(errMsg(err), 'error'); }
        } })));
  }));
}
