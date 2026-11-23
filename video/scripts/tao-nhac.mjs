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

function render({ name, key, bpm, prog, bars, seed, strum, melody }) {
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

for (const t of TRACKS) render(t);
