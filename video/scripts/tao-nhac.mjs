#!/usr/bin/env node
// Tự soạn nhạc nền (không bản quyền) cho video: ukulele gảy, bass, nhịp nhẹ, pad.
//   node video/scripts/tao-nhac.mjs            → tạo các bản mặc định vào video/nhac/
// Mỗi bản dài ~1 phút, lặp liền mạch (video tự lặp lại nhạc), âm lượng đã chuẩn hoá.
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SR = 44100;
const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, '..', 'nhac');

const NOTE = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
const freq = (midi) => 440 * 2 ** ((midi - 69) / 12);
// Hợp âm: [gốc, kiểu]
const CHORD = { maj: [0, 4, 7], min: [0, 3, 7], maj7: [0, 4, 7, 11], min7: [0, 3, 7, 10], add9: [0, 4, 7, 14], sus2: [0, 2, 7] };

// Bộ sinh số ngẫu nhiên cố định (mỗi lần chạy ra cùng một bản nhạc)
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

// Dây gảy Karplus–Strong (giống ukulele/guitar)
function pluck(buf, start, f, dur, amp, rand, pan = 0) {
  const n = Math.max(2, Math.round(SR / f));
  const line = new Float32Array(n).map(() => rand() * 2 - 1);
  let idx = 0;
  const len = Math.min(Math.round(dur * SR), buf.L.length - start);
  let prev = 0;
  for (let i = 0; i < len; i++) {
    const cur = line[idx];
    const nxt = line[(idx + 1) % n];
    const v = 0.4985 * (cur + nxt);
    line[idx] = v;
    idx = (idx + 1) % n;
    const env = Math.min(1, i / 40) * (i > len - 400 ? (len - i) / 400 : 1);
    const s = (cur * 0.7 + prev * 0.3) * amp * env;
    prev = cur;
    buf.L[start + i] += s * (1 - pan) ;
    buf.R[start + i] += s * (1 + pan);
  }
}

function sine(buf, start, f, dur, amp, attack = 0.01, release = 0.15, pan = 0) {
  const len = Math.min(Math.round(dur * SR), buf.L.length - start);
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const env = Math.min(1, t / attack) * Math.min(1, (dur - t) / release);
    const s = Math.sin(2 * Math.PI * f * t) * amp * env;
    buf.L[start + i] += s * (1 - pan);
    buf.R[start + i] += s * (1 + pan);
  }
}

function pad(buf, start, freqs, dur, amp) {
  const len = Math.min(Math.round(dur * SR), buf.L.length - start);
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const env = Math.min(1, t / 0.6) * Math.min(1, (dur - t) / 0.6);
    let s = 0;
    freqs.forEach((f, k) => { s += Math.sin(2 * Math.PI * f * t + k) + 0.3 * Math.sin(2 * Math.PI * f * 2.003 * t); });
    s *= amp * env / freqs.length;
    buf.L[start + i] += s * 0.9;
    buf.R[start + i] += s * 1.1;
  }
}

// Piano điện (kiểu Rhodes): hai sóng sin + bồi âm, tắt dần, rung nhẹ — tiếng ấm, tròn.
function epiano(buf, start, f, dur, amp, pan = 0) {
  const len = Math.min(Math.round((dur + 0.8) * SR), buf.L.length - start);
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const decay = Math.exp(-t * 1.6) * (t > dur ? Math.exp(-(t - dur) * 6) : 1);
    const attack = Math.min(1, t / 0.006);
    const trem = 1 + 0.06 * Math.sin(2 * Math.PI * 4.5 * t);
    const s = (Math.sin(2 * Math.PI * f * t) + 0.35 * Math.sin(2 * Math.PI * f * 2 * t) * Math.exp(-t * 4)
      + 0.12 * Math.sin(2 * Math.PI * f * 3.01 * t) * Math.exp(-t * 8)) * amp * decay * attack * trem;
    buf.L[start + i] += s * (1 - pan);
    buf.R[start + i] += s * (1 + pan);
  }
}

// Hộp nhạc / chuông nhẹ cho giai điệu
function bell(buf, start, f, amp, pan = 0) {
  const len = Math.min(Math.round(1.4 * SR), buf.L.length - start);
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const s = (Math.sin(2 * Math.PI * f * t) + 0.25 * Math.sin(2 * Math.PI * f * 4.01 * t) * Math.exp(-t * 9))
      * Math.exp(-t * 3.2) * Math.min(1, t / 0.003) * amp;
    buf.L[start + i] += s * (1 - pan);
    buf.R[start + i] += s * (1 + pan);
  }
}

