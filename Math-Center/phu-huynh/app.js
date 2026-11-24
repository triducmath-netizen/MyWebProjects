import {
  sb, logout, configured, $, el, loginToEmail, phoneToEmail, weekLabel, fmtNum, fmtDateTime,
  toast, errMsg, openDialog, showFiles, notConfiguredNotice,
  passwordField, rememberCheckbox, setRemember, rememberedLogin, saveLogin, askConfirm,
} from '../portal/common.js?v=20261124d';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../portal/config.js';
import { renderQuizList, setReadOnly } from './quiz.js?v=20261124d';

const app = $('#app');
let currentTab = 'quiz';
const top = $('#top-actions');

if (!configured) {
  notConfiguredNotice(app);
} else {
  sb.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') renderLogin();
  });
  start();
}

async function start() {
  const { data: { session } } = await sb.auth.getSession();
  if (session) renderDashboard(session.user);
  else renderLogin();
}

// ---------- Đăng nhập ----------
function renderLogin() {
  top.replaceChildren();
  const tag = document.querySelector('.portal-tag');
  if (tag) tag.textContent = 'Học sinh & PH';
  const msg = el('p', { class: 'error-text small', role: 'alert' });
  const btn = el('button', { class: 'btn btn-gold', type: 'submit', text: 'Đăng nhập' });
  const lastCode = rememberedLogin('parent');
  const form = el('form', { class: 'form-grid', novalidate: true },
    el('label', {}, 'Mã học sinh, hoặc số điện thoại / email của phụ huynh',
      el('input', { name: 'code', required: true, autocomplete: 'username',
        placeholder: 'Ví dụ: TD0123 hoặc 0912345678', value: lastCode })),
    passwordField('Mật khẩu', { name: 'password', required: true, autocomplete: 'current-password' }),
    rememberCheckbox(),
    btn, msg);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const login = form.code.value.trim();
    const password = form.password.value;
    if (!login || !password) { msg.textContent = 'Vui lòng nhập tên đăng nhập và mật khẩu.'; return; }
    btn.disabled = true; btn.textContent = 'Đang đăng nhập…'; msg.textContent = '';
    const remember = form.remember.checked;
    setRemember(remember);
    saveLogin('parent', login, remember);
    const { data, error } = await sb.auth.signInWithPassword({ email: loginToEmail(login), password });
    btn.disabled = false; btn.textContent = 'Đăng nhập';
    if (error) { msg.textContent = 'Tên đăng nhập hoặc mật khẩu không đúng.'; return; }
    renderDashboard(data.user);
  });

  app.replaceChildren(el('div', { class: 'panel narrow-panel' },
    el('h1', { text: 'Học sinh & Phụ huynh' }),
    el('p', { class: 'muted', text: 'Học sinh đăng nhập bằng mã học sinh để làm bài trực tuyến. Phụ huynh đăng nhập bằng số điện thoại hoặc email đã đăng ký để theo dõi kết quả của các con.' }),
    form,
    el('p', { class: 'muted small' }, 'Phụ huynh chưa có tài khoản? ',
      el('a', { href: '#dang-ky', text: 'Đăng ký tài khoản phụ huynh', onclick: (e) => { e.preventDefault(); renderSignup(); } })),
    el('p', { class: 'muted small' },
      el('a', { href: '#quen-mat-khau', text: 'Quên mật khẩu?', onclick: (e) => { e.preventDefault(); forgotPassword(); } }))));
  (lastCode ? form.password : form.code).focus();
}

// Quên mật khẩu: không tự đặt lại (ai biết mã cũng làm được) — nhờ phụ huynh hoặc giáo viên.
function forgotPassword() {
  openDialog('Quên mật khẩu', el('div', { class: 'form-grid' },
    el('h3', { text: 'Học sinh' }),
    el('p', {}, 'Em nhờ bố hoặc mẹ đăng nhập tài khoản phụ huynh và bấm ', el('b', { text: '"Đặt lại mật khẩu cho con"' }),
      ', hoặc nhờ giáo viên Trí Đức Math cấp lại. Em sẽ nhận một mật khẩu tạm gồm 6 chữ số; em đăng nhập bằng mật khẩu đó rồi đặt mật khẩu mới.'),
    el('p', { class: 'muted small', text: 'Vì sao không tự đặt lại được? Nếu ai biết mã học sinh cũng tự đặt lại được thì người khác có thể vào tài khoản của em.' }),
    el('h3', { text: 'Phụ huynh' }),
    el('p', { text: 'Vui lòng liên hệ giáo viên Trí Đức Math qua Zalo để được cấp lại mật khẩu.' })));
}

