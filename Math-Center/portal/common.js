import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY, PARENT_EMAIL_DOMAIN } from './config.js';

export const configured = !SUPABASE_URL.includes('YOUR-') && !SUPABASE_ANON_KEY.includes('YOUR-');
export const sb = configured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
export const BUCKET = 'tdm';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// Tạo phần tử an toàn: mọi chữ đi qua textContent, không dùng innerHTML với dữ liệu người dùng.
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (k in node && typeof v !== 'string') node[k] = v;
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

export function codeToEmail(code) {
  return `${code.trim().toLowerCase()}@${PARENT_EMAIL_DOMAIN}`;
}

export function normalizeCode(code) {
  return code.trim().toUpperCase().replace(/\s+/g, '');
}

// Thứ Hai của tuần chứa ngày d (theo giờ máy).
export function mondayOf(d = new Date()) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  return x;
}

export function toISODate(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function weekLabel(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const start = new Date(y, m - 1, d);
  const end = new Date(y, m - 1, d + 6);
  const f = (x) => `${String(x.getDate()).padStart(2, '0')}/${String(x.getMonth() + 1).padStart(2, '0')}`;
  return `Tuần ${f(start)} – ${f(end)}/${end.getFullYear()}`;
}

export function fmtNum(n) {
  if (n == null || n === '') return '—';
  return Number(n).toLocaleString('vi-VN', { maximumFractionDigits: 2 });
}

export function fmtDateTime(ts) {
  return new Date(ts).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
}

// Mật khẩu ngẫu nhiên dễ đọc (bỏ các ký tự dễ nhầm như 0/O, 1/l/I).
export function randomPassword(len = 10) {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const buf = new Uint32Array(len);
  crypto.getRandomValues(buf);
  return [...buf].map((n) => chars[n % chars.length]).join('');
}

// Thu nhỏ ảnh chụp điện thoại trước khi tải lên (tối đa 1800px, JPEG).
export async function prepareFile(file) {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const max = 1800;
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size < 1.5 * 1024 * 1024) { bmp.close?.(); return file; }
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close?.();
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.82));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

export function extOf(file) {
  if (file.type === 'application/pdf') return 'pdf';
  if (file.type === 'image/png') return 'png';
  if (file.type === 'image/webp') return 'webp';
  return 'jpg';
}

// Tải file lên kho riêng tư, trả về đường dẫn.
export async function uploadTo(folder, file) {
  const f = await prepareFile(file);
  const path = `${folder}/${crypto.randomUUID()}.${extOf(f)}`;
  const { error } = await sb.storage.from(BUCKET).upload(path, f, { contentType: f.type, upsert: false });
  if (error) throw error;
  return path;
}

export async function signedUrls(paths) {
  if (!paths.length) return [];
  const { data, error } = await sb.storage.from(BUCKET).createSignedUrls(paths, 3600);
  if (error) throw error;
  return data.map((d) => ({ path: d.path, url: d.signedUrl, pdf: d.path.endsWith('.pdf') }));
}

// ---------- Thông báo nhỏ ----------
export function toast(msg, type = 'ok') {
  let box = $('.toasts');
  if (!box) { box = el('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' }); document.body.append(box); }
  const t = el('div', { class: `toast ${type}`, text: msg });
  box.append(t);
  setTimeout(() => t.remove(), type === 'error' ? 6000 : 3500);
}

export function errMsg(e) {
  const m = e?.message || String(e);
  if (/Invalid login credentials/i.test(m)) return 'Thông tin đăng nhập không đúng.';
  if (/duplicate key.*code/i.test(m)) return 'Mã học sinh này đã tồn tại.';
  if (/duplicate key/i.test(m)) return 'Dữ liệu bị trùng.';
  if (/row-level security|permission denied/i.test(m)) return 'Bạn không có quyền thực hiện việc này.';
  if (/Failed to fetch|NetworkError/i.test(m)) return 'Mất kết nối mạng. Vui lòng thử lại.';
  return m;
}

// ---------- Hộp thoại ----------
export function openDialog(title, body, { wide = false } = {}) {
  const dlg = el('dialog', { class: `dlg${wide ? ' wide' : ''}` },
    el('div', { class: 'dlg-head' },
      el('h3', { text: title }),
      el('button', { class: 'icon-btn', 'aria-label': 'Đóng', onclick: () => dlg.close(), text: '×' })),
    el('div', { class: 'dlg-body' }, body));
  dlg.addEventListener('close', () => dlg.remove());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  document.body.append(dlg);
  dlg.showModal();
  return dlg;
}

// Xem ảnh / PDF trong hộp thoại.
export async function showFiles(title, paths) {
  const body = el('div', { class: 'gallery' }, el('p', { class: 'muted', text: 'Đang tải…' }));
  openDialog(title, body, { wide: true });
  try {
    const files = await signedUrls(paths);
    body.replaceChildren(...files.map((f, i) => f.pdf
      ? el('a', { class: 'btn btn-outline', href: f.url, target: '_blank', rel: 'noopener', text: `Mở file PDF ${i + 1}` })
      : el('a', { href: f.url, target: '_blank', rel: 'noopener', title: 'Mở ảnh cỡ lớn' },
          el('img', { src: f.url, alt: `${title} — trang ${i + 1}`, loading: 'lazy' }))));
  } catch (e) {
    body.replaceChildren(el('p', { class: 'error-text', text: errMsg(e) }));
  }
}

export function notConfiguredNotice(root) {
  root.replaceChildren(el('div', { class: 'panel narrow-panel' },
    el('h2', { text: 'Chưa kết nối máy chủ' }),
    el('p', { text: 'Cổng thông tin chưa được cấu hình. Quản trị viên cần điền địa chỉ và khóa Supabase vào file portal/config.js.' })));
}