// Lọc thông thấp một cực (làm tiếng ấm, bớt chói)
function lowpass(arr, cutoff) {
  const a = Math.exp(-2 * Math.PI * cutoff / SR);
  let y = 0;
  for (let i = 0; i < arr.length; i++) { y = (1 - a) * arr[i] + a * y; arr[i] = y; }
}

function kick(buf, start, amp) {
  const len = Math.min(Math.round(0.25 * SR), buf.L.length - start);
  let ph = 0;
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    ph += 2 * Math.PI * (45 + 90 * Math.exp(-t * 30)) / SR;
    const s = Math.sin(ph) * Math.exp(-t * 14) * amp;
    buf.L[start + i] += s; buf.R[start + i] += s;
  }
}

function shaker(buf, start, amp, rand) {
  const len = Math.min(Math.round(0.07 * SR), buf.L.length - start);
  let hp = 0, last = 0;
  for (let i = 0; i < len; i++) {
    const x = rand() * 2 - 1;
    hp = 0.85 * (hp + x - last); last = x; // lọc cao
    const s = hp * Math.exp(-i / (SR * 0.018)) * amp;
    buf.L[start + i] += s * 0.8; buf.R[start + i] += s * 1.2;
  }
}

function snap(buf, start, amp, rand) {
  const len = Math.min(Math.round(0.12 * SR), buf.L.length - start);
  for (let i = 0; i < len; i++) {
    const s = (rand() * 2 - 1) * Math.exp(-i / (SR * 0.03)) * amp;
    buf.L[start + i] += s; buf.R[start + i] += s;
  }
}

function render(opts) {
  if (opts.style === 'warm') return renderWarm(opts);
  return renderPop(opts);
}

// Phong cách ấm áp: piano điện + ukulele gảy nhẹ + bass mềm + giai điệu hộp nhạc + trống chổi
function renderWarm({ name, key, bpm, prog, bars, seed, motif }) {
  const rand = rng(seed);
  const beat = 60 / bpm;
  const total = bars * 4 * beat;
  const N = Math.round(total * SR) + 2 * SR;
  const buf = { L: new Float32Array(N), R: new Float32Array(N) };
  const root = 60 + NOTE[key];
  const at = (sec) => Math.round(sec * SR);
  const swing = beat * 0.06; // hơi "đung đưa" cho vui

  for (let bar = 0; bar < bars; bar++) {
    const [deg, type] = prog[bar % prog.length];
    const base = root + deg;
    const tones = CHORD[type].map((x) => base + x);
    const t0 = bar * 4 * beat;
    const section = Math.floor(bar / 8); // 0: dạo đầu nhẹ, 1+: đầy đủ
    // piano điện: hợp âm ở phách 1, nhắc lại nhẹ ở phách 2.5 và 3.5
    tones.forEach((m, k) => epiano(buf, at(t0 + k * 0.008), freq(m - 12), beat * 1.8, 0.07, (k - 1.5) * 0.12));
    [2.5, 3.5].forEach((p) => tones.slice(1).forEach((m, k) => epiano(buf, at(t0 + p * beat + swing), freq(m - 12), beat * 0.7, 0.035, (k - 1) * 0.15)));
    // bass mềm
    sine(buf, at(t0), freq(base - 24), beat * 1.7, 0.2, 0.02, 0.3);
    sine(buf, at(t0 + 2.5 * beat + swing), freq(base - 24 + (bar % 2 ? 7 : 12)), beat * 1.2, 0.13, 0.02, 0.3);
    // ukulele gảy nhẹ từ đoạn 2
    if (section >= 1) {
      [[1, false], [1.5, true], [3, false]].forEach(([p, up]) => {
        const order = up ? [...tones].reverse() : tones;
        order.forEach((m, k) => pluck(buf, at(t0 + p * beat + (p % 1 ? swing : 0) + k * 0.014), freq(m + 12), beat * 0.8 + 0.25, 0.07, rand, (k - 1.5) * 0.18));
      });
    }
    // giai điệu hộp nhạc: lặp mô-típ 2 ô nhịp, đổi theo hợp âm
    if (section >= 1 || bar % 2 === 1) {
      const mot = motif[bar % motif.length];
      mot.forEach(([p, step]) => {
        const scale = [0, 2, 4, 7, 9, 12, 14, 16]; // ngũ cung trưởng — luôn hợp, nghe vui
        bell(buf, at(t0 + p * beat + (p % 1 ? swing : 0)), freq(root + 12 + scale[step]), 0.055, 0.25);
      });
    }
    // trống chổi rất nhẹ
    for (let b = 0; b < 4; b++) {
      if (b === 0) kick(buf, at(t0), 0.22);
      if (b === 2 && section >= 1) kick(buf, at(t0 + 2 * beat), 0.14);
      if (b === 1 || b === 3) snap(buf, at(t0 + b * beat), 0.025, rand);
      shaker(buf, at(t0 + b * beat + beat / 2 + swing), 0.028, rand);
    }
  }

  // Lặp liền mạch: cộng đuôi tiếng về đầu
  const loopN = Math.round(total * SR);
  for (let i = loopN; i < N; i++) { buf.L[i - loopN] += buf.L[i]; buf.R[i - loopN] += buf.R[i]; }
  const L = buf.L.subarray(0, loopN), R = buf.R.subarray(0, loopN);
  lowpass(L, 5200); lowpass(R, 5200);
  writeWav(name, L, R, total, bpm, key);
}