// ---------- Phụ huynh tự đăng ký ----------
function renderSignup() {
  top.replaceChildren();
  const msg = el('p', { class: 'error-text small', role: 'alert' });
  const btn = el('button', { class: 'btn btn-gold', type: 'submit', text: 'Đăng ký' });
  const form = el('form', { class: 'form-grid', novalidate: true },
    el('label', {}, 'Họ tên phụ huynh', el('input', { name: 'full_name', required: true, autocomplete: 'name' })),
    el('label', {}, 'Số điện thoại hoặc email (dùng để đăng nhập)',
      el('input', { name: 'login', required: true, autocomplete: 'username', placeholder: 'Ví dụ: 0912345678' })),
    passwordField('Mật khẩu (ít nhất 8 ký tự)', { name: 'p1', minlength: '8', required: true, autocomplete: 'new-password' }),
    passwordField('Nhập lại mật khẩu', { name: 'p2', minlength: '8', required: true, autocomplete: 'new-password' }),
    el('div', { class: 'notice' }, el('span', { text: 'Để chắc chắn quý phụ huynh đúng là phụ huynh của em, vui lòng nhập mã liên kết do giáo viên Trí Đức Math gửi.' })),
    el('label', {}, 'Mã liên kết', el('input', { name: 'link_code', required: true, autocapitalize: 'characters', autocomplete: 'off', placeholder: 'Ví dụ: ABCD-EFGH' })),
    btn, msg);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.textContent = '';
    const login = form.login.value.trim();
    if (!form.full_name.value.trim()) { msg.textContent = 'Vui lòng nhập họ tên phụ huynh.'; return; }
    if (!login.includes('@') && !phoneToEmail(login)) { msg.textContent = 'Số điện thoại cần 10 số (ví dụ 0912345678), hoặc nhập email.'; return; }
    if (form.p1.value.length < 8) { msg.textContent = 'Mật khẩu cần ít nhất 8 ký tự.'; return; }
    if (form.p1.value !== form.p2.value) { msg.textContent = 'Hai mật khẩu không khớp.'; return; }
    if (!form.link_code.value.trim()) { msg.textContent = 'Vui lòng nhập mã liên kết.'; return; }
    btn.disabled = true; btn.textContent = 'Đang đăng ký…';
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/parent-signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
        body: JSON.stringify({
          full_name: form.full_name.value.trim(), login, password: form.p1.value,
          link_code: form.link_code.value,
        }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || `Lỗi máy chủ (${res.status})`);
      setRemember(true);
      saveLogin('parent', login, true);
      const { data, error } = await sb.auth.signInWithPassword({ email: out.email, password: form.p1.value });
      if (error) throw error;
      toast(`Đăng ký thành công! Đã liên kết với em ${out.student}.`);
      renderDashboard(data.user);
    } catch (err) {
      msg.textContent = errMsg(err);
      btn.disabled = false; btn.textContent = 'Đăng ký';
    }
  });

  app.replaceChildren(el('div', { class: 'panel narrow-panel' },
    el('h1', { text: 'Đăng ký tài khoản phụ huynh' }),
    el('p', { class: 'muted', text: 'Một tài khoản theo dõi được kết quả của các con học tại Trí Đức Math. Sau khi đăng ký, nhập mã liên kết của em khác ở ô "Liên kết với học sinh".' }),
    form,
    el('p', { class: 'muted small' }, 'Đã có tài khoản? ',
      el('a', { href: '#', text: 'Đăng nhập', onclick: (e) => { e.preventDefault(); renderLogin(); } }))));
  form.full_name.focus();
}

