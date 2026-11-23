#!/usr/bin/env node
// Dựng video từ kịch bản đã duyệt.
//   node video/scripts/lam-video.mjs video/kich-ban/<slug>.json [--nhap] [--chi-anh] [--chi-doc|--chi-ngang]
//     --nhap      : dùng giọng Edge miễn phí (bản xem thử) thay cho FPT.AI
//     --chi-anh   : chỉ xuất vài khung hình để xem nhanh (không dựng video)
// Kết quả trong video/xuat/<slug>/:
//   <slug>-ngang.mp4 (1920x1080, YouTube/Facebook), <slug>-doc.mp4 (1080x1920, TikTok/Reels/Shorts),
//   <slug>.srt (phụ đề), dang-mxh.md (tiêu đề, mô tả, hashtag), anh-bia-*.png
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, copyFileSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundle } from '@remotion/bundler';
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer';
import { kiemTra } from './kiem-tra-kich-ban.mjs';
import { taoGiongDoc } from './giong-doc.mjs';
import { buildTimeline, toSrt, FPS } from '../src/timeline.js';

const here = dirname(fileURLToPath(import.meta.url));
const videoDir = resolve(here, '..');
const args = process.argv.slice(2);
const kbPath = args.find((a) => !a.startsWith('--'));
if (!kbPath) { console.error('Cách dùng: node video/scripts/lam-video.mjs <kich-ban.json> [--nhap] [--chi-anh]'); process.exit(2); }
const nhap = args.includes('--nhap');
const chiAnh = args.includes('--chi-anh');

const kb = JSON.parse(readFileSync(kbPath, 'utf8'));
if (!kb.slug.startsWith('_')) {
  const { loi } = kiemTra(kb);
  if (loi.length) { loi.forEach((l) => console.log(`LỖI  ${l}`)); console.error('Kịch bản còn lỗi — sửa trước khi dựng.'); process.exit(1); }
}

// 1. Giọng đọc
const { provider, durations } = await taoGiongDoc(kbPath, { nhap });

// 2. Nhạc nền: chọn 1 bản trong video/nhac/ (cố định theo slug để lần dựng lại giống nhau)
let nhac = null;
const nhacDir = resolve(videoDir, 'nhac');
const tracks = existsSync(nhacDir) ? readdirSync(nhacDir).filter((f) => /\.(mp3|m4a|wav|ogg)$/i.test(f)).sort() : [];
if (tracks.length) {
  const pick = kb.nhac && tracks.includes(kb.nhac) ? kb.nhac
    : tracks[[...kb.slug].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7) % tracks.length];
  mkdirSync(resolve(videoDir, 'public', 'nhac'), { recursive: true });
  copyFileSync(resolve(nhacDir, pick), resolve(videoDir, 'public', 'nhac', pick));
  nhac = `nhac/${pick}`;
  console.log(`Nhạc nền: ${pick}`);
} else {
  console.log('Nhạc nền: (chưa có file nào trong video/nhac/ — video sẽ không có nhạc)');
}

const outDir = resolve(videoDir, 'xuat', kb.slug);
mkdirSync(outDir, { recursive: true });
const tl = buildTimeline(kb, durations);
writeFileSync(resolve(outDir, `${kb.slug}.srt`), toSrt(tl));

// 3. Dựng
console.log('Đang đóng gói hoạt hình…');
const serveUrl = await bundle({ entryPoint: resolve(videoDir, 'src', 'index.jsx'), publicDir: resolve(videoDir, 'public') });
const kieu = args.includes('--2d') ? '2d' : '3d';
const inputProps = { kichBan: kb, durations, nhac, amThanh: true, kieu };
const ids = args.includes('--chi-doc') ? ['Doc'] : args.includes('--chi-ngang') ? ['Ngang'] : ['Ngang', 'Doc'];

for (const id of ids) {
  const comp = await selectComposition({ serveUrl, id, inputProps });
  const tag = id === 'Ngang' ? 'ngang' : 'doc';
  // Ảnh bìa / khung xem nhanh
  const stills = chiAnh ? tl.scenes.map((s) => s.lines[0] ? s.lines[0].start + 0.8 : s.start + 1) : [tl.scenes[0].start + 1.2];
  for (const [i, sec] of stills.entries()) {
    const out = resolve(outDir, chiAnh ? `xem-${tag}-${String(i + 1).padStart(2, '0')}.png` : `anh-bia-${tag}.png`);
    await renderStill({ composition: comp, serveUrl, output: out, frame: Math.min(comp.durationInFrames - 1, Math.round(sec * FPS)), inputProps, chromiumOptions: { gl: 'angle' } });
  }
  if (chiAnh) { console.log(`Đã xuất ${stills.length} khung hình ${tag}`); continue; }
  const out = resolve(outDir, `${kb.slug}-${tag}.mp4`);
  let last = -1;
  await renderMedia({
    composition: comp, serveUrl, codec: 'h264', outputLocation: out, inputProps,
    crf: 20, audioBitrate: '192k', concurrency: 4, chromiumOptions: { gl: 'angle' },
    onProgress: ({ progress }) => {
      const p = Math.floor(progress * 20);
      if (p !== last) { last = p; process.stdout.write(`\r${tag}: ${'█'.repeat(p)}${'░'.repeat(20 - p)} ${Math.round(progress * 100)}%`); }
    },
  });
  console.log(`\n✔ ${basename(out)} (${(comp.durationInFrames / FPS / 60).toFixed(1)} phút)`);
}

// 4. Nội dung đăng mạng xã hội
const m = kb.dang_mxh || {};
const tags = (m.hashtag || []).join(' ');
writeFileSync(resolve(outDir, 'dang-mxh.md'), `# ${kb.tieu_de}

Giọng đọc: ${provider === 'fpt' ? 'FPT.AI' : 'Edge (BẢN XEM THỬ — dựng lại bằng FPT.AI trước khi đăng)'}
Thời lượng: ${(tl.total / 60).toFixed(1)} phút

## YouTube (file: ${kb.slug}-ngang.mp4, phụ đề: ${kb.slug}.srt)
**Tiêu đề:** ${m.tieu_de ?? kb.tieu_de}

**Mô tả:**
${m.mo_ta ?? ''}

Luyện đề Toán miễn phí: https://triducmath.vn
${tags}

## YouTube Shorts / TikTok / Instagram Reels (file: ${kb.slug}-doc.mp4)
${m.caption_ngan ?? m.tieu_de ?? kb.tieu_de}
${tags}

## Facebook (file: ${kb.slug}-ngang.mp4 hoặc ${kb.slug}-doc.mp4, phụ đề: ${kb.slug}.srt)
${m.tieu_de ?? kb.tieu_de}

${m.mo_ta ?? ''}

👉 https://triducmath.vn
${tags}

## Nguồn tham khảo
${(kb.nguon || []).map((n) => `- ${n.ten}${n.url ? ` — ${n.url}` : ''}`).join('\n')}
`);
console.log(`\nXong. Thư mục: video/xuat/${kb.slug}/`);
