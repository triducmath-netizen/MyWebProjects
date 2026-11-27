#!/usr/bin/env node
// Sinh 20 đề cho Toán 9 · Ôn tập chương III (Căn bậc hai và căn bậc ba); đề 1 là đề gốc, đề 2–20 cùng khuôn.
//   node de-thi/toan-9/theo-bai/sinh-de/on-tap-iii.mjs <file-đề-01.json> <file-đề-02-20.json> [hạt-giống]
// Hình ghi vào de-thi/toan-9/theo-bai/hinh/on-tap-iii/.
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const HINH = resolve(here, '..', 'hinh', 'on-tap-iii');
mkdirSync(HINH, { recursive: true });
const [out1, out2, seedArg] = process.argv.slice(2);
const R = String.raw;

// ---------- Tiện ích ----------
let seed = Number(seedArg ?? 20261127);
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const int = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
const TF = (b) => (b ? 'Đúng' : 'Sai');
const ABCD = 'ABCD';
const vn = (x) => String(Math.round(x * 1000) / 1000).replace('.', '{,}'); // số trong LaTeX, dấu phẩy thập phân
const vt = (x) => String(Math.round(x * 1000) / 1000).replace('.', ','); // số trong chữ thường
const sgn = (c) => (c < 0 ? `- ${-c}` : `+ ${c}`); // " + 3" / " - 3"
function lin(a, b, v = 'x') { // ax + b
  const A = a === 1 ? v : a === -1 ? `-${v}` : `${a}${v}`;
  return b === 0 ? A : `${A} ${sgn(b)}`;
}
const par = (v) => (v < 0 ? `(${v})` : `${v}`);
const SQF = [2, 3, 5, 6, 7, 10, 11, 13, 14, 15];
function place(correct, wrongs, idx) {
  const all = [correct, ...wrongs];
  if (new Set(all.map((x) => String(x[0]))).size !== 4) return null;
  const out = []; let k = 0;
  for (let i = 0; i < 4; i++) out.push(i === idx ? correct : wrongs[k++]);
  return out;
}
// phương án biểu thức một biến: [latex, js(x)] ; verify so giá trị tại các điểm thử
const exprVerify = (orig, js, pts) => `(()=>{const f=x=>${orig};const o=[${js.map((j) => `x=>${j}`).join(',')}];const p=${JSON.stringify(pts)};return o.findIndex(g=>p.every(x=>Math.abs(g(x)-f(x))<1e-7));})()`;
function exprQ(orig, correct, wrongs, idx, pts) {
  const o = place(correct, wrongs, idx); if (!o) return null;
  return { options: o.map((x) => `$${x[0]}$`), answer: idx, verify: exprVerify(orig, o.map((x) => x[1]), pts) };
}
const numQ = (correct, wrongs, idx, fmt = (v) => `$${vn(v)}$`) => {
  const o = place([correct], wrongs.map((w) => [w]), idx); if (!o) return null;
  return { options: o.map((x) => fmt(x[0])), answer: idx, _vals: o.map((x) => x[0]) };
};
const fig = (n, c) => `de-${String(n).padStart(2, '0')}-cau-${c}.svg`;
const imgPath = (n, c) => `../hinh/on-tap-iii/${fig(n, c)}`;
const NAMES = ['An', 'Bình', 'Minh', 'Lan', 'Hà', 'Nam', 'Mai', 'Hùng', 'Linh', 'Khoa'];

// ---------- Hình: thùng lập phương không nắp ----------
function boxFig(file, lid) {
  const s = 170, dx = 70, dy = 50, X = 70, Y = 90;
  const P = { A: [X, Y + s], B: [X + s, Y + s], C: [X + s + dx, Y + s - dy], D: [X + dx, Y + s - dy], E: [X, Y], F: [X + s, Y], G: [X + s + dx, Y - dy], H: [X + dx, Y - dy] };
  const L = (p, q, dash) => `<line x1="${P[p][0]}" y1="${P[p][1]}" x2="${P[q][0]}" y2="${P[q][1]}" stroke="#1f4fa8" stroke-width="2"${dash ? ' stroke-dasharray="6,5"' : ''}/>`;
  let g = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 330" font-family="Times New Roman" font-size="18"><rect width="400" height="330" fill="#fff"/>`;
  g += `<polygon points="${['E', 'F', 'G', 'H'].map((k) => P[k].join(',')).join(' ')}" fill="${lid ? '#a9c8f0' : '#e8f1ff'}" stroke="none"/>`;
  g += `<polygon points="${['A', 'B', 'F', 'E'].map((k) => P[k].join(',')).join(' ')}" fill="#cfe3ff" fill-opacity="0.7" stroke="none"/>`;
  g += `<polygon points="${['B', 'C', 'G', 'F'].map((k) => P[k].join(',')).join(' ')}" fill="#b9d4f7" fill-opacity="0.7" stroke="none"/>`;
  g += L('A', 'B') + L('B', 'C') + L('A', 'E') + L('B', 'F') + L('C', 'G') + L('E', 'F') + L('F', 'G') + L('G', 'H') + L('H', 'E') + L('A', 'D', 1) + L('D', 'C', 1) + L('D', 'H', 1);
  g += `<text x="${X + s / 2}" y="${Y + s + 28}" text-anchor="middle" font-style="italic">x</text>`;
  g += lid ? '' : `<text x="${X + s / 2 + 10}" y="${Y - dy / 2 - 30}" text-anchor="middle" font-size="16" fill="#555">miệng thùng (không có nắp)</text>`;
  writeFileSync(resolve(HINH, file), g + '</svg>\n');
}