// ---------- Trang kết quả ----------
// Tài khoản học sinh: students.parent_id = chính tài khoản đó (làm bài được).
// Tài khoản phụ huynh: thấy các con đã liên kết (chỉ xem).
let parentMode = false;
async function renderDashboard(user) {
  top.replaceChildren();
  app.replaceChildren(el('p', { class: 'muted', text: 'Đang tải kết quả…' }));

  const { data: profile } = await sb.from('profiles').select('role').eq('id', user.id).single();
  if (profile && profile.role !== 'parent') {
    app.replaceChildren(el('div', { class: 'panel narrow-panel' },
      el('h2', { text: 'Đây là tài khoản giáo viên' }),
      el('p', {}, 'Vui lòng dùng ', el('a', { href: '../giao-vien/', text: 'trang giáo viên' }), '.')));
    return;
  }

  const { data: students, error } = await sb
    .from('students').select('id, code, full_name, parent_id, password_changed, classes(name, grade)').order('full_name');
  if (error) { app.replaceChildren(el('p', { class: 'error-text', text: errMsg(error) })); return; }
  const own = students.find((x) => x.parent_id === user.id);
  parentMode = !own;
  setReadOnly(parentMode);
  const tag = document.querySelector('.portal-tag');
  if (tag) tag.textContent = parentMode ? 'Phụ huynh' : 'Học sinh';
  // Học sinh còn dùng mật khẩu ban đầu / mật khẩu tạm do người khác cấp → bắt đổi trước khi dùng.
  if (own && !own.password_changed) {
    top.replaceChildren(el('button', { class: 'btn btn-outline btn-sm', onclick: logout, text: 'Đăng xuất' }));
    const form = studentPasswordForm(() => { toast('Đã đổi mật khẩu. Chào mừng em!'); renderDashboard(user); });
    app.replaceChildren(el('div', { class: 'panel narrow-panel' },
      el('h1', { text: `Chào em ${own.full_name}!` }),
      el('p', { class: 'muted', text: 'Đây là lần đầu em đăng nhập. Em hãy đặt mật khẩu mới gồm đúng 6 chữ số và ghi nhớ nó. Mã học sinh của em không đổi.' }),
      form));
    form.querySelector('input').focus();
    return;
  }
  top.replaceChildren(
    ...(parentMode && students.length ? [el('button', { class: 'btn btn-gold btn-sm', onclick: addChild, text: '+ Liên kết với học sinh' })] : []),
    el('button', { class: 'btn btn-outline btn-sm', onclick: changePassword, text: 'Đổi mật khẩu' }),
    el('button', { class: 'btn btn-outline btn-sm', onclick: logout, text: 'Đăng xuất' }));
  if (!students.length) {
    const form = linkForm();
    app.replaceChildren(el('div', { class: 'panel narrow-panel' },
      el('h2', { text: 'Liên kết với học sinh' }),
      el('p', { class: 'muted', text: 'Nhập mã liên kết do giáo viên Trí Đức Math gửi để xem kết quả học tập của con. Chỉ cần liên kết một lần; những lần sau thông tin của con tự hiện.' }),
      form));
    form.querySelector('input').focus();
    return;
  }
  showStudent(students, own || students[0]);
}

// Ô "Liên kết với học sinh": mỗi lần nhập 1 mã liên kết = liên kết với 1 học sinh.
function linkForm(onDone) {
  const msg = el('p', { class: 'small error-text', role: 'alert' });
  const btn = el('button', { class: 'btn btn-gold', type: 'submit', text: 'Liên kết' });
  const form = el('form', { class: 'form-grid' },
    el('label', {}, 'Mã liên kết', el('input', { name: 'link_code', required: true, autocapitalize: 'characters', autocomplete: 'off', placeholder: 'Ví dụ: ABCD-EFGH' })),
    btn, msg);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.link_code.value.trim()) { msg.textContent = 'Vui lòng nhập mã liên kết.'; return; }
    btn.disabled = true; msg.textContent = '';
    const { data, error } = await sb.rpc('link_child_by_code', { p_link_code: form.link_code.value });
    btn.disabled = false;
    if (error) { msg.textContent = errMsg(error); return; }
    if (!data?.ok) { msg.textContent = data?.error || 'Không liên kết được.'; return; }
    onDone?.();
    toast(`Đã liên kết với em ${data.full_name}.`);
    const { data: { user } } = await sb.auth.getUser();
    renderDashboard(user);
  });
  return form;
}

// Phụ huynh đã có con: liên kết thêm (mở hộp thoại).
function addChild() {
  let dlg;
  const form = linkForm(() => dlg.close());
  dlg = openDialog('Liên kết với học sinh', el('div', { class: 'form-grid' },
    el('p', { class: 'muted small', text: 'Nhập mã liên kết của em do giáo viên Trí Đức Math gửi. Mỗi mã liên kết với một học sinh.' }),
    form));
  form.querySelector('input').focus();
}


