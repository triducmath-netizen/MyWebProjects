import {
  sb, configured, $, el, codeToEmail, normalizeCode, weekLabel, fmtNum, fmtDateTime,
  toast, errMsg, openDialog, showFiles, notConfiguredNotice,
  passwordField, rememberCheckbox, setRemember, rememberedLogin, saveLogin,
} from '../portal/common.js';
import { renderQuizList } from './quiz.js';

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
  const msg = el('p', { class: 'error-text small', role: 'alert' });
  const btn = el('button', { class: 'btn btn-gold', type: 'submit', text: 'Đăng nhập' });
  const lastCode = rememberedLogin('parent');
  const form = el('form', { class: 'form-grid', novalidate: true },
    el('label', {}, 'Mã học sinh',
      el('input', { name: 'code', required: true, autocomplete: 'username', autocapitalize: 'characters',
        placeholder: 'Ví dụ: TD0123', value: lastCode })),
    passwordField('Mật khẩu', { name: 'password', required: true, autocomplete: 'current-password' }),
    rememberCheckbox(),
    btn, msg);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = normalizeCode(form.code.value);
    const password = form.password.value;
    if (!code || !password) { msg.textContent = 'Vui lòng nhập mã học sinh và mật khẩu.'; return; }
    btn.disabled = true; btn.textContent = 'Đang đăng nhập…'; msg.textContent = '';
    const remember = form.remember.checked;
    setRemember(remember);
    saveLogin('parent', code, remember);
    const { data, error } = await sb.auth.signInWithPassword({ email: codeToEmail(code), password });
    btn.disabled = false; btn.textContent = 'Đăng nhập';
    if (error) { msg.textContent = 'Mã học sinh hoặc mật khẩu không đúng.'; return; }
    renderDashboard(data.user);
  });

  app.replaceChildren(el('div', { class: 'panel narrow-panel' },
    el('h1', { text: 'Học sinh & Phụ huynh' }),
    el('p', { class: 'muted', text: 'Đăng nhập bằng mã học sinh và mật khẩu do giáo viên Trí Đức Math cung cấp. Học sinh làm bài trực tuyến, phụ huynh theo dõi kết quả.' }),
    form,
    el('p', { class: 'muted small', text: 'Quên mật khẩu? Liên hệ giáo viên để được cấp lại.' })));
  (lastCode ? form.password : form.code).focus();
}

// ---------- Trang kết quả ----------
async function renderDashboard(user) {
  top.replaceChildren(
    el('button', { class: 'btn btn-outline btn-sm', onclick: changePassword, text: 'Đổi mật khẩu' }),
    el('button', { class: 'btn btn-outline btn-sm', onclick: () => sb.auth.signOut(), text: 'Đăng xuất' }));
  app.replaceChildren(el('p', { class: 'muted', text: 'Đang tải kết quả…' }));

  const { data: profile } = await sb.from('profiles').select('role').eq('id', user.id).single();
  if (profile && profile.role !== 'parent') {
    app.replaceChildren(el('div', { class: 'panel narrow-panel' },
      el('h2', { text: 'Đây là tài khoản giáo viên' }),
      el('p', {}, 'Vui lòng dùng ', el('a', { href: '../giao-vien/', text: 'trang giáo viên' }), '.')));
    return;
  }

  const { data: students, error } = await sb
    .from('students').select('id, code, full_name, classes(name)').order('full_name');
  if (error) { app.replaceChildren(el('p', { class: 'error-text', text: errMsg(error) })); return; }
  if (!students.length) {
    app.replaceChildren(el('div', { class: 'panel empty' },
      el('h2', { text: 'Chưa có học sinh nào được gắn với tài khoản này' }),
      el('p', { class: 'muted', text: 'Vui lòng liên hệ giáo viên để được hỗ trợ.' })));
    return;
  }
  showStudent(students, students[0]);
}

async function showStudent(students, s, tab = currentTab) {
  currentTab = tab;
  const head = el('div', { class: 'student-head' },
    el('div', {},
      el('p', { class: 'eyebrow dark', text: 'Học sinh' }),
      el('h1', { text: s.full_name }),
      el('p', { class: 'muted', text: `Mã HS: ${s.code}${s.classes ? ' · ' + s.classes.name : ''}` })));

  const switcher = students.length > 1
    ? el('div', { class: 'child-switch' }, students.map((x) =>
        el('button', { class: `btn btn-sm ${x.id === s.id ? 'btn-navy' : 'btn-outline'}`, text: x.full_name,
          onclick: () => showStudent(students, x) })))
    : null;

  const tabs = el('div', { class: 'tabs', role: 'tablist' },
    [['quiz', 'Bài tập trực tuyến'], ['weekly', 'Kết quả hằng tuần']].map(([id, label]) =>
      el('button', { class: 'tab', role: 'tab', 'aria-selected': String(tab === id), text: label,
        onclick: () => showStudent(students, s, id) })));

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

// ---------- Đổi mật khẩu ----------
function changePassword() {
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
