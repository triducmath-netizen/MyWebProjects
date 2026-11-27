#!/usr/bin/env node
// Sinh 20 đề cho Toán 8 · Bài 9. Phân tích đa thức thành nhân tử (đề 1 là đề gốc, đề 2–20 cùng khuôn).
// Mỗi câu một khuôn tham số: chọn bộ số đẹp (ngẫu nhiên có hạt giống), tự tính đáp án, phương án nhiễu,
// lời giải, verify và vẽ hình.
//   node de-thi/toan-8/theo-bai/sinh-de/bai-9.mjs <file-đề-01.json> <file-đề-02-20.json> [hạt-giống]
// Hình ghi vào de-thi/toan-8/theo-bai/hinh/bai-9/.
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const HINH = resolve(here, '..', 'hinh', 'bai-9');
mkdirSync(HINH, { recursive: true });
const [out1, out2, seedArg] = process.argv.slice(2);
const R = String.raw;

// ---------- Tiện ích ----------
// Mỗi vị trí câu một dòng số ngẫu nhiên riêng: sửa khuôn một câu chỉ làm đổi câu đó, các câu khác giữ nguyên.
const seed0 = Number(seedArg ?? 20261127);
const seeds = Array.from({ length: 23 }, (_, i) => (seed0 + i * 7919) % 2147483648);
let cur = 0;
const rnd = () => { seeds[cur] = (seeds[cur] * 1103515245 + 12345) % 2147483648; return seeds[cur] / 2147483648; };
const dn = (v) => String(v).replace('.', '{,}'); // số thập phân trong LaTeX
const pick = (a) => a[Math.floor(rnd() * a.length)];
const int = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
const TF = (b) => (b ? 'Đúng' : 'Sai');
const cf = (c) => (c === 1 ? '' : c === -1 ? '-' : String(c));
const par = (v) => (v < 0 ? `(${v})` : `${v}`);
// đa thức: danh sách [hệ số, phần biến]; bỏ hạng tử 0
function poly(ts) {
  let s = '';
  for (const [c, v] of ts) {
    if (c === 0) continue;
    const first = s === '';
    s += (c < 0 ? (first ? '-' : ' - ') : (first ? '' : ' + ')) + (Math.abs(c) === 1 && v ? '' : Math.abs(c)) + v;
  }
  return s || '0';
}
const L = (a, c, v = 'x') => poly([[a, v], [c, '']]); // ax + c
const mono = (c, px, qy) => `${cf(c)}${px ? 'x' + (px > 1 ? `^{${px}}` : '') : ''}${qy ? 'y' + (qy > 1 ? `^{${qy}}` : '') : ''}`;
function place(correct, wrongs, idx) {
  const all = [correct, ...wrongs];
  if (new Set(all.map((x) => x[0])).size !== 4) return null;
  const out = []; let k = 0;
  for (let i = 0; i < 4; i++) out.push(i === idx ? correct : wrongs[k++]);
  return out;
}
// phương án là biểu thức: verify so giá trị từng phương án với đa thức gốc tại vài điểm
const exprVerify = (orig, js) => `(()=>{const f=(x,y)=>${orig};const o=[${js.map((j) => `(x,y)=>${j}`).join(',')}];const pts=[[1.3,0.7],[2.9,-1.1],[-0.6,2.2]];return o.findIndex(g=>pts.every(([x,y])=>Math.abs(g(x,y)-f(x,y))<1e-7));})()`;
function exprQ(origJs, correct, wrongs, idx) { // correct/wrongs: [latex, js]
  const o = place(correct, wrongs, idx); if (!o) return null;
  return { options: o.map((x) => `$${x[0]}$`), answer: idx, verify: exprVerify(origJs, o.map((x) => x[1])) };
}
function numQ(correct, wrongs, idx) { // số
  const o = place([String(correct), correct], wrongs.map((w) => [String(w), w]), idx); if (!o) return null;
  return { options: o.map((x) => `$${x[0]}$`), answer: idx };
}
const fig = (n, c) => `de-${String(n).padStart(2, '0')}-cau-${c}.svg`;
const imgPath = (n, c) => `../hinh/bai-9/${fig(n, c)}`;