async function showStudent(students, s, tab = currentTab) {
  currentTab = tab;
  const head = el('div', { class: 'student-head' },
    el('div', {},
      el('p', { class: 'eyebrow dark', text: parentMode ? 'Con của bạn' : 'Học sinh' }),
      el('h1', { text: s.full_name }),
      el('p', { class: 'muted', text: `Mã HS: ${s.code}${s.classes ? ' · ' + s.classes.name : ''}` })));

  const switcher = students.length > 1
    ? el('div', { class: 'child-switch' }, students.map((x) =>
        el('button', { class: `btn btn-sm ${x.id === s.id ? 'btn-navy' : 'btn-outline'}`, text: x.full_name,
          onclick: () => showStudent(students, x) })))
    : null;

  const tabs = el('div', { class: 'tabs', role: 'tablist' },
    [['quiz', parentMode ? 'Bài trực tuyến đã làm' : 'Bài tập trực tuyến'], ['weekly', 'Kết quả hằng tuần']].map(([id, label]) =>
      el('button', { class: 'tab', role: 'tab', 'aria-selected': String(tab === id), text: label,
        onclick: () => showStudent(students, s, id) })));

  if (parentMode) {
    head.append(el('div', { class: 'acts' },
      el('button', { class: 'btn btn-outline btn-sm', text: 'Đặt lại mật khẩu cho con', onclick: () => resetChildPassword(s) })));
  }
  const listBox = el('div', {}, el('p', { class: 'muted', text: 'Đang tải…' }));
  app.replaceChildren(...[switcher, head, tabs, listBox].filter(Boolean));
  if (tab === 'quiz') { renderQuizList(listBox, s); return; }

  const { data: rows, error } = await sb
    .from('results')
    .select('id, score, comment, updated_at, result_files(path), assessments(id, title, week_start, max_score, assessment_files(path))')
    .eq('student_id', s.id);
  if (error) { listBox.replaceChildren(el('p', { class: 'error-text', text: errMsg(error) })); return; }

  rows.sort((a, b) => b.assessments.week_start.localeCompare(a.assessments.week_start) || b.id - a.id);

  if (!rows.length) {
    listBox.replaceChildren(el('div', { class: 'panel empty' },
      el('h2', { text: 'Chưa có kết quả' }),
      el('p', { class: 'muted', text: 'Kết quả bài kiểm tra hằng tuần sẽ hiện ở đây sau khi giáo viên cập nhật.' })));
    return;
  }

  // Điểm quy về thang 10 để so sánh giữa các bài có điểm tối đa khác nhau.
  const scored = rows.filter((r) => r.score != null);
  const on10 = scored.map((r) => (Number(r.score) / Number(r.assessments.max_score)) * 10);
  const avg = on10.length ? on10.reduce((a, b) => a + b, 0) / on10.length : null;
  const latest = scored[0];

  const stats = el('div', { class: 'stats' },
    stat('Số bài đã chấm', String(scored.length)),
    stat('Điểm trung bình (thang 10)', avg == null ? '—' : fmtNum(Math.round(avg * 10) / 10)),
    stat('Bài gần nhất', latest ? `${fmtNum(latest.score)} / ${fmtNum(latest.assessments.max_score)}` : '—'));

  listBox.replaceChildren(stats, el('h2', { text: 'Theo từng tuần' }), ...rows.map(weekCard));
}

function stat(k, v) {
  return el('div', { class: 'stat' }, el('div', { class: 'k', text: k }), el('div', { class: 'v', text: v }));
}

function weekCard(r) {
  const a = r.assessments;
  const testFiles = a.assessment_files.map((f) => f.path);
  const workFiles = r.result_files.map((f) => f.path);
  return el('article', { class: 'week' },
    el('div', {},
      el('div', { class: 'when', text: weekLabel(a.week_start) }),
      el('h3', { text: a.title })),
    r.score == null
      ? el('div', { class: 'score pending' }, el('b', { text: 'Chưa chấm' }))
      : el('div', { class: 'score', 'aria-label': `Điểm ${fmtNum(r.score)} trên ${fmtNum(a.max_score)}` },
          el('b', { text: fmtNum(r.score) }), el('span', { text: ` / ${fmtNum(a.max_score)}` })),
    el('p', { class: 'muted small', text: `Cập nhật: ${fmtDateTime(r.updated_at)}` }),
    r.comment ? el('div', { class: 'comment' }, el('span', { class: 'lbl', text: 'Nhận xét của giáo viên' }), r.comment) : null,
    el('div', { class: 'week-actions' },
      el('button', { class: 'btn btn-outline btn-sm', disabled: !testFiles.length,
        text: testFiles.length ? `Xem đề bài (${testFiles.length})` : 'Chưa có đề bài',
        onclick: () => showFiles(`Đề bài — ${a.title}`, testFiles) }),
      el('button', { class: 'btn btn-outline btn-sm', disabled: !workFiles.length,
        text: workFiles.length ? `Xem bài làm (${workFiles.length})` : 'Chưa có bài làm',
        onclick: () => showFiles(`Bài làm — ${a.title}`, workFiles) })));
}

