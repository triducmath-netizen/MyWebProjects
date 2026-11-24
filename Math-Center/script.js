// Menu trên điện thoại
const toggle = document.querySelector('.nav-toggle');
const menu = document.getElementById('menu');

toggle.addEventListener('click', () => {
  const open = toggle.getAttribute('aria-expanded') === 'true';
  toggle.setAttribute('aria-expanded', String(!open));
  toggle.setAttribute('aria-label', open ? 'Mở menu' : 'Đóng menu');
  menu.classList.toggle('open', !open);
});

menu.addEventListener('click', (e) => {
  if (e.target.closest('a')) {
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Mở menu');
    menu.classList.remove('open');
  }
});

// Năm ở chân trang
document.getElementById('year').textContent = new Date().getFullYear();

// Form đăng ký học thử: lưu thẳng vào Supabase (bảng trial_signups — khách chỉ được thêm,
// không đọc được). Quản trị xem danh sách ở trang giáo viên → thẻ "Đăng ký học thử".
// Nếu không gửi được (mất mạng…), hiện số điện thoại / Zalo và cách gửi bằng email.
const CONTACT_EMAIL = 'triducmath@gmail.com';
const form = document.getElementById('signup-form');
const msg = form.querySelector('.form-msg');
const submitBtn = form.querySelector('button[type="submit"]');

// "0912 345 678", "+84 912345678", "84912345678" → "0912345678"; sai → null
function normalizePhone(raw) {
  let d = String(raw || '').replace(/[^0-9]/g, '');
  if (d.startsWith('84') && d.length === 11) d = '0' + d.slice(2);
  return /^0[0-9]{9}$/.test(d) ? d : null;
}

function showMsg(parts, isError) {
  msg.replaceChildren(...parts.map((p) => {
    if (typeof p === 'string') return document.createTextNode(p);
    const a = document.createElement('a');
    a.href = p.href; a.textContent = p.text;
    return a;
  }));
  msg.classList.toggle('error', !!isError);
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (form.website && form.website.value) return; // ô bẫy: chỉ máy gửi tự động mới điền
  let ok = true;
  form.querySelectorAll('[required]').forEach((el) => {
    const v = el.value.trim();
    const bad = !v || (el.name === 'phone' && !normalizePhone(v)) || (el.name === 'name' && v.length < 2);
    el.classList.toggle('invalid', bad);
    el.setAttribute('aria-invalid', String(bad));
    if (bad) ok = false;
  });
  if (!ok) {
    showMsg(['Vui lòng điền đủ họ tên, lớp và số điện thoại 10 số (ví dụ 0912345678).'], true);
    return;
  }

  const d = new FormData(form);
  const row = {
    student_name: String(d.get('name')).trim().slice(0, 80),
    grade: parseInt(String(d.get('grade')).replace(/[^0-9]/g, ''), 10),
    parent_phone: normalizePhone(d.get('phone')),
    note: String(d.get('note') || '').trim().slice(0, 500) || null,
  };

  submitBtn.disabled = true;
  submitBtn.textContent = 'Đang gửi…';
  showMsg([''], false);
  try {
    const { SUPABASE_URL, SUPABASE_ANON_KEY } = await import('./portal/config.js');
    const res = await fetch(`${SUPABASE_URL}/rest/v1/trial_signups`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(row),
    });
    if (!res.ok) {
      const out = await res.json().catch(() => ({}));
      // Lỗi do máy chủ viết sẵn bằng tiếng Việt (trùng đăng ký, quá tải) → hiện nguyên văn
      if (out.code === 'P0001' && out.message) { showMsg([out.message], true); return; }
      throw new Error(out.message || `HTTP ${res.status}`);
    }
    form.reset();
    showMsg([`Đã nhận đăng ký của em ${row.student_name}. Trí Đức Math sẽ gọi lại số ${row.parent_phone} trong thời gian sớm nhất.`], false);
  } catch (err) {
    const body = `Họ tên học sinh: ${row.student_name}
Lớp: ${row.grade}
SĐT phụ huynh: ${row.parent_phone}
Ghi chú: ${row.note || '(không có)'}`;
    showMsg([
      'Chưa gửi được đăng ký (có thể do mạng). Quý phụ huynh vui lòng gọi hoặc nhắn Zalo ',
      { href: 'tel:0904440886', text: '0904 440 886' }, ', hoặc ',
      { href: `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Đăng ký học thử - ' + row.student_name)}&body=${encodeURIComponent(body)}`, text: 'gửi bằng email' },
      '.',
    ], true);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Gửi đăng ký';
  }
});

