#!/usr/bin/env node
// Sinh 20 đề cho Toán 8 · Ôn tập chương IV. Định lí Thalès (Luyện tập chung + Bài tập cuối chương):
// Bài 15 (Thalès thuận, đảo, hệ quả), Bài 16 (đường trung bình tam giác), Bài 17 (phân giác).
// Đề 1 là đề gốc, đề 2–20 cùng khuôn. Mỗi vị trí câu một dòng số ngẫu nhiên riêng.
//   node de-thi/toan-8/theo-bai/sinh-de/on-tap-iv.mjs <file-đề-01.json> <file-đề-02-20.json> [hạt-giống]
// Hình ghi vào de-thi/toan-8/theo-bai/hinh/on-tap-iv/.
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const HINH = resolve(here, '..', 'hinh', 'on-tap-iv');
mkdirSync(HINH, { recursive: true });
const [out1, out2, seedArg] = process.argv.slice(2);
const R = String.raw;

// ---------- Tiện ích ----------
const seed0 = Number(seedArg ?? 20261128);
const seeds = Array.from({ length: 23 }, (_, i) => (seed0 + i * 7919) % 2147483648);
let cur = 0;
const rnd = () => { seeds[cur] = (seeds[cur] * 1103515245 + 12345) % 2147483648; return seeds[cur] / 2147483648; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const int = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
const isInt = (x) => Math.abs(x - Math.round(x)) < 1e-9;
const TF = (b) => (b ? 'Đúng' : 'Sai');
// số trong LaTeX: nguyên, thập phân (dấu phẩy) hoặc phân số tối giản
function N(v) {
  if (isInt(v)) return String(Math.round(v));
  const r = Math.round(v * 100) / 100; if (Math.abs(r - v) < 1e-9) return String(r).replace('.', '{,}');
  for (let d = 2; d <= 400; d++) { const k = Math.round(v * d); if (Math.abs(k / d - v) < 1e-9) return F(k, d); }
  return String(v);
}
const F = (p, q) => { const g = gcd(p, q); return q / g === 1 ? String(p / g) : R`\dfrac{${p / g}}{${q / g}}`; }; // phân số tối giản
const T_ = (v) => String(Math.round(v * 100) / 100).replace('.', ','); // số trong hình
function place(correct, wrongs, idx) {
  const all = [correct, ...wrongs];
  if (new Set(all.map((x) => x[0])).size !== 4) return null;
  if (new Set(all.map((x) => Math.round(x[1] * 1e6))).size !== 4) return null;
  const out = []; let k = 0;
  for (let i = 0; i < 4; i++) out.push(i === idx ? correct : wrongs[k++]);
  return out;
}
// Trắc nghiệm số: [nhãn LaTeX, giá trị]; verify tính lại giá trị đúng (biểu thức JS độc lập) rồi trả chỉ số phương án.
// Phương án đúng là số nguyên: verify trả về giá trị (bộ kiểm tra so với phương án); ngược lại trả chỉ số.
function numQ(correct, wrongs, idx, verifyExpr) {
  const o = place(correct, wrongs, idx); if (!o) return null;
  const verify = /^-?\d+(\{,\}\d+)?$/.test(correct[0]) ? `Math.round((${verifyExpr})*1e6)/1e6`
    : `(()=>{const v=${verifyExpr};const o=[${o.map((x) => x[1]).join(',')}];const k=o.findIndex(x=>Math.abs(x-v)<1e-9);return o.filter(x=>Math.abs(x-v)<1e-9).length===1?k:-1;})()`;
  return { options: o.map((x) => `$${x[0]}$`), answer: idx, verify };
}
const nv = (v) => [N(v), v];
const fig = (n, c) => `de-${String(n).padStart(2, '0')}-cau-${c}.svg`;
const imgPath = (n, c) => `../hinh/on-tap-iv/${fig(n, c)}`;

// ---------- Hình học ----------
const add = (p, q) => [p[0] + q[0], p[1] + q[1]], sub = (p, q) => [p[0] - q[0], p[1] - q[1]], mul = (k, p) => [k * p[0], k * p[1]];
const along = (P, Q, t) => add(P, mul(t, sub(Q, P))); // điểm trên PQ với PX = t·PQ
const len = (p) => Math.hypot(p[0], p[1]);
// tam giác theo ba cạnh a = BC, b = CA, c = AB; B gốc, C trên trục hoành, A phía trên
function triABC(a, b, c) {
  if (!(a < b + c && b < a + c && c < a + b)) return null;
  const x = (c * c - b * b + a * a) / (2 * a), y = Math.sqrt(c * c - x * x);
  if (!(y > 0.25 * a)) return null; // tránh tam giác quá dẹt (hình khó đọc)
  return { A: [x, y], B: [0, 0], C: [a, 0] };
}
// cạnh còn lại khi biết AB = c, AC = b và góc A (độ)
const sideA = (b, c, deg) => Math.sqrt(b * b + c * c - 2 * b * c * Math.cos(deg * Math.PI / 180));

// Vẽ: P = { tên: [x, y] } (y hướng lên). o: poly, segs, lens, ticks, arcs, lab, extra
function draw(file, P, o = {}) {
  const pts = Object.values(P), xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const W = 420, H = 320, M = 46;
  const s = Math.min((W - 2 * M) / (Math.max(...xs) - Math.min(...xs) || 1), (H - 2 * M) / (Math.max(...ys) - Math.min(...ys) || 1));
  const x0 = Math.min(...xs), y1 = Math.max(...ys);
  const ox = (W - s * (Math.max(...xs) - x0)) / 2, oy = (H - s * (y1 - Math.min(...ys))) / 2;
  const X = (p) => ox + (p[0] - x0) * s, Y = (p) => oy + (y1 - p[1]) * s;
  const S = (p) => [X(p), Y(p)];
  const G = (o.center ? S(o.center) : [pts.reduce((u, p) => u + X(p), 0) / pts.length, pts.reduce((u, p) => u + Y(p), 0) / pts.length]);
  let g = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="Times New Roman" font-size="18"><rect width="${W}" height="${H}" fill="#fff"/>`;
  if (o.under) g += o.under(S, s);
  for (const pl of o.poly ?? []) g += `<polygon points="${pl.map((k) => S(P[k]).join(',')).join(' ')}" fill="${o.fill ?? '#eaf2ff'}" stroke="#1f4fa8" stroke-width="2"/>`;
  for (const [a, b, st] of o.segs ?? []) g += `<line x1="${X(P[a])}" y1="${Y(P[a])}" x2="${X(P[b])}" y2="${Y(P[b])}" stroke="${st === 'red' ? '#c0392b' : '#1f4fa8'}" stroke-width="${st === 'dash' ? 1.5 : 2}"${st === 'dash' ? ' stroke-dasharray="6,4"' : ''}/>`;
  for (const [a, b, n] of o.ticks ?? []) { // vạch đánh dấu đoạn bằng nhau
    const [p, q] = [S(P[a]), S(P[b])], m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2], d = sub(q, p), L = len(d), u = [-d[1] / L, d[0] / L], t = [d[0] / L, d[1] / L];
    for (let i = 0; i < n; i++) { const c = add(m, mul((i - (n - 1) / 2) * 5, t)); g += `<line x1="${c[0] - 6 * u[0]}" y1="${c[1] - 6 * u[1]}" x2="${c[0] + 6 * u[0]}" y2="${c[1] + 6 * u[1]}" stroke="#000" stroke-width="1.5"/>`; }
  }
  for (const [v, a, b, r0] of o.arcs ?? []) { // cung đánh dấu góc bằng nhau (từ tia va tới tia vb)
    const V = S(P[v]), r = r0 ?? 24, ta = Math.atan2(Y(P[a]) - V[1], X(P[a]) - V[0]), tb = Math.atan2(Y(P[b]) - V[1], X(P[b]) - V[0]);
    let dt = tb - ta; while (dt > Math.PI) dt -= 2 * Math.PI; while (dt < -Math.PI) dt += 2 * Math.PI;
    const p1 = [V[0] + r * Math.cos(ta), V[1] + r * Math.sin(ta)], p2 = [V[0] + r * Math.cos(ta + dt), V[1] + r * Math.sin(ta + dt)];
    g += `<path d="M${p1[0]},${p1[1]} A${r},${r} 0 0 ${dt > 0 ? 1 : 0} ${p2[0]},${p2[1]}" fill="none" stroke="#c0392b" stroke-width="1.5"/>`;
  }
  for (const [a, b, text, side] of o.lens ?? []) { // ghi độ dài: lệch ra xa tâm hình
    const [p, q] = [S(P[a]), S(P[b])], m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2], d = sub(q, p), L = len(d);
    let u = [-d[1] / L, d[0] / L]; if ((m[0] - G[0]) * u[0] + (m[1] - G[1]) * u[1] < 0) u = mul(-1, u); if (side === 'in') u = mul(-1, u);
    const c = add(m, mul(15, u));
    g += `<text x="${c[0]}" y="${c[1] + 6}" text-anchor="middle" font-size="17">${text}</text>`;
  }
  if (o.over) g += o.over(S, s);
  for (const [k, p] of Object.entries(P)) {
    if (o.hide?.includes(k)) continue;
    const q = S(p); let d = sub(q, G); const L = len(d) || 1; d = mul(1 / L, d);
    const off = o.lab?.[k] ?? [d[0] * 16 - 6, d[1] * 16 + 7];
    g += `<circle cx="${q[0]}" cy="${q[1]}" r="2.5" fill="#000"/><text x="${q[0] + off[0]}" y="${q[1] + off[1]}" font-style="italic">${k}</text>`;
  }
  writeFileSync(resolve(HINH, file), g + '</svg>\n');
}

// ---------- Bộ ba cạnh có phân giác chia cạnh đối thành số nguyên ----------
const BIS = [];
for (let a = 3; a <= 30; a++) for (let b = 3; b <= 30; b++) for (let c = 3; c <= 30; c++) {
  if (b === c || !triABC(a, b, c)) continue;
  if ((a * c) % (b + c) === 0) BIS.push([a, b, c]); // DB = ac/(b+c), DC = ab/(b+c) đều nguyên
}

// ---------- Khuôn từng câu ----------
const T = {};
// 1. Tỉ số hai đoạn thẳng (đổi đơn vị)
const UNITS = [['cm', 'dm', 10], ['mm', 'cm', 10], ['dm', 'm', 10], ['cm', 'm', 100]];
T[1] = (n, idx) => {
  const [u1, u2, k] = pick(UNITS), p = int(2, 9) * (k === 100 ? 10 : 1) * int(1, 3), q = int(2, 9);
  const big = q * k; if (gcd(p, big) === 1 && p > 30) return null; if (p === big) return null;
  const q0 = numQ([F(p, big), p / big], [[F(p, q), p / q], [F(big, p), big / p], [F(p, big * k), p / (big * k)]], idx, `${p}/(${q}*${k})`);
  return q0 && { ...q0, _mkey: `${p},${q},${k}`,
    prompt: R`Tỉ số của hai đoạn thẳng $AB = ${p}$ ${u1} và $CD = ${q}$ ${u2} là`,
    explanation: R`Đổi về cùng đơn vị: $CD = ${q}$ ${u2} $= ${big}$ ${u1}. Vậy $\dfrac{AB}{CD} = \dfrac{${p}}{${big}}${gcd(p, big) > 1 ? ` = ${F(p, big)}` : ''}$. Phương án $${F(p, q)}$ do không đổi đơn vị; phương án $${F(big, p)}$ là tỉ số $\dfrac{CD}{AB}$.` };
};
// Tam giác Thalès: AB = m + k, AC = n + l, góc A; M ∈ AB, N ∈ AC
function thalesFig(file, m, k, n, l, deg, lens) {
  const c = m + k, b = n + l, h = deg / 2 * Math.PI / 180, A = [0, 0];
  const B = [-c * Math.sin(h), -c * Math.cos(h)], C = [b * Math.sin(h), -b * Math.cos(h)];
  const P = { A, B, C, M: along(A, B, m / c), N: along(A, C, n / b) };
  draw(file, P, { poly: [['A', 'B', 'C']], segs: [['M', 'N', 'red']], lens });
}
// 2. Thalès: tính NC
T[2] = (n, idx) => {
  const m = int(2, 9), k = int(2, 9), s = int(1, 4); if (m === k) return null;
  const an = m * s, nc = k * s, deg = int(50, 70);
  const q = numQ(nv(nc), [nv(an * m / k), nv(an + k - m), nv(an + nc)], idx, `${an}*${k}/${m}`); if (!q) return null;
  return { ...q, _mkey: `${m},${k},${s}`, image: imgPath(n, '02'), _fig: () => thalesFig(fig(n, '02'), m, k, an, nc, deg, [['A', 'M', m], ['M', 'B', k], ['A', 'N', an], ['N', 'C', '?']]),
    prompt: R`Cho hình bên, biết $MN \parallel BC$, $AM = ${m}$ cm, $MB = ${k}$ cm, $AN = ${an}$ cm. Độ dài đoạn thẳng $NC$ là`,
    explanation: R`Vì $MN \parallel BC$ nên theo định lí Thalès: $\dfrac{AM}{MB} = \dfrac{AN}{NC}$, hay $\dfrac{${m}}{${k}} = \dfrac{${an}}{NC}$. Suy ra $NC = \dfrac{${an} \cdot ${k}}{${m}} = ${nc}$ (cm). Phương án $${N(an + nc)}$ là độ dài $AC$.` };
};
// 3. Đường trung bình: MN = BC/2
T[3] = (n, idx) => {
  const bc = int(3, 30) * 2, b = int(6, 30), c = int(6, 30), tri = triABC(bc, b, c); if (!tri) return null;
  const q = numQ(nv(bc / 2), [nv(bc * 2), nv(bc), nv(bc / 4)], idx, `${bc}/2`); if (!q) return null;
  return { ...q, _mkey: `${bc}`, image: imgPath(n, '03'),
    _fig: () => { const P = { ...tri, M: along(tri.A, tri.B, 0.5), N: along(tri.A, tri.C, 0.5) }; draw(fig(n, '03'), P, { poly: [['A', 'B', 'C']], segs: [['M', 'N', 'red']], ticks: [['A', 'M', 1], ['M', 'B', 1], ['A', 'N', 2], ['N', 'C', 2]], lens: [['B', 'C', `${bc} cm`]] }); },
    prompt: R`Cho tam giác $ABC$ có $BC = ${bc}$ cm; $M$, $N$ lần lượt là trung điểm của $AB$, $AC$ (hình bên). Độ dài đoạn thẳng $MN$ là`,
    explanation: R`$MN$ là đường trung bình của tam giác $ABC$ nên $MN = \dfrac{BC}{2} = \dfrac{${bc}}{2} = ${bc / 2}$ (cm). Phương án $${bc * 2}$ do nhầm thành $MN = 2BC$.` };
};
// 4. Phân giác: tỉ số DB/DC
T[4] = (n, idx) => {
  const [a, b, c] = pick(BIS); const tri = triABC(a, b, c); if (!tri) return null;
  const q = numQ([F(c, b), c / b], [[F(b, c), b / c], [F(c, b + c), c / (b + c)], [F(b, b + c), b / (b + c)]], idx, `${c}/${b}`); if (!q) return null;
  return { ...q, _mkey: `${b},${c}`, image: imgPath(n, '04'),
    _fig: () => { const D = along(tri.B, tri.C, c / (b + c)); draw(fig(n, '04'), { ...tri, D }, { poly: [['A', 'B', 'C']], segs: [['A', 'D', 'red']], arcs: [['A', 'B', 'D', 26], ['A', 'D', 'C', 30]], lens: [['A', 'B', `${c} cm`], ['A', 'C', `${b} cm`]] }); },
    prompt: R`Cho tam giác $ABC$ có $AB = ${c}$ cm, $AC = ${b}$ cm và $AD$ là đường phân giác của góc $A$ ($D \in BC$) như hình bên. Tỉ số $\dfrac{DB}{DC}$ bằng`,
    explanation: R`Theo tính chất đường phân giác của tam giác: $\dfrac{DB}{DC} = \dfrac{AB}{AC} = \dfrac{${c}}{${b}} = ${F(c, b)}$. Phương án $${F(b, c)}$ do đảo thứ tự hai cạnh.` };
};
// 5. Hệ quả Thalès: tính MN
T[5] = (n, idx) => {
  const m = int(1, 6), k = int(1, 6), t = int(2, 6), bc = (m + k) * t; if (m === k) return null;
  const c = m + k, b = int(Math.max(3, Math.abs(c - bc) + 2), c + bc - 2), tri = triABC(bc, b, c); if (!tri) return null;
  const mn = t * m;
  const q = numQ(nv(mn), [nv(t * k), nv(bc * m / k), nv(bc - m - k)], idx, `${bc}*${m}/(${m}+${k})`); if (!q) return null;
  return { ...q, _mkey: `${m},${k},${t}`, image: imgPath(n, '05'),
    _fig: () => { const P = { ...tri, M: along(tri.A, tri.B, m / c), N: along(tri.A, tri.C, m / c) }; draw(fig(n, '05'), P, { poly: [['A', 'B', 'C']], segs: [['M', 'N', 'red']], lens: [['A', 'M', m], ['M', 'B', k], ['B', 'C', bc], ['M', 'N', 'x', 'in']] }); },
    prompt: R`Cho hình bên, biết $MN \parallel BC$, $AM = ${m}$ cm, $MB = ${k}$ cm, $BC = ${bc}$ cm. Giá trị của $x$ là`,
    explanation: R`Vì $MN \parallel BC$ nên theo hệ quả của định lí Thalès: $\dfrac{MN}{BC} = \dfrac{AM}{AB} = \dfrac{${m}}{${m} + ${k}} = ${F(m, c)}$. Suy ra $x = MN = ${F(m, c)} \cdot ${bc} = ${mn}$ (cm). Phương án $${t * k}$ do lấy tỉ số $\dfrac{MB}{AB}$; phương án $${N(bc * m / k)}$ do lấy tỉ số $\dfrac{AM}{MB}$.` };
};
// 6. Đường trung bình: biết BC − MN
T[6] = (n, idx) => {
  const e = int(3, 25), tri = triABC(2 * e, int(e, 3 * e), int(e, 3 * e)); if (!tri) return null;
  const q = numQ(nv(2 * e), [nv(e), nv(e / 2), nv(3 * e)], idx, `${e}/(1-1/2)`); if (!q) return null;
  return { ...q, _mkey: `${e}`, image: imgPath(n, '06'),
    _fig: () => { const P = { ...tri, M: along(tri.A, tri.B, 0.5), N: along(tri.A, tri.C, 0.5) }; draw(fig(n, '06'), P, { poly: [['A', 'B', 'C']], segs: [['M', 'N', 'red']], ticks: [['A', 'M', 1], ['M', 'B', 1], ['A', 'N', 2], ['N', 'C', 2]] }); },
    prompt: R`Cho tam giác $ABC$, $M$ và $N$ lần lượt là trung điểm của $AB$ và $AC$ (hình bên). Biết $BC - MN = ${e}$ cm. Độ dài cạnh $BC$ là`,
    explanation: R`$MN$ là đường trung bình của tam giác $ABC$ nên $MN = \dfrac{BC}{2}$. Do đó $BC - MN = \dfrac{BC}{2} = ${e}$, suy ra $BC = ${2 * e}$ (cm). Phương án $${e}$ do nhầm $BC - MN$ chính là $BC$.` };
};
// 7. Phân giác: tính DB
T[7] = (n, idx) => {
  const [a, b, c] = pick(BIS); const tri = triABC(a, b, c); if (!tri) return null;
  const db = a * c / (b + c), dc = a * b / (b + c);
  const w3 = a * c / b;
  const q = numQ(nv(db), [nv(dc), nv(a / 2), nv(w3)], idx, `(()=>{const r=${c}/${b};return ${a}*r/(1+r);})()`); if (!q) return null;
  return { ...q, _mkey: `${a},${b},${c}`, image: imgPath(n, '07'),
    _fig: () => { const D = along(tri.B, tri.C, db / a); draw(fig(n, '07'), { ...tri, D }, { poly: [['A', 'B', 'C']], segs: [['A', 'D', 'red']], arcs: [['A', 'B', 'D', 26], ['A', 'D', 'C', 30]], lens: [['A', 'B', `${c} cm`], ['A', 'C', `${b} cm`], ['B', 'C', `${a} cm`]] }); },
    prompt: R`Cho tam giác $ABC$ có $AB = ${c}$ cm, $AC = ${b}$ cm, $BC = ${a}$ cm. Đường phân giác của góc $A$ cắt $BC$ tại $D$ (hình bên). Độ dài đoạn thẳng $DB$ là`,
    explanation: R`Theo tính chất đường phân giác: $\dfrac{DB}{DC} = \dfrac{AB}{AC} = \dfrac{${c}}{${b}}$, nên $\dfrac{DB}{BC} = \dfrac{${c}}{${c} + ${b}}$. Suy ra $DB = \dfrac{${c} \cdot ${a}}{${b + c}} = ${N(db)}$ (cm). Phương án $${N(dc)}$ là độ dài $DC$; phương án $${N(a / 2)}$ do nhầm $D$ là trung điểm của $BC$.` };
};
// 8. Tứ giác: E, F, K trung điểm AD, BC, AC → EK + KF
T[8] = (n, idx) => {
  const p = int(3, 15) * 2, qd = int(3, 15) * 2; if (p === qd) return null;
  const q = numQ(nv((p + qd) / 2), [nv(p + qd), nv((p + qd) / 4), nv(Math.abs(p - qd) / 2)], idx, `${qd}/2+${p}/2`); if (!q) return null;
  return { ...q, _mkey: `${Math.min(p, qd)},${Math.max(p, qd)}`, image: imgPath(n, '08'),
    _fig: () => {
      const h = 0.65 * Math.max(p, qd), f = 12 * Math.PI / 180; // AB = p, CD = qd đúng độ dài
      const A = [0, 0], B = [p, 0], D = [-0.12 * p, h], C = add(D, [qd * Math.cos(f), qd * Math.sin(f)]);
      const P = { A, B, C, D, E: along(A, D, 0.5), F: along(B, C, 0.5), K: along(A, C, 0.5) };
      draw(fig(n, '08'), P, { poly: [['A', 'B', 'C', 'D']], segs: [['A', 'C', 'dash'], ['E', 'K', 'red'], ['K', 'F', 'red']], ticks: [['A', 'E', 1], ['E', 'D', 1], ['B', 'F', 2], ['F', 'C', 2]], lens: [['A', 'B', `${p} cm`], ['C', 'D', `${qd} cm`]] });
    },
    prompt: R`Cho tứ giác $ABCD$ có $AB = ${p}$ cm, $CD = ${qd}$ cm. Gọi $E$, $F$, $K$ lần lượt là trung điểm của $AD$, $BC$, $AC$ (hình bên). Giá trị của $EK + KF$ là`,
    explanation: R`$EK$ là đường trung bình của tam giác $ACD$ nên $EK = \dfrac{CD}{2} = ${qd / 2}$ cm; $KF$ là đường trung bình của tam giác $ABC$ nên $KF = \dfrac{AB}{2} = ${p / 2}$ cm. Vậy $EK + KF = ${(p + qd) / 2}$ (cm). Phương án $${p + qd}$ do quên chia đôi.` };
};
// 9. Đường trung bình (ngược): biết MN, tìm BC
T[9] = (n, idx) => {
  const d = int(3, 30), b = int(6, 40), c = int(6, 40), tri = triABC(2 * d, b, c); if (!tri) return null;
  const q = numQ(nv(2 * d), [nv(d / 2), nv(d), nv(4 * d)], idx, `${d}*2`); if (!q) return null;
  return { ...q, _mkey: `${d}`, image: imgPath(n, '09'),
    _fig: () => { const P = { ...tri, M: along(tri.A, tri.B, 0.5), N: along(tri.A, tri.C, 0.5) }; draw(fig(n, '09'), P, { poly: [['A', 'B', 'C']], segs: [['M', 'N', 'red']], ticks: [['A', 'M', 1], ['M', 'B', 1], ['A', 'N', 2], ['N', 'C', 2]], lens: [['M', 'N', `${d} cm`, 'in']] }); },
    prompt: R`Cho hình bên, trong đó $M$, $N$ lần lượt là trung điểm của $AB$, $AC$ và $MN = ${d}$ cm. Độ dài cạnh $BC$ là`,
    explanation: R`$MN$ là đường trung bình của tam giác $ABC$ nên $MN = \dfrac{BC}{2}$, suy ra $BC = 2MN = ${2 * d}$ (cm). Phương án $${N(d / 2)}$ do chia đôi thay vì nhân đôi.` };
};
// 10. Tam giác cân, phân giác góc B: tính AD
const ISO = [];
for (let b = 4; b <= 40; b++) for (let a = 2; a < 2 * b; a++) if ((b * b) % (a + b) === 0 && a !== b) ISO.push([a, b]);
T[10] = (n, idx) => {
  const [a, b] = pick(ISO), tri = triABC(a, b, b); if (!tri) return null;
  const ad = b * b / (a + b), dc = a * b / (a + b);
  const q = numQ(nv(ad), [nv(dc), nv(b / 2), nv(b * a / (2 * b))], idx, `(()=>{const r=${b}/${a};return ${b}*r/(1+r);})()`); if (!q) return null;
  return { ...q, _mkey: `${a},${b}`, image: imgPath(n, '10'),
    _fig: () => { const D = along(tri.A, tri.C, ad / b); draw(fig(n, '10'), { ...tri, D }, { poly: [['A', 'B', 'C']], segs: [['B', 'D', 'red']], arcs: [['B', 'C', 'D', 26], ['B', 'D', 'A', 30]], lens: [['A', 'B', `${b} cm`], ['B', 'C', `${a} cm`]], ticks: [['A', 'B', 1], ['A', 'C', 1]] }); },
    prompt: R`Cho tam giác $ABC$ cân tại $A$ có $AB = AC = ${b}$ cm, $BC = ${a}$ cm. Đường phân giác của góc $B$ cắt $AC$ tại $D$ (hình bên). Độ dài đoạn thẳng $AD$ là`,
    explanation: R`$BD$ là phân giác của góc $B$ nên $\dfrac{DA}{DC} = \dfrac{BA}{BC} = \dfrac{${b}}{${a}}$, do đó $\dfrac{AD}{AC} = \dfrac{${b}}{${b} + ${a}}$ và $AD = \dfrac{${b} \cdot ${b}}{${a + b}} = ${N(ad)}$ (cm). Phương án $${N(dc)}$ là độ dài $DC$; phương án $${N(b / 2)}$ do nhầm $D$ là trung điểm của $AC$.` };
};
// 11. Thực tế: đo khoảng cách qua sông (Thalès)
T[11] = (n, idx) => {
  const ad = int(4, 30) * 10, ratio = pick([[1, 2], [1, 3], [2, 3], [1, 4], [3, 4], [2, 5]]);
  const bd = ad * ratio[0] / ratio[1]; if (!isInt(bd)) return null; // BD : AD = r
  const ab = ad + bd, de = int(2, 9) * 5 * ratio[1], bc = de * ab / ad; if (!isInt(bc)) return null;
  const q = numQ(nv(ad), [nv(ab), nv(bd * de / bc), nv(bd * bc / de)], idx, `(()=>{const k=${de}/${bc};return ${bd}*k/(1-k);})()`); if (!q) return null;
  return { ...q, _mkey: `${ad},${bd},${de}`, image: imgPath(n, '11'),
    _fig: () => {
      const hA = 0.85 * ab, xB = -Math.sqrt(ab * ab - hA * hA); // AB = ab đúng độ dài, BC = bc
      const A = [0, hA], B = [xB, 0], C = [xB + bc, 0];
      const D = along(A, B, ad / ab), E = along(A, C, ad / ab);
      draw(fig(n, '11'), { A, B, C, D, E }, {
        under: (S) => { const y1 = S(A)[1] + 14, y2 = S(D)[1] - 10; return `<rect x="0" y="${y1}" width="420" height="${y2 - y1}" fill="#bfe1f6" opacity="0.8"/><text x="18" y="${(y1 + y2) / 2 + 6}" font-size="16" fill="#1f6fa8">sông</text>`; },
        poly: [['A', 'B', 'C']], fill: 'none', segs: [['D', 'E', 'red']], lens: [['D', 'E', `${de} m`, 'in'], ['B', 'C', `${bc} m`], ['B', 'D', `${bd} m`]] });
    },
    prompt: R`Để đo khoảng cách từ điểm $D$ ở bờ sông bên này đến điểm $A$ ở bờ bên kia, người ta chọn các điểm $B$, $C$, $E$ như hình bên sao cho $D$ nằm giữa $A$ và $B$, $E$ nằm giữa $A$ và $C$, $DE \parallel BC$. Đo được $BD = ${bd}$ m, $DE = ${de}$ m, $BC = ${bc}$ m. Khoảng cách $AD$ là`,
    explanation: R`Vì $DE \parallel BC$ nên $\dfrac{AD}{AB} = \dfrac{DE}{BC} = \dfrac{${de}}{${bc}} = ${F(de, bc)}$. Đặt $AD = x$ thì $AB = x + ${bd}$, nên $x \cdot ${bc / gcd(de, bc)} = ${de / gcd(de, bc)}(x + ${bd})$, suy ra $x = ${ad}$ (m). Phương án $${ab}$ là độ dài $AB$.` };
};
// 12. Phân giác + song song: DE ∥ AB, tính DE
T[12] = (n, idx) => {
  const [a, b, c] = pick(BIS); const tri = triABC(a, b, c); if (!tri) return null;
  const de = b * c / (b + c); if (!isInt(de * 2)) return null;
  const q = numQ(nv(de), [nv(c * c / (b + c)), nv(c / 2), nv(b * c / Math.abs(b - c))], idx, `(()=>{const t=${b}/(${b}+${c});return t*${c};})()`); if (!q) return null;
  return { ...q, _mkey: `${b},${c}`, image: imgPath(n, '12'), // BC không dùng trong đề nên không tính vào bộ số
    _fig: () => { const D = along(tri.B, tri.C, c / (b + c)), E = along(tri.C, tri.A, b / (b + c)); draw(fig(n, '12'), { ...tri, D, E }, { poly: [['A', 'B', 'C']], segs: [['A', 'D', 'red'], ['D', 'E', 'red']], arcs: [['A', 'B', 'D', 26], ['A', 'D', 'C', 30]], lens: [['A', 'B', `${c} cm`], ['A', 'C', `${b} cm`]] }); },
    prompt: R`Cho tam giác $ABC$ có $AB = ${c}$ cm, $AC = ${b}$ cm, $AD$ là đường phân giác của góc $A$ ($D \in BC$). Qua $D$ kẻ đường thẳng song song với $AB$, cắt $AC$ tại $E$ (hình bên). Độ dài đoạn thẳng $DE$ là`,
    explanation: R`Theo tính chất phân giác: $\dfrac{DB}{DC} = \dfrac{AB}{AC} = \dfrac{${c}}{${b}}$, nên $\dfrac{CD}{CB} = \dfrac{${b}}{${b + c}}$. Vì $DE \parallel AB$ nên theo hệ quả của định lí Thalès: $\dfrac{DE}{AB} = \dfrac{CD}{CB} = \dfrac{${b}}{${b + c}}$, suy ra $DE = \dfrac{${b} \cdot ${c}}{${b + c}} = ${N(de)}$ (cm). Phương án $${N(c * c / (b + c))}$ do dùng nhầm tỉ số $\dfrac{BD}{BC}$.` };
};
// 13. Đúng/Sai: Thalès thuận, hệ quả, đảo
T[13] = (n, pat) => {
  const m = int(2, 6), k = int(2, 6), s = int(1, 3), t = int(1, 4); if (m === k) return null;
  const an = m * s, nc = k * s, bc = (m + k) * t, c = m + k, b = an + nc; if (!triABC(bc, b, c)) return null;
  const [ta, tb, tc, td] = pat;
  const ncF = an + k - m !== nc && an + k - m > 0 ? an + k - m : nc + 1;
  const acT = b, acF = an + m !== b ? an + m : b + 2;
  const mnT = t * m, mnF = t * k;
  const bpT = t * k, bpF = t * m;
  const v = [ta ? nc : ncF, tb ? acT : acF, tc ? mnT : mnF, td ? bpT : bpF];
  const tri = triABC(bc, b, c);
  return { answer: pat, _mkey: `${m},${k},${s},${t}`, image: imgPath(n, '13'),
    _fig: () => { const P = { ...tri, M: along(tri.A, tri.B, m / c), N: along(tri.A, tri.C, m / c) }; draw(fig(n, '13'), P, { poly: [['A', 'B', 'C']], segs: [['M', 'N', 'red']], lens: [['A', 'M', m], ['M', 'B', k], ['A', 'N', an], ['B', 'C', bc]] }); },
    prompt: R`Cho tam giác $ABC$ có $MN \parallel BC$ ($M \in AB$, $N \in AC$) như hình bên, với $AM = ${m}$ cm, $MB = ${k}$ cm, $AN = ${an}$ cm, $BC = ${bc}$ cm. Xét tính đúng sai của các mệnh đề sau.`,
    options: [R`a) $NC = ${v[0]}$ cm.`, R`b) $AC = ${v[1]}$ cm.`, R`c) $MN = ${v[2]}$ cm.`, R`d) Nếu $P$ là điểm trên cạnh $BC$ với $BP = ${v[3]}$ cm thì $MP \parallel AC$.`],
    verify: `(()=>{const m=${m},k=${k},an=${an},bc=${bc};const nc=an*k/m,ac=an+nc,mn=bc*m/(m+k);const bp=${v[3]};const par=Math.abs(k/(m+k)-bp/bc)<1e-9;const eq=(x,y)=>Math.abs(x-y)<1e-9;return [eq(nc,${v[0]}),eq(ac,${v[1]}),eq(mn,${v[2]}),par];})()`,
    explanation: R`a) ${TF(ta)}: $MN \parallel BC$ nên $\dfrac{AM}{MB} = \dfrac{AN}{NC}$, suy ra $NC = \dfrac{${an} \cdot ${k}}{${m}} = ${nc}$ cm. b) ${TF(tb)}: $AC = AN + NC = ${an} + ${nc} = ${b}$ cm. c) ${TF(tc)}: theo hệ quả của định lí Thalès, $\dfrac{MN}{BC} = \dfrac{AM}{AB} = \dfrac{${m}}{${c}}$, nên $MN = ${mnT}$ cm. d) ${TF(td)}: theo định lí Thalès đảo, $MP \parallel AC$ khi $\dfrac{BP}{BC} = \dfrac{BM}{BA} = \dfrac{${k}}{${c}}$, tức $BP = ${bpT}$ cm${td ? '' : R`, khác $${bpF}$ cm`}.` };
};
// 14. Đúng/Sai: ba đường trung bình
T[14] = (n, pat) => {
  const a = int(3, 15) * 2, b = int(3, 15) * 2, c = int(3, 15) * 2; if (a === b || a === c || b === c) return null;
  const tri = triABC(a, b, c); if (!tri) return null;
  const [ta, tb, tc, td] = pat;
  return { answer: pat, _mkey: `${a},${b},${c}`, image: imgPath(n, '14'),
    _fig: () => { const P = { ...tri, M: along(tri.A, tri.B, 0.5), N: along(tri.A, tri.C, 0.5), P: along(tri.B, tri.C, 0.5) }; draw(fig(n, '14'), P, { poly: [['A', 'B', 'C']], segs: [['M', 'N', 'red'], ['N', 'P', 'red'], ['P', 'M', 'red']], ticks: [['A', 'M', 1], ['M', 'B', 1], ['A', 'N', 2], ['N', 'C', 2], ['B', 'P', 3], ['P', 'C', 3]], lens: [['A', 'B', c], ['A', 'C', b], ['B', 'C', a]] }); },
    prompt: R`Cho tam giác $ABC$ có $AB = ${c}$ cm, $AC = ${b}$ cm, $BC = ${a}$ cm. Gọi $M$, $N$, $P$ lần lượt là trung điểm của $AB$, $AC$, $BC$ (hình bên). Xét tính đúng sai của các mệnh đề sau.`,
    options: [R`a) $MN = ${ta ? a / 2 : b / 2}$ cm.`, tb ? R`b) Tứ giác $BMNP$ là hình bình hành.` : R`b) Tứ giác $BMNC$ là hình bình hành.`, R`c) Chu vi tam giác $MNP$ bằng $${tc ? (a + b + c) / 2 : a + b + c}$ cm.`, R`d) $MP \parallel AC$ và $MP = ${td ? b / 2 : c / 2}$ cm.`],
    verify: `(()=>{const a=${a},b=${b},c=${c};return [${ta ? a / 2 : b / 2}===a/2, ${tb}, ${tc ? (a + b + c) / 2 : a + b + c}===(a+b+c)/2, ${td ? b / 2 : c / 2}===b/2];})()`,
    explanation: R`$MN$, $NP$, $PM$ là các đường trung bình của tam giác $ABC$: $MN \parallel BC$, $MN = \dfrac{BC}{2} = ${a / 2}$ cm; $NP \parallel AB$, $NP = ${c / 2}$ cm; $MP \parallel AC$, $MP = ${b / 2}$ cm. a) ${TF(ta)}. b) ${TF(tb)}: ${tb ? R`$MN \parallel BP$ và $MN = BP = ${a / 2}$ cm nên $BMNP$ là hình bình hành` : R`$MN \parallel BC$ nhưng $MN = ${a / 2}$ cm $\ne BC$, nên $BMNC$ là hình thang, không phải hình bình hành`}. c) ${TF(tc)}: chu vi tam giác $MNP$ là $${a / 2} + ${b / 2} + ${c / 2} = ${(a + b + c) / 2}$ cm (bằng nửa chu vi tam giác $ABC$). d) ${TF(td)}: $MP \parallel AC$ và $MP = \dfrac{AC}{2} = ${b / 2}$ cm.` };
};
// 15. Đúng/Sai thực tế: đo khoảng cách qua ao
T[15] = (n, pat) => {
  // k = 2 thì M, N đã là trung điểm, ý c trở nên hiển nhiên → chỉ dùng 3, 4
  const k = pick([3, 4]), op = int(4, 12) * k, oq = int(4, 12) * k, d = int(6, 20); if (op === oq) return null;
  const [ta, tb, tc, td] = pat, pq = k * d;
  if (!triABC(pq, oq, op)) return null; // ba điểm O, P, Q phải tạo thành tam giác thật (bất đẳng thức tam giác)
  const x = int(2, 5) * (op / gcd(op, oq)), y = x * oq / op; if (!isInt(y) || x >= op || x === op / k) return null; // M' khác M
  const st = oq / gcd(op, oq), yF = y + st < oq ? y + st : y - st; // N' phải nằm trong đoạn OQ, không trùng đầu mút
  if (!(y < oq) || !(yF > 0 && yF < oq)) return null;
  const om = op / k, on = oq / k;
  return { answer: pat, _mkey: `${k},${op},${oq},${d}`, image: imgPath(n, '15'),
    _fig: () => {
      // tam giác OPQ đúng ba cạnh OP, OQ, PQ = k·MN; O ở dưới, ao ở trên
      const t = triABC(pq, oq, op), fl = (p) => [p[0], -p[1]];
      const O = fl(t.A), Pp = fl(t.B), Q = fl(t.C);
      const M = along(O, Pp, 1 / k), Nn = along(O, Q, 1 / k);
      draw(fig(n, '15'), { O, P: Pp, Q, M, N: Nn }, {
        under: (S) => { const a = S(Pp), b = S(Q), cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2; return `<ellipse cx="${cx}" cy="${cy}" rx="${Math.abs(b[0] - a[0]) / 2 - 8}" ry="26" fill="#bfe1f6" opacity="0.85"/><text x="${cx}" y="${cy - 30}" text-anchor="middle" font-size="16" fill="#1f6fa8">ao</text>`; },
        segs: [['O', 'P'], ['O', 'Q'], ['P', 'Q', 'dash'], ['M', 'N', 'red']], lens: [['O', 'M', `${om} m`], ['O', 'N', `${on} m`], ['M', 'N', `${d} m`, 'in']], center: [(O[0] + Pp[0] + Q[0]) / 3, (O[1] + Pp[1] + Q[1]) / 3] });
    },
    prompt: R`Để đo khoảng cách giữa hai điểm $P$, $Q$ ở hai bên một cái ao, bác Mến chọn điểm $O$ như hình bên và đo được $OP = ${op}$ m, $OQ = ${oq}$ m. Trên $OP$, $OQ$ bác lấy điểm $M$, $N$ với $OM = ${om}$ m, $ON = ${on}$ m và đo được $MN = ${d}$ m. Xét tính đúng sai của các mệnh đề sau.`,
    options: [ta ? R`a) $MN \parallel PQ$.` : R`a) $\dfrac{OM}{OP} \ne \dfrac{ON}{OQ}$.`, R`b) Khoảng cách $PQ = ${tb ? pq : pq + d}$ m.`, R`c) Nếu lấy $M$, $N$ lần lượt là trung điểm của $OP$, $OQ$ thì đoạn $MN$ đo được dài $${N(tc ? pq / 2 : pq / 4)}$ m.`, R`d) Nếu lấy $M' \in OP$, $N' \in OQ$ với $OM' = ${x}$ m, $ON' = ${td ? y : yF}$ m thì $M'N' \parallel PQ$.`],
    verify: `(()=>{const op=${op},oq=${oq},om=${om},on=${on},mn=${d};const r=om/op,s=on/oq;const pq=mn/r;return [${ta ? 'Math.abs(r-s)<1e-9' : 'Math.abs(r-s)>1e-9'}, ${tb ? pq : pq + d}===pq, ${tc ? pq / 2 : pq / 4}===pq/2, Math.abs(${x}/op-${td ? y : yF}/oq)<1e-9];})()`,
    explanation: R`$\dfrac{OM}{OP} = \dfrac{${om}}{${op}} = \dfrac{1}{${k}}$ và $\dfrac{ON}{OQ} = \dfrac{${on}}{${oq}} = \dfrac{1}{${k}}$. a) ${TF(ta)}: hai tỉ số bằng nhau nên theo định lí Thalès đảo $MN \parallel PQ$. b) ${TF(tb)}: theo hệ quả của định lí Thalès, $\dfrac{MN}{PQ} = \dfrac{OM}{OP} = \dfrac{1}{${k}}$, nên $PQ = ${k} \cdot ${d} = ${pq}$ m. c) ${TF(tc)}: khi đó $MN$ là đường trung bình của tam giác $OPQ$, $MN = \dfrac{PQ}{2} = ${N(pq / 2)}$ m. d) ${TF(td)}: $M'N' \parallel PQ$ khi $\dfrac{OM'}{OP} = \dfrac{ON'}{OQ}$, tức $ON' = \dfrac{${x} \cdot ${oq}}{${op}} = ${y}$ m.` };
};
// 16. Đúng/Sai: tính chất phân giác
T[16] = (n, pat) => {
  const [a, b, c] = pick(BIS); if (a === b || a === c) return null;
  const tri = triABC(a, b, c); if (!tri) return null;
  const [ta, tb, tc, td] = pat, db = a * c / (b + c), dc = a * b / (b + c);
  return { answer: pat, _mkey: `${a},${b},${c}`, image: imgPath(n, '16'),
    _fig: () => { const D = along(tri.B, tri.C, db / a); draw(fig(n, '16'), { ...tri, D }, { poly: [['A', 'B', 'C']], segs: [['A', 'D', 'red']], arcs: [['A', 'B', 'D', 26], ['A', 'D', 'C', 30]], lens: [['A', 'B', c], ['A', 'C', b], ['B', 'C', a]] }); },
    prompt: R`Cho tam giác $ABC$ có $AB = ${c}$ cm, $AC = ${b}$ cm, $BC = ${a}$ cm và $AD$ là đường phân giác của góc $A$ ($D \in BC$) như hình bên. Xét tính đúng sai của các mệnh đề sau.`,
    options: [R`a) $\dfrac{DB}{DC} = ${ta ? F(c, b) : F(b, c)}$.`, R`b) $DB = ${N(tb ? db : a / 2)}$ cm.`, R`c) $DC = ${N(tc ? dc : db)}$ cm.`, R`d) Nếu đường phân giác của góc $B$ cắt $AC$ tại $E$ thì $\dfrac{EA}{EC} = ${td ? F(c, a) : F(a, c)}$.`],
    verify: `(()=>{const a=${a},b=${b},c=${c};const db=a*c/(b+c),dc=a-db;return [Math.abs(${ta ? c / b : b / c}-db/dc)<1e-9, Math.abs(${tb ? db : a / 2}-db)<1e-9, Math.abs(${tc ? dc : db}-dc)<1e-9, Math.abs(${td ? c / a : a / c}-c/a)<1e-9];})()`,
    explanation: R`a) ${TF(ta)}: $\dfrac{DB}{DC} = \dfrac{AB}{AC} = ${F(c, b)}$. b) ${TF(tb)}: $DB = \dfrac{${c}}{${c} + ${b}} \cdot ${a} = ${N(db)}$ cm${tb ? '' : R` ($D$ không phải trung điểm của $BC$ vì $AB \ne AC$)`}. c) ${TF(tc)}: $DC = ${a} - ${N(db)} = ${N(dc)}$ cm. d) ${TF(td)}: $BE$ là phân giác của góc $B$ trong tam giác $ABC$ nên $\dfrac{EA}{EC} = \dfrac{BA}{BC} = ${F(c, a)}$.` };
};
// 17. Trả lời ngắn: tìm x trên hình (Thalès)
T[17] = (n) => {
  const m = int(2, 9), k = int(2, 9), s = int(1, 5); if (m === k) return null;
  const l = k * s, x = m * s, deg = int(50, 70);
  return { answer: [String(x)], _mkey: `${m},${k},${s}`, image: imgPath(n, '17'), _fig: () => thalesFig(fig(n, '17'), m, k, x, l, deg, [['A', 'M', m], ['M', 'B', k], ['A', 'N', 'x'], ['N', 'C', l]]),
    prompt: R`Trong hình bên, $MN \parallel BC$ và các độ dài cho trên hình có cùng đơn vị là cm. Tìm $x$.`,
    verify: `(()=>{const r=${m}/${k};return r*${l};})()`,
    explanation: R`Vì $MN \parallel BC$ nên theo định lí Thalès: $\dfrac{AN}{NC} = \dfrac{AM}{MB}$, hay $\dfrac{x}{${l}} = \dfrac{${m}}{${k}}$. Suy ra $x = \dfrac{${m} \cdot ${l}}{${k}} = ${x}$.` };
};
// 18. Trả lời ngắn: chu vi tam giác ABC từ đường trung bình
T[18] = (n) => {
  const d = int(3, 20), b = int(5, 30), c = int(5, 30); if (!triABC(2 * d, b, c) || b === c) return null;
  const ans = b + c + 2 * d, tri = triABC(2 * d, b, c);
  return { answer: [String(ans)], _mkey: `${d},${b},${c}`, image: imgPath(n, '18'),
    _fig: () => { const P = { ...tri, M: along(tri.A, tri.B, 0.5), N: along(tri.A, tri.C, 0.5) }; draw(fig(n, '18'), P, { poly: [['A', 'B', 'C']], segs: [['M', 'N', 'red']], ticks: [['A', 'M', 1], ['M', 'B', 1], ['A', 'N', 2], ['N', 'C', 2]], lens: [['A', 'B', `${c} cm`], ['A', 'C', `${b} cm`], ['M', 'N', `${d} cm`, 'in']] }); },
    prompt: R`Cho tam giác $ABC$ có $AB = ${c}$ cm, $AC = ${b}$ cm. Gọi $M$, $N$ lần lượt là trung điểm của $AB$, $AC$ (hình bên). Biết $MN = ${d}$ cm. Tính chu vi tam giác $ABC$ (cm).`,
    verify: `${c}+${b}+${d}/0.5`,
    explanation: R`$MN$ là đường trung bình của tam giác $ABC$ nên $BC = 2MN = ${2 * d}$ cm. Chu vi tam giác $ABC$ là $${c} + ${b} + ${2 * d} = ${ans}$ (cm).` };
};
// 19. Trả lời ngắn: phân giác (ngược) — biết DB, DC và AB + AC, tìm AB
T[19] = (n) => {
  const [a, b, c] = pick(BIS); const db = a * c / (b + c), dc = a * b / (b + c); if (!isInt(db) || !isInt(dc)) return null;
  const tri = triABC(a, b, c);
  return { answer: [String(c)], _mkey: `${a},${b},${c}`, image: imgPath(n, '19'),
    _fig: () => { const D = along(tri.B, tri.C, db / a); draw(fig(n, '19'), { ...tri, D }, { poly: [['A', 'B', 'C']], segs: [['A', 'D', 'red']], arcs: [['A', 'B', 'D', 26], ['A', 'D', 'C', 30]], lens: [['B', 'D', db], ['D', 'C', dc]] }); },
    prompt: R`Cho tam giác $ABC$ có $AD$ là đường phân giác của góc $A$ ($D \in BC$), $DB = ${db}$ cm, $DC = ${dc}$ cm (hình bên). Biết $AB + AC = ${b + c}$ cm. Tính độ dài cạnh $AB$ (cm).`,
    verify: `(()=>{const s=${b + c};return s*${db}/(${db}+${dc});})()`,
    explanation: R`Theo tính chất đường phân giác: $\dfrac{AB}{AC} = \dfrac{DB}{DC} = \dfrac{${db}}{${dc}}$, nên $\dfrac{AB}{AB + AC} = \dfrac{${db}}{${db + dc}}$. Suy ra $AB = \dfrac{${db} \cdot ${b + c}}{${db + dc}} = ${c}$ (cm).` };
};
// 20. Trả lời ngắn: trung điểm bốn cạnh tứ giác → chu vi hình bình hành
T[20] = (n) => {
  const p = int(5, 30), q = int(5, 30); if (p === q) return null;
  return { answer: [String(p + q)], _mkey: `${Math.min(p, q)},${Math.max(p, q)}`, image: imgPath(n, '20'),
    _fig: () => {
      const f = Math.PI * 70 / 180, O = [0.45 * p, 0], u = [Math.cos(f), Math.sin(f)]; // AC = p, BD = q đúng độ dài
      const A = [0, 0], C = [p, 0], B = add(O, mul(-0.4 * q, u)), D = add(O, mul(0.6 * q, u));
      const P = { A, B, C, D, M: along(A, B, 0.5), N: along(B, C, 0.5), P: along(C, D, 0.5), Q: along(D, A, 0.5) };
      draw(fig(n, '20'), P, { poly: [['A', 'B', 'C', 'D']], segs: [['A', 'C', 'dash'], ['B', 'D', 'dash'], ['M', 'N', 'red'], ['N', 'P', 'red'], ['P', 'Q', 'red'], ['Q', 'M', 'red']], ticks: [['A', 'M', 1], ['M', 'B', 1], ['B', 'N', 2], ['N', 'C', 2], ['C', 'P', 3], ['P', 'D', 3], ['D', 'Q', 4], ['Q', 'A', 4]] });
    },
    prompt: R`Cho tứ giác $ABCD$ có hai đường chéo $AC = ${p}$ cm, $BD = ${q}$ cm. Gọi $M$, $N$, $P$, $Q$ lần lượt là trung điểm của $AB$, $BC$, $CD$, $DA$ (hình bên). Tính chu vi tứ giác $MNPQ$ (cm).`,
    verify: `${p}/2*2+${q}/2*2`,
    explanation: R`$MN$, $PQ$ là đường trung bình của các tam giác $ABC$, $ACD$ nên $MN = PQ = \dfrac{AC}{2} = ${N(p / 2)}$ cm; tương tự $NP = QM = \dfrac{BD}{2} = ${N(q / 2)}$ cm. Chu vi tứ giác $MNPQ$ là $2 \cdot ${N(p / 2)} + 2 \cdot ${N(q / 2)} = ${p + q}$ (cm).` };
};
// 21. Trả lời ngắn thực tế: đo chiều cao cây bằng cọc
T[21] = (n) => {
  const ad = int(2, 6), db = int(4, 16), h = pick([1, 1.2, 1.5, 2]), H = h * (ad + db) / ad; if (!isInt(H * 10) || String(H).length > 4 || H < 3) return null; // cây cao ít nhất 3 m
  return { answer: [String(H), String(H).replace('.', ',')], _mkey: `${ad},${db},${h}`, image: imgPath(n, '21'),
    _fig: () => {
      const A = [0, 0], D = [ad, 0], B = [ad + db, 0], E = [ad, h], C = [ad + db, H];
      draw(fig(n, '21'), { A, D, B, E, C }, {
        under: (S) => `<line x1="10" y1="${S(A)[1]}" x2="410" y2="${S(A)[1]}" stroke="#7a5c2e" stroke-width="2"/>`,
        segs: [['A', 'C', 'dash'], ['D', 'E'], ['B', 'C']], lens: [['A', 'D', `${ad} m`], ['D', 'B', `${db} m`], ['D', 'E', `${T_(h)} m`, 'in']], center: [ad, H * 2], lab: { C: [8, 6], B: [6, 20], A: [-14, 20], D: [-6, 20], E: [-18, 0] } });
    },
    prompt: R`Để đo chiều cao $BC$ của một cái cây, bạn An cắm một cái cọc $DE$ cao $${N(h)}$ m vuông góc với mặt đất sao cho đỉnh cọc $E$ và ngọn cây $C$ cùng nằm trên một đường thẳng đi qua điểm $A$ trên mặt đất (hình bên). Đo được $AD = ${ad}$ m, $DB = ${db}$ m. Tính chiều cao $BC$ của cây (m).`,
    verify: `Math.round(${h}/${ad}*(${ad}+${db})*100)/100`,
    explanation: R`Cọc $DE$ và cây $BC$ cùng vuông góc với mặt đất nên $DE \parallel BC$. Theo hệ quả của định lí Thalès trong tam giác $ABC$: $\dfrac{DE}{BC} = \dfrac{AD}{AB} = \dfrac{${ad}}{${ad} + ${db}} = ${F(ad, ad + db)}$. Suy ra $BC = ${N(h)} \cdot ${F(ad + db, ad)} = ${N(H)}$ (m).` };
};
// 22. Trả lời ngắn thực tế: thang chữ A
T[22] = (n) => {
  const L = pick([150, 180, 200, 240, 250]), bc = int(6, 14) * 10, am = int(8, 30) * 5; if (am >= L - 20) return null; // thanh ngang cách đỉnh ít nhất 40 cm
  const mn = bc * am / L; if (!isInt(mn)) return null;
  return { answer: [String(am)], _mkey: `${L},${bc},${am}`, image: imgPath(n, '22'),
    _fig: () => {
      const hgt = Math.sqrt(L * L - (bc / 2) ** 2) || L, A = [0, hgt], B = [-bc / 2, 0], C = [bc / 2, 0];
      const M = along(A, B, am / L), Nn = along(A, C, am / L);
      draw(fig(n, '22'), { A, B, C, M, N: Nn }, { under: (S) => `<line x1="10" y1="${S(B)[1]}" x2="410" y2="${S(B)[1]}" stroke="#7a5c2e" stroke-width="2"/>`, segs: [['A', 'B'], ['A', 'C'], ['M', 'N', 'red']], lens: [['A', 'B', `${L} cm`], ['M', 'N', `${mn} cm`, 'in'], ['B', 'C', `${bc} cm`]] });
    },
    prompt: R`Một chiếc thang chữ A có hai chân $AB = AC = ${L}$ cm. Thanh ngang $MN$ ($M \in AB$, $N \in AC$, $AM = AN$) song song với mặt đất và dài $${mn}$ cm; khoảng cách giữa hai chân thang trên mặt đất là $BC = ${bc}$ cm (hình bên). Tính độ dài $AM$ (cm).`,
    verify: `(()=>{const r=${mn}/${bc};return r*${L};})()`,
    explanation: R`$MN \parallel BC$ nên theo hệ quả của định lí Thalès: $\dfrac{AM}{AB} = \dfrac{MN}{BC} = \dfrac{${mn}}{${bc}}$. Suy ra $AM = \dfrac{${mn} \cdot ${L}}{${bc}} = ${am}$ (cm).` };
};

