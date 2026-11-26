#!/usr/bin/env node
// Sinh đề 2–20 cho Toán 10 · Bài 10. Vectơ trong mặt phẳng tọa độ, theo khuôn của đề gốc (đề 1).
// Không tốn token AI: mỗi câu có một khuôn tham số, chọn bộ số đẹp theo đề (ngẫu nhiên có hạt giống),
// tự tính đáp án, phương án nhiễu, lời giải, verify và vẽ hình.
//   node de-thi/toan-10/theo-bai/sinh-de/bai-10.mjs <file-đề-gốc.json> <file-ra.json> [hạt-giống]
// Hình ghi vào de-thi/toan-10/theo-bai/hinh/bai-10/ (cạnh thư mục sinh-de).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const HINH = resolve(here, '..', 'hinh', 'bai-10');
mkdirSync(HINH, { recursive: true });
const [baseFile, outFile, seedArg] = process.argv.slice(2);
const base = JSON.parse(readFileSync(baseFile, 'utf8'));
const R = String.raw;

// ---------- Tiện ích ----------
let seed = Number(seedArg ?? 20261126);
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const int = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
const nz = (lo, hi) => { let v; do v = int(lo, hi); while (v === 0); return v; };
function frac(x) {
  if (Number.isInteger(x)) return String(x);
  for (let d = 2; d <= 12; d++) { const k = Math.round(x * d); if (Math.abs(k / d - x) < 1e-9) return `${k < 0 ? '-' : ''}\\frac{${Math.abs(k)}}{${d}}`; }
  return String(x).replace('.', '{,}');
}
const N = frac;
const P = (x, y) => `(${N(x)}; ${N(y)})`;
const $ = (s) => `$${s}$`;
const eq = (a, b) => a[0] === b[0] && a[1] === b[1];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]], sub = (a, b) => [a[0] - b[0], a[1] - b[1]], mul = (k, a) => [k * a[0], k * a[1]];
const cross = (a, b) => a[0] * b[1] - b[0] * a[1];
const ij = (a, b) => { // a i + b j
  const t = (c, s, first) => (c === 0 ? '' : `${c < 0 ? (first ? '-' : ' - ') : (first ? '' : ' + ')}${Math.abs(c) === 1 ? '' : Math.abs(c)}\\vec{${s}}`);
  return (t(a, 'i', true) + t(b, 'j', a === 0)) || '\\vec{0}';
};
function surd(n2) { // √n2 rút gọn
  let k = 1, m = n2;
  for (let d = 2; d * d <= m; d++) while (m % (d * d) === 0) { m /= d * d; k *= d; }
  return m === 1 ? String(k) : `${k === 1 ? '' : k}\\sqrt{${m}}`;
}
// đặt đáp án đúng vào vị trí idx; mỗi phương án là [chuỗi, giá trị]
function place(correct, wrongs, idx) {
  const all = [correct, ...wrongs];
  if (new Set(all.map((x) => x[0])).size !== 4) return null;
  const out = []; let k = 0;
  for (let i = 0; i < 4; i++) out.push(i === idx ? correct : wrongs[k++]);
  return out;
}
const pairVerify = (opts, val) => `(()=>{const v=[${val[0]},${val[1]}];const o=[${opts.map((o) => `[${o[1][0]},${o[1][1]}]`).join(',')}];return o.findIndex(p=>p[0]===v[0]&&p[1]===v[1]);})()`;
const pairOpts = (correct, wrongs, idx) => {
  const o = place([$(P(...correct)), correct], wrongs.map((w) => [$(P(...w)), w]), idx);
  return o && { options: o.map((x) => x[0]), verify: pairVerify(o, correct), answer: idx };
};
const TF = (b) => (b ? 'Đúng' : 'Sai');

