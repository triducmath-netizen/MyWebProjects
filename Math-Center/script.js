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

// Form đăng ký: web tĩnh chưa có máy chủ, nên form mở ứng dụng email
// với nội dung đã điền sẵn để phụ huynh bấm Gửi.
const CONTACT_EMAIL = 'triducmath@gmail.com';
const form = document.getElementById('signup-form');
const msg = form.querySelector('.form-msg');

form.addEventListener('submit', (e) => {
  e.preventDefault();
  let ok = true;
  form.querySelectorAll('[required]').forEach((el) => {
    const bad = !el.value.trim() ||
      (el.name === 'phone' && !/^[0-9+\s.-]{9,15}$/.test(el.value.trim()));
    el.classList.toggle('invalid', bad);
    el.setAttribute('aria-invalid', String(bad));
    if (bad) ok = false;
  });

  if (!ok) {
    msg.textContent = 'Vui lòng điền đủ họ tên, lớp và số điện thoại hợp lệ.';
    msg.classList.add('error');
    return;
  }

  const d = new FormData(form);
  const body =
    `Họ tên học sinh: ${d.get('name')}\n` +
    `Lớp: ${d.get('grade')}\n` +
    `SĐT phụ huynh: ${d.get('phone')}\n` +
    `Ghi chú: ${d.get('note') || '(không có)'}`;
  const subject = `Đăng ký học thử - ${d.get('name')}`;

  window.location.href =
    `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  msg.classList.remove('error');
  msg.textContent = 'Ứng dụng email đã được mở với nội dung điền sẵn — bấm Gửi để hoàn tất. Hoặc gọi/Zalo trực tiếp: 0904 440 886 – 0347 176 606.';
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
