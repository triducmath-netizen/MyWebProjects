#!/usr/bin/env node
// Sinh 20 đề cho Toán 11 · Bài 15. Giới hạn của dãy số (đề 1 là đề gốc, đề 2–20 cùng khuôn).
//   node de-thi/toan-11/theo-bai/sinh-de/bai-15.mjs <file-đề-01.json> <file-đề-02-20.json> [hạt-giống]
// Hình ghi vào de-thi/toan-11/theo-bai/hinh/bai-15/.
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const HINH = resolve(here, '..', 'hinh', 'bai-15');
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
const vn = (x) => String(Math.round(x * 1e6) / 1e6).replace('.', '{,}');
const sgn = (c) => (c < 0 ? `- ${-c}` : `+ ${c}`);
const par = (v) => (v < 0 ? `(${v})` : `${v}`);
// phân số [p, q]
const Q = (p, q = 1) => { if (q < 0) { p = -p; q = -q; } const g = gcd(p, q) || 1; return [p / g, q / g]; };
const fr = ([p, q]) => (q === 1 ? `${p}` : `${p < 0 ? '-' : ''}\\dfrac{${Math.abs(p)}}{${q}}`);
const fv = ([p, q]) => p / q;
const qmul = (a, b) => Q(a[0] * b[0], a[1] * b[1]);
const qadd = (a, b) => Q(a[0] * b[1] + b[0] * a[1], a[1] * b[1]);
const qsub = (a, b) => qadd(a, [-b[0], b[1]]);
const qdiv = (a, b) => Q(a[0] * b[1], a[1] * b[0]);
function place(correct, wrongs, idx) {
  const all = [correct, ...wrongs];
  if (new Set(all.map((x) => String(x[0]))).size !== 4) return null;
  const out = []; let k = 0;
  for (let i = 0; i < 4; i++) out.push(i === idx ? correct : wrongs[k++]);
  return out;
}
// phương án phân số: [latex, giá trị]
const fopt = (q) => [`$${fr(q)}$`, fv(q)];
function valQ(correct, wrongs, idx, target) { // target: biểu thức JS tính độc lập đáp số
  if (wrongs.some((w) => Math.abs(w[1] - correct[1]) < 1e-9)) return null;
  const o = place(correct, wrongs, idx); if (!o) return null;
  const isNum = /^\$-?\d+\$$/.test(correct[0]);
  return { options: o.map((x) => x[0]), answer: idx, verify: isNum ? `(()=>{const t=${target};return Math.round(t*1e4)/1e4;})()` : `(()=>{const t=${target};return ${JSON.stringify(o.map((x) => x[1]))}.findIndex(v=>Math.abs(v-t)<1e-6);})()` };
}
const L = R`\lim\limits_{n \to +\infty}`;
const fig = (n, c) => `de-${String(n).padStart(2, '0')}-cau-${c}.svg`;
const imgPath = (n, c) => `../hinh/bai-15/${fig(n, c)}`;
const HEAD = (W, H) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="Times New Roman" font-size="18"><rect width="${W}" height="${H}" fill="#fff"/>`;

// ---------- Hình ----------
function tileFig(file, lab) { // H.5.2: chia 4, tô góc dưới trái, lặp ở góc trên phải
  const O = 40, S = 300; let g = HEAD(400, 380);
  let x = O, y = O, s = S;
  for (let i = 0; i < 6; i++) {
    const h = s / 2;
    g += `<rect x="${x}" y="${y + h}" width="${h}" height="${h}" fill="#f6c343" stroke="#555" stroke-width="1.2"/>`;
    g += `<rect x="${x + h}" y="${y + h}" width="${h}" height="${h}" fill="none" stroke="#555" stroke-width="1.2"/>`;
    g += `<rect x="${x}" y="${y}" width="${h}" height="${h}" fill="none" stroke="#555" stroke-width="1.2"/>`;
    x += h; s = h;
  }
  g += `<rect x="${O}" y="${O}" width="${S}" height="${S}" fill="none" stroke="#000" stroke-width="2"/>`;
  g += `<text x="${O + S / 2}" y="${O + S + 28}" text-anchor="middle">${lab}</text>`;
  writeFileSync(resolve(HINH, file), g + '</svg>\n');
}
function nestFig(file, tri, lab) {
  let g = HEAD(400, 380);
  if (!tri) {
    let P = [[60, 40], [340, 40], [340, 320], [60, 320]];
    g += `<polygon points="${P.map((p) => p.join(',')).join(' ')}" fill="#cfe3ff" stroke="#1f4fa8" stroke-width="2"/>`;
    for (let i = 0; i < 6; i++) {
      P = P.map((p, j) => { const q = P[(j + 1) % 4]; return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; });
      g += `<polygon points="${P.map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' ')}" fill="${i % 2 ? '#cfe3ff' : '#ffffff'}" stroke="#1f4fa8" stroke-width="1.6"/>`;
    }
    g += `<text x="200" y="350" text-anchor="middle">${lab}</text>`;
  } else {
    let P = [[200, 30], [360, 307], [40, 307]];
    g += `<polygon points="${P.map((p) => p.join(',')).join(' ')}" fill="#cfe3ff" stroke="#1f4fa8" stroke-width="2"/>`;
    for (let i = 0; i < 5; i++) {
      P = P.map((p, j) => { const q = P[(j + 1) % 3]; return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; });
      g += `<polygon points="${P.map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' ')}" fill="${i % 2 ? '#cfe3ff' : '#ffffff'}" stroke="#1f4fa8" stroke-width="1.6"/>`;
    }
    g += `<text x="200" y="345" text-anchor="middle">${lab}</text>`;
  }
  writeFileSync(resolve(HINH, file), g + '</svg>\n');
}

// ---------- Khuôn từng câu ----------
const T = {};
const poly = (ts) => { let s = ''; for (const [c, v] of ts) { if (c === 0) continue; const first = s === ''; s += (c < 0 ? (first ? '-' : ' - ') : (first ? '' : ' + ')) + (Math.abs(c) === 1 && v ? '' : Math.abs(c)) + v; } return s || '0'; };
// 1. Giới hạn phân thức cùng bậc (NB, bấm máy được)
T[1] = (n, idx) => {
  const a = pick([1, 2, 3, 4, 5, 6, 7, -1, -2, -3, -4, -5]), c = int(1, 7), b = int(-9, 9), d = int(-9, 9), sq = rnd() < 0.5;
  if (b === 0 || d === 0 || Math.abs(a) === c || a * d === b * c) return null;
  const num = sq ? poly([[a, 'n^2'], [b, 'n'], [1, '']]) : poly([[a, 'n'], [b, '']]), den = sq ? poly([[c, 'n^2'], [d, '']]) : poly([[c, 'n'], [d, '']]);
  const js = sq ? `(${a}*n*n+${b}*n+1)/(${c}*n*n+(${d}))` : `(${a}*n+(${b}))/(${c}*n+(${d}))`;
  const q = valQ(fopt(Q(a, c)), [fopt(Q(c, a)), fopt(Q(sq ? 1 : b, d)), ['$0$', 0]], idx, `(n=>${js})(1e10)`);
  return q && { ...q, prompt: R`$${L} \dfrac{${num}}{${den}}$ bằng`,
    explanation: R`Chia cả tử và mẫu cho $n${sq ? '^2' : ''}$: $${L} \dfrac{${num}}{${den}} = \dfrac{${a}}{${c}} = ${fr(Q(a, c))}$ (vì $\lim \frac{1}{n^k} = 0$). Phương án $${fr(Q(sq ? 1 : b, d))}$ là lấy tỉ số các hệ số tự do — sai.` };
};
// 2. Dãy có giới hạn bằng c (NB, bấm máy được)
T[2] = (n, idx) => {
  const c = int(0, 5), p = int(1, 6), qq = int(p + 1, 9); if (gcd(p, qq) !== 1) return null; const neg = rnd() < 0.4;
  const pw = (a, b, s) => (b === 1 ? `${s ? `(-${a})` : a}^n` : R`\left(${s ? '-' : ''}\dfrac{${a}}{${b}}\right)^n`);
  const cor = [c === 0 ? pw(p, qq, neg) : R`${c} + ${pw(p, qq, neg)}`, `${c}+Math.pow(${neg ? -p : p}/${qq},n)`];
  const w1 = [c === 0 ? pw(qq, p, false) : R`${c} + ${pw(qq, p, false)}`, `${c}+Math.pow(${qq}/${p},n)`];
  const w2 = [R`\dfrac{${c + 1 === 1 ? '' : c + 1}n - 1}{n}`, `(${c + 1}*n-1)/n`];
  const w3 = [R`\dfrac{${2 * c + 1 === 1 ? '' : 2 * c + 1}n}{2n + 1}`, `${2 * c + 1}*n/(2*n+1)`];
  const o = place(cor, [w1, w2, w3], idx); if (!o) return null;
  return { options: o.map((x) => `$u_n = ${x[0]}$`), answer: idx, _key: `${c}-${p}-${qq}-${neg}`,
    verify: `(()=>{const f=[${o.map((x) => `n=>${x[1]}`).join(',')}];return f.findIndex(g=>Math.abs(g(400)-${c})<1e-3);})()`,
    prompt: R`Dãy số $(u_n)$ nào sau đây có giới hạn bằng $${c}$ khi $n \to +\infty$?`,
    explanation: R`Vì $\left|${neg ? '-' : ''}\dfrac{${p}}{${qq}}\right| < 1$ nên $${pw(p, qq, neg)} \to 0$, do đó dãy $${cor[0]}$ có giới hạn $${c}$. Các dãy còn lại: $${w1[0]} \to +\infty$ (vì $\dfrac{${qq}}{${p}} > 1$); $${w2[0]} \to ${c + 1}$; $${w3[0]} \to ${fr(Q(2 * c + 1, 2))}$.` };
};
// 3. Tổng cấp số nhân lùi vô hạn (NB, bấm máy được)
T[3] = (n, idx) => {
  const u1 = int(1, 9), p = int(1, 4), t = int(p + 1, 6), s = pick([1, -1]); if (gcd(p, t) !== 1) return null;
  const q = Q(s * p, t), S = qdiv([u1, 1], qsub([1, 1], q));
  const q2 = valQ(fopt(S), [fopt(qdiv([u1, 1], qadd([1, 1], q))), fopt(qmul([u1, 1], qdiv(q, qsub([1, 1], q)))), fopt(qdiv([u1, 1], q))], idx, `${u1}/(1-(${fv(q)}))`);
  return q2 && { ...q2, prompt: R`Tổng của cấp số nhân lùi vô hạn $(u_n)$ có $u_1 = ${u1}$ và công bội $q = ${fr(q)}$ bằng`,
    explanation: R`$S = \dfrac{u_1}{1 - q} = \dfrac{${u1}}{1 - ${par(fr(q))}} = ${fr(S)}$. Phương án $${fr(qdiv([u1, 1], qadd([1, 1], q)))}$ dùng nhầm $1 + q$ ở mẫu.` };
};
// 4. Phép toán giới hạn với dữ kiện ẩn
T[4] = (n, idx) => {
  const a = int(-6, 9), b = int(-6, 9), p = int(2, 5), r = int(1, 4); if (a === 0 || b === 0 || a === b) return null;
  const cor = p * a - r * b, w = [p * a + r * b, a - b, p * (a - r * b)];
  const o = place([`$${cor}$`, cor], w.map((x) => [`$${x}$`, x]), idx); if (!o) return null;
  return { options: o.map((x) => x[0]), answer: idx, verify: `(()=>{const u=n=>${a}+1/n,v=n=>${b}-2/n,N=1e8;return Math.round(${p}*u(N)-${r}*v(N));})()`,
    prompt: R`Cho hai dãy số $(u_n)$, $(v_n)$ thỏa mãn $${L} u_n = ${a}$ và $${L} v_n = ${b}$. Giá trị của $${L} \left(${p}u_n - ${r === 1 ? '' : r}v_n\right)$ là`,
    explanation: R`Theo quy tắc tính giới hạn: $\lim(${p}u_n - ${r === 1 ? '' : r}v_n) = ${p}\lim u_n - ${r}\lim v_n = ${p} \cdot ${par(a)} - ${r} \cdot ${par(b)} = ${cor}$.` };
};
// 5. Quy tắc giới hạn vô cực (trừu tượng)
T[5] = (n, idx) => {
  const v = int(0, 2), a = int(1, 9), s = v === 0 ? pick([1, -1]) : 1;
  const opts = { z: ['$0$', 'z'], pi: [R`$+\infty$`, 'pi'], mi: [R`$-\infty$`, 'mi'], a: [`$${s * a}$`, 'a'] };
  let cor, pr, expl, js;
  if (v === 0) { cor = opts.z; pr = R`$${L} u_n = ${s * a}$ và $${L} v_n = +\infty$. Khi đó $${L} \dfrac{u_n}{v_n}$ bằng`; expl = R`Theo quy tắc: nếu $\lim u_n = a$ và $\lim v_n = +\infty$ thì $\lim \dfrac{u_n}{v_n} = 0$.`; js = `(${s * a}+1/N)/N`; }
  else if (v === 1) { cor = opts.pi; pr = R`$${L} u_n = ${a}$, $v_n > 0$ với mọi $n$ và $${L} v_n = 0$. Khi đó $${L} \dfrac{u_n}{v_n}$ bằng`; expl = R`Theo quy tắc: nếu $\lim u_n = a > 0$, $\lim v_n = 0$ và $v_n > 0$ với mọi $n$ thì $\lim \dfrac{u_n}{v_n} = +\infty$.`; js = `(${a}+1/N)/(1/N)`; }
  else { cor = opts.pi; pr = R`$${L} u_n = +\infty$ và $${L} v_n = ${a}$. Khi đó $${L} (u_n v_n)$ bằng`; expl = R`Theo quy tắc: nếu $\lim u_n = +\infty$ và $\lim v_n = a > 0$ thì $\lim u_n v_n = +\infty$.`; js = `N*(${a}+1/N)`; }
  const w = Object.values(opts).filter((x) => x !== cor);
  const o = place(cor, w, idx); if (!o) return null;
  return { options: o.map((x) => x[0]), answer: idx, _key: `${v}${s}${a}`,
    verify: v === 0 ? `(()=>{const N=1e9,x=${js};return Math.round(x*1e3)/1e3+0;})()` : `(()=>{const N=1e9,x=${js};const k=Math.abs(x)>1e6?(x>0?'pi':'mi'):Math.abs(x)<1e-6?'z':'a';return ${JSON.stringify(o.map((x) => x[1]))}.indexOf(k);})()`,
    prompt: R`Cho hai dãy số $(u_n)$, $(v_n)$ với ${pr}`, explanation: expl + (v === 0 ? '' : R` Phương án $${s * a}$ là nhầm với giới hạn của $(u_n)$ hoặc $(v_n)$.`) };
};
// 6. Nguyên lí |u_n − c| ≤ v_n → 0
T[6] = (n, idx) => {
  const c = int(-5, 8), k = int(2, 9), f = pick(['n', 'n^2', '2^n', R`\sqrt{n}`]); if (c === 0 || c === k || c === -k) return null;
  const o = place([`$${c}$`, c], [[`$${c + k}$`, c + k], [`$${k}$`, k], ['$0$', 0]], idx); if (!o) return null;
  const fj = { n: 'n', 'n^2': 'n*n', '2^n': '2**n', [R`\sqrt{n}`]: 'Math.sqrt(n)' }[f];
  return { options: o.map((x) => x[0]), answer: idx, verify: `(()=>{const n=1e4;const u=${c}+${k}/(2*${fj});return Math.round(u);})()`,
    prompt: R`Cho dãy số $(u_n)$ thỏa mãn $|u_n ${sgn(-c)}| \le \dfrac{${k}}{${f}}$ với mọi $n \ge 1$. Giá trị của $${L} u_n$ là`,
    explanation: R`Vì $\lim \dfrac{${k}}{${f}} = 0$ và $|u_n ${sgn(-c)}| \le \dfrac{${k}}{${f}}$ nên $\lim (u_n ${sgn(-c)}) = 0$, tức $\lim u_n = ${c}$. Phương án $${c + k}$ hay $${k}$ là lấy nhầm số $${k}$ ở tử.` };
};
// 7. Tìm tham số a để giới hạn phân thức bằng L
T[7] = (n, idx) => {
  const c = int(1, 6), Lm = pick([1, 2, 3, 4, -1, -2, -3]), b = int(-7, 7), d = int(1, 9); if (b === 0) return null;
  const a = Lm * c;
  const o = place([`$${a}$`, a], [[`$${fr(Q(Lm, c))}$`, Lm / c], [`$${Lm + c}$`, Lm + c], [`$${Lm * d}$`, Lm * d]], idx); if (!o) return null;
  if (new Set(o.map((x) => x[1])).size < 4) return null;
  return { options: o.map((x) => x[0]), answer: idx, verify: `(()=>{let r=null;for(let a=-60;a<=60;a++){if(Math.abs(a/${c}-(${Lm}))<1e-12)r=a;}return r;})()`,
    prompt: R`Biết $${L} \dfrac{an^2 ${b < 0 ? '-' : '+'} ${Math.abs(b) === 1 ? '' : Math.abs(b)}n + 1}{${c === 1 ? '' : c}n^2 - ${d}} = ${Lm}$ với $a$ là hằng số. Giá trị của $a$ là`,
    explanation: R`Chia cả tử và mẫu cho $n^2$: giới hạn bằng $\dfrac{a}{${c}}$. Do đó $\dfrac{a}{${c}} = ${Lm}$, suy ra $a = ${a}$. Phương án $${Lm * d}$ là chia nhầm cho hệ số tự do của mẫu.` };
};
// 8. Tìm a: lim √(an²+b)/(cn+d) = L
T[8] = (n, idx) => {
  const Lm = int(1, 4), c = int(1, 4), b = int(1, 9), d = int(-5, 5); if (d === 0) return null;
  const a = (Lm * c) ** 2;
  const o = place([`$${a}$`, a], [[`$${Lm * c}$`, Lm * c], [`$${Lm * Lm * c}$`, Lm * Lm * c], [`$${Lm * c * c}$`, Lm * c * c]], idx); if (!o) return null;
  if (new Set(o.map((x) => x[1])).size < 4) return null;
  return { options: o.map((x) => x[0]), answer: idx, verify: `(()=>{let r=null;for(let a=1;a<=300;a++){const N=1e8;if(Math.abs(Math.sqrt(a*N*N+${b})/(${c}*N+(${d}))-${Lm})<1e-6)r=a;}return r;})()`,
    prompt: R`Biết $${L} \dfrac{\sqrt{an^2 + ${b}}}{${c === 1 ? '' : c}n ${sgn(d)}} = ${Lm}$ với $a > 0$. Giá trị của $a$ là`,
    explanation: R`Chia tử và mẫu cho $n$ ($n > 0$): $\dfrac{\sqrt{a + \frac{${b}}{n^2}}}{${c} ${d < 0 ? '-' : '+'} \frac{${Math.abs(d)}}{n}} \to \dfrac{\sqrt a}{${c}}$. Do đó $\sqrt a = ${Lm * c}$, $a = ${a}$. Phương án $${Lm * c}$ quên bình phương.` };
};
// 9. Thực tế: quả bóng nảy — tổng quãng đường
const BALL = ['quả bóng cao su', 'quả bóng tennis', 'quả bóng bàn', 'quả bóng rổ'];
T[9] = (n, idx) => {
  const p = int(1, 4), qq = int(p + 1, 5); if (gcd(p, qq) !== 1) return null;
  const h = (qq - p) * int(1, 6), ob = pick(BALL); if (h < 2 || h > 12) return null;
  const tot = h * (qq + p) / (qq - p), w = [h * qq / (qq - p), 2 * h * qq / (qq - p), h * p / (qq - p)];
  const o = place([`$${tot}$ m`, tot], w.map((x) => [`$${x}$ m`, x]), idx); if (!o) return null;
  return { options: o.map((x) => x[0]), answer: idx, _key: ob, _core: `${h}-${p}-${qq}`,
    verify: `(()=>{let s=${h},x=${h};for(let i=0;i<3000;i++){x*=${p}/${qq};s+=2*x;}return ${JSON.stringify(o.map((x) => x[1]))}.findIndex(v=>Math.abs(v-s)<1e-6);})()`,
    prompt: R`Một ${ob} được thả rơi từ độ cao $${h}$ m xuống mặt sàn. Sau mỗi lần chạm sàn, quả bóng nảy lên độ cao bằng $\dfrac{${p}}{${qq}}$ độ cao trước đó. Giả sử quả bóng luôn chuyển động vuông góc với mặt sàn và quá trình này tiếp diễn vô hạn lần. Tổng quãng đường quả bóng di chuyển là`,
    explanation: R`Quãng đường gồm lần rơi đầu $${h}$ m và mỗi lần nảy đi lên rồi rơi xuống cùng một độ cao. Các độ cao nảy lập thành cấp số nhân lùi vô hạn $u_1 = ${fr(Q(h * p, qq))}$, $q = \dfrac{${p}}{${qq}}$, tổng $\dfrac{u_1}{1-q} = ${fr(Q(h * p, qq - p))}$. Tổng quãng đường: $${h} + 2 \cdot ${fr(Q(h * p, qq - p))} = ${tot}$ (m). Phương án $${w[0]}$ m chỉ tính một chiều.` };
};
// 10. Tìm công bội từ u1 và tổng S
T[10] = (n, idx) => {
  const p = int(1, 4), t = int(p + 1, 6), s = pick([1, -1]); if (gcd(p, t) !== 1) return null;
  const q = Q(s * p, t), u1 = int(1, 9), S = qdiv([u1, 1], qsub([1, 1], q));
  const q2 = valQ(fopt(q), [fopt(Q(-s * p, t)), fopt(qdiv([u1, 1], S)), fopt(Q(t, s * p))], idx, `1-${u1}/(${fv(S)})`);
  return q2 && { ...q2, prompt: R`Cho cấp số nhân lùi vô hạn $(u_n)$ có $u_1 = ${u1}$ và tổng các số hạng $S = ${fr(S)}$. Công bội $q$ của cấp số nhân đó là`,
    explanation: R`Từ $S = \dfrac{u_1}{1 - q}$ suy ra $1 - q = \dfrac{u_1}{S} = ${u1} : ${par(fr(S))} = ${fr(qdiv([u1, 1], S))}$, nên $q = 1 - ${par(fr(qdiv([u1, 1], S)))} = ${fr(q)}$. Phương án $${fr(qdiv([u1, 1], S))}$ là giá trị của $1 - q$, chưa tính $q$.` };
};
// 11. Tìm a: lim(√(n² + an + b) − n) = L
T[11] = (n, idx) => {
  const Lm = pick([1, 2, 3, 4, 5, -1, -2, -3, -4]), b = int(1, 9);
  const a = 2 * Lm;
  const o = place([`$${a}$`, a], [[`$${Lm}$`, Lm], [`$${fr(Q(Lm, 2))}$`, Lm / 2], [`$${4 * Lm}$`, 4 * Lm]], idx); if (!o) return null;
  return { options: o.map((x) => x[0]), answer: idx, _key: `${b}`, verify: `(()=>{let r=null;for(let a=-30;a<=30;a++){const N=1e9;const v=(a*N+${b})/(Math.sqrt(N*N+a*N+${b})+N);if(Math.abs(v-(${Lm}))<1e-6)r=a;}return r;})()`,
    prompt: R`Biết $${L} \left(\sqrt{n^2 + an + ${b}} - n\right) = ${Lm}$ với $a$ là hằng số. Giá trị của $a$ là`,
    explanation: R`Nhân và chia với biểu thức liên hợp: $\sqrt{n^2 + an + ${b}} - n = \dfrac{an + ${b}}{\sqrt{n^2 + an + ${b}} + n} = \dfrac{a + \frac{${b}}{n}}{\sqrt{1 + \frac{a}{n} + \frac{${b}}{n^2}} + 1} \to \dfrac{a}{2}$. Do đó $\dfrac a2 = ${Lm}$, $a = ${a}$. Phương án $${Lm}$ quên chia cho $2$.` };
};
// 12. Thực tế: lượng thuốc trong cơ thể sau thời gian dài
T[12] = (n, idx) => {
  const r = pick([10, 20, 25, 40, 50]), Lm = pick([100, 150, 200, 250, 300, 400, 500]), D = Lm * (100 - r) / 100; if (!Number.isInteger(D)) return null;
  const med = pick(['viên thuốc', 'liều thuốc']);
  const w = [D * (100 + r) / 100, D, Lm * (100 + r) / 100];
  const o = place([`$${Lm}$ mg`, Lm], w.map((x) => [`$${vn(x)}$ mg`, x]), idx); if (!o) return null;
  if (new Set(o.map((x) => x[1])).size < 4) return null;
  return { options: o.map((x) => x[0]), answer: idx, _key: med, _core: `${D}-${r}`,
    verify: `(()=>{let x=0;for(let i=0;i<500;i++)x=x*${r / 100}+${D};return ${JSON.stringify(o.map((x) => x[1]))}.findIndex(v=>Math.abs(v-x)<1e-6);})()`,
    prompt: R`Một bệnh nhân hằng ngày phải uống một ${med} $${D}$ mg. Sau ngày đầu, trước mỗi lần uống, lượng thuốc cũ trong cơ thể vẫn còn $${r}\%$. Nếu bệnh nhân dùng thuốc trong một thời gian dài thì lượng thuốc có trong cơ thể ngay sau khi uống thuốc ước tính là`,
    explanation: R`Ngay sau lần uống thứ $n$, lượng thuốc là $${D} + ${D} \cdot ${vn(r / 100)} + ${D} \cdot ${vn(r / 100)}^2 + \dots + ${D} \cdot ${vn(r / 100)}^{n-1}$. Khi $n \to +\infty$ đây là tổng cấp số nhân lùi vô hạn $u_1 = ${D}$, $q = ${vn(r / 100)}$: $\dfrac{${D}}{1 - ${vn(r / 100)}} = ${Lm}$ (mg). Phương án $${vn(w[0])}$ mg chỉ tính hai lần uống.` };
};
// 13. Đúng/Sai: cấp số nhân lùi vô hạn (NB)
T[13] = (n, pat) => {
  const c = int(1, 9), p = int(1, 4), t = int(p + 1, 6); if (gcd(p, t) !== 1) return null;
  const q = Q(p, t), S = qdiv([c, 1], qsub([1, 1], q)), Sf = qdiv([c, 1], qadd([1, 1], q)), u12 = qadd([c, 1], qmul([c, 1], q)), u12f = qadd([c, 1], qmul([c, 1], Q(t, p)));
  const qs = (x) => (x[1] === 1 ? `${x[0]}` : R`\dfrac{${x[0]}}{${x[1]}}`);
  return { answer: pat, _core: `${c}-${p}-${t}`,
    options: [pat[0] ? R`a) $${L} u_n = 0$.` : R`a) $${L} u_n = ${c}$.`,
      pat[1] ? R`b) $(u_n)$ là cấp số nhân lùi vô hạn với công bội $${qs(q)}$.` : R`b) $(u_n)$ là cấp số nhân lùi vô hạn với công bội $${qs(Q(t, p))}$.`,
      R`c) $u_1 + u_2 = ${fr(pat[2] ? u12 : u12f)}$.`,
      R`d) Tổng $S = u_1 + u_2 + \dots + u_n + \dots = ${fr(pat[3] ? S : Sf)}$.`],
    verify: `(()=>{const u=k=>${c}*Math.pow(${p}/${t},k-1);let s=0;for(let k=1;k<4000;k++)s+=u(k);return [${pat[0] ? 'Math.abs(u(4000))<1e-9' : `Math.abs(u(4000)-${c})<1e-9`}, ${pat[1]}, Math.abs(u(1)+u(2)-${fv(pat[2] ? u12 : u12f)})<1e-9, Math.abs(s-${fv(pat[3] ? S : Sf)})<1e-9];})()`,
    prompt: R`Cho dãy số $(u_n)$ với $u_n = ${c === 1 ? '' : c}\left(${qs(q)}\right)^{n-1}$. Xét tính đúng, sai của các khẳng định sau.`,
    explanation: R`a) ${TF(pat[0])}. Vì $0 < ${qs(q)} < 1$ nên $\left(${qs(q)}\right)^{n-1} \to 0$, do đó $\lim u_n = 0$. b) ${TF(pat[1])}. $\dfrac{u_{n+1}}{u_n} = ${qs(q)}$ và $|${qs(q)}| < 1$ nên $(u_n)$ là cấp số nhân lùi vô hạn, công bội $${qs(q)}$. c) ${TF(pat[2])}. $u_1 + u_2 = ${c} + ${c} \cdot ${qs(q)} = ${fr(u12)}$. d) ${TF(pat[3])}. $S = \dfrac{u_1}{1 - q} = \dfrac{${c}}{1 - ${qs(q)}} = ${fr(S)}$.` };
};
// 14. Đúng/Sai: phép toán giới hạn với dữ kiện ẩn (TH)
T[14] = (n, pat) => {
  const a = int(1, 8), b = int(1, 9), k = int(1, 4); if (a === b) return null;
  const m2 = a + k * b, m = Math.sqrt(m2); if (!Number.isInteger(m)) return null;
  const aV = pat[0] ? a + b : a * b; if (!pat[0] && a * b === a + b) return null;
  const bV = pat[1] ? Q(a * a, b - a) : Q(a, b - a); if (!pat[1] && fv(bV) === a * a / (b - a)) return null;
  const cV = pat[2] ? m : m2;
  const dV = pat[3] ? Q(2 * a - b, a + b) : Q(2 * a - b, a - b); if (!pat[3] && Math.abs(fv(dV) - (2 * a - b) / (a + b)) < 1e-12) return null;
  return { answer: pat, _core: `${a}-${b}`,
    options: [R`a) $${L} (u_n + v_n) = ${aV}$.`, R`b) $${L} \dfrac{u_n^2}{v_n - u_n} = ${fr(bV)}$.`, R`c) $${L} \sqrt{u_n + ${k === 1 ? '' : k}v_n} = ${cV}$.`, R`d) $${L} \dfrac{2u_n - v_n}{u_n + v_n} = ${fr(dV)}$.`],
    verify: `(()=>{const N=1e7,u=${a}+1/N,v=${b}+2/N,e=(x,y)=>Math.abs(x-y)<1e-5;return [e(u+v,${aV}), e(u*u/(v-u),${fv(bV)}), e(Math.sqrt(u+${k}*v),${cV}), e((2*u-v)/(u+v),${fv(dV)})];})()`,
    prompt: R`Cho hai dãy số không âm $(u_n)$ và $(v_n)$ với $${L} u_n = ${a}$ và $${L} v_n = ${b}$. Xét tính đúng, sai của các khẳng định sau.`,
    explanation: R`a) ${TF(pat[0])}. $\lim(u_n + v_n) = ${a} + ${b} = ${a + b}$. b) ${TF(pat[1])}. $\lim \dfrac{u_n^2}{v_n - u_n} = \dfrac{${a}^2}{${b} - ${a}} = ${fr(Q(a * a, b - a))}$. c) ${TF(pat[2])}. $u_n + ${k}v_n \ge 0$ và $\lim(u_n + ${k}v_n) = ${a} + ${k} \cdot ${b} = ${m2}$ nên $\lim\sqrt{u_n + ${k}v_n} = \sqrt{${m2}} = ${m}$. d) ${TF(pat[3])}. $\lim \dfrac{2u_n - v_n}{u_n + v_n} = \dfrac{2 \cdot ${a} - ${b}}{${a} + ${b}} = ${fr(Q(2 * a - b, a + b))}$.` };
};
// 15. Đúng/Sai: nghịch lí Zeno (VD, thực tế)
T[15] = (n, pat) => {
  const v2 = int(1, 5), k = pick([5, 10, 20, 25]), x = pick([0.25, 0.5, 1, 1.5, 2]), v1 = k * v2, d = v2 * (k - 1) * x;
  if (v1 > 100 || !Number.isInteger(d * 4)) return null;
  const t1 = d / v1, t2 = t1 / k, dist = v1 * x;
  const aV = pat[0] ? t1 : d / v2, bV = pat[1] ? t2 : t1 * (k - 1) / k, cV = pat[2] ? dist : d, dV = pat[3] ? x : x * (k + 1) / k;
  const digits = (v) => { const t = String(Math.round(v * 1e6) / 1e6); return (t.startsWith('0.') ? t.slice(2) : t.replace('.', '')).length; };
  if ([t1, t2, aV, bV, cV, dV, d, dist].some((v) => digits(v) > 4)) return null;
  if ([[aV, t1], [bV, t2], [cV, dist], [dV, x]].some(([u, w], i) => !pat[i] && Math.abs(u - w) < 1e-12)) return null;
  return { answer: pat, _core: `${v1}-${v2}-${d}`,
    options: [R`a) $t_1 = ${vn(aV)}$ giờ.`, R`b) $t_2 = ${vn(bV)}$ giờ.`, R`c) Từ lúc xuất phát đến khi đuổi kịp rùa, Achilles chạy được quãng đường $${vn(cV)}$ km.`, R`d) Tổng $t_1 + t_2 + \dots + t_n + \dots = ${vn(dV)}$ giờ, tức là Achilles đuổi kịp rùa sau $${vn(dV)}$ giờ.`],
    verify: `(()=>{const e=(p,q)=>Math.abs(p-q)<1e-9;let s=0,t=${d}/${v1};const t1=t;for(let i=0;i<500;i++){s+=t;t*=${v2}/${v1};}return [e(t1,${aV}), e(t1*${v2}/${v1},${bV}), e(${v1}*s,${cV}), e(s,${dV})];})()`,
    prompt: R`(Nghịch lí Zeno) Achilles đuổi theo một con rùa trên một đường thẳng. Achilles chạy với vận tốc $${v1}$ km/h, rùa bò với vận tốc $${v2}$ km/h, lúc đầu rùa ở phía trước Achilles $${vn(d)}$ km. Gọi $t_1$ là thời gian Achilles chạy đến vị trí xuất phát của rùa, $t_2$ là thời gian Achilles chạy tiếp đến vị trí rùa có mặt sau thời gian $t_1$, cứ tiếp tục như vậy. Xét tính đúng, sai của các khẳng định sau.`,
    explanation: R`a) ${TF(pat[0])}. $t_1 = \dfrac{${vn(d)}}{${v1}} = ${vn(t1)}$ (giờ). b) ${TF(pat[1])}. Trong thời gian $t_1$ rùa bò thêm $${v2}t_1$ km, nên $t_2 = \dfrac{${v2}t_1}{${v1}} = \dfrac{t_1}{${k}} = ${vn(t2)}$ (giờ). c) ${TF(pat[2])}. $(t_n)$ là cấp số nhân lùi vô hạn, $q = \dfrac{1}{${k}}$, tổng thời gian $\dfrac{t_1}{1 - q} = ${vn(x)}$ giờ; quãng đường Achilles chạy: $${v1} \cdot ${vn(x)} = ${vn(dist)}$ (km). d) ${TF(pat[3])}. Tổng $t_1 + t_2 + \dots = \dfrac{${vn(t1)}}{1 - \frac{1}{${k}}} = ${vn(x)}$ (giờ): Achilles đuổi kịp rùa sau $${vn(x)}$ giờ, nên lập luận của Zeno là sai.` };
};
// 16. Đúng/Sai: hình vuông tô màu (H.5.2) (TH)
T[16] = (n, pat) => {
  const Lc = 3 * int(1, 10), u = pick(['cm', 'dm']);
  const aV = pat[0] ? Q(Lc, 2) : Q(Lc, 4), bV = pat[1] ? Q(1, 2) : Q(1, 4), cV = pat[2] ? Lc : 2 * Lc, dV = pat[3] ? Q(Lc * Lc, 3) : Q(Lc * Lc, 4);
  const file = fig(n, '16');
  return { answer: pat, image: imgPath(n, '16'), _fig: () => tileFig(file, `${Lc} ${u}`), _key: `${Lc}${u}`, _core: `${Lc}${u}`,
    options: [R`a) $u_1 = ${fr(aV)}$ ${u}.`, R`b) $(u_n)$ là cấp số nhân với công bội $${fr(bV)}$.`, R`c) Tổng độ dài cạnh của tất cả các hình vuông được tô màu bằng $${cV}$ ${u}.`, R`d) Tổng diện tích của tất cả các hình vuông được tô màu bằng $${fr(dV)}$ ${u}².`],
    verify: `(()=>{const e=(p,q)=>Math.abs(p-q)<1e-9;let s=0,a=0,x=${Lc}/2;const u1=x;for(let i=0;i<200;i++){s+=x;a+=x*x;x/=2;}return [e(u1,${fv(aV)}), e(0.5,${fv(bV)}), e(s,${cV}), e(a,${fv(dV)})];})()`,
    prompt: R`Cho hình vuông cạnh $${Lc}$ ${u}. Chia hình vuông đó thành bốn hình vuông nhỏ bằng nhau rồi tô màu hình vuông nhỏ ở góc dưới bên trái; lặp lại thao tác này với hình vuông nhỏ ở góc trên bên phải, và cứ tiếp tục vô hạn lần (như hình bên). Gọi $u_1, u_2, \dots, u_n, \dots$ lần lượt là độ dài cạnh của các hình vuông được tô màu. Xét tính đúng, sai của các khẳng định sau.`,
    explanation: R`a) ${TF(pat[0])}. $u_1 = \dfrac{${Lc}}{2} = ${fr(Q(Lc, 2))}$ (${u}). b) ${TF(pat[1])}. Mỗi lần chia, cạnh giảm một nửa nên $(u_n)$ là cấp số nhân, công bội $\dfrac12$. c) ${TF(pat[2])}. Tổng các cạnh $\dfrac{u_1}{1 - \frac12} = ${Lc}$ (${u}). d) ${TF(pat[3])}. Diện tích các hình tô màu $u_n^2$ lập thành cấp số nhân với $u_1^2 = ${fr(Q(Lc * Lc, 4))}$, công bội $\dfrac14$; tổng là $\dfrac{${fr(Q(Lc * Lc, 4))}}{1 - \frac14} = ${fr(Q(Lc * Lc, 3))}$ (${u}²).` };
};
// 17. lim(u_n v_n − √u_n) với dữ kiện ẩn
T[17] = (n) => {
  const r = int(1, 6), a = r * r, b = pick([-5, -4, -3, -2, 2, 3, 4, 5, 6, 7]), m = int(1, 4);
  const ans = a * b - m * r;
  return { answer: [String(ans)], verify: `(()=>{const N=1e8,u=${a}+1/N,v=${b}+1/N;return Math.round(u*v-${m}*Math.sqrt(u));})()`,
    prompt: R`Cho dãy số không âm $(u_n)$ và dãy số $(v_n)$ thỏa mãn $${L} u_n = ${a}$, $${L} v_n = ${b}$. Tính $${L} \left(u_n v_n - ${m === 1 ? '' : m}\sqrt{u_n}\right)$.`,
    explanation: R`$\lim(u_nv_n) = ${a} \cdot ${par(b)} = ${a * b}$; vì $u_n \ge 0$ nên $\lim\sqrt{u_n} = \sqrt{${a}} = ${r}$. Do đó giới hạn cần tìm bằng $${a * b} - ${m} \cdot ${r} = ${ans}$.` };
};
// 18. Số hạng đầu tiên có |u_n| < ε
T[18] = (n) => {
  const k = int(2, 9), e = pick([100, 1000]), v = rnd() < 0.5;
  const ans = v ? Math.floor(e / k) + 1 : k * e + 1; if (ans > 9999) return null;
  const E = e === 100 ? '0{,}01' : '0{,}001';
  const U = v ? R`\dfrac{(-1)^n}{${k}n}` : R`\dfrac{${k}}{n}`;
  return { answer: [String(ans)], verify: `(()=>{for(let n=1;n<20000;n++){if(Math.abs(${v ? `1/(${k}*n)` : `${k}/n`})<1/${e})return n;}})()`,
    prompt: R`Cho dãy số $(u_n)$ với $u_n = ${U}$. Kể từ số hạng thứ $N$ trở đi thì $|u_n| < ${E}$, trong đó $N$ là số nguyên dương nhỏ nhất có tính chất đó. Tìm $N$.`,
    explanation: v ? R`$|u_n| = \dfrac{1}{${k}n} < ${E}$ ⇔ $${k}n > ${e}$ ⇔ $n > \dfrac{${e}}{${k}} \approx ${vn(Math.round(e / k * 100) / 100)}$. Số nguyên dương nhỏ nhất là $N = ${ans}$.`
      : R`$|u_n| = \dfrac{${k}}{n} < ${E}$ ⇔ $n > ${k * e}$. Số nguyên dương nhỏ nhất là $N = ${ans}$.` };
};
// 19. Thực tế: vi khuẩn tăng gấp đôi — giới hạn vô cực
T[19] = (n) => {
  const N0 = pick([20, 25, 30, 40, 50, 60, 75, 100]), Tc = int(2, 6), X = pick([2000, 3000, 5000, 6000, 8000, 9000]);
  let m = 0; while (N0 * 2 ** m <= X) m++;
  const ans = m * Tc, kind = pick(['Một loại vi khuẩn', 'Một chủng vi khuẩn', 'Một loại tảo đơn bào']);
  return { answer: [String(ans)], _key: kind, verify: `(()=>{let t=0,x=${N0};while(x<=${X}){x*=2;t+=${Tc};}return t;})()`,
    prompt: R`${kind} được nuôi cấy với số lượng ban đầu là $${N0}$ cá thể. Sau mỗi chu kì $${Tc}$ giờ, số lượng của chúng tăng gấp đôi. Gọi $u_n$ là số cá thể sau chu kì thứ $n$ (khi đó $${L} u_n = +\infty$). Hỏi sau ít nhất bao nhiêu giờ thì số cá thể vượt quá $${X}$?`,
    explanation: R`$u_n = ${N0} \cdot 2^n$. Cần $${N0} \cdot 2^n > ${X}$ ⇔ $2^n > ${vn(X / N0)}$. Vì $2^{${m - 1}} = ${2 ** (m - 1)}$, $2^{${m}} = ${2 ** m}$ nên $n$ nhỏ nhất là $${m}$, tức sau $${m} \cdot ${Tc} = ${ans}$ giờ.` };
};
// 20. Tìm a: lim (a·bⁿ + cⁿ)/(b^{n+1} − 1) = L
T[20] = (n) => {
  const b = pick([3, 4, 5]), c = int(1, b - 1), Lm = pick([1, 2, 3, 4, 5, -1, -2, -3]), one = int(1, 7);
  const a = b * Lm;
  return { answer: [String(a)], verify: `(()=>{let r=null;for(let a=-60;a<=60;a++){const N=200,v=(a+Math.pow(${c}/${b},N))/(${b}-${one}/Math.pow(${b},N));if(Math.abs(v-(${Lm}))<1e-9)r=a;}return r;})()`,
    prompt: R`Biết $${L} \dfrac{a \cdot ${b}^n + ${c === 1 ? '1' : `${c}^n`}}{${b}^{n+1} - ${one}} = ${Lm}$ với $a$ là hằng số. Tìm $a$.`,
    explanation: R`Chia tử và mẫu cho $${b}^n$: $\dfrac{a + ${c === 1 ? R`\left(\frac{1}{${b}}\right)^n` : R`\left(\frac{${c}}{${b}}\right)^n`}}{${b} - \frac{${one}}{${b}^n}} \to \dfrac{a}{${b}}$ (vì $\left|\frac{${c}}{${b}}\right| < 1$). Do đó $\dfrac{a}{${b}} = ${Lm}$, $a = ${a}$.` };
};
// 21. Thực tế: hoa văn lồng nhau — tổng diện tích (hình)
T[21] = (n) => {
  const tri = rnd() < 0.5, who = pick(['Một họa sĩ', 'Một kiến trúc sư', 'Một nhà thiết kế', 'Một người thợ lát gạch']);
  if (!tri) {
    const a = int(2, 20), ans = 2 * a * a; if (ans > 9999) return null;
    return { answer: [String(ans)], image: imgPath(n, '21'), _fig: () => nestFig(fig(n, '21'), false, `cạnh hình vuông lớn nhất: ${a} dm`), _key: who,
      verify: `(()=>{let s=0,x=${a * a};for(let i=0;i<300;i++){s+=x;x/=2;}return Math.round(s*1e6)/1e6;})()`,
      prompt: R`${who} vẽ một hoa văn như sau: vẽ hình vuông cạnh $${a}$ dm; nối trung điểm các cạnh của nó được hình vuông thứ hai; nối trung điểm các cạnh của hình vuông thứ hai được hình vuông thứ ba, và cứ tiếp tục vô hạn lần (như hình bên). Tính tổng diện tích của tất cả các hình vuông đó (đơn vị: dm²).`,
      explanation: R`Hình vuông mới có cạnh bằng $\dfrac{\sqrt2}{2}$ cạnh hình vuông trước nên diện tích bằng $\dfrac12$ diện tích hình trước. Các diện tích lập thành cấp số nhân lùi vô hạn $u_1 = ${a * a}$, $q = \dfrac12$; tổng $\dfrac{${a * a}}{1 - \frac12} = ${ans}$ (dm²).` };
  }
  const A = 3 * int(1, 30), ans = 4 * A / 3;
  return { answer: [String(ans)], image: imgPath(n, '21'), _fig: () => nestFig(fig(n, '21'), true, `diện tích tam giác lớn nhất: ${A} cm²`), _key: who,
    verify: `(()=>{let s=0,x=${A};for(let i=0;i<300;i++){s+=x;x/=4;}return Math.round(s*1e6)/1e6;})()`,
    prompt: R`${who} vẽ một hoa văn như sau: vẽ tam giác đều có diện tích $${A}$ cm²; nối trung điểm các cạnh của nó được tam giác thứ hai; nối trung điểm các cạnh của tam giác thứ hai được tam giác thứ ba, và cứ tiếp tục vô hạn lần (như hình bên). Tính tổng diện tích của tất cả các tam giác đó (đơn vị: cm²).`,
    explanation: R`Tam giác mới có cạnh bằng một nửa cạnh tam giác trước (đường trung bình) nên diện tích bằng $\dfrac14$ diện tích tam giác trước. Các diện tích lập thành cấp số nhân lùi vô hạn $u_1 = ${A}$, $q = \dfrac14$; tổng $\dfrac{${A}}{1 - \frac14} = ${ans}$ (cm²).` };
};
// 22. Thực tế: bóng nảy — lần nảy đầu tiên thấp hơn mức cho trước
T[22] = (n) => {
  const h = pick([2, 3, 4, 5, 6, 8, 10]), [p, qq] = pick([[1, 2], [2, 3], [3, 4], [3, 5], [4, 5]]), X = pick([10, 20, 30, 50]), ob = pick(BALL);
  let m = 0, x = h * 100; while (x >= X) { x = x * p / qq; m++; }
  if (m < 3 || m > 30) return null;
  return { answer: [String(m)], _key: ob, verify: `(()=>{let k=0,x=${h * 100};while(x>=${X}){x=x*${p}/${qq};k++;}return k;})()`,
    prompt: R`Một ${ob} được thả rơi từ độ cao $${h}$ m xuống mặt sàn. Sau mỗi lần chạm sàn, quả bóng nảy lên độ cao bằng $\dfrac{${p}}{${qq}}$ độ cao trước đó. Gọi $u_n$ là độ cao (m) quả bóng đạt được sau lần nảy thứ $n$ (khi đó $${L} u_n = 0$). Hỏi bắt đầu từ lần nảy thứ mấy thì quả bóng nảy lên thấp hơn $${X}$ cm?`,
    explanation: R`$(u_n)$ là cấp số nhân với $u_1 = ${h} \cdot \dfrac{${p}}{${qq}}$, công bội $\dfrac{${p}}{${qq}}$, nên $u_n = ${h} \cdot \left(\dfrac{${p}}{${qq}}\right)^n$ (m). Cần $${h} \cdot \left(\dfrac{${p}}{${qq}}\right)^n < ${vn(X / 100)}$. Tính lần lượt: $u_{${m - 1}} \approx ${vn(Math.round(h * (p / qq) ** (m - 1) * 1000) / 1000)}$ m $\ge ${vn(X / 100)}$ m, $u_{${m}} \approx ${vn(Math.round(h * (p / qq) ** m * 1000) / 1000)}$ m $< ${vn(X / 100)}$ m. Vậy từ lần nảy thứ $${m}$.` };
};

// ---------- Thông tin câu ----------
const META = [ // [kind, muc, thuc_te, bam_may]
  ['mcq', 'NB', false, true], ['mcq', 'NB', false, true], ['mcq', 'NB', false, true], ['mcq', 'NB', false, false], ['mcq', 'NB', false, false], ['mcq', 'NB', false, false],
  ['mcq', 'TH', false, false], ['mcq', 'TH', false, false], ['mcq', 'TH', true, false], ['mcq', 'VD', false, false], ['mcq', 'VD', false, false], ['mcq', 'VD', true, false],
  ['tf', 'NB', false, false], ['tf', 'TH', false, false], ['tf', 'VD', true, false], ['tf', 'TH', false, false],
  ['short', 'NB', false, false], ['short', 'NB', false, false], ['short', 'TH', true, false], ['short', 'TH', false, false], ['short', 'VD', true, false], ['short', 'VD', true, false],
];
const PTS = { mcq: 0.25, tf: 1, short: 0.5 };
const MCQ_BASE = [0, 1, 2, 3, 2, 0, 3, 1, 0, 2, 3, 1];
const PATTERNS = [[1, 0, 1, 1], [1, 0, 1, 0], [1, 1, 0, 0], [1, 1, 0, 1], [0, 1, 1, 0], [0, 1, 0, 1], [1, 0, 0, 1], [0, 0, 1, 1], [0, 1, 1, 1], [1, 1, 1, 0], [0, 1, 0, 0], [1, 0, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]].map((p) => p.map(Boolean));
const qkey = (q) => q.prompt.replace(/\s+/g, '') + '|' + (q.options ? [...q.options].sort().join('|') : '') + (q._key ?? '');
const seen = new Set(), shortSeen = META.map(() => new Set()), coreSeen = META.map(() => new Set());
const exams = [];
for (let n = 1; n <= 20; n++) {
  const qs = META.map(([kind, muc, thuc_te, bam_may], i) => {
    for (let tries = 0; tries < 8000; tries++) {
      const key = kind === 'mcq' ? (MCQ_BASE[i] + n - 1) % 4 : kind === 'tf' ? PATTERNS[(n * 3 + (i - 12) * 5) % PATTERNS.length] : null;
      const q = T[i + 1](n, key); if (!q) continue;
      // chống trùng: câu dẫn (bỏ _key) + tập phương án
      const k = `${i}|` + q.prompt.replace(/\s+/g, '') + '|' + (q.options ? [...q.options].sort().join('|') : '');
      if (seen.has(k)) continue; delete q._key;
      if (q._core && coreSeen[i].has(q._core)) continue; if (q._core) coreSeen[i].add(q._core); delete q._core;
      if (kind === 'short' && shortSeen[i].has(q.answer[0]) && tries < 400) continue;
      seen.add(k); if (kind === 'short') shortSeen[i].add(q.answer[0]);
      const fg = q._fig; delete q._fig; if (fg) fg();
      return { kind, muc, thuc_te, bam_may, prompt: q.prompt, ...(q.image ? { image: q.image } : {}),
        ...(q.options ? { options: q.options } : {}), answer: q.answer, points: PTS[kind], verify: q.verify, explanation: q.explanation };
    }
    throw new Error(`Đề ${n} câu ${i + 1}: không tìm được bộ số`);
  });
  const nn = String(n).padStart(2, '0');
  exams.push({ slug: `toan11-bai15-gioi-han-cua-day-so-${nn}`, title: `Bài 15. Giới hạn của dãy số — Đề ${n}`, sort_order: n, time_limit_min: 90,
    description: 'Đề bài tập về nhà Bài 15 (Giới hạn của dãy số), cấu trúc THPT: 12 trắc nghiệm, 4 Đúng/Sai, 6 trả lời ngắn.', questions: qs });
}
void qkey;
const head = { grade: 11, chapter: 'Chương V. Giới hạn. Hàm số liên tục', topic: 'Bài 15. Giới hạn của dãy số', level: 'kha' };
writeFileSync(out1, JSON.stringify({ ...head, exams: exams.slice(0, 1) }, null, 2) + '\n', 'utf8');
writeFileSync(out2, JSON.stringify({ ...head, exams: exams.slice(1) }, null, 2) + '\n', 'utf8');
console.log(`Đã sinh ${exams.length} đề (${exams.length * 22} câu): ${out1}, ${out2}`);
