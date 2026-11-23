---
name: noi-dung-web
description: Soạn, duyệt và đăng nội dung cho website Trí Đức Math (triducmath.vn) — các phần Giới thiệu, Phương pháp, Hỏi đáp, Chương trình hoặc nội dung mới. Dùng khi chủ website muốn bổ sung/viết lại nội dung web, xem bản nháp chờ duyệt, hoặc nói "duyệt", "đăng", "sửa bản nháp", "bỏ bản nháp".
---

# Nội dung website Trí Đức Math

Quy trình 3 bước, **không bao giờ đăng khi chưa được chủ website duyệt rõ ràng trong khung chat** (một câu như "duyệt bài X", "đăng đi").

Thư mục:
- `noi-dung/thong-tin-xac-thuc.md` — dữ kiện được phép dùng.
- `noi-dung/cho-duyet/` — bản nháp chờ duyệt.
- `noi-dung/da-dang/` — bản đã đăng (lưu lịch sử).
- `noi-dung/bo/` — bản nháp bị bỏ.

## 1. Soạn bản nháp
- Giao việc cho agent **bien-tap-noi-dung** (Agent tool, `subagent_type: "bien-tap-noi-dung"`), nêu rõ phần cần viết và ý của chủ website. Nếu chủ website không nói phần nào, cho agent tự đề xuất 2–3 phần đang mỏng nhất.
- Sau khi agent xong, chạy `node tools/kiem-tra-van-phong.mjs noi-dung/cho-duyet/*.md`; còn LỖI thì nhờ agent sửa (SendMessage) đến khi 0 lỗi.
- Trình bày cho chủ website: mỗi bản nháp hiện **nguyên văn phần "Nội dung đề xuất"**, phần thay đổi so với hiện tại, và các câu "Cần bạn xác nhận". Hỏi duyệt từng bài.

## 2. Sửa theo góp ý
- Chủ website góp ý → sửa thẳng file nháp (hoặc nhờ agent), chạy lại kiểm tra văn phong, trình bày lại.
- Câu trả lời cho `[CẦN XÁC NHẬN]` → thay vào bản nháp **và** ghi bổ sung vào `thong-tin-xac-thuc.md` (kèm ngày).

## 3. Đăng (chỉ khi đã được duyệt)
1. Chạy `node tools/kiem-tra-van-phong.mjs --dang <file>` — phải 0 lỗi (không còn `[CẦN XÁC NHẬN]`).
2. Sửa `Math-Center/index.html` đúng vị trí phần đó, giữ nguyên cấu trúc HTML/class hiện có (ví dụ Hỏi đáp dùng `<details><summary>…</summary><p>…</p></details>`; Phương pháp dùng `<li><span class="step-num">n</span><div><h3>…</h3><p>…</p></div></li>`). Nội dung chữ phải **khớp từng chữ** với bản đã duyệt. Phần mới chưa có trên trang: thêm `<section class="section">` theo cùng phong cách, cập nhật menu nếu cần.
3. Xem lại trong khung trình duyệt (preview `math-center`), kiểm tra cả màn hình điện thoại.
4. Đổi `trang_thai: da-dang`, thêm `ngay_dang:`, chuyển file sang `noi-dung/da-dang/`.
5. Commit (tiếng Việt hoặc tiếng Anh, có dòng Co-Authored-By theo quy định) và push lên `main`. GitHub Actions tự đưa lên https://triducmath.vn trong ~1 phút; kiểm tra lại trên web thật.
6. Báo chủ website: đã đăng gì, ở đâu, link.

## Bỏ bản nháp
Chủ website nói bỏ → chuyển file sang `noi-dung/bo/` (không xoá), ghi lý do vào đầu file.
