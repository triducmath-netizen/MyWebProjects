#!/usr/bin/env node
// Tạo giọng đọc cho từng câu thoại của một kịch bản.
//   node video/scripts/giong-doc.mjs video/kich-ban/<slug>.json [--nhap]
// Kết quả: video/public/am-thanh/<slug>/c<cảnh>-l<câu>.mp3 + durations.json (độ dài từng câu, giây).
//
// Nhà cung cấp (đặt trong .env.local ở thư mục gốc dự án):
//   FPT_TTS_API_KEY=...         → giọng FPT.AI (bản chính thức)
//   FPT_VOICE_DUC=leminh        → giọng thầy Đức (mặc định leminh — nam miền Bắc)
//   FPT_VOICE_MINH=minhquang    → giọng Minh
//   FPT_SPEED_DUC=0 / FPT_SPEED_MINH=0   (từ -3 đến 3)
// Không có khoá FPT hoặc thêm --nhap → dùng giọng Microsoft Edge (miễn phí) để làm bản xem thử.
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { parseFile } from 'music-metadata';

const here = dirname(fileURLToPath(import.meta.url));
const videoDir = resolve(here, '..');
const root = resolve(videoDir, '..');

function readEnv() {
  const p = resolve(root, '.env.local');
  if (!existsSync(p)) return {};
  return Object.fromEntries(readFileSync(p, 'utf8').split(/\r?\n/).filter((l) => /^\s*[A-Z_]+\s*=/.test(l))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
}

// Chuẩn hoá lời đọc: bỏ dấu ngoặc kép, đọc "triducmath.vn" cho đúng.
function speakable(text) {
  return text.replace(/[“”"]/g, '').replace(/triducmath\.vn/gi, 'Trí Đức Math chấm v n').replace(/\s+/g, ' ').trim();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fptTts(text, voice, speed, key) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch('https://api.fpt.ai/hmi/tts/v5', {
      method: 'POST',
      headers: { 'api-key': key, voice, speed: String(speed ?? 0), format: 'mp3' },
      body: text,
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok || out.error) {
      if (attempt === 3) throw new Error(`FPT.AI lỗi ${res.status}: ${out.message ?? JSON.stringify(out)}`);
      await sleep(1500 * attempt);
      continue;
    }
    // File được tạo bất đồng bộ — chờ đến khi tải được
    for (let i = 0; i < 40; i++) {
      await sleep(i < 5 ? 800 : 1500);
      const a = await fetch(out.async);
      if (a.ok) {
        const buf = Buffer.from(await a.arrayBuffer());
        if (buf.length > 1000) return buf;
      }
    }
    if (attempt === 3) throw new Error('FPT.AI: hết thời gian chờ file âm thanh');
  }
}

async function edgeTts(text, who) {
  const { MsEdgeTTS, OUTPUT_FORMAT } = await import('msedge-tts');
  const tts = new MsEdgeTTS();
  await tts.setMetadata('vi-VN-NamMinhNeural', OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
  const opts = who === 'minh' ? { pitch: '+18%', rate: '+6%' } : { rate: '-4%' };
  const { audioStream } = tts.toStream(text, opts);
  const chunks = [];
  await new Promise((ok, fail) => {
    audioStream.on('data', (c) => chunks.push(c));
    audioStream.on('end', ok);
    audioStream.on('error', fail);
  });
  tts.close?.();
  return Buffer.concat(chunks);
}

export async function taoGiongDoc(kbPath, { nhap = false } = {}) {
  const kb = JSON.parse(readFileSync(kbPath, 'utf8'));
  const env = readEnv();
  const useFpt = !nhap && !!env.FPT_TTS_API_KEY;
  const provider = useFpt ? 'fpt' : 'edge';
  const outDir = resolve(videoDir, 'public', 'am-thanh', kb.slug);
  mkdirSync(outDir, { recursive: true });
  const cacheFile = resolve(outDir, 'cache.json');
  const cache = existsSync(cacheFile) ? JSON.parse(readFileSync(cacheFile, 'utf8')) : {};
  const durations = [];
  let made = 0;
  for (const [si, c] of kb.canh.entries()) {
    durations[si] = [];
    for (const [li, l] of c.loi.entries()) {
      const text = speakable(l.cau);
      const voice = useFpt ? (l.nguoi === 'minh' ? env.FPT_VOICE_MINH || 'minhquang' : env.FPT_VOICE_DUC || 'leminh') : `edge-${l.nguoi}`;
      const speed = l.nguoi === 'minh' ? env.FPT_SPEED_MINH : env.FPT_SPEED_DUC;
      const sig = createHash('sha1').update(`${provider}|${voice}|${speed}|${text}`).digest('hex');
      const file = resolve(outDir, `c${si}-l${li}.mp3`);
      if (cache[`${si}-${li}`] !== sig || !existsSync(file) || statSync(file).size < 1000) {
        const buf = useFpt ? await fptTts(text, voice, speed, env.FPT_TTS_API_KEY) : await edgeTts(text, l.nguoi);
        writeFileSync(file, buf);
        cache[`${si}-${li}`] = sig;
        made++;
        process.stdout.write('.');
      }
      const meta = await parseFile(file, { duration: true });
      durations[si][li] = Math.round((meta.format.duration ?? 0) * 1000) / 1000;
    }
  }
  writeFileSync(cacheFile, JSON.stringify(cache, null, 2));
  writeFileSync(resolve(outDir, 'durations.json'), JSON.stringify({ provider, durations }, null, 2));
  const total = durations.flat().reduce((a, b) => a + b, 0);
  console.log(`\nGiọng đọc (${provider === 'fpt' ? 'FPT.AI' : 'Edge — bản xem thử'}): ${made} câu mới, tổng lời ${total.toFixed(1)} giây`);
  return { provider, durations };
}

if (process.argv[1]?.endsWith('giong-doc.mjs')) {
  const f = process.argv.slice(2).find((a) => !a.startsWith('--'));
  if (!f) { console.error('Cách dùng: node video/scripts/giong-doc.mjs <kich-ban.json> [--nhap]'); process.exit(2); }
  taoGiongDoc(f, { nhap: process.argv.includes('--nhap') }).catch((e) => { console.error(e.message); process.exit(1); });
}