// ---------- Hình ----------
const HEAD = (W, H) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="Times New Roman" font-size="18">
  <defs><marker id="m2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#000"/></marker></defs>
  <rect width="${W}" height="${H}" fill="#fff"/>`;
const dim = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#000" stroke-width="1.3" marker-start="url(#m2)" marker-end="url(#m2)"/>`;
const ext = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#555" stroke-width="1" stroke-dasharray="4,3"/>`;
const loiDi = (x, yText, yBand) => `<line x1="${x + 22}" y1="${yText - 5}" x2="${x + 40}" y2="${yBand}" stroke="#1f4fa8" stroke-width="1"/><circle cx="${x + 40}" cy="${yBand}" r="2.5" fill="#1f4fa8"/><text x="${x}" y="${yText}" text-anchor="middle" font-size="15" fill="#1f4fa8">lối đi</text>`;
const xm = (x, y, s = 'x') => `<text x="${x}" y="${y}" text-anchor="middle" font-style="italic">${s} <tspan font-style="normal">m</tspan></text>`;
// lối đi quanh hình vuông: outside = lối đi ở ngoài (cạnh trong là x), ngược lại lối đi ở trong (cạnh ngoài là x).
// Kích thước ghi bên ngoài hình, có đường gióng nét đứt, để không đè lên nét vẽ.
function walkFig(file, w, outside, noun) {
  const O = 40, S = 260, t = 16 + 6 * w, I = O + t, s = S - 2 * t;
  let g = HEAD(360, 370);
  g += `<rect x="${O}" y="${O}" width="${S}" height="${S}" fill="#cfe3ff" fill-opacity="0.8" stroke="#1f4fa8" stroke-width="2"/>`;
  g += `<rect x="${I}" y="${I}" width="${s}" height="${s}" fill="#dff0d4" stroke="#2e7d32" stroke-width="2"/>`;
  g += `<text x="${O + S / 2}" y="${O + S / 2 + 6}" text-anchor="middle" fill="#2e7d32">${noun}</text>`;
  g += loiDi(O + S / 2 - 40, O - 14, O + t / 2);
  g += dim(O + S - t, O + S / 2 + 40, O + S, O + S / 2 + 40) + `<text x="${O + S + 6}" y="${O + S / 2 + 46}" font-size="16">${w} m</text>`;
  const [a0, a1] = outside ? [I, I + s] : [O, O + S], yb = outside ? I + s : O + S;
  g += ext(a0, yb + 4, a0, O + S + 30) + ext(a1, yb + 4, a1, O + S + 30) + dim(a0, O + S + 22, a1, O + S + 22) + xm((a0 + a1) / 2, O + S + 46);
  writeFileSync(resolve(HINH, file), g + '</svg>\n');
}
// hình chữ nhật (rộng x, dài x + a) có lối đi rộng w bao quanh phía ngoài
function rectFig(file, w, a, noun) {
  const O = 70, T = 40, t = 14 + 6 * w, iw = 190 + 8 * a, ih = 150, W = iw + 2 * t, H = ih + 2 * t, L = O + t, Tp = T + t;
  let g = HEAD(O + W + 60, T + H + 60);
  g += `<rect x="${O}" y="${T}" width="${W}" height="${H}" fill="#cfe3ff" fill-opacity="0.8" stroke="#1f4fa8" stroke-width="2"/>`;
  g += `<rect x="${L}" y="${Tp}" width="${iw}" height="${ih}" fill="#dff0d4" stroke="#2e7d32" stroke-width="2"/>`;
  g += `<text x="${L + iw / 2}" y="${Tp + ih / 2 + 6}" text-anchor="middle" fill="#2e7d32">${noun}</text>`;
  g += loiDi(O + W / 2 - 40, T - 14, T + t / 2);
  g += ext(L, Tp + ih + 4, L, T + H + 30) + ext(L + iw, Tp + ih + 4, L + iw, T + H + 30) + dim(L, T + H + 22, L + iw, T + H + 22) + xm(L + iw / 2, T + H + 46, `x + ${a}`);
  g += ext(L - 4, Tp, O - 30, Tp) + ext(L - 4, Tp + ih, O - 30, Tp + ih) + dim(O - 22, Tp, O - 22, Tp + ih) + `<text x="${O - 30}" y="${Tp + ih / 2 + 6}" text-anchor="end" font-style="italic">x <tspan font-style="normal">m</tspan></text>`;
  g += dim(O + W - t, T + H / 2 + 30, O + W, T + H / 2 + 30) + `<text x="${O + W + 6}" y="${T + H / 2 + 36}" font-size="16">${w} m</text>`;
  writeFileSync(resolve(HINH, file), g + '</svg>\n');
}
function cutFig(file, a, b) {
  const O = 50, S = 250, k = S / a, sb = b * k;
  let g = HEAD(360, 370);
  g += `<path d="M${O},${O} L${O + S - sb},${O} L${O + S - sb},${O + sb} L${O + S},${O + sb} L${O + S},${O + S} L${O},${O + S} Z" fill="#cfe3ff" fill-opacity="0.8" stroke="#1f4fa8" stroke-width="2"/>`;
  g += `<rect x="${O + S - sb}" y="${O}" width="${sb}" height="${sb}" fill="#fff" stroke="#888" stroke-width="1.5" stroke-dasharray="6,4"/>`;
  g += dim(O, O + S + 20, O + S, O + S + 20) + `<text x="${O + S / 2}" y="${O + S + 44}" text-anchor="middle" font-style="italic">a</text>`;
  g += dim(O + S + 18, O, O + S + 18, O + sb) + `<text x="${O + S + 26}" y="${O + sb / 2 + 6}" font-style="italic">b</text>`;
  // chữ đặt giữa dải dưới của phần còn lại; dải mỏng thì ghi phía trên hình, có đường dẫn
  const hb = S - sb;
  g += hb >= 56 ? `<text x="${O + S / 2}" y="${O + sb + hb / 2 + 6}" text-anchor="middle" fill="#1f4fa8">phần còn lại</text>`
    : `<line x1="${O + hb / 2}" y1="${O - 14}" x2="${O + hb / 2}" y2="${O + S - hb / 2}" stroke="#1f4fa8" stroke-width="1"/><circle cx="${O + hb / 2}" cy="${O + S - hb / 2}" r="2.5" fill="#1f4fa8"/><text x="${Math.max(O + hb / 2, 48)}" y="${O - 20}" text-anchor="middle" fill="#1f4fa8">phần còn lại</text>`;
  writeFileSync(resolve(HINH, file), g + '</svg>\n');
}