// ---------- Khuôn từng câu ----------
const T = {};
// 1. Các căn bậc hai của một số dương (NB, bấm máy được)
T[1] = (n, idx) => {
  let X, k, kk;
  if (rnd() < 0.6) { k = int(2, 19); X = String(k * k); kk = String(k); }
  else { const p = int(1, 9), q = int(2, 9); if (gcd(p, q) !== 1) return null; X = R`\frac{${p * p}}{${q * q}}`; kk = R`\frac{${p}}{${q}}`; k = p / q; }
  const o = place([R`$${kk}$ và $-${kk}$`, 1], [[`$${kk}$`, 2], [`$-${kk}$`, 3], [R`$${X}$ và $-${X}$`, 4]], idx); if (!o) return null;
  return { options: o.map((x) => x[0]), answer: idx, verify: `${JSON.stringify(o.map((x) => x[1]))}.indexOf(1)`,
    prompt: R`Các căn bậc hai của $${X}$ là`,
    explanation: R`Vì $(${kk})^2 = (-${kk})^2 = ${X}$ nên $${X}$ có hai căn bậc hai là $${kk}$ và $-${kk}$. Phương án chỉ có $${kk}$ là căn bậc hai số học, chưa đủ.` };
};
// 2. Điều kiện xác định của căn thức bậc hai
T[2] = (n, idx) => {
  const a = pick([1, 2, 3, 4, 5, -1, -2, -3, -4]), r = int(-9, 9); if (r === 0) return null;
  const b = -a * r, ge = a > 0, P = lin(a, b);
  const opts = [[`x \\ge ${r}`, 'ge', r], [`x \\le ${r}`, 'le', r], [`x > ${r}`, 'gt', r], [`x ${ge ? '\\ge' : '\\le'} ${-r}`, ge ? 'ge' : 'le', -r]];
  const cor = ge ? opts[0] : opts[1], w = opts.filter((x) => x !== cor);
  const o = place(cor, w, idx); if (!o) return null;
  return { options: o.map((x) => `$${x[0]}$`), answer: idx,
    verify: `(()=>{const ok=x=>${a}*x+(${b})>=0;const t={ge:(x,r)=>x>=r,le:(x,r)=>x<=r,gt:(x,r)=>x>r};const o=${JSON.stringify(o.map((x) => [x[1], x[2]]))};const pts=[${r - 2},${r - 1},${r - 0.5},${r},${r + 0.5},${r + 1},${r + 2}];return o.findIndex(([k,r])=>pts.every(x=>t[k](x,r)===ok(x)));})()`,
    prompt: R`Căn thức $\sqrt{${P}}$ xác định khi và chỉ khi`,
    explanation: R`$\sqrt{${P}}$ xác định khi $${P} \ge 0$, tức $${a > 0 ? `${a === 1 ? '' : a}x \\ge ${-b}` : `${a === -1 ? '-' : a}x \\ge ${-b}`}$${a < 0 ? R`, chia hai vế cho số âm $${a}$ phải đổi chiều` : ''}, được $${cor[0]}$. Phương án $x > ${r}$ bỏ sót trường hợp biểu thức dưới dấu căn bằng $0$.` };
};
// 3. Căn bậc ba (NB, bấm máy được)
T[3] = (n, idx) => {
  const k = int(2, 9), s = pick([1, -1]), fr = rnd() < 0.4, q = int(2, 5); if (fr && gcd(k, q) !== 1) return null;
  const inside = fr ? R`${s < 0 ? '-' : ''}\frac{${k ** 3}}{${q ** 3}}` : `${s * k ** 3}`, val = fr ? R`${s < 0 ? '-' : ''}\frac{${k}}{${q}}` : `${s * k}`, neg = fr ? R`${s < 0 ? '' : '-'}\frac{${k}}{${q}}` : `${-s * k}`;
  const o = place([val, 1], [[neg, 2], [R`\pm ${fr ? R`\frac{${k}}{${q}}` : k}`, 3], [fr ? R`${s < 0 ? '-' : ''}\frac{${k * k}}{${q * q}}` : `${s * k * k}`, 4]], idx); if (!o) return null;
  return { options: o.map((x) => `$${x[0]}$`), answer: idx, verify: fr ? `${JSON.stringify(o.map((x) => x[1]))}.indexOf(1)` : `Math.round(Math.cbrt(${s * k ** 3}))`,
    prompt: R`Giá trị của $\sqrt[3]{${inside}}$ bằng`,
    explanation: R`Vì $\left(${val}\right)^3 = ${inside}$ nên $\sqrt[3]{${inside}} = ${val}$. Mỗi số thực có đúng một căn bậc ba (căn bậc ba của số âm là số âm), nên phương án $\pm$ là sai.` };
};
// 4. √((x − c)²) với điều kiện
T[4] = (n, idx) => {
  const c = int(1, 12), v = pick(['x', 'a', 'y', 't']), lt = rnd() < 0.5;
  const x0 = lt ? c - 1.7 : c + 1.7;
  const cor = lt ? [`${c} - ${v}`, `${c}-x`] : [`${v} - ${c}`, `x-${c}`], wro = lt ? [`${v} - ${c}`, `x-${c}`] : [`${c} - ${v}`, `${c}-x`];
  const q = exprQ(`Math.sqrt((x-${c})**2)`, cor, [wro, [`${v} + ${c}`, `x+${c}`], [`(${v} - ${c})^2`, `(x-${c})**2`]], idx, [x0, lt ? c - 3.1 : c + 3.1]);
  return q && { ...q, prompt: R`Với $${v} ${lt ? '<' : '>'} ${c}$, biểu thức $\sqrt{(${v} - ${c})^2}$ bằng`,
    explanation: R`$\sqrt{(${v} - ${c})^2} = |${v} - ${c}|$. Vì $${v} ${lt ? '<' : '>'} ${c}$ nên $${v} - ${c} ${lt ? '< 0' : '> 0'}$, do đó $|${v} - ${c}| = ${cor[0]}$. Phương án $${wro[0]}$ quên xét dấu của $${v} - ${c}$.` };
};
// 5. Khai căn với phép nhân / phép chia
T[5] = (n, idx) => {
  const k = int(2, 9), m = pick([2, 3, 5, 6, 7].filter((d) => (k * k) % d === 0 || true)); const mul = rnd() < 0.5;
  let P, js, cor, w;
  if (mul) { const p = k * k * m, q = m; if (p === q) return null; // √(p a)·√(q a)? dùng √(m a)·√(k²m a)? -> km a
    P = R`\sqrt{${m}a} \cdot \sqrt{${k * k * m}a}`; js = `Math.sqrt(${m}*x)*Math.sqrt(${k * k * m}*x)`; cor = [`${k * m}a`, `${k * m}*x`];
    w = [[`${k * m}a^2`, `${k * m}*x*x`], [`${k * k * m * m}a`, `${k * k * m * m}*x`], [R`${k}a\sqrt{${m}}`, `${k}*x*Math.sqrt(${m})`]]; }
  else { P = R`\dfrac{\sqrt{${k * k * m}a^3}}{\sqrt{${m}a}}`; js = `Math.sqrt(${k * k * m}*x**3)/Math.sqrt(${m}*x)`; cor = [`${k}a`, `${k}*x`];
    w = [[`${k}a^2`, `${k}*x*x`], [`${k * k}a`, `${k * k}*x`], [R`${k}\sqrt{a}`, `${k}*Math.sqrt(x)`]]; }
  const q = exprQ(js, cor, w, idx, [1.3, 2.9, 5.2]);
  return q && { ...q, prompt: R`Với $a > 0$, biểu thức $${P}$ bằng`,
    explanation: mul ? R`$${P} = \sqrt{${m}a \cdot ${k * k * m}a} = \sqrt{${k * k * m * m}a^2} = ${k * m}|a| = ${k * m}a$ (vì $a > 0$). Phương án $${k * k * m * m}a$ quên khai căn.`
      : R`$${P} = \sqrt{\dfrac{${k * k * m}a^3}{${m}a}} = \sqrt{${k * k}a^2} = ${k}|a| = ${k}a$ (vì $a > 0$). Phương án $${k * k}a$ quên khai căn của $${k * k}$.` };
};
// 6. Đưa thừa số ra ngoài dấu căn (có dấu giá trị tuyệt đối)
T[6] = (n, idx) => {
  const k = int(2, 7), m = pick([2, 3, 5, 6, 7]), neg = rnd() < 0.5, A = k * k * m; if (m === k) return null;
  const cor = neg ? [R`-${k}a\sqrt{${m}}`, `-${k}*x*Math.sqrt(${m})`] : [R`${k}a\sqrt{${m}}`, `${k}*x*Math.sqrt(${m})`];
  const w = [neg ? [R`${k}a\sqrt{${m}}`, `${k}*x*Math.sqrt(${m})`] : [R`-${k}a\sqrt{${m}}`, `-${k}*x*Math.sqrt(${m})`], [R`${k * k}a\sqrt{${m}}`, `${k * k}*x*Math.sqrt(${m})`], [R`${k}a^2\sqrt{${m}}`, `${k}*x*x*Math.sqrt(${m})`]];
  const q = exprQ(`Math.sqrt(${A}*x*x)`, cor, w, idx, neg ? [-1.3, -2.9] : [1.3, 2.9]);
  return q && { ...q, prompt: R`Với $a ${neg ? '<' : '>'} 0$, đưa thừa số ra ngoài dấu căn: $\sqrt{${A}a^2}$ bằng`,
    explanation: R`$\sqrt{${A}a^2} = \sqrt{${k}^2 \cdot ${m} \cdot a^2} = ${k}|a|\sqrt{${m}}$. Vì $a ${neg ? '< 0' : '> 0'}$ nên $|a| = ${neg ? '-a' : 'a'}$, được $${cor[0]}$.${neg ? R` Phương án $${k}a\sqrt{${m}}$ quên rằng $a$ âm.` : ''}` };
};
// 7. Trục căn thức ở mẫu (biểu thức chữ)
T[7] = (n, idx) => {
  const q = int(1, 6), c = int(1, 9), s = pick([1, -1]), Q = q * q; // c/(√a + s q)
  const num = (t) => (c === 1 ? `\\sqrt{a} ${t > 0 ? '+' : '-'} ${q}` : `${c}(\\sqrt{a} ${t > 0 ? '+' : '-'} ${q})`);
  const fr = (t, den) => R`\dfrac{${num(t)}}{${den}}`;
  const js = (t, d) => `${c}*(Math.sqrt(x)+(${t * q}))/(${d})`;
  const cor = [fr(-s, `a - ${Q}`), js(-s, `x-${Q}`)];
  const w = [[fr(s, `a - ${Q}`), js(s, `x-${Q}`)], [fr(-s, `a + ${Q}`), js(-s, `x+${Q}`)], [fr(-s, `${Q} - a`), js(-s, `${Q}-x`)]];
  const qq = exprQ(`${c}/(Math.sqrt(x)+(${s * q}))`, cor, w, idx, [Q + 2.3, Q + 7.9]);
  return qq && { ...qq, prompt: R`Với $a \ge 0$, $a \ne ${Q}$, trục căn thức ở mẫu của biểu thức $\dfrac{${c}}{\sqrt{a} ${s > 0 ? '+' : '-'} ${q}}$ ta được`,
    explanation: R`Nhân cả tử và mẫu với biểu thức liên hợp $\sqrt{a} ${s > 0 ? '-' : '+'} ${q}$: mẫu thành $(\sqrt a)^2 - ${q}^2 = a - ${Q}$. Vậy kết quả là $${cor[0]}$. Phương án có mẫu $a + ${Q}$ là nhầm hằng đẳng thức.` };
};
// 8. Rút gọn phân thức chứa căn
T[8] = (n, idx) => {
  const k = int(1, 9), f = int(0, 3);
  const forms = [[R`\dfrac{x - ${k * k}}{\sqrt{x} - ${k}}`, `(x-${k * k})/(Math.sqrt(x)-${k})`, 1, R`x - ${k * k} = (\sqrt x - ${k})(\sqrt x + ${k})`],
    [R`\dfrac{x - ${k * k}}{\sqrt{x} + ${k}}`, `(x-${k * k})/(Math.sqrt(x)+${k})`, -1, R`x - ${k * k} = (\sqrt x - ${k})(\sqrt x + ${k})`],
    [R`\dfrac{x + ${2 * k}\sqrt{x} + ${k * k}}{\sqrt{x} + ${k}}`, `(x+${2 * k}*Math.sqrt(x)+${k * k})/(Math.sqrt(x)+${k})`, 1, R`x + ${2 * k}\sqrt x + ${k * k} = (\sqrt x + ${k})^2`],
    [R`\dfrac{x - ${2 * k}\sqrt{x} + ${k * k}}{\sqrt{x} - ${k}}`, `(x-${2 * k}*Math.sqrt(x)+${k * k})/(Math.sqrt(x)-${k})`, -1, R`x - ${2 * k}\sqrt x + ${k * k} = (\sqrt x - ${k})^2`]];
  const [E, js, s, why] = forms[f];
  const all = { p: [R`\sqrt{x} + ${k}`, `Math.sqrt(x)+${k}`], m: [R`\sqrt{x} - ${k}`, `Math.sqrt(x)-${k}`], xp: [`x + ${k}`, `x+${k}`], xm: [`x - ${k}`, `x-${k}`] };
  const cor = s > 0 ? all.p : all.m, w = [s > 0 ? all.m : all.p, all.xp, all.xm];
  const q = exprQ(js, cor, w, idx, [k * k + 3.7, k * k + 11.3]);
  return q && { ...q, prompt: R`Với $x \ge 0$, $x \ne ${k * k}$, rút gọn biểu thức $${E}$ ta được`,
    explanation: R`Ta có $${why}$, chia cho mẫu được $${cor[0]}$. Phương án $${cor[0].replace('\\sqrt{x}', 'x')}$ nhầm $\sqrt x$ với $x$.` };
};
// 9. Thực tế: nhiệt lượng Q = I²Rt, tìm cường độ dòng điện
T[9] = (n, idx) => {
  const I = pick([0.5, 1, 1.5, 2, 2.5, 3, 4, 5]), Rr = pick([5, 10, 20, 40]), t = pick([4, 9, 16, 25, 36]), Q = I * I * Rr * t;
  if (Q > 9999 || !Number.isInteger(Q)) return null;
  const q = numQ(I, [I * I, I * Math.sqrt(t), I / Math.sqrt(t)], idx, (v) => `$${vn(v)}$ A`); if (!q) return null; if (!Number.isInteger(I / Math.sqrt(t) * 1000)) return null;
  return { ...q, verify: `${JSON.stringify(q._vals)}.findIndex(v=>Math.abs(v-Math.sqrt(${Q}/(${Rr}*${t})))<1e-9)`,
    prompt: R`Nhiệt lượng tỏa ra trên một dây dẫn được tính bởi công thức $Q = I^2Rt$, trong đó $Q$ là nhiệt lượng (J), $I$ là cường độ dòng điện (A), $R$ là điện trở (Ω), $t$ là thời gian (s). Một dây dẫn có điện trở $R = ${Rr}$ Ω, trong $${t}$ giây tỏa ra nhiệt lượng $${Q}$ J. Cường độ dòng điện chạy qua dây dẫn là`,
    explanation: R`Từ $Q = I^2Rt$ suy ra $I^2 = \dfrac{Q}{Rt} = \dfrac{${Q}}{${Rr} \cdot ${t}} = ${vn(I * I)}$, mà $I > 0$ nên $I = \sqrt{${vn(I * I)}} = ${vn(I)}$ (A). Phương án $${vn(I * I)}$ A quên khai căn; phương án $${vn(I * Math.sqrt(t))}$ A quên chia cho $t$; phương án $${vn(I / Math.sqrt(t))}$ A khai căn nhầm $\sqrt{Q : R} : t$.` };
};
// 10. Rút gọn có dấu giá trị tuyệt đối trên một khoảng
T[10] = (n, idx) => {
  const k = int(2, 12), plus = rnd() < 0.5, inside = rnd() < 0.6; // 0<x<k hoặc x>k
  const cor = inside ? (plus ? [`${k}`, `${k}`] : [`${k} - 2x`, `${k}-2*x`]) : (plus ? [`2x - ${k}`, `2*x-${k}`] : [`-${k}`, `-${k}`]);
  const pool = [[`${k} - 2x`, `${k}-2*x`], [`2x - ${k}`, `2*x-${k}`], [`${k}`, `${k}`], [`-${k}`, `-${k}`]].filter((x) => x[0] !== cor[0]);
  const E = R`\sqrt{x^2 - ${2 * k}x + ${k * k}} ${plus ? '+' : '-'} \sqrt{x^2}`;
  const js = `Math.sqrt(x*x-${2 * k}*x+${k * k})${plus ? '+' : '-'}Math.sqrt(x*x)`;
  const q = exprQ(js, cor, pool, idx, inside ? [k * 0.3, k * 0.7] : [k + 1.3, k + 4.1]);
  if (q && /^-?\d+$/.test(cor[0])) q.verify = `(()=>{const x=${inside ? k * 0.4 : k + 2.2};return Math.round(${js});})()`;
  return q && { ...q, prompt: R`Với $${inside ? `0 < x < ${k}` : `x > ${k}`}$, rút gọn biểu thức $A = ${E}$ ta được`,
    explanation: R`$A = \sqrt{(x - ${k})^2} ${plus ? '+' : '-'} \sqrt{x^2} = |x - ${k}| ${plus ? '+' : '-'} |x|$. Với $${inside ? `0 < x < ${k}` : `x > ${k}`}$: $|x - ${k}| = ${inside ? `${k} - x` : `x - ${k}`}$, $|x| = x$. Do đó $A = ${inside ? `${k} - x` : `x - ${k}`} ${plus ? '+' : '-'} x = ${cor[0]}$.` };
};
// 11. Dữ kiện ẩn: √a + √b = s, √a − √b = d
T[11] = (n, idx) => {
  const d = int(1, 6), s = d + 2 * int(1, 5), v = rnd() < 0.5;
  let cor, w, ask, expl;
  if (v) { cor = s * d; w = [s * s - d * d, (s - d) ** 2, s + d]; ask = 'a - b'; expl = R`$a - b = (\sqrt a)^2 - (\sqrt b)^2 = (\sqrt a + \sqrt b)(\sqrt a - \sqrt b) = ${s} \cdot ${d} = ${s * d}$.`; }
  else { cor = (s * s - d * d) / 4; w = [s * s - d * d, s * d, (s * s + d * d) / 2]; ask = R`\sqrt{ab}`; expl = R`$\sqrt a = \dfrac{${s} + ${d}}{2} = ${(s + d) / 2}$, $\sqrt b = \dfrac{${s} - ${d}}{2} = ${(s - d) / 2}$, nên $\sqrt{ab} = \sqrt a \cdot \sqrt b = ${(s + d) / 2} \cdot ${(s - d) / 2} = ${cor}$.`; }
  const q = numQ(cor, w, idx); if (!q) return null;
  return { ...q, verify: `(()=>{const ra=(${s}+${d})/2,rb=(${s}-${d})/2;return ${v ? 'ra*ra-rb*rb' : 'ra*rb'};})()`,
    prompt: R`Cho hai số dương $a, b$ thỏa mãn $\sqrt{a} + \sqrt{b} = ${s}$ và $\sqrt{a} - \sqrt{b} = ${d}$. Giá trị của $${ask}$ là`,
    explanation: expl + R` Phương án $${s * s - d * d}$ là nhầm $(\sqrt a + \sqrt b)^2 - (\sqrt a - \sqrt b)^2$ với $a - b$.` };
};
// 12. Thực tế: khối lập phương cắt thành các khối nhỏ
T[12] = (n, idx) => {
  const p = pick([2, 3]), c = int(2, p === 2 ? 9 : 6), V = (p * c) ** 3, cnt = p ** 3, ob = pick(['khối gỗ', 'khối pho mát', 'khối đất nặn', 'khối thạch']), tp = rnd() < 0.5;
  const q = tp ? numQ(6 * c * c, [c * c, 6 * (p * c) ** 2, 4 * c * c], idx, (v) => `$${vn(v)}$ cm²`) : numQ(c * c, [c, (p * c) ** 2, c ** 3], idx, (v) => `$${vn(v)}$ cm²`); if (!q) return null;
  return { ...q, _core: `${V}-${cnt}-${tp}`, verify: `(()=>{const e=Math.round(Math.cbrt(${V}))/${p};return ${JSON.stringify(q._vals)}.findIndex(v=>Math.abs(v-${tp ? 6 : 1}*e*e)<1e-9);})()`,
    prompt: R`Một ${ob} hình lập phương có thể tích $${V}$ cm³ được cắt thành $${cnt}$ khối lập phương nhỏ bằng nhau. ${tp ? 'Diện tích toàn phần của một khối lập phương nhỏ' : 'Diện tích mỗi mặt của một khối lập phương nhỏ'} là`,
    explanation: R`Cạnh khối lớn: $\sqrt[3]{${V}} = ${p * c}$ (cm). Cắt thành $${cnt} = ${p}^3$ khối nhỏ thì mỗi cạnh chia làm $${p}$ phần, cạnh khối nhỏ là $${p * c} : ${p} = ${c}$ (cm). ${tp ? R`Diện tích toàn phần: $6 \cdot ${c}^2 = ${6 * c * c}$ (cm²). Phương án $${4 * c * c}$ cm² chỉ là diện tích xung quanh; phương án $${6 * (p * c) ** 2}$ cm² là của khối lớn.` : R`Diện tích mỗi mặt: $${c}^2 = ${c * c}$ (cm²). Phương án $${c ** 3}$ cm² là thể tích khối nhỏ (cm³), không phải diện tích.`}` };
};
// 13. Đúng/Sai: các quy tắc (NB)
T[13] = (n, pat) => {
  const a = int(2, 9), b = int(2, 12), m = pick([2, 3, 5, 6]), r = int(2, 6), u = int(2, 9);
  const st = [
    pat[0] ? R`$\sqrt[3]{-${a ** 3}} = -${a}$.` : R`$\sqrt[3]{-${a ** 3}} = ${a}$.`,
    pat[1] ? R`$\sqrt{(-${b})^2} = ${b}$.` : R`$\sqrt{(-${b})^2} = -${b}$.`,
    pat[2] ? R`Với $a \ge 0$ thì $\sqrt{${m}a} \cdot \sqrt{${r * r * m}a} = ${r * m}a$.` : R`Với $a \ge 0$ thì $\sqrt{${m}a} \cdot \sqrt{${r * r * m}a} = ${r * m}a^2$.`,
    pat[3] ? R`Với $a < 0$ thì $\sqrt{${u * u}a^2} = -${u}a$.` : R`Với $a < 0$ thì $\sqrt{${u * u}a^2} = ${u}a$.`,
  ];
  return { options: st.map((s, i) => `${'abcd'[i]}) ${s}`), answer: pat,
    verify: `(()=>{const x=-1.7,y=2.3;return [${pat[0] ? `Math.cbrt(-${a ** 3})===-${a}` : `Math.cbrt(-${a ** 3})===${a}`}, ${pat[1] ? `Math.sqrt(${b * b})===${b}` : `Math.sqrt(${b * b})===-${b}`}, Math.abs(Math.sqrt(${m}*y)*Math.sqrt(${r * r * m}*y)-(${pat[2] ? `${r * m}*y` : `${r * m}*y*y`}))<1e-9, Math.abs(Math.sqrt(${u * u}*x*x)-(${pat[3] ? `-${u}*x` : `${u}*x`}))<1e-9];})()`,
    prompt: R`Khi ôn tập chương III, bạn ${pick(NAMES)} lớp 9${pick(['A', 'B', 'C', 'D', 'E', 'G'])} viết bốn kết quả dưới đây. Xét tính đúng, sai của các khẳng định sau.`,
    explanation: R`a) ${TF(pat[0])}. $(-${a})^3 = -${a ** 3}$ nên $\sqrt[3]{-${a ** 3}} = -${a}$. b) ${TF(pat[1])}. $\sqrt{(-${b})^2} = |-${b}| = ${b}$. c) ${TF(pat[2])}. $\sqrt{${m}a} \cdot \sqrt{${r * r * m}a} = \sqrt{${r * r * m * m}a^2} = ${r * m}|a| = ${r * m}a$ (vì $a \ge 0$). d) ${TF(pat[3])}. $\sqrt{${u * u}a^2} = ${u}|a| = -${u}a$ vì $a < 0$.` };
};
// 14. Đúng/Sai: rút gọn biểu thức P (TH)
T[14] = (n, pat) => {
  const k = int(1, 6), m = int(1, 6); if (m === k) return null;
  const e = k - m, w = int(2, 9); if (w === k) return null;
  const v = 2 * w + e;
  const ms = m === 1 ? '' : m;
  const Ptxt = R`P = \dfrac{x - ${k * k}}{\sqrt{x} - ${k}} + \dfrac{x - ${ms}\sqrt{x}}{\sqrt{x}}`;
  const Pe = (c) => (c === 0 ? R`2\sqrt{x}` : R`2\sqrt{x} ${sgn(c)}`);
  const xClaim = pat[3] ? w * w : w;
  return { answer: pat,
    options: [pat[0] ? R`a) Điều kiện xác định của $P$ là $x > 0$ và $x \ne ${k * k}$.` : R`a) Điều kiện xác định của $P$ là $x \ge 0$ và $x \ne ${k * k}$.`,
      pat[1] ? R`b) $\dfrac{x - ${k * k}}{\sqrt{x} - ${k}} = \sqrt{x} + ${k}$.` : R`b) $\dfrac{x - ${k * k}}{\sqrt{x} - ${k}} = \sqrt{x} - ${k}$.`,
      pat[2] ? R`c) Rút gọn được $P = ${Pe(e)}$.` : R`c) Rút gọn được $P = ${Pe(k + m)}$.`,
      R`d) $P = ${v}$ khi $x = ${xClaim}$.`],
    verify: `(()=>{const P=x=>(x-${k * k})/(Math.sqrt(x)-${k})+(x-${m}*Math.sqrt(x))/Math.sqrt(x);const t=[3.7,11.2];return [${pat[0]}, ${pat[1] ? 'true' : 'false'}, t.every(x=>Math.abs(P(x)-(2*Math.sqrt(x)+(${pat[2] ? e : k + m})))<1e-9), Math.abs(P(${xClaim})-${v})<1e-9];})()`,
    prompt: R`Cho biểu thức $${Ptxt}$. Xét tính đúng, sai của các khẳng định sau.`,
    explanation: R`a) ${TF(pat[0])}. Cần $x \ge 0$, $\sqrt x \ne 0$ (mẫu thứ hai) và $\sqrt x \ne ${k}$, tức $x > 0$ và $x \ne ${k * k}$. b) ${TF(pat[1])}. $x - ${k * k} = (\sqrt x - ${k})(\sqrt x + ${k})$ nên phân thức bằng $\sqrt x + ${k}$. c) ${TF(pat[2])}. $\dfrac{x - ${ms}\sqrt x}{\sqrt x} = \sqrt x - ${m}$, nên $P = \sqrt x + ${k} + \sqrt x - ${m} = ${Pe(e)}$. d) ${TF(pat[3])}. $${Pe(e)} = ${v}$ ⇔ $\sqrt x = ${w}$ ⇔ $x = ${w * w}$ (thỏa mãn điều kiện).` };
};
// 15. Đúng/Sai: rơi tự do S = 4,9t² (VD, thực tế)
T[15] = (n, pat) => {
  const Tt = int(3, 9), h = 4.9 * Tt * Tt, t1 = int(1, Tt - 1), mult = pick([4, 9, 16]), r = Math.sqrt(mult);
  const s1 = 4.9 * t1 * t1, place2 = pick(['một tòa tháp', 'một vách đá', 'một tòa nhà cao tầng', 'một khinh khí cầu đứng yên']);
  const aC = pat[0] ? s1 : 9.8 * t1, bC = pat[1] ? Tt : Tt + 1, cC = pat[2] ? h - s1 : h - 9.8 * t1, dC = pat[3] ? r : mult;
  if (Math.abs(aC - s1) < 1e-9 && !pat[0]) return null; if (Math.abs(cC - (h - s1)) < 1e-9 && !pat[2]) return null;
  return { answer: pat,
    options: [R`a) Sau $${t1}$ giây, vật rơi được quãng đường $${vn(aC)}$ m.`, R`b) Vật chạm đất sau $${bC}$ giây.`,
      R`c) Sau $${t1}$ giây, vật còn cách mặt đất $${vn(cC)}$ m.`, R`d) Nếu thả vật từ độ cao gấp $${mult}$ lần thì thời gian rơi đến khi chạm đất gấp $${dC}$ lần.`],
    verify: `(()=>{const h=${h},S=t=>4.9*t*t,T=Math.sqrt(h/4.9),e=x=>Math.round(x*1000)/1000;return [e(S(${t1}))===e(${aC}), e(T)===${bC}, e(h-S(${t1}))===e(${cC}), e(Math.sqrt(${mult}*h/4.9)/T)===${dC}];})()`,
    prompt: R`Từ đỉnh ${place2} cao $${vn(h)}$ m, người ta thả rơi tự do một vật nhỏ. Quãng đường vật rơi được sau $t$ giây là $S = 4{,}9t^2$ (m) (bỏ qua sức cản không khí). Xét tính đúng, sai của các khẳng định sau.`,
    explanation: R`a) ${TF(pat[0])}. $S = 4{,}9 \cdot ${t1}^2 = ${vn(s1)}$ (m). b) ${TF(pat[1])}. Chạm đất khi $4{,}9t^2 = ${vn(h)}$ ⇔ $t^2 = ${Tt * Tt}$ ⇔ $t = ${Tt}$ (giây) (vì $t > 0$). c) ${TF(pat[2])}. Vật còn cách mặt đất $${vn(h)} - ${vn(s1)} = ${vn(h - s1)}$ (m). d) ${TF(pat[3])}. $t = \sqrt{\dfrac{h}{4{,}9}}$; độ cao gấp $${mult}$ lần thì $t$ gấp $\sqrt{${mult}} = ${r}$ lần.` };
};
// 16. Đúng/Sai: mảnh đất hình vuông (TH, thực tế)
T[16] = (n, pat) => {
  const nn = int(8, 40), d = int(1, 5), p = nn + int(2, 15), who = pick(NAMES), what = pick(['mảnh vườn', 'mảnh đất', 'sân chơi', 'ao cá']);
  const S = nn * nn, S2 = p * p;
  const aC = pat[0] ? nn : nn + pick([1, -1, 2]), bC = pat[1] ? 4 * nn : 2 * nn, cC = pat[2] ? 2 * nn * d + d * d : d * d, dC = pat[3] ? p - nn : p + nn;
    return { answer: pat,
    options: [R`a) Cạnh của ${what} dài $${vn(aC)}$ m.`, R`b) Để rào kín xung quanh ${what} cần $${bC}$ m hàng rào.`,
      R`c) Nếu mở rộng mỗi cạnh thêm $${d}$ m thì diện tích tăng thêm $${cC}$ m².`, R`d) Một ${what} hình vuông khác có diện tích $${S2}$ m² thì có cạnh dài hơn cạnh ${what} của bác ${who} $${dC}$ m.`],
    verify: `(()=>{const a=Math.sqrt(${S}),b=Math.sqrt(${S2});return [a===${aC}, 4*a===${bC}, (a+${d})**2-a*a===${cC}, b-a===${dC}];})()`,
    prompt: R`Bác ${who} có một ${what} hình vuông với diện tích $${S}$ m². Xét tính đúng, sai của các khẳng định sau.`,
    explanation: R`a) ${TF(pat[0])}. Cạnh là $\sqrt{${S}} = ${nn}$ (m). b) ${TF(pat[1])}. Chu vi $4 \cdot ${nn} = ${4 * nn}$ (m). c) ${TF(pat[2])}. Diện tích mới $(${nn} + ${d})^2 = ${(nn + d) ** 2}$, tăng $${(nn + d) ** 2} - ${S} = ${2 * nn * d + d * d}$ (m²). d) ${TF(pat[3])}. Cạnh ${what} kia là $\sqrt{${S2}} = ${p}$ (m), dài hơn $${p} - ${nn} = ${p - nn}$ (m).` };
};
// 17. Số nguyên lớn nhất / nhỏ nhất để căn thức xác định
T[17] = (n) => {
  const a = int(2, 7), c = int(5, 60); if (c % a === 0) return null; const big = rnd() < 0.5;
  const ans = big ? Math.floor(c / a) : Math.ceil(c / a);
  const E = big ? `${c} - ${a}x` : `${a}x - ${c}`;
  return { answer: [String(ans)], verify: `(()=>{const ok=x=>${big ? `${c}-${a}*x` : `${a}*x-${c}`}>=0;let x=${big ? 100 : -100};while(!ok(x))x+=${big ? -1 : 1};return x;})()`,
    prompt: R`Tìm số nguyên $x$ ${big ? 'lớn nhất' : 'nhỏ nhất'} để căn thức $\sqrt{${E}}$ xác định.`,
    explanation: R`$\sqrt{${E}}$ xác định khi $${E} \ge 0$ ⇔ $x ${big ? '\\le' : '\\ge'} \dfrac{${c}}{${a}}$. Vì $\dfrac{${c}}{${a}} \approx ${vn(Math.round(c / a * 100) / 100)}$ nên số nguyên ${big ? 'lớn nhất' : 'nhỏ nhất'} là $${ans}$.` };
};
// 18. Đưa thừa số ra ngoài: √N = a√b, tính a + b
T[18] = (n) => {
  const k = int(2, 9), m = pick(SQF), N = k * k * m; if (N > 999) return null;
  return { answer: [String(k + m)], verify: `(()=>{const N=${N};let a=1;for(let i=2;i*i<=N;i++)if(N%(i*i)===0)a=i;return a+N/(a*a);})()`,
    prompt: R`Đưa thừa số ra ngoài dấu căn, ta viết được $\sqrt{${N}} = a\sqrt{b}$ với $a, b$ là các số nguyên dương và $b$ nhỏ nhất có thể. Tính $a + b$.`,
    explanation: R`$${N} = ${k * k} \cdot ${m} = ${k}^2 \cdot ${m}$ nên $\sqrt{${N}} = ${k}\sqrt{${m}}$ ($${m}$ không còn thừa số chính phương). Vậy $a = ${k}$, $b = ${m}$, $a + b = ${k + m}$.` };
};
// 19. Trục căn thức: c/(√p ± q) = a√p + b, tính a + b
T[19] = (n) => {
  const q = int(1, 4), d = int(1, 5), p = q * q + d; if ([4, 9, 16, 25].some((z) => p % z === 0)) return null;
  const u = int(1, 5), c = d * u, s = pick([1, -1]); // c/(√p − s q)? dùng mẫu √p + s q
  const a = u, b = -s * u * q, ans = a + b; if (ans === 0) return null;
  return { answer: [String(ans)], verify: `(()=>{const D=${p}-${q * q},v=${c}/(Math.sqrt(${p})+(${s * q})),A=${c}/D,B=-(${s})*${c}*${q}/D;return Math.abs(A*Math.sqrt(${p})+B-v)<1e-9?A+B:NaN;})()`,
    prompt: R`Trục căn thức ở mẫu, ta viết được $\dfrac{${c}}{\sqrt{${p}} ${s > 0 ? '+' : '-'} ${q}} = a\sqrt{${p}} + b$ với $a, b$ là các số nguyên. Tính $a + b$.`,
    explanation: R`$\dfrac{${c}}{\sqrt{${p}} ${s > 0 ? '+' : '-'} ${q}} = \dfrac{${c === 1 ? '' : c}(\sqrt{${p}} ${s > 0 ? '-' : '+'} ${q})}{${p} - ${q * q}} = ${d === 1 ? '' : R`\dfrac{${c}(\sqrt{${p}} ${s > 0 ? '-' : '+'} ${q})}{${d}} = `} ${u === 1 ? '' : u}\sqrt{${p}} ${sgn(b)}$. Vậy $a = ${a}$, $b = ${b}$, $a + b = ${ans}$.` };
};
// 20. Tổng các nghiệm của √(x² − 2ax + a²) = b
T[20] = (n) => {
  const a = int(-9, 9), b = int(1, 12); if (a === 0) return null;
  const E = R`x^2 ${sgn(-2 * a)}x + ${a * a}`;
  return { answer: [String(2 * a)], verify: `(()=>{const r=[${a}+${b},${a}-${b}];return r.filter(x=>Math.abs(Math.sqrt(x*x-(${2 * a})*x+${a * a})-${b})<1e-9).reduce((s,x)=>s+x,0);})()`,
    prompt: R`Tính tổng tất cả các giá trị của $x$ thỏa mãn $\sqrt{${E}} = ${b}$.`,
    explanation: R`$\sqrt{${E}} = \sqrt{(x ${sgn(-a)})^2} = |x ${sgn(-a)}|$. Phương trình thành $|x ${sgn(-a)}| = ${b}$ ⇔ $x = ${a + b}$ hoặc $x = ${a - b}$. Tổng các giá trị: $${a + b} + ${par(a - b)} = ${2 * a}$.` };
};
// 21. Thực tế: thùng lập phương không nắp (hình)
const OBJ21 = [['thùng tôn', 'tôn'], ['bể kính nuôi cá', 'kính'], ['thùng gỗ', 'gỗ ván'], ['hộp nhựa', 'tấm nhựa']];
T[21] = (n) => {
  const c = int(3, 13), V = c ** 3, [ob, mat] = pick(OBJ21), lid = rnd() < 0.5, F = lid ? 6 : 5;
  return { answer: [String(F * c * c)], image: imgPath(n, '21'), _fig: () => boxFig(fig(n, '21'), lid), _key: ob, _core: `${V}-${lid}`,
    verify: `(()=>{const x=Math.round(Math.cbrt(${V}));return ${F}*x*x;})()`,
    prompt: R`Một ${ob} có dạng hình lập phương, ${lid ? 'có nắp đậy kín' : 'không có nắp'} (như hình bên), chứa được vừa đầy $${V}$ lít nước. Tính diện tích ${mat} cần dùng để làm ${ob} đó (đơn vị: dm², bỏ qua độ dày và mép nối).`,
    explanation: R`$${V}$ lít $= ${V}$ dm³. Cạnh của ${ob}: $x = \sqrt[3]{${V}} = ${c}$ (dm). ${lid ? 'Có nắp nên gồm đủ $6$ mặt' : 'Không có nắp nên chỉ gồm $5$ mặt'} hình vuông, diện tích ${mat} là $${F}x^2 = ${F} \cdot ${c * c} = ${F * c * c}$ (dm²).` };
};
// 22. Đếm số nguyên thỏa hai điều kiện có căn
T[22] = (n) => {
  const a = int(-5, 10), k = int(2, 6), b = a + int(2, 45); if (b === a + k * k) return null;
  const hi = Math.min(b, a + k * k), ans = hi - a + 1;
  return { answer: [String(ans)], verify: `(()=>{let c=0;for(let x=-200;x<=200;x++){if(x-(${a})>=0&&${b}-x>=0&&Math.sqrt(x-(${a}))<=${k})c++;}return c;})()`,
    prompt: R`Có bao nhiêu số nguyên $x$ thỏa mãn đồng thời: căn thức $\sqrt{${b} - x}$ xác định và $\sqrt{${lin(1, -a)}} \le ${k}$?`,
    explanation: R`$\sqrt{${b} - x}$ xác định ⇔ $x \le ${b}$. $\sqrt{${lin(1, -a)}} \le ${k}$ ${a === 0 ? '' : R`⇔ $0 \le ${lin(1, -a)} \le ${k * k}$ `}⇔ $${a} \le x \le ${a + k * k}$. Kết hợp: $${a} \le x \le ${hi}$, có $${hi} - ${par(a)} + 1 = ${ans}$ số nguyên.` };
};