// Phụ huynh đặt lại mật khẩu cho con (khi con quên).
async function resetChildPassword(s) {
  if (!await askConfirm(`Đặt lại mật khẩu cho em ${s.full_name}? Em sẽ nhận một mật khẩu tạm mới, đăng nhập rồi đặt mật khẩu mới.`)) return;
  try {
    const { data: { session } } = await sb.auth.getSession();
    const res = await fetch(`${SUPABASE_URL}/functions/v1/manage-accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}`, apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify({ action: 'parent_reset_child_password', student_id: s.id }),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.error || `Lỗi máy chủ (${res.status})`);
    openDialog(`Đã đặt lại mật khẩu cho em ${s.full_name}`, el('div', { class: 'form-grid' },
      el('div', { class: 'cred' },
        el('div', {}, 'Mã học sinh: ', el('code', { text: out.login_code })),
        el('div', {}, 'Mật khẩu tạm: ', el('code', { text: out.password }))),
      el('p', { class: 'muted', text: 'Em đăng nhập bằng mã và mật khẩu tạm này, rồi đặt mật khẩu mới gồm 6 chữ số.' })));
  } catch (err) { toast(errMsg(err), 'error'); }
}

// ---------- Đổi mật khẩu ----------
// Học sinh: mật khẩu đúng 6 chữ số, đổi qua máy chủ (manage-accounts) để ghi nhận đã đổi mật khẩu ban đầu.
function studentPasswordForm(onDone) {
  const msg = el('p', { class: 'small error-text', role: 'status' });
  const btn = el('button', { class: 'btn btn-gold', type: 'submit', text: 'Lưu mật khẩu mới' });
  const pin = { inputmode: 'numeric', pattern: '[0-9]{6}', maxlength: '6', minlength: '6', required: true, autocomplete: 'new-password' };
  const form = el('form', { class: 'form-grid' },
    passwordField('Mật khẩu mới (đúng 6 chữ số)', { name: 'p1', ...pin }),
    passwordField('Nhập lại mật khẩu mới', { name: 'p2', ...pin }),
    btn, msg);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const p1 = form.p1.value.trim();
    if (!/^\d{6}$/.test(p1)) { msg.textContent = 'Mật khẩu phải gồm đúng 6 chữ số (0–9).'; return; }
    if (p1 !== form.p2.value.trim()) { msg.textContent = 'Hai mật khẩu không khớp.'; return; }
    btn.disabled = true; msg.textContent = '';
    try {
      const { data: { session } } = await sb.auth.getSession();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/manage-accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}`, apikey: SUPABASE_ANON_KEY },
        body: JSON.stringify({ action: 'change_student_password', password: p1 }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || `Lỗi máy chủ (${res.status})`);
      // Đăng nhập lại bằng mật khẩu mới để trình duyệt giữ phiên (và đề nghị lưu mật khẩu).
      const { data: { user } } = await sb.auth.getUser();
      await sb.auth.signInWithPassword({ email: user.email, password: p1 });
      onDone();
    } catch (err) {
      msg.textContent = errMsg(err);
      btn.disabled = false;
    }
  });
  return form;
}

function changePassword() {
  if (!parentMode) {
    const dlg = openDialog('Đổi mật khẩu', studentPasswordForm(() => { dlg.close(); toast('Đã đổi mật khẩu.'); }));
    return;
  }
  const msg = el('p', { class: 'small', role: 'status' });
  const btn = el('button', { class: 'btn btn-gold', type: 'submit', text: 'Lưu mật khẩu mới' });
  const form = el('form', { class: 'form-grid' },
    passwordField('Mật khẩu mới (ít nhất 8 ký tự)', { name: 'p1', minlength: '8', required: true, autocomplete: 'new-password' }),
    passwordField('Nhập lại mật khẩu mới', { name: 'p2', minlength: '8', required: true, autocomplete: 'new-password' }),
    btn, msg);
  const dlg = openDialog('Đổi mật khẩu', form);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.className = 'small error-text';
    if (form.p1.value.length < 8) { msg.textContent = 'Mật khẩu cần ít nhất 8 ký tự.'; return; }
    if (form.p1.value !== form.p2.value) { msg.textContent = 'Hai mật khẩu không khớp.'; return; }
    btn.disabled = true;
    const { error } = await sb.auth.updateUser({ password: form.p1.value });
    btn.disabled = false;
    if (error) { msg.textContent = errMsg(error); return; }
    dlg.close();
    toast('Đã đổi mật khẩu.');
  });
}