// ---------- Thông tin câu ----------
const META = [
  ['mcq', 'NB', false, false], ['mcq', 'NB', false, false], ['mcq', 'NB', false, false], ['mcq', 'NB', false, false],
  ['mcq', 'TH', false, false], ['mcq', 'TH', false, false], ['mcq', 'TH', false, false], ['mcq', 'TH', false, false],
  ['mcq', 'NB', false, false], ['mcq', 'VD', false, false], ['mcq', 'VD', true, false], ['mcq', 'VD', false, false],
  ['tf', 'NB', false, false], ['tf', 'TH', false, false], ['tf', 'VD', true, false], ['tf', 'NB', false, false],
  ['short', 'NB', false, false], ['short', 'NB', false, false], ['short', 'TH', false, false], ['short', 'TH', false, false],
  ['short', 'VD', true, false], ['short', 'VD', true, false],
];
const PTS = { mcq: 0.25, tf: 1, short: 0.5 };
const MCQ_BASE = [0, 1, 2, 3, 2, 0, 3, 1, 0, 2, 3, 1];
const PATTERNS = [[1, 0, 1, 1], [1, 0, 1, 0], [1, 1, 0, 0], [1, 1, 0, 1], [0, 1, 1, 0], [0, 1, 0, 1], [1, 0, 0, 1], [0, 0, 1, 1], [0, 1, 1, 1], [1, 1, 1, 0], [0, 1, 0, 0], [1, 0, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]].map((p) => p.map(Boolean));
const qkey = (q) => q._mkey ?? q.prompt.replace(/\s+/g, '');
const seen = new Set();
const shortSeen = META.map(() => new Set());
const exams = [];
for (let n = 1; n <= 20; n++) {
  const qs = META.map(([kind, muc, thuc_te, bam_may], i) => {
    for (let tries = 0; tries < 8000; tries++) {
      const key = kind === 'mcq' ? (MCQ_BASE[i] + n - 1) % 4 : kind === 'tf' ? PATTERNS[(n * 3 + (i - 12) * 5) % PATTERNS.length] : null;
      cur = i + 1;
      const q = T[i + 1](n, key); if (!q) continue;
      const k = `${i}|` + qkey(q); if (seen.has(k)) continue; delete q._mkey;
      if (kind === 'short' && shortSeen[i].has(q.answer[0]) && tries < 5000) continue;
      seen.add(k); if (kind === 'short') shortSeen[i].add(q.answer[0]);
      const fg = q._fig; delete q._fig; if (fg) fg();
      return { kind, muc, thuc_te, bam_may, prompt: q.prompt, ...(q.image ? { image: q.image } : {}),
        ...(q.options ? { options: q.options } : {}), answer: q.answer, points: PTS[kind], verify: q.verify, explanation: q.explanation };
    }
    throw new Error(`Đề ${n} câu ${i + 1}: không tìm được bộ số`);
  });
  const nn = String(n).padStart(2, '0');
  exams.push({ slug: `toan8-on-tap-chuong-4-${nn}`, title: `Ôn tập chương IV — Đề ${n}`, sort_order: n, time_limit_min: 90,
    description: 'Đề bài tập về nhà ôn tập Chương IV (Định lí Thalès: Bài 15, 16, 17), cấu trúc THPT: 12 trắc nghiệm, 4 Đúng/Sai, 6 trả lời ngắn.', questions: qs });
}
const head = { grade: 8, chapter: 'Chương IV. Định lí Thalès', topic: 'Ôn tập chương IV', level: 'kha' };
writeFileSync(out1, JSON.stringify({ ...head, exams: exams.slice(0, 1) }, null, 2) + '\n', 'utf8');
writeFileSync(out2, JSON.stringify({ ...head, exams: exams.slice(1) }, null, 2) + '\n', 'utf8');
console.log(`Đã sinh ${exams.length} đề (${exams.length * 22} câu): ${out1}, ${out2}`);