// ---------- Thông tin câu ----------
const META = [ // [kind, muc, thuc_te, bam_may]
  ['mcq', 'NB', false, true], ['mcq', 'NB', false, false], ['mcq', 'NB', false, true], ['mcq', 'NB', false, false], ['mcq', 'NB', false, false], ['mcq', 'NB', false, false],
  ['mcq', 'TH', false, false], ['mcq', 'TH', false, false], ['mcq', 'TH', true, false], ['mcq', 'VD', false, false], ['mcq', 'VD', false, false], ['mcq', 'VD', true, false],
  ['tf', 'NB', false, false], ['tf', 'TH', false, false], ['tf', 'VD', true, false], ['tf', 'TH', true, false],
  ['short', 'NB', false, false], ['short', 'NB', false, false], ['short', 'TH', false, false], ['short', 'TH', false, false], ['short', 'VD', true, false], ['short', 'VD', false, false],
];
const PTS = { mcq: 0.25, tf: 1, short: 0.5 };
const MCQ_BASE = [0, 1, 2, 3, 2, 0, 3, 1, 0, 2, 3, 1];
const PATTERNS = [[1, 0, 1, 1], [1, 0, 1, 0], [1, 1, 0, 0], [1, 1, 0, 1], [0, 1, 1, 0], [0, 1, 0, 1], [1, 0, 0, 1], [0, 0, 1, 1], [0, 1, 1, 1], [1, 1, 1, 0], [0, 1, 0, 0], [1, 0, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]].map((p) => p.map(Boolean));
const qkey = (q) => q.prompt.replace(/\s+/g, '') + (q._key ?? '');
const seen = new Set(), seenPrompt = META.map(() => new Set()), shortSeen = META.map(() => new Set()), coreSeen = META.map(() => new Set());
const exams = [];
for (let n = 1; n <= 20; n++) {
  const qs = META.map(([kind, muc, thuc_te, bam_may], i) => {
    for (let tries = 0; tries < 6000; tries++) {
      const key = kind === 'mcq' ? (MCQ_BASE[i] + n - 1) % 4 : kind === 'tf' ? PATTERNS[(n * 3 + (i - 12) * 5) % PATTERNS.length] : null;
      const q = T[i + 1](n, key); if (!q) continue;
      const k = qkey(q); if (seen.has(k) || seenPrompt[i].has(q.prompt)) continue; delete q._key;
      if (q._core && coreSeen[i].has(q._core)) continue;
      if (kind === 'short' && shortSeen[i].has(q.answer[0]) && tries < 400) continue;
      if (q._core) coreSeen[i].add(q._core); delete q._core;
      seen.add(k); seenPrompt[i].add(q.prompt); if (kind === 'short') shortSeen[i].add(q.answer[0]);
      const fg = q._fig; delete q._fig; delete q._vals; if (fg) fg();
      return { kind, muc, thuc_te, bam_may, prompt: q.prompt, ...(q.image ? { image: q.image } : {}),
        ...(q.options ? { options: q.options } : {}), answer: q.answer, points: PTS[kind], verify: q.verify, explanation: q.explanation };
    }
    throw new Error(`Đề ${n} câu ${i + 1}: không tìm được bộ số`);
  });
  const nn = String(n).padStart(2, '0');
  exams.push({ slug: `toan9-on-tap-chuong-3-${nn}`, title: `Ôn tập chương III — Đề ${n}`, sort_order: n, time_limit_min: 90,
    description: 'Đề bài tập về nhà Ôn tập chương III (Căn bậc hai và căn bậc ba), cấu trúc THPT: 12 trắc nghiệm, 4 Đúng/Sai, 6 trả lời ngắn.', questions: qs });
}
const head = { grade: 9, chapter: 'Chương III. Căn bậc hai và căn bậc ba', topic: 'Ôn tập chương III', level: 'kha' };
writeFileSync(out1, JSON.stringify({ ...head, exams: exams.slice(0, 1) }, null, 2) + '\n', 'utf8');
writeFileSync(out2, JSON.stringify({ ...head, exams: exams.slice(1) }, null, 2) + '\n', 'utf8');
console.log(`Đã sinh ${exams.length} đề (${exams.length * 22} câu): ${out1}, ${out2}`);
