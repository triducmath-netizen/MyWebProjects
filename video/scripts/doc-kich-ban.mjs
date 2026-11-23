#!/usr/bin/env node
// Xuất kịch bản JSON thành bản đọc duyệt (Markdown) cạnh file gốc.
//   node video/scripts/doc-kich-ban.mjs video/kich-ban/<slug>.json [...]
import { readFileSync, writeFileSync } from 'node:fs';

const TEN = { 'mo-dau': 'Mở đầu', giang: 'Thầy giảng', 'hoi-thoai': 'Hội thoại', bang: 'Các bước', 'vi-du': 'Ví dụ minh họa', 'tong-ket': 'Tổng kết', 'ket-thuc': 'Kết thúc' };
for (const f of process.argv.slice(2)) {
  const kb = JSON.parse(readFileSync(f, 'utf8'));
  const soChu = kb.canh.flatMap((c) => c.loi).reduce((s, l) => s + l.cau.split(/\s+/).length, 0);
  let md = `# ${kb.tieu_de}\n\n**Phương pháp:** ${kb.phuong_phap}  \n**Độ dài lời thoại:** ${soChu} chữ (~${(soChu / 165).toFixed(1)} phút)\n\n`;
  kb.canh.forEach((c, i) => {
    md += `## Cảnh ${i + 1} — ${TEN[c.loai] ?? c.loai}${c.tieu_de ? `: ${c.tieu_de}` : ''}\n\n`;
    if (c.phu_de) md += `*${c.phu_de}*\n\n`;
    if (c.de_bai) md += `> **Đề bài (trên bảng):** ${c.de_bai}\n\n`;
    if (c.noi_dung?.length) md += `> **Trên bảng:**\n${c.noi_dung.map((x, k) => `> ${k + 1}. ${x}`).join('\n')}\n\n`;
    if (c.loi_giai?.length) md += `> **Lời giải (hiện dần):**\n${c.loi_giai.map((x) => `> - ${x}`).join('\n')}\n\n`;
    md += c.loi.map((l) => {
      const tag = [l.chu ? `chữ trên màn hình: **${l.chu}**` : null, l.bieu_tuong ? `hình: ${l.bieu_tuong}` : null, l.dieu_bo ? `cử chỉ: ${l.dieu_bo}` : null].filter(Boolean).join(' · ');
      return `**${l.nguoi === 'duc' ? 'Thầy Đức' : 'Minh'}:** ${l.cau}${tag ? `  \n  ↳ *${tag}*` : ''}`;
    }).join('  \n') + '\n\n';
  });
  const m = kb.dang_mxh || {};
  md += `## Đăng mạng xã hội\n\n- **Tiêu đề:** ${m.tieu_de ?? ''}\n- **Mô tả:** ${m.mo_ta ?? ''}\n- **Caption ngắn:** ${m.caption_ngan ?? ''}\n- **Hashtag:** ${(m.hashtag || []).join(' ')}\n\n`;
  md += `## Nguồn tham khảo\n\n${(kb.nguon || []).map((n) => `- ${n.ten}${n.url ? ` — ${n.url}` : ''}`).join('\n')}\n`;
  const out = f.replace(/\.json$/, '.md');
  writeFileSync(out, md);
  console.log(`→ ${out}`);
}
