#!/usr/bin/env node
// Kiểm tra kịch bản video:  node video/scripts/kiem-tra-kich-ban.mjs video/kich-ban/<slug>.json
import { readFileSync } from 'node:fs';

export const LOAI = ['mo-dau', 'giang', 'bang', 'vi-du', 'tong-ket', 'ket-thuc'];
export const BIEU_TUONG = ['sach', 'mat', 'nao', 'but', 'lich', 'dong-ho', 'bong-den', 'muc-tieu', 'dau-hoi', 'dau-tich', 'dau-x', 'bieu-do', 'lap-lai', 'ngoi-sao', 'ngu', 'trai-tim'];
export const DIEU_BO = ['binh-thuong', 'giang-giai', 'chi-bang', 'suy-nghi', 'vui', 'ngac-nhien', 'buon', 'gat-dau', 'vay-tay', 'viet-bang'];
const CAM = ['trong thời đại', 'hành trình', 'chinh phục', 'đột phá', 'bí kíp thần thánh', 'đảm bảo điểm 10', 'cam kết đỗ', 'trung tâm'];

export function kiemTra(kb) {
  const loi = [];
  const canh = (m) => loi.push(m);
  if (!/^[a-z0-9-]{3,60}$/.test(kb.slug || '')) canh('slug chỉ gồm a-z, 0-9, dấu -');
  for (const k of ['tieu_de', 'phuong_phap']) if (!kb[k]?.trim()) canh(`thiếu ${k}`);
  if (!Array.isArray(kb.nguon) || !kb.nguon.length) canh('cần ít nhất 1 nguồn tham khảo (nguon)');
  if (!Array.isArray(kb.canh) || kb.canh.length < 4) { canh('cần ít nhất 4 cảnh'); return { loi, soChu: 0 }; }
  if (kb.canh[0].loai !== 'mo-dau') canh('cảnh đầu phải là mo-dau');
  const first = kb.canh[0].loi?.[0];
  if (!first || first.nguoi !== 'duc' || first.cau.trim() !== 'Chào các em!') canh('câu đầu tiên phải là thầy Đức nói đúng "Chào các em!"');
  if (kb.canh.some((c) => (c.loi || []).some((l) => /thầy là thầy Đức|thầy tên là/i.test(l.cau)))) canh('thầy Đức không tự giới thiệu tên');
  if (kb.canh.at(-1).loai !== 'ket-thuc') canh('cảnh cuối phải là ket-thuc');
  if (!kb.canh.some((c) => c.loai === 'vi-du')) canh('cần ít nhất 1 cảnh vi-du (ví dụ minh họa)');
  let soChu = 0;
  kb.canh.forEach((c, i) => {
    const at = `cảnh ${i + 1} (${c.loai})`;
    if (!LOAI.includes(c.loai)) canh(`${at}: loai không hợp lệ`);
    if (!Array.isArray(c.loi) || !c.loi.length) { canh(`${at}: thiếu loi`); return; }
    c.loi.forEach((l, j) => {
      const a = `${at}, câu ${j + 1}`;
      if (l.nguoi !== 'duc') canh(`${a}: video giấu mặt — chỉ thầy Đức nói (nguoi phải là duc)`);
      if (l.chu != null) {
        const nc = String(l.chu).trim().split(/\s+/).length;
        if (nc > 8) canh(`${a}: chu dài ${nc} chữ (tối đa 8)`);
        if ((String(l.chu).match(/\$/g) || []).length % 2) canh(`${a}: dấu $ không cân trong chu`);
      }
      if (l.bieu_tuong && !BIEU_TUONG.includes(l.bieu_tuong)) canh(`${a}: bieu_tuong "${l.bieu_tuong}" không hợp lệ`);
      if (!l.cau?.trim()) { canh(`${a}: thiếu cau`); return; }
      const n = l.cau.trim().split(/\s+/).length;
      soChu += n;
      if (n > 28) canh(`${a}: ${n} chữ (tối đa 28) — "${l.cau.slice(0, 50)}…"`);
      if (/\$|\\[a-z]+/.test(l.cau)) canh(`${a}: lời đọc có LaTeX — viết bằng chữ để máy đọc`);
      for (const x of CAM) if (l.cau.toLowerCase().includes(x)) canh(`${a}: tránh cụm "${x}"`);
    });
    if ((c.loai === 'bang' || c.loai === 'tong-ket') && !(Array.isArray(c.noi_dung) && c.noi_dung.length)) canh(`${at}: cần noi_dung (các dòng trên bảng)`);
    if (c.loai === 'vi-du' && !c.de_bai?.trim()) canh(`${at}: cần de_bai`);
    for (const t of [c.tieu_de, c.de_bai, ...(c.noi_dung || []), ...(c.loi_giai || [])]) {
      if (t && ((String(t).match(/\$/g) || []).length % 2)) canh(`${at}: dấu $ không cân trong "${String(t).slice(0, 40)}"`);
    }
  });
  if (soChu < 550) canh(`lời đọc ${soChu} chữ — quá ngắn (cần 550–850, ≈ 3,5–5 phút)`);
  if (soChu > 900) canh(`lời đọc ${soChu} chữ — quá dài (cần 550–850)`);
  const m = kb.dang_mxh || {};
  if (!m.tieu_de || !m.mo_ta || !Array.isArray(m.hashtag) || !m.caption_ngan) canh('dang_mxh cần tieu_de, mo_ta, hashtag[], caption_ngan');
  return { loi, soChu };
}

if (process.argv[1]?.endsWith('kiem-tra-kich-ban.mjs')) {
  let tong = 0;
  for (const f of process.argv.slice(2)) {
    let kb;
    try { kb = JSON.parse(readFileSync(f, 'utf8')); } catch (e) { console.log(`LỖI  ${f}: JSON lỗi — ${e.message}`); tong++; continue; }
    const { loi, soChu } = kiemTra(kb);
    loi.forEach((l) => console.log(`LỖI  ${f} › ${l}`));
    console.log(`${f}: ${soChu} chữ lời thoại (~${(soChu / 165).toFixed(1)} phút) — ${loi.length} lỗi`);
    tong += loi.length;
  }
  process.exit(tong ? 1 : 0);
}
