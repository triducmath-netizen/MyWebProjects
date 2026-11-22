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
  msg.textContent = 'Ứng dụng email đã được mở với nội dung điền sẵn — bấm Gửi để hoàn tất. Hoặc gọi/Zalo trực tiếp cho chúng tôi.';
});