// ---------- Hình (lưới tọa độ) ----------
function grid(xmin, xmax, ymin, ymax, s = 40) {
  const W = (xmax - xmin + 2) * s, H = (ymax - ymin + 2) * s;
  const X = (x) => (x - xmin + 1) * s, Y = (y) => (ymax - y + 1) * s;
  let g = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="Times New Roman" font-size="17">
  <defs>
    <marker id="mui" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#000"/></marker>
    <marker id="muiv" viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="14" markerHeight="14" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#c0392b"/></marker>
    <marker id="muin" viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#c0392b"/></marker>
  </defs>
  <rect width="${W}" height="${H}" fill="#fff"/>`;
  for (let x = xmin; x <= xmax; x++) g += `<line x1="${X(x)}" y1="${Y(ymin)}" x2="${X(x)}" y2="${Y(ymax)}" stroke="#d9e2ec" stroke-width="1"/>`;
  for (let y = ymin; y <= ymax; y++) g += `<line x1="${X(xmin)}" y1="${Y(y)}" x2="${X(xmax)}" y2="${Y(y)}" stroke="#d9e2ec" stroke-width="1"/>`;
  g += `<line x1="${X(xmin) - 10}" y1="${Y(0)}" x2="${X(xmax) + 25}" y2="${Y(0)}" stroke="#000" stroke-width="1.5" marker-end="url(#mui)"/>`;
  g += `<line x1="${X(0)}" y1="${Y(ymin) + 10}" x2="${X(0)}" y2="${Y(ymax) - 25}" stroke="#000" stroke-width="1.5" marker-end="url(#mui)"/>`;
  g += `<text x="${X(xmax) + 18}" y="${Y(0) + 20}" font-style="italic">x</text><text x="${X(0) + 8}" y="${Y(ymax) - 14}" font-style="italic">y</text>`;
  g += `<text x="${X(0) - 16}" y="${Y(0) + 18}" font-style="italic">O</text>`;
  for (let x = xmin; x <= xmax; x++) if (x !== 0) g += `<text x="${X(x) - (x < 0 ? 9 : 4)}" y="${Y(0) + 17}" font-size="14">${x < 0 ? '−' + -x : x}</text>`;
  for (let y = ymin; y <= ymax; y++) if (y !== 0) g += `<text x="${X(0) - (y < 0 ? 22 : 14)}" y="${Y(y) + 5}" font-size="14">${y < 0 ? '−' + -y : y}</text>`;
  return { g, X, Y, end: '</svg>\n' };
}
const point = (X, Y, x, y, name, dx = 8, dy = -8) => `<circle cx="${X(x)}" cy="${Y(y)}" r="4" fill="#1f4fa8"/><text x="${X(x) + dx}" y="${Y(y) + dy}" font-weight="bold" font-style="italic" fill="#1f4fa8">${name}</text>`;
const vec = (X, Y, x1, y1, x2, y2, name, lx, ly) => `<line x1="${X(x1)}" y1="${Y(y1)}" x2="${X(x2)}" y2="${Y(y2)}" stroke="#c0392b" stroke-width="2.4" marker-end="url(#muiv)"/><text x="${X(lx)}" y="${Y(ly)}" font-style="italic" font-weight="bold" fill="#c0392b">${name}</text><line x1="${X(lx) + 1}" y1="${Y(ly) - 16}" x2="${X(lx) + 10}" y2="${Y(ly) - 16}" stroke="#c0392b" stroke-width="1.2" marker-end="url(#muin)"/>`;
const fig = (n, c) => `de-${String(n).padStart(2, '0')}-cau-${c}.svg`;

// ---------- Khuôn từng câu: (n, ans) → câu (n: số đề, ans: vị trí đáp án / mẫu Đúng/Sai) ----------
const T = {};
T[1] = (n, idx) => {
  const a = nz(-6, 6), b = nz(-6, 6); if (Math.abs(a) === Math.abs(b)) return null;
  const o = pairOpts([a, b], [[b, a], [a, -b], [-a, -b]], idx); if (!o) return null;
  return { ...o, prompt: R`Trong mặt phẳng tọa độ $Oxy$, cho vectơ $\vec{u} = ${ij(a, b)}$. Tọa độ của vectơ $\vec{u}$ là`,
    explanation: R`Vectơ $\vec{u} = x\vec{i} + y\vec{j}$ có tọa độ $(x; y)$, nên $\vec{u} = ${P(a, b)}$. Phương án $${P(b, a)}$ do đảo thứ tự hoành độ, tung độ.` };
};
T[2] = (n, idx) => {
  const A = [int(-5, 5), int(-5, 5)], B = [int(-5, 6), int(-5, 6)]; const v = sub(B, A); if (v[0] === 0 || v[1] === 0) return null;
  const o = pairOpts(v, [sub(A, B), add(A, B), [v[0], B[1] + A[1]]], idx); if (!o) return null;
  return { ...o, prompt: R`Trong mặt phẳng tọa độ $Oxy$, cho hai điểm $A${P(...A)}$ và $B${P(...B)}$. Tọa độ của vectơ $\overrightarrow{AB}$ là`,
    explanation: R`$\overrightarrow{AB} = (x_B - x_A; y_B - y_A) = ${P(...v)}$. Phương án $${P(...sub(A, B))}$ do lấy nhầm $A - B$; phương án $${P(...add(A, B))}$ do cộng tọa độ.` };
};
T[3] = (n, idx) => {
  const p = nz(-4, 4), q = nz(-3, 4); if (Math.abs(p) === Math.abs(q)) return null;
  const o = pairOpts([p, q], [[q, p], [-p, q], [p, -q]], idx); if (!o) return null;
  const { g, X, Y, end } = grid(-4, 4, -3, 4);
  return { ...o, _key: `M${p},${q}`, prompt: R`Trong mặt phẳng tọa độ $Oxy$ như hình bên (mỗi ô vuông có cạnh bằng $1$ đơn vị), tọa độ của điểm $M$ là`,
    image: `../hinh/bai-10/${fig(n, '03')}`,
    _fig: () => writeFileSync(resolve(HINH, fig(n, '03')), g + `<line x1="${X(p)}" y1="${Y(q)}" x2="${X(p)}" y2="${Y(0)}" stroke="#555" stroke-dasharray="5,4"/><line x1="${X(p)}" y1="${Y(q)}" x2="${X(0)}" y2="${Y(q)}" stroke="#555" stroke-dasharray="5,4"/>` + point(X, Y, p, q, 'M', p < 0 ? -22 : 8) + end),
    explanation: R`Gióng từ $M$ xuống trục hoành được hoành độ $${p}$, gióng sang trục tung được tung độ $${q}$. Vậy $M${P(p, q)}$. Phương án $${P(q, p)}$ do đảo thứ tự hoành độ và tung độ.` };
};
T[4] = (n, idx) => {
  const u = [nz(-5, 5), nz(-5, 5)], v = [nz(-5, 5), nz(-5, 5)]; const s = add(u, v);
  const o = pairOpts(s, [sub(u, v), [u[0] * v[0], u[1] * v[1]], [s[0], u[1] - v[1]]], idx); if (!o) return null;
  return { ...o, prompt: R`Trong mặt phẳng tọa độ $Oxy$, cho $\vec{u} = ${P(...u)}$ và $\vec{v} = ${P(...v)}$. Tọa độ của vectơ $\vec{u} + \vec{v}$ là`,
    explanation: R`$\vec{u} + \vec{v} = ${P(...s)}$ (cộng từng tọa độ tương ứng). Phương án $${P(...sub(u, v))}$ là tọa độ của $\vec{u} - \vec{v}$.` };
};
T[5] = (n, idx) => {
  const k = pick([-4, -3, -2, 2, 3, 4]), a = [nz(-4, 4), nz(-4, 4)]; const r = mul(k, a);
  const o = pairOpts(r, [mul(-k, a), [r[0], -r[1]], [a[0] + k, a[1] + k]], idx); if (!o) return null;
  return { ...o, prompt: R`Trong mặt phẳng tọa độ $Oxy$, cho $\vec{a} = ${P(...a)}$. Tọa độ của vectơ $${k}\vec{a}$ là`,
    explanation: R`$${k}\vec{a} = (${k} \cdot ${a[0] < 0 ? `(${a[0]})` : a[0]}; ${k} \cdot ${a[1] < 0 ? `(${a[1]})` : a[1]}) = ${P(...r)}$. Phương án $${P(a[0] + k, a[1] + k)}$ do cộng $${k}$ vào từng tọa độ.` };
};
T[6] = (n, idx) => {
  const A = [int(-5, 6), int(-5, 6)], B = [int(-5, 6), int(-5, 6)]; const s = add(A, B); if (s[0] % 2 || s[1] % 2 || eq(A, B)) return null;
  const I = mul(0.5, s);
  const o = pairOpts(I, [s, mul(0.5, sub(B, A)), [I[0], I[1] + 1]], idx); if (!o) return null;
  return { ...o, prompt: R`Trong mặt phẳng tọa độ $Oxy$, cho hai điểm $A${P(...A)}$ và $B${P(...B)}$. Tọa độ trung điểm $I$ của đoạn thẳng $AB$ là`,
    explanation: R`$I\left(\dfrac{x_A + x_B}{2}; \dfrac{y_A + y_B}{2}\right) = ${P(...I)}$. Phương án $${P(...s)}$ do quên chia cho $2$.` };
};
T[7] = (n, idx) => {
  const A = [int(-4, 5), int(-4, 5)], B = [int(-4, 5), int(-4, 5)], G = [int(-2, 4), int(-2, 4)];
  const C = sub(sub(mul(3, G), A), B); if (eq(A, B) || cross(sub(B, A), sub(C, A)) === 0) return null;
  const o = pairOpts(C, [mul(3, G), add(sub(mul(3, G), A), B), sub(add(A, B), G)], idx); if (!o) return null;
  return { ...o, prompt: R`Trong mặt phẳng tọa độ $Oxy$, cho tam giác $ABC$ có $A${P(...A)}$, $B${P(...B)}$ và trọng tâm $G${P(...G)}$. Tọa độ của đỉnh $C$ là`,
    explanation: R`$G$ là trọng tâm nên $x_C = 3x_G - x_A - x_B = ${C[0]}$ và $y_C = 3y_G - y_A - y_B = ${C[1]}$. Vậy $C${P(...C)}$. Phương án $${P(...mul(3, G))}$ do quên trừ tọa độ của $A$, $B$.` };
};
T[8] = (n, idx) => {
  const u = [nz(-4, 4), nz(-4, 4)], k = pick([-3, -2, 2, 3]); if (Math.abs(u[0]) === Math.abs(u[1])) return null;
  const good = mul(k, u), ws = [[u[1], u[0]], [-u[0], u[1]], [k * u[0], -k * u[1]]];
  if (ws.some((w) => cross(u, w) === 0)) return null;
  const o = place([$(P(...good)), good], ws.map((w) => [$(P(...w)), w]), idx); if (!o) return null;
  return { options: o.map((x) => x[0]), answer: idx, verify: `(()=>{const o=[${o.map((x) => `[${x[1]}]`).join(',')}];return o.findIndex(p=>${u[0]}*p[1]-p[0]*(${u[1]})===0);})()`,
    prompt: R`Trong mặt phẳng tọa độ $Oxy$, vectơ nào sau đây cùng phương với vectơ $\vec{u} = ${P(...u)}$?`,
    explanation: R`Hai vectơ $(x; y)$ và $(x'; y')$ cùng phương khi và chỉ khi $xy' - x'y = 0$. Vectơ $${P(...good)} = ${k}\vec{u}$ thỏa mãn; các phương án còn lại đều cho $xy' - x'y \ne 0$.` };
};
T[9] = (n, idx) => {
  const A = [int(-5, 5), int(-5, 5)], v = [nz(-5, 5), nz(-5, 5)]; const B = add(A, v);
  const o = pairOpts(B, [sub(A, v), sub(v, A), [A[0] * v[0], A[1] * v[1]]], idx); if (!o) return null;
  return { ...o, prompt: R`Trong mặt phẳng tọa độ $Oxy$, cho điểm $A${P(...A)}$ và vectơ $\overrightarrow{AB} = ${P(...v)}$. Tọa độ của điểm $B$ là`,
    explanation: R`$\overrightarrow{AB} = (x_B - x_A; y_B - y_A) = ${P(...v)}$, nên $x_B = ${A[0]} + ${v[0] < 0 ? `(${v[0]})` : v[0]} = ${B[0]}$, $y_B = ${A[1]} + ${v[1] < 0 ? `(${v[1]})` : v[1]} = ${B[1]}$. Vậy $B${P(...B)}$. Phương án $${P(...sub(A, v))}$ do lấy nhầm $A - \overrightarrow{AB}$.` };
};
T[10] = (n, idx) => {
  const p = nz(-5, 5), q = nz(-8, 8), r = nz(-6, 6); const m = q * p / r; if (!Number.isInteger(m) || m === 0) return null;
  const w = [-m, r * p / q, m + r].map((x) => Math.round(x * 100) / 100);
  if (w.some((x) => !Number.isInteger(x))) return null;
  const o = place([$(N(m)), m], w.map((x) => [$(N(x)), x]), idx); if (!o) return null;
  return { options: o.map((x) => x[0]), answer: idx, verify: `(()=>{for(let m=-60;m<=60;m++){if(m*(${r})-(${q})*(${p})===0)return m;}return NaN;})()`,
    prompt: R`Trong mặt phẳng tọa độ $Oxy$, cho $\vec{u} = (m; ${p})$ và $\vec{v} = ${P(q, r)}$. Giá trị của $m$ để hai vectơ $\vec{u}$ và $\vec{v}$ cùng phương là`,
    explanation: R`$\vec{u}$, $\vec{v}$ cùng phương $\Leftrightarrow m \cdot ${r < 0 ? `(${r})` : r} - ${q < 0 ? `(${q})` : q} \cdot ${p < 0 ? `(${p})` : p} = 0 \Leftrightarrow m = ${m}$. Phương án $${N(-m)}$ do sai dấu.` };
};
T[11] = (n, idx) => {
  const A = [int(-3, 4), int(-3, 4)], B = [int(-3, 6), int(-3, 6)], C = [int(-3, 6), int(-3, 6)];
  if (cross(sub(B, A), sub(C, A)) === 0) return null;
  const D = sub(add(A, C), B);
  const o = pairOpts(D, [sub(add(B, C), A), sub(add(A, B), C), [D[1], D[0]]], idx); if (!o) return null;
  return { ...o, prompt: R`Trong mặt phẳng tọa độ $Oxy$, cho ba điểm $A${P(...A)}$, $B${P(...B)}$, $C${P(...C)}$. Tọa độ điểm $D$ để tứ giác $ABCD$ là hình bình hành là`,
    explanation: R`$ABCD$ là hình bình hành $\Leftrightarrow \overrightarrow{AD} = \overrightarrow{BC} = ${P(...sub(C, B))}$, nên $D = ${P(...D)}$. Phương án $${P(...sub(add(B, C), A))}$ ứng với hình bình hành $ABDC$.` };
};
T[12] = (n, idx) => {
  const A = [int(-4, 6), int(-4, 6)], v = [nz(-4, 5), nz(-4, 5)], t = pick([2, 3, 4]); const B = add(A, mul(t, v));
  const vat = pick(['một con tàu', 'một chiếc ca nô', 'một máy bay không người lái']);
  const o = pairOpts(B, [add(A, v), mul(t, v), add(A, mul(t + 1, v))], idx); if (!o) return null;
  return { ...o, prompt: R`Trên một hệ trục tọa độ (đơn vị trên mỗi trục là km), ${vat} xuất phát từ vị trí $A${P(...A)}$ và chuyển động thẳng đều, mỗi giờ dịch chuyển theo vectơ $\vec{v} = ${P(...v)}$. Sau $${t}$ giờ, nó ở vị trí có tọa độ`,
    explanation: R`Sau $${t}$ giờ, dịch chuyển theo vectơ $${t}\vec{v} = ${P(...mul(t, v))}$, nên vị trí là $A + ${t}\vec{v} = ${P(...B)}$. Phương án $${P(...add(A, v))}$ là vị trí sau $1$ giờ; phương án $${P(...mul(t, v))}$ quên cộng tọa độ điểm xuất phát.` };
};
T[13] = (n, pat) => {
  const A = [int(-3, 4), int(-3, 4)], B = [int(-3, 5), int(-3, 5)], C = [int(-4, 5), int(-3, 6)];
  const AB = sub(B, A), AC = sub(C, A); if (cross(AB, AC) === 0 || AB[0] === 0 || AB[1] === 0) return null;
  const M = mul(0.5, add(B, C)), D = sub(add(A, C), B);
  const [ta, tb, tc, td] = pat;
  const ab = ta ? AB : [AB[0], AB[1] + 1], Ms = tc ? M : [M[0], M[1] + 1], Ds = td ? D : sub(add(B, C), A);
  return { answer: pat,
    prompt: R`Trong mặt phẳng tọa độ $Oxy$, cho ba điểm $A${P(...A)}$, $B${P(...B)}$, $C${P(...C)}$. Xét tính đúng sai của các mệnh đề sau.`,
    options: [R`a) $\overrightarrow{AB} = ${P(...ab)}$.`, tb ? R`b) Ba điểm $A$, $B$, $C$ không thẳng hàng.` : R`b) Ba điểm $A$, $B$, $C$ thẳng hàng.`, R`c) Trung điểm của đoạn thẳng $BC$ là $M${P(...Ms)}$.`, R`d) Tứ giác $ABCD$ là hình bình hành khi $D${P(...Ds)}$.`],
    verify: `(()=>{const A=[${A}],B=[${B}],C=[${C}];const AB=[B[0]-A[0],B[1]-A[1]],AC=[C[0]-A[0],C[1]-A[1]];const col=AB[0]*AC[1]-AC[0]*AB[1]===0;const M=[(B[0]+C[0])/2,(B[1]+C[1])/2],D=[A[0]+C[0]-B[0],A[1]+C[1]-B[1]];return [AB[0]===${ab[0]}&&AB[1]===${ab[1]}, ${tb ? '!col' : 'col'}, M[0]===${Ms[0]}&&M[1]===${Ms[1]}, D[0]===${Ds[0]}&&D[1]===${Ds[1]}];})()`,
    explanation: R`a) ${TF(ta)}: $\overrightarrow{AB} = ${P(...AB)}$. b) ${TF(tb)}: $\overrightarrow{AC} = ${P(...AC)}$ và $${AB[0]} \cdot ${AC[1] < 0 ? `(${AC[1]})` : AC[1]} - ${AC[0] < 0 ? `(${AC[0]})` : AC[0]} \cdot ${AB[1] < 0 ? `(${AB[1]})` : AB[1]} = ${cross(AB, AC)} \ne 0$, nên $A$, $B$, $C$ không thẳng hàng. c) ${TF(tc)}: trung điểm của $BC$ là $${P(...M)}$. d) ${TF(td)}: $ABCD$ là hình bình hành $\Leftrightarrow \overrightarrow{AD} = \overrightarrow{BC} = ${P(...sub(C, B))}$, suy ra $D${P(...D)}$.` };
};
T[14] = (n, pat) => {
  const u = [pick([2, 3]), pick([1, -1, 2])], v = [pick([-1, -2, 1]), pick([2, 3])]; // v luôn hướng lên, không cắt trục
  if (cross(u, v) === 0) return null;
  const su = [-4, u[1] === 2 ? -3 : -2], eu = add(su, u), sv = [3, 1], ev = add(sv, v);
  if (eu[1] === 0 || ev[1] === 0 || ev[0] === 0) return null;
  const [ta, tb, tc, td] = pat, s = add(u, v), t2 = sub(mul(2, u), v);
  const ua = ta ? u : [u[1], u[0]], sb = tb ? s : [s[0], s[1] + 1], tcv = tc ? t2 : [t2[0] - 2, t2[1]];
  if (!ta && eq(ua, u)) return null;
  const { g, X, Y, end } = grid(-4, 4, -3, 4);
  return { answer: pat, _key: `u${u}v${v}`, image: `../hinh/bai-10/${fig(n, '14')}`,
    _fig: () => writeFileSync(resolve(HINH, fig(n, '14')), g + vec(X, Y, ...su, ...eu, 'u', (su[0] + eu[0]) / 2 - 0.1, (su[1] + eu[1]) / 2 - 0.55) + vec(X, Y, ...sv, ...ev, 'v', (sv[0] + ev[0]) / 2 + 0.35, (sv[1] + ev[1]) / 2 - 0.1) + end),
    prompt: R`Trong mặt phẳng tọa độ $Oxy$ như hình bên (mỗi ô vuông có cạnh bằng $1$ đơn vị), cho hai vectơ $\vec{u}$ và $\vec{v}$. Xét tính đúng sai của các mệnh đề sau.`,
    options: [R`a) $\vec{u} = ${P(...ua)}$.`, R`b) $\vec{u} + \vec{v} = ${P(...sb)}$.`, R`c) $2\vec{u} - \vec{v} = ${P(...tcv)}$.`, td ? R`d) Hai vectơ $\vec{u}$ và $\vec{v}$ không cùng phương.` : R`d) Hai vectơ $\vec{u}$ và $\vec{v}$ cùng phương.`],
    verify: `(()=>{const u=[${eu[0]}-(${su[0]}),${eu[1]}-(${su[1]})],v=[${ev[0]}-(${sv[0]}),${ev[1]}-(${sv[1]})];const s=[u[0]+v[0],u[1]+v[1]],t=[2*u[0]-v[0],2*u[1]-v[1]];const col=u[0]*v[1]-v[0]*u[1]===0;return [u[0]===${ua[0]}&&u[1]===${ua[1]}, s[0]===${sb[0]}&&s[1]===${sb[1]}, t[0]===${tcv[0]}&&t[1]===${tcv[1]}, ${td ? '!col' : 'col'}];})()`,
    explanation: R`Đọc trên hình: $\vec{u}$ đi từ điểm $${P(...su)}$ đến điểm $${P(...eu)}$, nên $\vec{u} = ${P(...u)}$; $\vec{v}$ đi từ điểm $${P(...sv)}$ đến điểm $${P(...ev)}$, nên $\vec{v} = ${P(...v)}$. a) ${TF(ta)}. b) ${TF(tb)}: $\vec{u} + \vec{v} = ${P(...s)}$. c) ${TF(tc)}: $2\vec{u} - \vec{v} = ${P(...t2)}$. d) ${TF(td)}: $${u[0]} \cdot ${v[1] < 0 ? `(${v[1]})` : v[1]} - ${v[0] < 0 ? `(${v[0]})` : v[0]} \cdot ${u[1] < 0 ? `(${u[1]})` : u[1]} = ${cross(u, v)} \ne 0$, hai vectơ không cùng phương.` };
};
T[15] = (n, pat) => {
  const h = [nz(-4, 4), nz(-4, 4)], T0 = pick([4, 5, 6, 8]), A = [int(2, 8) * 10, int(2, 9) * 10]; const B = add(A, mul(T0, h));
  const t1 = int(2, T0 - 1), len = Math.hypot(...h), L = Number.isInteger(len) ? len - (pat[3] ? 1 : 0) : (pat[3] ? Math.floor(len) : Math.ceil(len));
  const [ta, tb, tc, td] = pat, AB = mul(T0, h);
  const ab = ta ? AB : [AB[0], -AB[1]], hb = tb ? h : [h[1], h[0]], Pt = add(A, mul(t1, h)), pc = tc ? Pt : add(A, mul(t1 - 1, h));
  if (!tb && eq(hb, h)) return null;
  return { answer: pat,
    prompt: R`Trên màn hình ra-đa theo dõi một cơn bão (hệ trục tọa độ $Oxy$, đơn vị trên mỗi trục là km), tâm bão chuyển động thẳng đều. Lúc $0$ giờ tâm bão ở vị trí $A${P(...A)}$, lúc $${T0}$ giờ tâm bão ở vị trí $B${P(...B)}$. Xét tính đúng sai của các mệnh đề sau.`,
    options: [R`a) Trong $${T0}$ giờ, tâm bão dịch chuyển theo vectơ $\overrightarrow{AB} = ${P(...ab)}$.`, R`b) Mỗi giờ, tâm bão dịch chuyển theo vectơ $${P(...hb)}$.`, R`c) Lúc $${t1}$ giờ, tâm bão ở vị trí $${P(...pc)}$.`, R`d) Mỗi giờ, tâm bão di chuyển được quãng đường lớn hơn $${L}$ km.`],
    verify: `(()=>{const A=[${A}],B=[${B}];const AB=[B[0]-A[0],B[1]-A[1]];const h=[AB[0]/${T0},AB[1]/${T0}];const P=[A[0]+${t1}*h[0],A[1]+${t1}*h[1]];return [AB[0]===${ab[0]}&&AB[1]===${ab[1]}, h[0]===${hb[0]}&&h[1]===${hb[1]}, P[0]===${pc[0]}&&P[1]===${pc[1]}, Math.hypot(h[0],h[1])>${L}];})()`,
    explanation: R`a) ${TF(ta)}: $\overrightarrow{AB} = ${P(...AB)}$. b) ${TF(tb)}: chuyển động thẳng đều nên mỗi giờ tâm bão dịch chuyển theo vectơ $\frac{1}{${T0}}\overrightarrow{AB} = ${P(...h)}$. c) ${TF(tc)}: lúc $${t1}$ giờ tâm bão ở $A + ${t1}${P(...h)} = ${P(...Pt)}$. d) ${TF(td)}: quãng đường mỗi giờ là $\sqrt{${h[0] * h[0]} + ${h[1] * h[1]}} = ${surd(h[0] * h[0] + h[1] * h[1])}$ (km), ${len > L ? 'lớn hơn' : 'không lớn hơn'} $${L}$ km.` };
};
T[16] = (n, pat) => {
  const A = [int(-3, 3), int(-2, 4)], B = [int(-1, 5), int(-3, 3)], k = int(-2, 3), m1 = pick([-1, 1, 2, 3]);
  const d = sub(B, A); if (d[0] === d[1] || d[0] === 0 || d[1] === 0 || A[0] + A[1] === B[0] + B[1]) return null;
  // C(m; m + k): thẳng hàng ⇔ d0(m + k − a2) − d1(m − a1) = 0
  const m0 = (d[0] * (A[1] - k) - d[1] * A[0]) / (d[0] - d[1]);
  const C1 = [m1, m1 + k]; if (cross(d, sub(C1, A)) === 0) return null;
  const G = [(A[0] + B[0] + C1[0]) / 3, (A[1] + B[1] + C1[1]) / 3];
  const coef = 2 * (B[0] + B[1] - A[0] - A[1]), rhs = B[0] ** 2 + (B[1] - k) ** 2 - A[0] ** 2 - (A[1] - k) ** 2, mEq = rhs / coef;
  const [ta, tb, tc, td] = pat, L2 = d[0] ** 2 + d[1] ** 2;
  const ABs = ta ? surd(L2) : surd(L2 + 1), mS = tb ? m0 : m0 + 1, Gs = tc ? G : [G[0], G[1] + 1];
  return { answer: pat,
    prompt: R`Trong mặt phẳng tọa độ $Oxy$, cho hai điểm $A${P(...A)}$, $B${P(...B)}$ và điểm $C(m; m ${k < 0 ? '-' : '+'} ${Math.abs(k)})$ với $m$ là tham số. Xét tính đúng sai của các mệnh đề sau.`.replace('m + 0', 'm').replace('m - 0', 'm'),
    options: [R`a) $AB = ${ABs}$.`, R`b) Ba điểm $A$, $B$, $C$ thẳng hàng khi và chỉ khi $m = ${N(mS)}$.`, R`c) Khi $m = ${m1}$, trọng tâm của tam giác $ABC$ là $G${P(...Gs)}$.`, td ? R`d) Có đúng một giá trị của $m$ để $CA = CB$.` : R`d) Không có giá trị nào của $m$ để $CA = CB$.`],
    verify: `(()=>{const A=[${A}],B=[${B}],k=${k};const L=Math.hypot(B[0]-A[0],B[1]-A[1]);const col=m=>(B[0]-A[0])*(m+k-A[1])-(B[1]-A[1])*(m-A[0]);const sc=col(1)-col(0);const r=sc!==0?[-col(0)/sc]:[];const G=[(A[0]+B[0]+${m1})/3,(A[1]+B[1]+${m1}+k)/3];const f=m=>((m-A[0])**2+(m+k-A[1])**2)-((m-B[0])**2+(m+k-B[1])**2);const sl=f(1)-f(0);const e=sl!==0?1:(f(0)===0?Infinity:0);return [Math.abs(L-Math.sqrt(${ta ? L2 : L2 + 1}))<1e-9, r.length===1&&Math.abs(r[0]-(${mS}))<1e-9, Math.abs(G[0]-(${Gs[0]}))<1e-9&&Math.abs(G[1]-(${Gs[1]}))<1e-9, ${td ? 'e===1' : 'e===0'}];})()`,
    explanation: R`a) ${TF(ta)}: $\overrightarrow{AB} = ${P(...d)}$, $AB = \sqrt{${L2}} = ${surd(L2)}$. b) ${TF(tb)}: $\overrightarrow{AC} = (m ${A[0] < 0 ? '+' : '-'} ${Math.abs(A[0])}; m ${k - A[1] < 0 ? '-' : '+'} ${Math.abs(k - A[1])})$; $A$, $B$, $C$ thẳng hàng $\Leftrightarrow ${d[0]}(m ${k - A[1] < 0 ? '-' : '+'} ${Math.abs(k - A[1])}) - ${d[1] < 0 ? `(${d[1]})` : d[1]}(m ${A[0] < 0 ? '+' : '-'} ${Math.abs(A[0])}) = 0 \Leftrightarrow m = ${N(m0)}$. c) ${TF(tc)}: khi $m = ${m1}$ thì $C${P(...C1)}$, trọng tâm $G${P(...G)}$. d) ${TF(td)}: $CA = CB \Leftrightarrow CA^2 = CB^2$, rút gọn được phương trình bậc nhất $${coef}m = ${rhs}$, có đúng một nghiệm $m = ${N(mEq)}$.`.replace(/\+ 0\)/g, ')').replace(/- 0\)/g, ')') };
};
T[17] = (n) => {
  const A = [int(-4, 4), nz(-5, 5)], B = [int(-4, 6), nz(-5, 6)]; if (A[1] === B[1]) return null;
  const x = A[0] - A[1] * (B[0] - A[0]) / (B[1] - A[1]); if (!Number.isInteger(x) || eq(A, B)) return null;
  return { answer: [String(x)],
    prompt: R`Trong mặt phẳng tọa độ $Oxy$, cho hai điểm $A${P(...A)}$ và $B${P(...B)}$. Điểm $M$ thuộc trục hoành sao cho ba điểm $A$, $B$, $M$ thẳng hàng. Tìm hoành độ của điểm $M$.`,
    verify: `(()=>{for(let x=-60;x<=60;x+=0.5){if((${B[0] - A[0]})*(0-(${A[1]}))-(x-(${A[0]}))*(${B[1] - A[1]})===0)return x;}return NaN;})()`,
    explanation: R`Gọi $M(x; 0)$. Ta có $\overrightarrow{AB} = ${P(...sub(B, A))}$, $\overrightarrow{AM} = (x ${A[0] < 0 ? '+' : '-'} ${Math.abs(A[0])}; ${-A[1]})$. Ba điểm thẳng hàng $\Leftrightarrow ${B[0] - A[0]} \cdot ${-A[1] < 0 ? `(${-A[1]})` : -A[1]} - (x ${A[0] < 0 ? '+' : '-'} ${Math.abs(A[0])}) \cdot ${B[1] - A[1] < 0 ? `(${B[1] - A[1]})` : B[1] - A[1]} = 0 \Leftrightarrow x = ${x}$.`.replace('x - 0', 'x').replace('x + 0', 'x') };
};
T[18] = (n) => {
  const [a, c, r] = pick([[3, 4, 5], [4, 3, 5], [6, 8, 10], [8, 6, 10], [5, 12, 13], [12, 5, 13], [8, 15, 17], [15, 8, 17], [9, 12, 15], [12, 9, 15], [7, 24, 25], [24, 7, 25], [20, 15, 25]]);
  const cc = pick([c, -c]);
  return { answer: [String(a)],
    prompt: R`Trong mặt phẳng tọa độ $Oxy$, cho vectơ $\vec{u} = (a; ${cc})$ với $a > 0$. Biết $|\vec{u}| = ${r}$, tìm $a$.`,
    verify: `Math.sqrt(${r * r} - ${c * c})`,
    explanation: R`$|\vec{u}| = \sqrt{a^2 + ${c * c}} = ${r} \Leftrightarrow a^2 = ${r * r} - ${c * c} = ${a * a}$. Vì $a > 0$ nên $a = ${a}$.` };
};
T[19] = (n) => {
  const A = [int(-1, 2), int(0, 4)], B = [int(2, 6), int(-1, 2)], C = [int(3, 6), int(2, 5)];
  if (cross(sub(B, A), sub(C, A)) <= 0 || eq(A, B) || eq(B, C)) return null; // A → B → C ngược chiều kim đồng hồ
  const D = sub(add(A, C), B);
  const { g, X, Y, end } = grid(-1, 6, -1, 5);
  const G = [(A[0] + B[0] + C[0]) / 3, (A[1] + B[1] + C[1]) / 3];
  const lab = (p, name) => { const dx = p[0] < G[0] ? -22 : 8, dy = p[1] < G[1] ? 20 : -8; return point(X, Y, p[0], p[1], name, dx, dy); };
  return { answer: [String(D[0] + D[1])], _key: `${A}|${B}|${C}`, image: `../hinh/bai-10/${fig(n, '19')}`,
    _fig: () => writeFileSync(resolve(HINH, fig(n, '19')), g + `<polygon points="${X(A[0])},${Y(A[1])} ${X(B[0])},${Y(B[1])} ${X(C[0])},${Y(C[1])}" fill="#cfe3ff" fill-opacity="0.5" stroke="#1f4fa8" stroke-width="2"/>` + lab(A, 'A') + lab(B, 'B') + lab(C, 'C') + end),
    prompt: R`Trong mặt phẳng tọa độ $Oxy$ như hình bên (mỗi ô vuông có cạnh bằng $1$ đơn vị), cho tam giác $ABC$. Điểm $D(a; b)$ thỏa mãn tứ giác $ABCD$ là hình bình hành. Tính $a + b$.`,
    verify: `(()=>{const A=[${A}],B=[${B}],C=[${C}];const D=[A[0]+C[0]-B[0],A[1]+C[1]-B[1]];return D[0]+D[1];})()`,
    explanation: R`Đọc trên hình: $A${P(...A)}$, $B${P(...B)}$, $C${P(...C)}$. $ABCD$ là hình bình hành $\Leftrightarrow \overrightarrow{AD} = \overrightarrow{BC} = ${P(...sub(C, B))}$, nên $D${P(...D)}$. Vậy $a + b = ${D[0] + D[1]}$.` };
};
T[20] = (n) => {
  const [p, q] = pick([[2, -1], [3, -1], [1, 2], [2, 1], [1, -2], [3, -2], [1, 3]]);
  const A = [int(-4, 4), int(-4, 4)], B = [int(-4, 4), int(-4, 4)]; if (eq(A, B)) return null;
  const M = [(p * A[0] + q * B[0]) / (p + q), (p * A[1] + q * B[1]) / (p + q)]; if (!M.every(Number.isInteger)) return null;
  const term = (c, s) => `${c === 1 ? '' : c === -1 ? '-' : c}\\overrightarrow{M${s}}`;
  const lhs = `${term(p, 'A')} ${q < 0 ? '-' : '+'} ${term(Math.abs(q), 'B')}`;
  return { answer: [String(M[0] + M[1])],
    prompt: R`Trong mặt phẳng tọa độ $Oxy$, cho hai điểm $A${P(...A)}$ và $B${P(...B)}$. Điểm $M(x; y)$ thỏa mãn $${lhs} = \vec{0}$. Tính $x + y$.`,
    verify: `(()=>{const A=[${A}],B=[${B}];for(let x=-40;x<=40;x++)for(let y=-40;y<=40;y++){if(${p}*(A[0]-x)+(${q})*(B[0]-x)===0&&${p}*(A[1]-y)+(${q})*(B[1]-y)===0)return x+y;}return NaN;})()`,
    explanation: R`$${lhs} = \vec{0} \Leftrightarrow ${p}(x_A - x) ${q < 0 ? '-' : '+'} ${Math.abs(q)}(x_B - x) = 0$ và $${p}(y_A - y) ${q < 0 ? '-' : '+'} ${Math.abs(q)}(y_B - y) = 0$, suy ra $x = \dfrac{${p}x_A ${q < 0 ? '-' : '+'} ${Math.abs(q)}x_B}{${p + q}} = ${M[0]}$, $y = \dfrac{${p}y_A ${q < 0 ? '-' : '+'} ${Math.abs(q)}y_B}{${p + q}} = ${M[1]}$. Vậy $x + y = ${M[0] + M[1]}$.` };
};
T[21] = (n) => {
  const t = int(2, 6), v1 = [nz(-3, 5), nz(1, 5)], dv = [nz(-4, 4), 0], v2 = sub(v1, dv), P1 = [int(-5, 5), int(-5, 5)];
  const P2 = add(P1, mul(t, dv)); if (eq(v1, v2)) return null;
  const meet = add(P1, mul(t, v1)), gio = int(6, 9);
  return { answer: [String(t)],
    prompt: R`Trên một vùng biển, chọn hệ trục tọa độ $Oxy$ với đơn vị trên mỗi trục là km. Lúc $${gio}$ giờ sáng, tàu thứ nhất ở vị trí $${P(...P1)}$ và chuyển động thẳng đều, mỗi giờ dịch chuyển theo vectơ $${P(...v1)}$; cùng lúc đó, tàu thứ hai ở vị trí $${P(...P2)}$ và chuyển động thẳng đều, mỗi giờ dịch chuyển theo vectơ $${P(...v2)}$. Hỏi sau bao nhiêu giờ thì hai tàu gặp nhau?`,
    verify: `(()=>{for(let t=0.5;t<=30;t+=0.5){const a=[${P1[0]}+t*(${v1[0]}),${P1[1]}+t*(${v1[1]})],b=[${P2[0]}+t*(${v2[0]}),${P2[1]}+t*(${v2[1]})];if(a[0]===b[0]&&a[1]===b[1])return t;}return NaN;})()`,
    explanation: R`Sau $t$ giờ, tàu thứ nhất ở vị trí $(${P1[0]} + ${v1[0] < 0 ? `(${v1[0]})` : v1[0]}t; ${P1[1]} + ${v1[1]}t)$, tàu thứ hai ở vị trí $(${P2[0]} + ${v2[0] < 0 ? `(${v2[0]})` : v2[0]}t; ${P2[1]} + ${v2[1]}t)$. Tung độ luôn bằng nhau; hai tàu gặp nhau khi hoành độ bằng nhau: $${P1[0]} + ${v1[0] < 0 ? `(${v1[0]})` : v1[0]}t = ${P2[0]} + ${v2[0] < 0 ? `(${v2[0]})` : v2[0]}t \Leftrightarrow t = ${t}$. Vậy sau $${t}$ giờ hai tàu gặp nhau tại điểm $${P(...meet)}$.` };
};
T[22] = (n) => {
  const h = [nz(-5, 5), nz(-5, 5)], T0 = pick([3, 4, 5, 6]), A = [int(1, 9) * 10, int(1, 9) * 10], t = int(7, 15); if (t === T0) return null;
  const B = add(A, mul(T0, h)), useX = rnd() < 0.5, val = useX ? A[0] + t * h[0] : A[1] + t * h[1];
  return { answer: [String(t)],
    prompt: R`Trên màn hình ra-đa (hệ trục tọa độ $Oxy$, đơn vị trên mỗi trục là km), tâm một cơn bão chuyển động thẳng đều. Lúc $0$ giờ tâm bão ở vị trí $A${P(...A)}$, lúc $${T0}$ giờ tâm bão ở vị trí $B${P(...B)}$. Hỏi vào lúc mấy giờ thì tâm bão có ${useX ? 'hoành độ' : 'tung độ'} bằng $${val}$?`,
    verify: `(()=>{const h=[(${B[0]}-${A[0]})/${T0},(${B[1]}-${A[1]})/${T0}];return (${val}-${useX ? A[0] : A[1]})/h[${useX ? 0 : 1}];})()`,
    explanation: R`Trong $${T0}$ giờ tâm bão dịch chuyển theo vectơ $\overrightarrow{AB} = ${P(...mul(T0, h))}$, nên mỗi giờ dịch chuyển theo vectơ $${P(...h)}$. Lúc $t$ giờ, tâm bão ở vị trí $(${A[0]} + ${h[0] < 0 ? `(${h[0]})` : h[0]}t; ${A[1]} + ${h[1] < 0 ? `(${h[1]})` : h[1]}t)$. Từ $${useX ? A[0] : A[1]} + ${(useX ? h[0] : h[1]) < 0 ? `(${useX ? h[0] : h[1]})` : (useX ? h[0] : h[1])}t = ${val}$ suy ra $t = ${t}$. Vậy lúc $${t}$ giờ.` };
};

// ---------- Sinh 19 đề ----------
const ex1 = base.exams[0];
const MCQ_BASE = [0, 1, 2, 3, 2, 0, 3, 1, 0, 2, 3, 1];
const PATTERNS = [[1, 0, 1, 1], [1, 0, 1, 0], [1, 1, 0, 0], [1, 1, 0, 1], [0, 1, 1, 0], [0, 1, 0, 1], [1, 0, 0, 1], [0, 0, 1, 1], [0, 1, 1, 1], [1, 1, 1, 0], [0, 1, 0, 0], [1, 0, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]].map((p) => p.map(Boolean));
const qkey = (q) => q.prompt.replace(/\s+/g, '') + JSON.stringify(q.options ?? '') + (q._key ?? '');
const seen = new Set(ex1.questions.map(qkey));
const shortSeen = ex1.questions.map((q) => new Set(q.kind === 'short' ? [q.answer[0]] : []));
const exams = [];
for (let n = 2; n <= 20; n++) {
  const qs = ex1.questions.map((bq, i) => {
    for (let tries = 0; tries < 4000; tries++) {
      const key = bq.kind === 'mcq' ? (MCQ_BASE[i] + n - 1) % 4 : bq.kind === 'tf' ? PATTERNS[(n * 3 + (i - 12) * 5) % PATTERNS.length] : null;
      const q = T[i + 1](n, key); if (!q) continue;
      const k = qkey(q); if (seen.has(k)) continue; delete q._key;
      if (bq.kind === 'short' && shortSeen[i].has(q.answer[0]) && tries < 3000) continue;
      seen.add(k); if (bq.kind === 'short') shortSeen[i].add(q.answer[0]);
      const fg = q._fig; delete q._fig; if (fg) fg();
      return { kind: bq.kind, muc: bq.muc, thuc_te: bq.thuc_te, bam_may: bq.bam_may, prompt: q.prompt, ...(q.image ? { image: q.image } : {}),
        ...(q.options ? { options: q.options } : {}), answer: q.answer, points: bq.points, verify: q.verify, explanation: q.explanation };
    }
    throw new Error(`Đề ${n} câu ${i + 1}: không tìm được bộ số`);
  });
  const nn = String(n).padStart(2, '0');
  exams.push({ slug: ex1.slug.replace(/-01$/, `-${nn}`), title: ex1.title.replace(/Đề 1$/, `Đề ${n}`), sort_order: n, time_limit_min: ex1.time_limit_min, description: ex1.description, questions: qs });
}
writeFileSync(outFile, JSON.stringify({ grade: base.grade, chapter: base.chapter, topic: base.topic, level: base.level, exams }, null, 2) + '\n', 'utf8');
console.log(`Đã sinh ${exams.length} đề (${exams.length * 22} câu) vào ${outFile}`);