function writeWav(name, L, R, total, bpm, key) {
  const loopN = L.length;
  let peak = 0;
  for (let i = 0; i < loopN; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  const g = 0.89 / (peak || 1);
  const pcm = Buffer.alloc(loopN * 4);
  for (let i = 0; i < loopN; i++) {
    pcm.writeInt16LE(Math.round(Math.tanh(L[i] * g * 1.05) * 32000), i * 4);
    pcm.writeInt16LE(Math.round(Math.tanh(R[i] * g * 1.05) * 32000), i * 4 + 2);
  }
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22);
  h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 4, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(resolve(outDir, `${name}.wav`), Buffer.concat([h, pcm]));
  console.log(`✔ ${name}.wav — ${total.toFixed(1)} giây, ${bpm} BPM, giọng ${key}`);
}

function renderPop({ name, key, bpm, prog, bars, seed, strum, melody }) {
  const rand = rng(seed);
  const beat = 60 / bpm;
  const total = bars * 4 * beat;
  const N = Math.round(total * SR) + SR; // dư 1 giây cho đuôi tiếng
  const buf = { L: new Float32Array(N), R: new Float32Array(N) };
  const root = 60 + NOTE[key]; // quãng giữa
  const at = (sec) => Math.round(sec * SR);

  for (let bar = 0; bar < bars; bar++) {
    const [deg, type] = prog[bar % prog.length];
    const base = root + deg;
    const tones = CHORD[type].map((x) => base + x);
    const t0 = bar * 4 * beat;
    // pad nền
    pad(buf, at(t0), tones.map((m) => freq(m - 12)), 4 * beat, 0.05);
    // bass: nốt gốc nhịp 1, quãng 5 nhịp 3
    sine(buf, at(t0), freq(base - 24), beat * 1.6, 0.22, 0.01, 0.2);
    sine(buf, at(t0 + 2 * beat), freq(base - 24 + 7), beat * 1.4, 0.18, 0.01, 0.2);
    // ukulele gảy theo mẫu
    strum.forEach(([pos, len, up], si) => {
      const ts = t0 + pos * beat;
      const order = up ? [...tones].reverse() : tones;
      order.forEach((m, k) => pluck(buf, at(ts + k * 0.012), freq(m + 12), len * beat + 0.3, 0.11 + (si === 0 ? 0.03 : 0), rand, (k - 1.5) * 0.15));
    });
    // giai điệu đơn giản (chuông) — nốt trong hợp âm, lúc có lúc không
    if (melody && bar % 2 === 1) {
      [0, 1.5, 2.5, 3].forEach((p, k) => {
        if (rand() < 0.75) sine(buf, at(t0 + p * beat), freq(tones[(k + bar) % tones.length] + 24), beat * 0.9, 0.05, 0.005, 0.5, 0.3);
      });
    }
    // trống nhẹ
    for (let b = 0; b < 4; b++) {
      if (b === 0 || b === 2) kick(buf, at(t0 + b * beat), 0.35);
      if (b === 1 || b === 3) snap(buf, at(t0 + b * beat), 0.06, rand);
      shaker(buf, at(t0 + b * beat + beat / 2), 0.05, rand);
      shaker(buf, at(t0 + b * beat), 0.03, rand);
    }
  }

  // Đuôi tiếng tràn sau ô nhịp cuối → cộng vòng về đầu để lặp liền mạch
  const loopN = Math.round(total * SR);
  for (let i = loopN; i < N; i++) { buf.L[i - loopN] += buf.L[i]; buf.R[i - loopN] += buf.R[i]; }

  // Chuẩn hoá âm lượng (đỉnh -1 dB) + nén mềm
  let peak = 0;
  for (let i = 0; i < loopN; i++) peak = Math.max(peak, Math.abs(buf.L[i]), Math.abs(buf.R[i]));
  const g = 0.89 / (peak || 1);
  const pcm = Buffer.alloc(loopN * 4);
  for (let i = 0; i < loopN; i++) {
    const l = Math.tanh(buf.L[i] * g * 1.1);
    const r = Math.tanh(buf.R[i] * g * 1.1);
    pcm.writeInt16LE(Math.round(l * 32000), i * 4);
    pcm.writeInt16LE(Math.round(r * 32000), i * 4 + 2);
  }
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22);
  h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 4, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  mkdirSync(outDir, { recursive: true });
  const file = resolve(outDir, `${name}.wav`);
  writeFileSync(file, Buffer.concat([h, pcm]));
  console.log(`✔ ${name}.wav — ${total.toFixed(1)} giây, ${bpm} BPM, giọng ${key}`);
}