// ---------- Khuôn từng câu ----------
const T = {};
// 1. Nhân tử chung (hệ số ƯCLN, số mũ nhỏ nhất)
T[1] = (n, idx) => {
  const g = pick([2, 3, 4, 5, 6]), p = int(1, 5), q = int(1, 5); if (p === q || gcd(p, q) !== 1) return null;
  const e1 = [int(1, 3), int(1, 2)], e2 = [int(1, 3), int(1, 2)]; if (e1[0] === e2[0] && e1[1] === e2[1]) return null;
  const s = pick([1, -1]), a = g * p, b = g * q;
  const mn = [Math.min(e1[0], e2[0]), Math.min(e1[1], e2[1])], mx = [Math.max(e1[0], e2[0]), Math.max(e1[1], e2[1])];
  const C = [g, ...mn], W = [[g, mn[0], 0], [1, ...mn], [g, ...mx]];
  const o = place([mono(...C), C], W.map((w) => [mono(...w), w]), idx); if (!o) return null;
  const P = poly([[a, mono(1, ...e1)], [s * b, mono(1, ...e2)]]);
  const rest = poly([[p, mono(1, e1[0] - mn[0], e1[1] - mn[1])], [s * q, mono(1, e2[0] - mn[0], e2[1] - mn[1])]]);
  return { options: o.map((x) => `$${x[0]}$`), answer: idx,
    verify: `(()=>{const g=(a,b)=>b?g(b,a%b):a;const c=[g(${a},${b}),Math.min(${e1[0]},${e2[0]}),Math.min(${e1[1]},${e2[1]})];const o=[${o.map((x) => `[${x[1]}]`).join(',')}];return o.findIndex(t=>t[0]===c[0]&&t[1]===c[1]&&t[2]===c[2]);})()`,
    prompt: R`Phân tích đa thức $${P}$ thành nhân tử bằng cách đặt nhân tử chung (hệ số của nhân tử chung là ước chung lớn nhất của các hệ số, phân tích triệt để). Nhân tử chung đó là`,
    explanation: R`ƯCLN$(${a}, ${b}) = ${g}$; lũy thừa của $x$ có số mũ nhỏ nhất là $${mono(1, mn[0], 0)}$, của $y$ là $${mono(1, 0, mn[1])}$. Nhân tử chung là $${mono(...C)}$ và $${P} = ${mono(...C)}(${rest})$. Phương án $${mono(1, ...mn)}$ thiếu hệ số chung; phương án $${mono(g, ...mx)}$ lấy nhầm số mũ lớn nhất.` };
};
// 2. Hiệu hai bình phương
T[2] = (n, idx) => {
  const a = int(1, 4), b = int(1, 9); if (gcd(a, b) !== 1 || (a === 1 && b === 1)) return null;
  const q = exprQ(`${a * a}*x*x-${b * b}`, [`(${L(a, -b)})(${L(a, b)})`, `(${a}*x-${b})*(${a}*x+${b})`],
    [[`(${L(a, -b)})^2`, `(${a}*x-${b})**2`], [`(${L(a, b)})^2`, `(${a}*x+${b})**2`], [`(${poly([[b, ''], [-a, 'x']])})(${poly([[b, ''], [a, 'x']])})`, `(${b}-${a}*x)*(${b}+${a}*x)`]], idx);
  return q && { ...q, prompt: R`Phân tích đa thức $${poly([[a * a, 'x^2'], [-b * b, '']])}$ thành nhân tử, ta được`,
    explanation: R`$${poly([[a * a, 'x^2'], [-b * b, '']])} = ${a === 1 ? "x" : `(${a}x)`}^2 - ${b}^2 = (${L(a, -b)})(${L(a, b)})$ (hiệu hai bình phương). Phương án $(${poly([[b, ''], [-a, 'x']])})(${poly([[b, ''], [a, 'x']])})$ bằng $${b * b} - ${cf(a * a)}x^2$, ngược dấu.` };
};
// 3. Bình phương của một tổng / hiệu
T[3] = (n, idx) => {
  const a = int(1, 3), k = int(1, 9), s = pick([1, -1]); if (gcd(a, k) !== 1 || (a === 1 && k === 1)) return null;
  const P = poly([[a * a, 'x^2'], [2 * a * k * s, 'x'], [k * k, '']]);
  const q = exprQ(`${a * a}*x*x+(${2 * a * k * s})*x+${k * k}`, [`(${L(a, s * k)})^2`, `(${a}*x+(${s * k}))**2`],
    [[`(${L(a, -s * k)})^2`, `(${a}*x-(${s * k}))**2`], [`(${L(a, -k)})(${L(a, k)})`, `(${a}*x-${k})*(${a}*x+${k})`], [`(${L(a, 2 * s * k)})^2`, `(${a}*x+(${2 * s * k}))**2`]], idx);
  return q && { ...q, prompt: R`Phân tích đa thức $${P}$ thành nhân tử, ta được`,
    explanation: R`$${P} = ${a === 1 ? "x" : `(${a}x)`}^2 ${s > 0 ? '+' : '-'} 2 \cdot ${cf(a)}x \cdot ${k} + ${k}^2 = (${L(a, s * k)})^2$. Phương án $(${L(a, -s * k)})^2$ sai dấu hạng tử giữa; phương án $(${L(a, -k)})(${L(a, k)})$ là hiệu hai bình phương, không có hạng tử chứa $x$.` };
};
// 4. Tổng / hiệu hai lập phương
T[4] = (n, idx) => {
  const a = int(1, 3), k = int(1, 5), s = pick([1, -1]); if (gcd(a, k) !== 1) return null;
  const P = poly([[a ** 3, 'x^3'], [s * k ** 3, '']]);
  const sq = (m) => poly([[a * a, 'x^2'], [m * a * k, 'x'], [k * k, '']]);
  const sqj = (m) => `(${a * a}*x*x+(${m * a * k})*x+${k * k})`;
  const q = exprQ(`${a ** 3}*x**3+(${s * k ** 3})`, [`(${L(a, s * k)})(${sq(-s)})`, `(${a}*x+(${s * k}))*${sqj(-s)}`],
    [[`(${L(a, s * k)})(${sq(s)})`, `(${a}*x+(${s * k}))*${sqj(s)}`], [`(${L(a, s * k)})(${sq(-2 * s)})`, `(${a}*x+(${s * k}))*${sqj(-2 * s)}`], [`(${L(a, -s * k)})(${sq(s)})`, `(${a}*x-(${s * k}))*${sqj(s)}`]], idx);
  return q && { ...q, prompt: R`Phân tích đa thức $${P}$ thành nhân tử, ta được`,
    explanation: R`$${P} = ${a === 1 ? "x" : `(${a}x)`}^3 ${s > 0 ? '+' : '-'} ${k}^3 = (${L(a, s * k)})(${sq(-s)})$ theo hằng đẳng thức $A^3 ${s > 0 ? '+' : '-'} B^3 = (A ${s > 0 ? '+' : '-'} B)(A^2 ${s > 0 ? '-' : '+'} AB + B^2)$. Phương án $(${L(a, s * k)})(${sq(s)})$ sai dấu của $AB$; phương án có $${Math.abs(2 * a * k)}x$ nhầm với bình phương của một ${s > 0 ? 'hiệu' : 'tổng'}.` };
};
// 5. Đặt nhân tử chung sau khi đổi dấu
T[5] = (n, idx) => {
  const k = int(1, 9), m = int(2, 9), s = pick([1, -1]); if (m === k) return null;
  const lhs = `x(y - ${k}) ${s > 0 ? '+' : '-'} ${m}(${k} - y)`;
  const q = exprQ(`x*(y-${k})+(${s * m})*(${k}-y)`, [`(y - ${k})(${L(1, -s * m)})`, `(y-${k})*(x-(${s * m}))`],
    [[`(y - ${k})(${L(1, s * m)})`, `(y-${k})*(x+(${s * m}))`], [`(${k} - y)(${L(1, -s * m)})`, `(${k}-y)*(x-(${s * m}))`], [`(y + ${k})(${L(1, -s * m)})`, `(y+${k})*(x-(${s * m}))`]], idx);
  return q && { ...q, prompt: R`Phân tích đa thức $${lhs}$ thành nhân tử, ta được`,
    explanation: R`Đổi dấu: $${m}(${k} - y) = -${m}(y - ${k})$, nên $${lhs} = x(y - ${k}) ${s > 0 ? '-' : '+'} ${m}(y - ${k}) = (y - ${k})(${L(1, -s * m)})$. Phương án $(y - ${k})(${L(1, s * m)})$ do quên đổi dấu khi đổi $${k} - y$ thành $y - ${k}$.` };
};
// 6. Dữ kiện ẩn: x ± y = d → bình phương
T[6] = (n, idx) => {
  const d = int(3, 25), v = pick([0, 1]);
  const q = numQ(d * d, [2 * d, -d * d, d], idx); if (!q) return null;
  const cond = v ? `x + y = ${d}` : `x - y = ${d}`, E = v ? 'x^2 + 2xy + y^2' : 'x^2 - 2xy + y^2';
  return { ...q, _mkey: `${d}`, prompt: R`Biết $${cond}$. Giá trị của biểu thức $${E}$ bằng`,
    verify: v ? `(()=>{const x=${d}-1.5,y=1.5;return Math.round((x*x+2*x*y+y*y)*1e6)/1e6;})()` : `(()=>{const x=${d}+1.5,y=1.5;return Math.round((x*x-2*x*y+y*y)*1e6)/1e6;})()`,
    explanation: R`$${E} = (${v ? 'x + y' : 'x - y'})^2 = ${d}^2 = ${d * d}$. Phương án $${2 * d}$ do nhầm bình phương với nhân đôi; phương án $${-d * d}$ sai dấu.` };
};
// 7. x² − y² = P và một tổng/hiệu → tổng/hiệu còn lại
T[7] = (n, idx) => {
  const s = int(2, 9), qv = int(2, 9), v = pick([0, 1]); if (qv === s) return null;
  const P = s * qv;
  const q = numQ(qv, [-qv, P - s, P + s], idx); if (!q) return null;
  const [given, ask] = v ? ['x - y', 'x + y'] : ['x + y', 'x - y'];
  return { ...q, _mkey: `${s},${qv}`, prompt: R`Biết $x^2 - y^2 = ${P}$ và $${given} = ${s}$. Giá trị của $${ask}$ bằng`,
    verify: `${P}/${s}`,
    explanation: R`$x^2 - y^2 = (x + y)(x - y)$, nên $${s} \cdot (${ask}) = ${P}$, suy ra $${ask} = ${P} : ${s} = ${qv}$. Phương án $${P - s}$ do lấy $${P} - ${s}$ thay vì chia.` };
};
// 8. Nhóm hạng tử: nhận ra nhân tử
T[8] = (n, idx) => {
  const a = int(1, 9), c = int(1, 3), v = pick([0, 1]);
  const P = `x^2 - ${a * a} + ${cf(c)}xy ${v ? '-' : '+'} ${cf(c * a)}y`;
  const corr = v ? `x - ${a}` : `x + ${a}`, all = [`x + ${a}`, `x - ${a}`, `y + ${a}`, `y - ${a}`];
  const o = place([corr, 0], all.filter((x) => x !== corr).map((x) => [x, 0]), idx); if (!o) return null;
  const f = `(x,y)=>x*x-${a * a}+${c}*x*y+(${v ? -1 : 1})*${c * a}*y`;
  const rest = v ? poly([[1, 'x'], [a, ''], [c, 'y']]) : poly([[1, 'x'], [-a, ''], [c, 'y']]);
  return { options: o.map((x) => `$${x[0]}$`), answer: idx,
    verify: `(()=>{const f=${f};const r=[${o.map((x) => { const [vv, sg] = [x[0][0], x[0].includes('+') ? -a : a]; return `['${vv}',${sg}]`; }).join(',')}];return r.findIndex(([v,z])=>v==='x'?[1.3,2.7].every(t=>Math.abs(f(z,t))<1e-9):[1.3,2.7].every(t=>Math.abs(f(t,z))<1e-9));})()`,
    prompt: R`Đa thức nào sau đây là một nhân tử của đa thức $${P}$?`,
    explanation: R`Nhóm hạng tử: $${P} = (x^2 - ${a * a}) + ${cf(c)}y(${v ? `x - ${a}` : `x + ${a}`}) = (x - ${a})(x + ${a}) + ${cf(c)}y(${corr}) = (${corr})(${rest})$. Vậy $${corr}$ là một nhân tử.` };
};
// 9. Tìm hệ số tự do để là bình phương
T[9] = (n, idx) => {
  const k = int(3, 25), s = pick([1, -1]);
  const q = numQ(k * k, [2 * k, 4 * k * k, -k * k], idx); if (!q) return null;
  return { ...q, _mkey: `${k}`, prompt: R`Biết đa thức $x^2 ${s > 0 ? '+' : '-'} ${2 * k}x + m$ viết được dưới dạng $(x ${s > 0 ? '+' : '-'} a)^2$ với $a$ là hằng số. Giá trị của $m$ là`,
    verify: `(()=>{const b=${2 * k * s};return (b/2)*(b/2);})()`,
    explanation: R`$(x ${s > 0 ? '+' : '-'} a)^2 = x^2 ${s > 0 ? '+' : '-'} 2ax + a^2$. So sánh: $2a = ${2 * k}$ nên $a = ${k}$ và $m = a^2 = ${k * k}$. Phương án $${4 * k * k}$ do lấy $(${2 * k})^2$.` };
};
// 10. Dữ kiện ẩn, nhóm rồi đặt nhân tử chung
T[10] = (n, idx) => {
  const s = int(3, 9), k = int(2, 9), v = pick([0, 1]); if (k === s) return null;
  const sg = v ? 1 : -1, C = s * s + sg * k * s;
  const q = numQ(C, [s * s - sg * k * s, s * s + sg * k, (s + sg * k) ** 2], idx); if (!q) return null;
  const cond = v ? `a - b = ${s}` : `a + b = ${s}`, E = v ? `a^2 - 2ab + b^2 + ${k}a - ${k}b` : `a^2 + 2ab + b^2 - ${k}a - ${k}b`;
  const base = v ? 'a - b' : 'a + b';
  return { ...q, prompt: R`Biết $${cond}$. Giá trị của biểu thức $${E}$ bằng`,
    verify: v ? `(()=>{const a=${s}+1.3,b=1.3;return Math.round((a*a-2*a*b+b*b+${k}*a-${k}*b)*1e6)/1e6;})()` : `(()=>{const a=${s}/2+0.7,b=${s}/2-0.7;return Math.round((a*a+2*a*b+b*b-${k}*a-${k}*b)*1e6)/1e6;})()`,
    explanation: R`$${E} = (${base})^2 ${v ? '+' : '-'} ${k}(${base}) = (${base})(${base} ${v ? '+' : '-'} ${k}) = ${s} \cdot ${v ? s + k : s - k < 0 ? `(${s - k})` : s - k} = ${C}$. Phương án $${s * s - sg * k * s}$ sai dấu; phương án $${s * s + sg * k}$ quên nhân $${k}$ với $${base}$.` };
};
// 11. Lối đi bao quanh (thực tế, mô hình hoá)
const NOUN11 = [['Một mảnh vườn', 'vườn'], ['Một bồn hoa', 'bồn hoa'], ['Một bể bơi', 'bể bơi'], ['Một sân cỏ', 'sân cỏ'], ['Một ao cá', 'ao cá']];
// Hình chữ nhật chiều rộng x, chiều dài x + a, lối đi rộng w bao quanh phía ngoài: S = 2w(2x + a + 2w)
T[11] = (n, idx) => {
  const w = int(1, 3), a = int(1, 8), [Ctx, noun] = pick(NOUN11);
  const q = exprQ(`(x+${2 * w})*(x+${a + 2 * w})-x*(x+${a})`, [`${2 * w}(2x + ${a + 2 * w})`, `${2 * w}*(2*x+${a + 2 * w})`],
    [[`${2 * w}(2x + ${a + w})`, `${2 * w}*(2*x+${a + w})`], [w === 1 ? `2x + ${a + 2}` : `${w}(2x + ${a + 2 * w})`, `${w}*(2*x+${a + 2 * w})`], [`${2 * w}(x + ${a + 2 * w})`, `${2 * w}*(x+${a + 2 * w})`]], idx);
  return q && { ...q, _mkey: `${w},${a}`, image: imgPath(n, '11'), _fig: () => rectFig(fig(n, '11'), w, a, noun),
    prompt: R`${Ctx} có dạng hình chữ nhật với chiều rộng $x$ (m) và chiều dài hơn chiều rộng $${a}$ m. Người ta làm một lối đi rộng $${w}$ m bao quanh phía ngoài ${noun} như hình bên. Diện tích của lối đi (m²) là`,
    explanation: R`${noun[0].toUpperCase() + noun.slice(1)} có kích thước $x$ và $x + ${a}$; hình chữ nhật lớn (gồm cả lối đi) có kích thước $x + ${2 * w}$ và $x + ${a + 2 * w}$. Diện tích lối đi: $(x + ${2 * w})(x + ${a + 2 * w}) - x(x + ${a}) = x^2 + ${a + 4 * w}x + ${2 * w * (a + 2 * w)} - x^2 - ${cf(a)}x = ${4 * w}x + ${2 * w * (a + 2 * w)} = ${2 * w}(2x + ${a + 2 * w})$. Phương án $${2 * w}(2x + ${a + w})$ do chỉ cộng bề rộng lối đi ở một bên; phương án $${2 * w}(x + ${a + 2 * w})$ do đặt nhân tử chung sai.` };
};
// 12. a ± b, ab → a³ ± b³
T[12] = (n, idx) => {
  const d = int(1, 6), p = int(1, 9), v = pick([0, 1]); if (v && d * d < 4 * p) return null;
  const sg = v ? -1 : 1, C = d ** 3 + sg * 3 * d * p;
  const q = numQ(C, [d ** 3 + sg * d * p, d ** 3, d ** 3 - sg * 3 * d * p], idx); if (!q) return null;
  const cond = v ? `a + b = ${d}` : `a - b = ${d}`, E = v ? 'a^3 + b^3' : 'a^3 - b^3';
  return { ...q, prompt: R`Cho hai số thực $a$, $b$ thỏa mãn $${cond}$ và $ab = ${p}$. Giá trị của $${E}$ bằng`,
    verify: v ? `(()=>{const a=(${d}+Math.sqrt(${d * d - 4 * p}))/2,b=${d}-a;return Math.round((a**3+b**3)*1e6)/1e6;})()` : `(()=>{const b=(-${d}+Math.sqrt(${d * d + 4 * p}))/2,a=b+${d};return Math.round((a**3-b**3)*1e6)/1e6;})()`,
    explanation: v
      ? R`$a^3 + b^3 = (a + b)(a^2 - ab + b^2) = (a + b)\left[(a + b)^2 - 3ab\right] = ${d} \cdot (${d * d} - ${3 * p}) = ${C}$. Phương án $${d ** 3 - d * p}$ do viết $a^2 - ab + b^2 = (a + b)^2 - ab$.`
      : R`$a^3 - b^3 = (a - b)(a^2 + ab + b^2) = (a - b)\left[(a - b)^2 + 3ab\right] = ${d} \cdot (${d * d} + ${3 * p}) = ${C}$. Phương án $${d ** 3 + d * p}$ do viết $a^2 + ab + b^2 = (a - b)^2 + ab$.` };
};
// 13. Đúng/Sai: P(x) = c x³ − c k² x
T[13] = (n, pat) => {
  const c = int(1, 3), k = int(2, 9), [ta, tb, tc, td] = pat;
  const P = poly([[c, 'x^3'], [-c * k * k, 'x']]), V = c * (k + 1) * (2 * k + 1), Vs = tc ? V : 2 * c * k * (k + 1) /* lỗi: (k+1)+k tính thành 2k */, cnt = td ? 3 : 2;
  return { answer: pat,
    prompt: R`Cho đa thức $P(x) = ${P}$. Xét tính đúng sai của các mệnh đề sau.`,
    options: [ta ? R`a) $P(x) = ${cf(c)}x(x^2 - ${k * k})$.` : R`a) $P(x) = ${cf(c)}x^2(x - ${k * k})$.`, tb ? R`b) $P(x) = ${cf(c)}x(x - ${k})(x + ${k})$.` : R`b) $P(x) = ${cf(c)}x(x - ${k})^2$.`,
      R`c) $P(${k + 1}) = ${Vs}$.`, R`d) Có đúng $${cnt}$ giá trị của $x$ để $P(x) = 0$.`],
    verify: `(()=>{const f=x=>${c}*x**3-${c * k * k}*x;const pts=[1.3,-2.1,3.7];const eq=g=>pts.every(x=>Math.abs(g(x)-f(x))<1e-7);let z=0;for(let x=-50;x<=50;x++)if(f(x)===0)z++;return [eq(${ta ? `x=>${c}*x*(x*x-${k * k})` : `x=>${c}*x*x*(x-${k * k})`}),eq(${tb ? `x=>${c}*x*(x-${k})*(x+${k})` : `x=>${c}*x*(x-${k})**2`}),f(${k + 1})===${Vs},z===${cnt}];})()`,
    explanation: R`Đặt nhân tử chung rồi dùng hiệu hai bình phương: $P(x) = ${cf(c)}x(x^2 - ${k * k}) = ${cf(c)}x(x - ${k})(x + ${k})$. a) ${TF(ta)}${ta ? '' : R` (nhân tử chung chỉ là $${cf(c)}x$, không phải $${cf(c)}x^2$)`}. b) ${TF(tb)}${tb ? '' : R` ($x^2 - ${k * k} = (x - ${k})(x + ${k})$, không phải $(x - ${k})^2$)`}. c) ${TF(tc)}: $P(${k + 1}) = ${cf(c)}${c === 1 ? '' : R` \cdot `}${k + 1} \cdot 1 \cdot ${2 * k + 1} = ${V}$. d) ${TF(td)}: $P(x) = 0 \Leftrightarrow x = 0$ hoặc $x = ${k}$ hoặc $x = -${k}$, có đúng $3$ giá trị.` };
};
// 14. Đúng/Sai: A = a²x² − (y − e)²
T[14] = (n, pat) => {
  const a = int(1, 2), k = int(1, 9), e = pick([1, -1]) * k, [ta, tb, tc, td] = pat;
  const A = poly([[a * a, 'x^2'], [-1, 'y^2'], [2 * e, 'y'], [-e * e, '']]), ax = a === 1 ? 'x' : `(${a}x)`;
  const f1 = poly([[a, 'x'], [-1, 'y'], [e, '']]), f2 = poly([[a, 'x'], [1, 'y'], [-e, '']]);
  const g1 = poly([[a, 'x'], [-1, 'y'], [-e, '']]), g2 = poly([[a, 'x'], [1, 'y'], [e, '']]);
  const u = int(1, 4), v = int(1, 6), V = (a * u - v + e) * (a * u + v - e); if (V === 0) return null;
  const Vw = (a * u - v - e) * (a * u + v + e), Vs = td ? V : (Vw !== V ? Vw : V + 4);
  const Af = `(x,y)=>${a * a}*x*x-y*y+(${2 * e})*y-${e * e}`;
  return { answer: pat, _key: `${a},${e}`,
    prompt: R`Cho biểu thức $A = ${A}$. Xét tính đúng sai của các mệnh đề sau.`,
    options: [R`a) $A = ${ax}^2 - (${L(1, ta ? -e : e, 'y')})^2$.`, tb ? R`b) $A = (${f1})(${f2})$.` : R`b) $A = (${g1})(${g2})$.`,
      R`c) Với mọi $x$, $y$ thỏa mãn $${tc ? poly([[a, 'x'], [1, 'y']]) : poly([[a, 'x'], [-1, 'y']])} = ${e}$ thì $A = 0$.`, R`d) Tại $x = ${u}$, $y = ${v}$ thì $A = ${Vs}$.`],
    verify: `(()=>{const A=${Af};const pts=[[1.3,0.7],[2.9,-1.1],[-0.6,2.2]];const eq=g=>pts.every(([x,y])=>Math.abs(g(x,y)-A(x,y))<1e-7);const cy=x=>${tc ? `${e}-${a}*x` : `${a}*x-(${e})`};const c=[1.5,-0.7,4.2].every(x=>Math.abs(A(x,cy(x)))<1e-9);return [eq((x,y)=>${a * a}*x*x-(y-(${ta ? e : -e}))**2),eq((x,y)=>${tb ? `(${a}*x-y+(${e}))*(${a}*x+y-(${e}))` : `(${a}*x-y-(${e}))*(${a}*x+y+(${e}))`}),c,A(${u},${v})===${Vs}];})()`,
    explanation: R`Nhóm ba hạng tử cuối: $A = ${ax}^2 - (y^2 ${e > 0 ? '-' : '+'} ${Math.abs(2 * e)}y + ${e * e}) = ${ax}^2 - (${L(1, -e, 'y')})^2 = (${f1})(${f2})$. a) ${TF(ta)}. b) ${TF(tb)}. c) ${TF(tc)}: ${tc ? R`khi $${poly([[a, 'x'], [1, 'y']])} = ${e}$ thì nhân tử $${f2} = 0$ nên $A = 0$` : R`khi $${poly([[a, 'x'], [-1, 'y']])} = ${e}$ thì $${f1} = ${2 * e} \ne 0$, còn $${f2}$ thay đổi, chẳng hạn $x = 0$, $y = ${-e}$ cho $A = ${-4 * e * e} \ne 0$`}. d) ${TF(td)}: $A = (${a * u} - ${v} ${e > 0 ? '+' : '-'} ${Math.abs(e)})(${a * u} + ${v} ${e > 0 ? '-' : '+'} ${Math.abs(e)}) = ${a * u - v + e} \cdot ${par(a * u + v - e)} = ${V}$.` };
};
// 15. Đúng/Sai thực tế: lối đi bao quanh phía ngoài
const NOUN15 = [['mảnh vườn', 'vườn'], ['bồn hoa', 'bồn hoa'], ['sân chơi', 'sân chơi'], ['khu đất trồng rau', 'đất rau']];
T[15] = (n, pat) => {
  const w = int(1, 3), X = int(8, 30), X0 = int(8, 30), [noun, short] = pick(NOUN15), [ta, tb, tc, td] = pat; if (X0 === X) return null;
  const S = (x) => 4 * w * (x + w), cs = tc ? S(X) : 4 * w * (X + 2 * w), xs = td ? X0 : X0 + w;
  return { answer: pat, _mkey: `${w},${X},${X0}`, image: imgPath(n, '15'), _fig: () => walkFig(fig(n, '15'), w, true, short),
    prompt: R`Một ${noun} có dạng hình vuông cạnh $x$ (m). Người ta làm một lối đi rộng $${w}$ m bao quanh phía ngoài ${noun} như hình bên. Gọi $S$ là diện tích của lối đi (m²). Xét tính đúng sai của các mệnh đề sau.`,
    options: [R`a) Hình vuông lớn (gồm ${noun} và lối đi) có cạnh bằng $x + ${ta ? 2 * w : w}$ (m).`, R`b) $S = ${4 * w}(x + ${tb ? w : 2 * w})$.`,
      R`c) Khi $x = ${X}$ thì $S = ${cs}$ m².`, R`d) Nếu diện tích lối đi là $${S(X0)}$ m² thì cạnh của ${noun} là $${xs}$ m.`],
    verify: `(()=>{const w=${w};const S=x=>(x+2*w)**2-x*x;return [${ta ? 2 * w : w}===2*w,[3.3,7.9].every(x=>Math.abs(${4 * w}*(x+${tb ? w : 2 * w})-S(x))<1e-9),S(${X})===${cs},(${S(X0)}-4*w*w)/(4*w)===${xs}];})()`,
    explanation: R`Mỗi bên lối đi rộng $${w}$ m nên cạnh hình vuông lớn là $x + ${2 * w}$. Do đó $S = (x + ${2 * w})^2 - x^2 = ${2 * w}(2x + ${2 * w}) = ${4 * w}(x + ${w})$. a) ${TF(ta)}. b) ${TF(tb)}. c) ${TF(tc)}: $S = ${4 * w} \cdot (${X} + ${w}) = ${S(X)}$ m². d) ${TF(td)}: $${4 * w}(x + ${w}) = ${S(X0)} \Leftrightarrow x + ${w} = ${S(X0) / (4 * w)} \Leftrightarrow x = ${X0}$ (m).` };
};
// 16. Đúng/Sai: M = (ax ± k)², N = a²x² − k²
T[16] = (n, pat) => {
  const a = int(1, 3), k = int(1, 9), s = pick([1, -1]), [ta, tb, tc, td] = pat; if (gcd(a, k) !== 1 || (a === 1 && k === 1)) return null;
  const M = poly([[a * a, 'x^2'], [2 * s * a * k, 'x'], [k * k, '']]), N = poly([[a * a, 'x^2'], [-k * k, '']]);
  const good = L(a, s * k), bad = L(a, -s * k);
  const Mf = `x=>${a * a}*x*x+(${2 * s * a * k})*x+${k * k}`, Nf = `x=>${a * a}*x*x-${k * k}`;
  return { answer: pat,
    prompt: R`Cho hai đa thức $M = ${M}$ và $N = ${N}$. Xét tính đúng sai của các mệnh đề sau.`,
    options: [R`a) $M = (${ta ? good : bad})^2$.`, tb ? R`b) $N = (${L(a, -k)})(${L(a, k)})$.` : R`b) $N = (${L(a, -k)})^2$.`,
      R`c) $M + N = ${2 * a}x(${tc ? good : bad})$.`, R`d) $M$ và $N$ có nhân tử chung là $${td ? good : bad}$.`],
    verify: `(()=>{const M=${Mf},N=${Nf};const pts=[1.3,-2.1,3.7];const eq=(g,h)=>pts.every(x=>Math.abs(g(x)-h(x))<1e-7);const r=${td ? -s * k : s * k}/${a};return [eq(x=>(${a}*x+(${ta ? s * k : -s * k}))**2,M),eq(${tb ? `x=>(${a}*x-${k})*(${a}*x+${k})` : `x=>(${a}*x-${k})**2`},N),eq(x=>${2 * a}*x*(${a}*x+(${tc ? s * k : -s * k})),x=>M(x)+N(x)),Math.abs(M(r))<1e-9&&Math.abs(N(r))<1e-9];})()`,
    explanation: R`$M = (${good})^2$ (bình phương của một ${s > 0 ? 'tổng' : 'hiệu'}), $N = (${L(a, -k)})(${L(a, k)})$ (hiệu hai bình phương). a) ${TF(ta)}. b) ${TF(tb)}. c) ${TF(tc)}: $M + N = ${poly([[2 * a * a, 'x^2'], [2 * s * a * k, 'x']])} = ${2 * a}x(${good})$. d) ${TF(td)}: $M = (${good})(${good})$ và $N$ đều có nhân tử $${good}$; ${td ? R`còn $${bad}$ không phải nhân tử của $M$` : R`$${bad}$ không phải nhân tử của $M$`}.` };
};
// 17. Trả lời ngắn: hệ số khi đặt nhân tử chung
T[17] = (n) => {
  const g = int(2, 12), p = int(1, 7), q = int(1, 11), s = pick([1, -1]); if (gcd(p, q) !== 1 || p === q) return null;
  const a = g * p, b = g * q;
  return { answer: [String(g + p + q)],
    prompt: R`Đặt nhân tử chung, ta viết được $${poly([[a, 'x^2'], [s * b, 'x']])} = cx(px ${s > 0 ? '+' : '-'} q)$, trong đó $c$, $p$, $q$ là các số nguyên dương và $p$, $q$ nguyên tố cùng nhau. Tính $c + p + q$.`,
    verify: `(()=>{const g=(x,y)=>y?g(y,x%y):x;const c=g(${a},${b});return c+${a}/c+${b}/c;})()`,
    explanation: R`$cx(px ${s > 0 ? '+' : '-'} q) = cpx^2 ${s > 0 ? '+' : '-'} cqx$ nên $cp = ${a}$, $cq = ${b}$. Vì $p$, $q$ nguyên tố cùng nhau nên $c = $ ƯCLN$(${a}, ${b}) = ${g}$, $p = ${p}$, $q = ${q}$: $${poly([[a, 'x^2'], [s * b, 'x']])} = ${g}x(${poly([[p, 'x'], [s * q, '']])})$. Vậy $c + p + q = ${g + p + q}$.` };
};
// 18. Trả lời ngắn: hệ số trong tổng/hiệu hai lập phương
T[18] = (n) => {
  const a = int(1, 4), k = int(1, 9), s = pick([1, -1]); if (gcd(a, k) !== 1 || a === k || (a === 1 && k < 2)) return null;
  const ans = a * k + k * k; if (ans > 999) return null;
  return { answer: [String(ans)],
    prompt: R`Biết $${poly([[a ** 3, 'x^3'], [s * k ** 3, '']])} = (${L(a, s * k)})(${cf(a * a)}x^2 ${s > 0 ? '-' : '+'} mx + n)$ với mọi $x$, trong đó $m$, $n$ là các hằng số. Tính $m + n$.`,
    verify: `(()=>{const n=(${s * k ** 3})/(${s * k});const val=(${a ** 3}+(${s * k ** 3}))/(${a}+(${s * k}));const m=${s}*(${a * a}+n-val);return m+n;})()`,
    explanation: R`$${poly([[a ** 3, 'x^3'], [s * k ** 3, '']])} = ${a === 1 ? "x" : `(${a}x)`}^3 ${s > 0 ? '+' : '-'} ${k}^3 = (${L(a, s * k)})(${poly([[a * a, 'x^2'], [-s * a * k, 'x'], [k * k, '']])})$. So sánh: $m = ${a * k}$, $n = ${k * k}$. Vậy $m + n = ${ans}$.` };
};
// 19. Trả lời ngắn: tính giá trị nhờ phân tích (dữ kiện tổng, hiệu)
T[19] = (n) => {
  const s = int(2, 12), d = int(1, 9), k = int(1, 9), v = pick([0, 1]); if (d === s) return null;
  const ans = v ? s * (d - k) : d * (s + k); if (ans === 0) return null;
  const E = poly([[1, 'x^2'], [-1, 'y^2'], [v ? -k : k, 'x'], [-k, 'y']]);
  return { answer: [String(ans)],
    prompt: R`Biết $x + y = ${s}$ và $x - y = ${d}$. Tính giá trị của biểu thức $A = ${E}$.`,
    verify: `(()=>{const x=(${s}+${d})/2,y=(${s}-${d})/2;return Math.round((x*x-y*y+(${v ? -k : k})*x-${k}*y)*1e6)/1e6;})()`,
    explanation: v
      ? R`$A = (x - y)(x + y) - ${cf(k)}(x + y) = (x + y)(x - y - ${k}) = ${s} \cdot ${par(d - k)} = ${ans}$.`
      : R`$A = (x - y)(x + y) + ${cf(k)}(x - y) = (x - y)(x + y + ${k}) = ${d} \cdot ${s + k} = ${ans}$.` };
};
// 20. Trả lời ngắn: tìm x dạng A·B = 0
T[20] = (n) => {
  const a = int(1, 9), b = int(1, 9), s = pick([1, -1]); if (a === b) return null;
  const ans = s > 0 ? a + b : a - b; if (ans === 0) return null;
  const lhs = `x(x - ${a}) ${s > 0 ? '+' : '-'} ${cf(b)}(${a} - x)`;
  return { answer: [String(ans)],
    prompt: R`Tính tổng tất cả các giá trị của $x$ thỏa mãn $${lhs} = 0$.`,
    verify: `(()=>{const B=-(${a}+(${s})*${b}),C=(${s})*${a}*${b};const D=Math.sqrt(B*B-4*C);const r=[...new Set([(-B+D)/2,(-B-D)/2])];return r.reduce((u,v)=>u+v,0);})()`,
    explanation: R`$${lhs} = x(x - ${a}) ${s > 0 ? '-' : '+'} ${cf(b)}(x - ${a}) = (x - ${a})(${L(1, -s * b)})$. Do đó $x - ${a} = 0$ hoặc $${L(1, -s * b)} = 0$, tức $x = ${a}$ hoặc $x = ${s * b}$. Tổng các giá trị là $${a} + ${par(s * b)} = ${ans}$.` };
};
// 21. Trả lời ngắn thực tế: tấm bìa cắt góc
const NOUN21 = ['một tấm bìa', 'một tấm tôn', 'một tấm gỗ', 'một mảnh vải'];
T[21] = (n) => {
  const a = int(6, 30), b = int(1, a - 3), ctx = pick(NOUN21), s = a + b, S = a * a - b * b;
  return { answer: [String(a)], _mkey: `${a},${b}`, image: imgPath(n, '21'), _fig: () => cutFig(fig(n, '21'), a, b),
    prompt: R`Từ ${ctx} hình vuông cạnh $a$ (cm), người ta cắt bỏ ở một góc một hình vuông cạnh $b$ (cm) như hình bên. Biết phần còn lại có diện tích $${S}$ cm² và $a + b = ${s}$. Tính $a$ (cm).`,
    verify: `(${s}+${S}/${s})/2`,
    explanation: R`Diện tích phần còn lại: $a^2 - b^2 = (a - b)(a + b) = ${S}$, nên $a - b = ${S} : ${s} = ${a - b}$. Từ $a + b = ${s}$ và $a - b = ${a - b}$ suy ra $a = (${s} + ${a - b}) : 2 = ${a}$ (cm).` };
};
// 22. Trả lời ngắn thực tế: lối đi sát mép bên trong
const NAME22 = ['Bác Minh', 'Cô Lan', 'Ông Hòa', 'Chú Tâm', 'Bà Mai'];
const NOUN22 = [['mảnh vườn', 'vườn'], ['mảnh đất', 'đất'], ['sân', 'sân']];
T[22] = (n) => {
  const w = int(1, 2), x = int(10, 40), who = pick(NAME22), [noun, short] = pick(NOUN22), S = 4 * w * (x - w);
  return { answer: [String(x)], _mkey: `${w},${x}`, image: imgPath(n, '22'), _fig: () => walkFig(fig(n, '22'), w, false, 'phần trong'),
    prompt: R`${who} có một ${noun} hình vuông. Người ta làm một lối đi rộng $${w}$ m chạy sát mép bên trong, bao quanh ${noun} như hình bên. Biết diện tích lối đi là $${S}$ m². Tính cạnh $x$ của ${noun} (m).`,
    verify: `(()=>{const w=${w},S=${S};return (S+4*w*w)/(4*w);})()`,
    explanation: R`Phần bên trong lối đi là hình vuông cạnh $x - ${2 * w}$. Diện tích lối đi: $x^2 - (x - ${2 * w})^2 = (x - x + ${2 * w})(x + x - ${2 * w}) = ${2 * w}(2x - ${2 * w}) = ${4 * w}(x - ${w})$. Từ $${4 * w}(x - ${w}) = ${S}$ suy ra $x - ${w} = ${S / (4 * w)}$, $x = ${x}$ (m).` };
};