// Khung "Mới trên website": nội dung lấy từ assets/tin-moi.js
(function () {
  const box = document.getElementById('tin-moi');
  const items = (window.TIN_MOI || []).filter((t) => t && t.tieuDe);
  if (!box || !items.length) return;

  const slidesEl = box.querySelector('.news-slides');
  const dotsEl = box.querySelector('.news-dots');
  const pauseBtn = box.querySelector('[data-act="pause"]');
  const DELAY = 6000;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  const mk = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  };

  const slides = items.map((t, i) => {
    const s = mk('article', 'news-slide');
    s.setAttribute('role', 'group');
    s.setAttribute('aria-roledescription', 'tin');
    s.setAttribute('aria-label', `${i + 1} / ${items.length}`);
    const soon = /sắp/i.test(t.ngay || '');
    s.append(mk('span', 'news-date' + (soon ? ' soon' : ''), t.ngay || ''));
    s.append(mk('h3', '', t.tieuDe));
    if (t.moTa) s.append(mk('p', '', t.moTa));
    if (t.link) {
      const a = mk('a', 'news-link', t.nhan || 'Xem');
      a.href = t.link;
      s.append(a);
    }
    slidesEl.append(s);
    return s;
  });

  const dots = items.map((t, i) => {
    const d = mk('button');
    d.type = 'button';
    d.setAttribute('aria-label', `Tin ${i + 1}: ${t.tieuDe}`);
    d.addEventListener('click', () => { show(i, true); });
    dotsEl.append(d);
    return d;
  });

  let cur = 0, timer = null;
  let userPaused = reduce.matches; // giảm chuyển động: không tự chạy
  let hover = false, focus = false;

  function show(i, byUser) {
    cur = (i + slides.length) % slides.length;
    slides.forEach((s, k) => {
      const on = k === cur;
      s.classList.toggle('off', !on);
      s.classList.toggle('in', on && !reduce.matches);
      s.inert = !on;
      s.setAttribute('aria-hidden', String(!on));
    });
    dots.forEach((d, k) => d.setAttribute('aria-current', String(k === cur)));
    if (byUser) restart();
  }

  function running() { return !userPaused && !hover && !focus && !document.hidden; }

  function restart() {
    clearInterval(timer);
    timer = null;
    if (running() && slides.length > 1) timer = setInterval(() => show(cur + 1), DELAY);
    // Khi không tự chạy, đọc tin mới cho trình đọc màn hình
    slidesEl.setAttribute('aria-live', running() ? 'off' : 'polite');
  }

  function setPaused(p) {
    userPaused = p;
    box.classList.toggle('paused', p);
    pauseBtn.setAttribute('aria-label', p ? 'Tiếp tục tự chạy' : 'Tạm dừng tự chạy');
    restart();
  }

  box.querySelector('[data-act="prev"]').addEventListener('click', () => show(cur - 1, true));
  box.querySelector('[data-act="next"]').addEventListener('click', () => show(cur + 1, true));
  pauseBtn.addEventListener('click', () => setPaused(!userPaused));

  box.addEventListener('mouseenter', () => { hover = true; restart(); });
  box.addEventListener('mouseleave', () => { hover = false; restart(); });
  box.addEventListener('focusin', () => { focus = true; restart(); });
  box.addEventListener('focusout', (e) => {
    if (!box.contains(e.relatedTarget)) { focus = false; restart(); }
  });
  box.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); show(cur - 1, true); }
    if (e.key === 'ArrowRight') { e.preventDefault(); show(cur + 1, true); }
  });
  document.addEventListener('visibilitychange', restart);
  reduce.addEventListener?.('change', () => setPaused(reduce.matches || userPaused));

  if (slides.length < 2) box.querySelector('.news-ctrl').hidden = dotsEl.hidden = true;
  box.hidden = false;
  show(0);
  setPaused(userPaused);
})();
