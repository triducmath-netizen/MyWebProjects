#!/usr/bin/env node
// Quét tự động website Trí Đức Math — bước đầu của agent `kiem-thu-web`.
//   node tools/kiem-thu-web.mjs                       # quét https://triducmath.vn
//   node tools/kiem-thu-web.mjs --base http://localhost:5173
//   node tools/kiem-thu-web.mjs --json                # in kết quả dạng JSON
// Chỉ ĐỌC (GET), không đăng nhập, không gửi form. Thoát mã 1 nếu có lỗi mức "loi".
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SITE = join(ROOT, 'Math-Center');
const args = process.argv.slice(2);
const BASE = (args[args.indexOf('--base') + 1] && args.includes('--base') ? args[args.indexOf('--base') + 1] : 'https://triducmath.vn').replace(/\/$/, '');
const AS_JSON = args.includes('--json');
const PAGES = ['/', '/phu-huynh/', '/giao-vien/'];

const findings = []; // { muc: 'loi'|'canh-bao'|'chua-xong', nhom, noi, mo_ta }
const add = (muc, nhom, noi, mo_ta) => findings.push({ muc, nhom, noi, mo_ta });

// Lỗi 5xx / mạng: thử lại tối đa 2 lần để không báo nhầm lỗi chập chờn của GitHub Pages
async function get(url) {
  let r;
  for (let i = 0; i < 3; i++) {
    r = await get1(url);
    if (r.status && r.status < 500) return r;
    await new Promise((ok) => setTimeout(ok, 1500));
  }
  return r;
}
async function get1(url) {
  const t0 = Date.now();
  try {
    const r = await fetch(url, { redirect: 'follow', headers: { 'user-agent': 'kiem-thu-web/1.0' } });
    const buf = Buffer.from(await r.arrayBuffer());
    return { ok: r.ok, status: r.status, buf, text: buf.toString('utf8'), ms: Date.now() - t0, type: r.headers.get('content-type') || '' };
  } catch (e) {
    return { ok: false, status: 0, buf: Buffer.alloc(0), text: '', ms: Date.now() - t0, err: e.message };
  }
}
// Bỏ qua khác biệt CRLF/LF (checkout trên Windows) khi so sánh nội dung
const sha = (b) => createHash('sha1').update(b.toString('latin1').replace(/\r\n/g, '\n')).digest('hex');
const isRemote = (u) => /^(https?:)?\/\//.test(u);
const stripQ = (u) => u.split(/[?#]/)[0];

// ---------- 1. Trang & tài nguyên trên site đang chạy ----------
const assets = new Map(); // url tuyệt đối -> { from }
const seen = new Map();   // url -> response
const moduleSpecs = [];   // { file, spec, resolved }

function collectHtml(pageUrl, html) {
  const re = /<(script|link|img|a|source)\b[^>]*?\s(src|href)=["']([^"']+)["'][^>]*>/gi;
  for (const m of html.matchAll(re)) {
    const [tag, kind, raw] = [m[0], m[1].toLowerCase(), m[3]];
    if (/^(mailto:|tel:|#|javascript:|data:)/.test(raw)) {
      if (raw === '#' && kind === 'a') add('canh-bao', 'lien-ket', pageUrl, `Liên kết trỏ "#" rỗng: ${tag.slice(0, 80)}`);
      continue;
    }
    if (/rel=["']preconnect/.test(tag)) continue;
    const abs = new URL(raw, pageUrl).href;
    if (!assets.has(abs)) assets.set(abs, { from: pageUrl, kind });
  }
  for (const m of html.matchAll(/<img\b(?![^>]*\balt=)[^>]*>/gi)) add('canh-bao', 'tiep-can', pageUrl, `Ảnh thiếu alt: ${m[0].slice(0, 80)}`);
  const checkTag = (re, ten) => { if (!re.test(html)) add('canh-bao', 'seo', pageUrl, `Thiếu ${ten}`); };
  checkTag(/<html[^>]*\blang=/i, 'thuộc tính lang trên <html>');
  checkTag(/<meta[^>]+name=["']viewport/i, 'meta viewport');
  checkTag(/<title>[^<]{5,}<\/title>/i, '<title>');
  if (pageUrl.endsWith(BASE + '/')) {
    checkTag(/<meta[^>]+name=["']description/i, 'meta description');
    checkTag(/<meta[^>]+property=["']og:title/i, 'thẻ Open Graph (og:title) — chia sẻ Zalo/Facebook không có ảnh/tiêu đề đẹp');
    checkTag(/<meta[^>]+property=["']og:image/i, 'og:image');
    checkTag(/<link[^>]+rel=["']canonical/i, 'link canonical');
  }
}

for (const p of PAGES) {
  const url = BASE + p;
  const r = await get(url);
  seen.set(url, r);
  if (!r.ok) { add('loi', 'trang', url, `Trang trả về ${r.status || r.err}`); continue; }
  if (r.ms > 3000) add('canh-bao', 'toc-do', url, `Tải chậm: ${r.ms} ms`);
  collectHtml(url, r.text);
}

// Theo các import trong module JS (chỉ cùng domain)
const queue = [...assets.keys()].filter((u) => u.startsWith(BASE) && /\.m?js(\?|$)/.test(u));
const visitedJs = new Set();
while (queue.length) {
  const u = queue.shift();
  if (visitedJs.has(u)) continue;
  visitedJs.add(u);
  const r = seen.get(u) || await get(u);
  seen.set(u, r);
  if (!r.ok) continue;
  for (const m of r.text.matchAll(/(?:import\s[^'"]*?from\s*|import\s*\(\s*|import\s+)["']([^"']+)["']/g)) {
    const spec = m[1];
    const resolved = new URL(spec, u).href;
    moduleSpecs.push({ file: u, spec, resolved });
    if (!assets.has(resolved)) assets.set(resolved, { from: u, kind: 'import' });
    if (resolved.startsWith(BASE)) queue.push(resolved);
  }
}

for (const [u, info] of assets) {
  if (info.kind === 'a' && !u.startsWith(BASE)) continue; // liên kết ngoài (Google Maps…) — không quét
  const r = seen.get(u) || await get(u);
  seen.set(u, r);
  if (!r.ok) add('loi', 'tai-nguyen', u, `Không tải được (${r.status || r.err}) — dùng ở ${info.from}`);
}

// Cùng một module được nạp với ?v khác nhau → trình duyệt tạo 2 bản (2 client Supabase, trạng thái tách rời)
const byPath = new Map();
for (const { file, resolved } of moduleSpecs) {
  if (!resolved.startsWith(BASE)) continue;
  const k = stripQ(resolved);
  if (!byPath.has(k)) byPath.set(k, new Map());
  const v = new URL(resolved).search || '(không có ?v)';
  if (!byPath.get(k).has(v)) byPath.get(k).set(v, []);
  byPath.get(k).get(v).push(file.replace(BASE, ''));
}
for (const [k, vs] of byPath) {
  if (vs.size > 1) {
    const detail = [...vs].map(([v, files]) => `${v} ← ${[...new Set(files)].join(', ')}`).join(' | ');
    add('loi', 'phien-ban-module', k.replace(BASE, ''), `Module được import với nhiều phiên bản khác nhau, trình duyệt sẽ nạp thành nhiều bản riêng: ${detail}`);
  }
}

// ---------- 2. So sánh site đang chạy với mã nguồn (chưa deploy?) ----------
if (BASE.startsWith('https://')) {
  for (const [u, r] of seen) {
    if (!u.startsWith(BASE) || !r.ok) continue;
    let p = stripQ(u).slice(BASE.length) || '/';
    if (p.endsWith('/')) p += 'index.html';
    const local = join(SITE, decodeURIComponent(p));
    if (!existsSync(local)) { add('canh-bao', 'trien-khai', p, 'Có trên site nhưng không có trong Math-Center/'); continue; }
    if (sha(readFileSync(local)) !== sha(r.buf)) add('canh-bao', 'trien-khai', p, 'Bản trên triducmath.vn khác bản trong mã nguồn (chưa deploy, hoặc đang ở nhánh chưa gộp vào main)');
  }
}

// ---------- 3. Kiểm tra tĩnh mã nguồn ----------
function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? (f === 'node_modules' ? [] : walk(p)) : [p];
  });
}
const files = walk(SITE);
for (const f of files.filter((x) => /\.m?js$/.test(x))) {
  try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); }
  catch (e) {
    // module ES dùng import/export: thử lại theo kiểu module
    try { execFileSync(process.execPath, ['--input-type=module', '--check'], { input: readFileSync(f), stdio: 'pipe' }); }
    catch (e2) { add('loi', 'cu-phap-js', relative(ROOT, f), String(e2.stderr || e2.message).split('\n').slice(0, 4).join(' ')); }
  }
}
const PLACEHOLDER = /(\[CẦN XÁC NHẬN[^\]]*\]|\bTODO\b|\bFIXME\b|lorem ipsum|đang cập nhật|coming soon|sắp ra mắt|xxx-xxx)/gi;
for (const f of files.filter((x) => /\.(html|js|css)$/.test(x))) {
  const txt = readFileSync(f, 'utf8');
  txt.split('\n').forEach((line, i) => {
    for (const m of line.matchAll(PLACEHOLDER)) add('chua-xong', 'noi-dung', `${relative(ROOT, f)}:${i + 1}`, `Còn chữ tạm/chưa hoàn thiện: "${m[0]}"`);
  });
  if (/service_role/i.test(txt) && /eyJ[a-zA-Z0-9_-]{20,}/.test(txt)) add('loi', 'bao-mat', relative(ROOT, f), 'Có vẻ chứa khóa service_role (JWT) trong mã phía trình duyệt');
  if (/console\.log\(/.test(txt) && f.endsWith('.js')) add('canh-bao', 'mon-mot', relative(ROOT, f), 'Còn console.log trong mã chạy trên trình duyệt');
}
// Liên kết nội bộ #id trên trang chủ phải có phần tử tương ứng
const home = readFileSync(join(SITE, 'index.html'), 'utf8');
for (const m of home.matchAll(/href="#([^"]+)"/g)) {
  if (!new RegExp(`id=["']${m[1]}["']`).test(home)) add('loi', 'lien-ket', `Math-Center/index.html`, `Liên kết #${m[1]} không có phần tử id tương ứng`);
}

// ---------- 4. Hướng dẫn cài đặt có liệt kê đủ migration? ----------
const guide = readFileSync(join(ROOT, 'supabase', 'HUONG-DAN-CAI-DAT.md'), 'utf8');
for (const mig of readdirSync(join(ROOT, 'supabase', 'migrations')).filter((f) => f.endsWith('.sql'))) {
  if (!guide.includes(mig)) add('chua-xong', 'tai-lieu', 'supabase/HUONG-DAN-CAI-DAT.md', `Chưa liệt kê migration ${mig} ở Bước 2 — có thể chưa chạy trên Supabase thật`);
}
// Bản nháp nội dung còn chờ duyệt
const choDuyet = join(ROOT, 'noi-dung', 'cho-duyet');
if (existsSync(choDuyet)) for (const f of readdirSync(choDuyet).filter((x) => x.endsWith('.md'))) {
  add('chua-xong', 'noi-dung', `noi-dung/cho-duyet/${f}`, 'Bản nháp nội dung đang chờ duyệt, chưa lên web');
}

// ---------- In kết quả ----------
const order = { loi: 0, 'chua-xong': 1, 'canh-bao': 2 };
findings.sort((a, b) => order[a.muc] - order[b.muc] || a.nhom.localeCompare(b.nhom));
if (AS_JSON) {
  console.log(JSON.stringify({ base: BASE, thoi_diem: new Date().toISOString(), so_tai_nguyen: seen.size, findings }, null, 2));
} else {
  const label = { loi: 'LỖI', 'chua-xong': 'CHƯA XONG', 'canh-bao': 'CẢNH BÁO' };
  console.log(`Quét ${BASE} — ${seen.size} URL, ${files.length} file nguồn`);
  for (const f of findings) console.log(`[${label[f.muc]}] (${f.nhom}) ${f.noi}\n    ${f.mo_ta}`);
  const c = (m) => findings.filter((f) => f.muc === m).length;
  console.log(`\nTổng: ${c('loi')} lỗi, ${c('chua-xong')} chưa xong, ${c('canh-bao')} cảnh báo`);
}
process.exit(findings.some((f) => f.muc === 'loi') ? 1 : 0);