// ---------- Thông tin câu (đề gốc) ----------
const META = [
  ['mcq', 'NB', false, false], ['mcq', 'NB', false, true], ['mcq', 'NB', false, true], ['mcq', 'NB', false, true],
  ['mcq', 'TH', false, false], ['mcq', 'NB', false, false], ['mcq', 'TH', false, false], ['mcq', 'TH', false, false],
  ['mcq', 'TH', false, false], ['mcq', 'VD', false, false], ['mcq', 'VD', true, false], ['mcq', 'VD', false, false],
  ['tf', 'NB', false, false], ['tf', 'TH', false, false], ['tf', 'VD', true, false], ['tf', 'NB', false, false],
  ['short', 'NB', false, false], ['short', 'NB', false, false], ['short', 'TH', false, false], ['short', 'TH', false, false],
  ['short', 'VD', true, false], ['short', 'VD', true, false],
];
const PTS = { mcq: 0.25, tf: 1, short: 0.5 };
const MCQ_BASE = [0, 1, 2, 3, 2, 0, 3, 1, 0, 2, 3, 1];
const PATTERNS = [[1, 0, 1, 1], [1, 0, 1, 0], [1, 1, 0, 0], [1, 1, 0, 1], [0, 1, 1, 0], [0, 1, 0, 1], [1, 0, 0, 1], [0, 0, 1, 1], [0, 1, 1, 1], [1, 1, 1, 0], [0, 1, 0, 0], [1, 0, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]].map((p) => p.map(Boolean));
// chống trùng theo đề bài (không tính thứ tự phương án)
// chống trùng: theo bộ số (_mkey) nếu có — đổi ngữ cảnh mà giữ số vẫn tính là trùng; không thì theo đề bài
const qkey = (q) => q._mkey ?? q.prompt.replace(/\s+/g, '') + (q._key ?? '');
const seen = new Set();
const shortSeen = META.map(() => new Set());
const exams = [];
for (let n = 1; n <= 20; n++) {
  const qs = META.map(([kind, muc, thuc_te, bam_may], i) => {
    for (let tries = 0; tries < 6000; tries++) {
      const key = kind === 'mcq' ? (MCQ_BASE[i] + n - 1) % 4 : kind === 'tf' ? PATTERNS[(n * 3 + (i - 12) * 5) % PATTERNS.length] : null;
      cur = i + 1;
      const q = T[i + 1](n, key); if (!q) continue;
      const k = `${i}|` + qkey(q); if (seen.has(k)) continue; delete q._key; delete q._mkey;
      if (kind === 'short' && shortSeen[i].has(q.answer[0]) && tries < 4000) continue;
      seen.add(k); if (kind === 'short') shortSeen[i].add(q.answer[0]);
      const fg = q._fig; delete q._fig; if (fg) fg();
      return { kind, muc, thuc_te, bam_may, prompt: q.prompt, ...(q.image ? { image: q.image } : {}),
        ...(q.options ? { options: q.options } : {}), answer: q.answer, points: PTS[kind], verify: q.verify, explanation: q.explanation };
    }
    throw new Error(`Đề ${n} câu ${i + 1}: không tìm được bộ số`);
  });
  const nn = String(n).padStart(2, '0');
  exams.push({ slug: `toan8-bai9-phan-tich-da-thuc-thanh-nhan-tu-${nn}`, title: `Bài 9. Phân tích đa thức thành nhân tử — Đề ${n}`, sort_order: n, time_limit_min: 90,
    description: 'Đề bài tập về nhà Bài 9 (Phân tích đa thức thành nhân tử), cấu trúc THPT: 12 trắc nghiệm, 4 Đúng/Sai, 6 trả lời ngắn.', questions: qs });
}
const head = { grade: 8, chapter: 'Chương II. Hằng đẳng thức đáng nhớ và ứng dụng', topic: 'Bài 9. Phân tích đa thức thành nhân tử', level: 'kha' };
writeFileSync(out1, JSON.stringify({ ...head, exams: exams.slice(0, 1) }, null, 2) + '\n', 'utf8');
writeFileSync(out2, JSON.stringify({ ...head, exams: exams.slice(1) }, null, 2) + '\n', 'utf8');
console.log(`Đã sinh ${exams.length} đề (${exams.length * 22} câu): ${out1}, ${out2}`);
