#!/usr/bin/env node
// Rà bản nháp nội dung: cụm từ sáo rỗng / văn AI, gọi sai tên, dữ kiện chưa xác nhận, câu quá dài.
//   node tools/kiem-tra-van-phong.mjs noi-dung/cho-duyet/*.md
//   --dang   : chế độ trước khi đăng (còn [CẦN XÁC NHẬN] là LỖI)
import { readFileSync } from 'node:fs';

const CAM = [
  'trong thời đại', 'trong bối cảnh', 'bạn có bao giờ', 'hãy cùng', 'khám phá', 'không phải ngẫu nhiên',
  'hành trình', 'chinh phục', 'khai phá', 'đột phá', 'toàn diện', 'vượt trội', 'hàng đầu', 'tối ưu hóa', 'tối ưu hoá',
  'nâng tầm', 'chìa khóa vàng', 'chìa khoá vàng', 'bệ phóng', 'trên mọi chặng đường', 'tóm lại', 'hy vọng bài viết',
  'sứ mệnh', 'kiến tạo', 'bứt phá', 'đỉnh cao', 'số 1', 'uy tín nhất', 'tốt nhất',
];
const SAI_TEN = [/trung tâm/i];

const dang = process.argv.includes('--dang');
const files = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (!files.length) { console.error('Cách dùng: node tools/kiem-tra-van-phong.mjs [--dang] <file.md> ...'); process.exit(2); }

let loi = 0, canhBao = 0;
for (const f of files) {
  const raw = readFileSync(f, 'utf8');
  // Chỉ rà phần sẽ lên web
  const m = raw.match(/## Nội dung đề xuất\s*\n([\s\S]*?)(\n## |\s*$)/);
  const body = m ? m[1] : raw;
  const lower = body.toLowerCase();
  const out = (lv, msg) => { console.log(`${lv}  ${f} › ${msg}`); lv === 'LỖI ' ? loi++ : canhBao++; };

  for (const c of CAM) if (lower.includes(c)) out('LỖI ', `cụm từ nên tránh: "${c}"`);
  for (const r of SAI_TEN) if (r.test(body)) out('LỖI ', 'gọi Trí Đức Math là "trung tâm"');
  if ((lower.match(/không chỉ/g) || []).length > 1) out('LỖI ', '"không chỉ… mà còn…" dùng quá 1 lần');
  if ((body.match(/!/g) || []).length > 1) out('LỖI ', 'quá 1 dấu chấm than');
  if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(body)) out('LỖI ', 'có emoji');
  if (/\b[A-ZĐÂĂÊÔƠƯ]{5,}\b/.test(body.replace(/THCS|THPT|GDPT|SGK/g, ''))) out('CẢNH BÁO', 'có chữ IN HOA để nhấn mạnh');
  if (/[a-zà-ỹ]+, [a-zà-ỹ]+,? (và )?[a-zà-ỹ]+ và/i.test(body)) { /* bỏ qua: quá nhiều dương tính giả */ }
  const xacNhan = (body.match(/\[CẦN XÁC NHẬN[^\]]*\]/g) || []);
  if (xacNhan.length) (dang ? out('LỖI ', `còn ${xacNhan.length} chỗ [CẦN XÁC NHẬN]`) : out('CẢNH BÁO', `${xacNhan.length} chỗ chờ xác nhận`));

  // Câu quá dài
  const cau = body.replace(/\n+/g, ' ').split(/(?<=[.?!])\s+/).map((s) => s.trim()).filter((s) => s.length > 0 && !s.startsWith('#'));
  for (const s of cau) {
    const n = s.split(/\s+/).length;
    if (n > 32) out('CẢNH BÁO', `câu dài ${n} chữ: "${s.slice(0, 70)}…"`);
  }
}
console.log(`\n${files.length} file — ${loi} lỗi, ${canhBao} cảnh báo`);
process.exit(loi ? 1 : 0);