// Mẫu gảy: [vị trí nhịp, độ dài (nhịp), gảy ngược lên?]
const STRUM_POP = [[0, 1, false], [1, 0.5, false], [1.5, 0.5, true], [2.5, 0.5, true], [3, 1, false]];
const STRUM_SOFT = [[0, 2, false], [2, 1, false], [3, 1, true]];
const STRUM_BOUNCE = [[0, 0.5, false], [0.5, 0.5, true], [1.5, 0.5, true], [2, 0.5, false], [3, 0.5, false], [3.5, 0.5, true]];

const TRACKS = [
  { name: 'vui-tuoi-ukulele', key: 'C', bpm: 104, seed: 11, bars: 24, strum: STRUM_POP, melody: true,
    prog: [[0, 'maj'], [7, 'maj'], [9, 'min'], [5, 'maj']] },                 // C G Am F
  { name: 'nhe-nhang-suy-nghi', key: 'D', bpm: 88, seed: 23, bars: 20, strum: STRUM_SOFT, melody: true,
    prog: [[0, 'maj7'], [9, 'min7'], [4, 'min7'], [5, 'add9']] },             // Dmaj7 Bm7 F#m7 Gadd9
  { name: 'tich-cuc-nang-dong', key: 'F', bpm: 112, seed: 37, bars: 24, strum: STRUM_BOUNCE, melody: true,
    prog: [[0, 'maj'], [5, 'maj'], [9, 'min'], [7, 'sus2']] },                // F Bb Dm Csus2
];

// Ấm áp, nhẹ nhàng nhưng vui: G – Em7 – Cmaj7 – Dadd9 (I – vi – IV – V), 92 BPM.
// Mô-típ giai điệu: [phách, bậc trong thang ngũ cung]
const MOTIF_AM_AP = [
  [[0, 2], [0.5, 3], [1, 4], [2.5, 3], [3, 2]],
  [[0, 1], [1, 2], [1.5, 1], [2, 0], [3.5, 2]],
  [[0, 2], [0.5, 3], [1, 4], [2, 5], [3, 4]],
  [[0, 3], [1, 2], [2, 1], [2.5, 2], [3, 0]],
];
TRACKS.push({
  name: 'am-ap-vui-ve', style: 'warm', key: 'G', bpm: 92, seed: 53, bars: 24, motif: MOTIF_AM_AP,
  prog: [[0, 'add9'], [9, 'min7'], [5, 'maj7'], [7, 'add9']],
});

const only = process.argv[2];
for (const t of TRACKS) if (!only || t.name === only) render(t);
