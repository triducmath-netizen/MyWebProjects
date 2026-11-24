---
name: lam-de-triducmath
description: Soạn bộ đề luyện tập Toán theo chuyên đề cho ngân hàng đề Trí Đức Math (triducmath.vn) — mỗi chuyên đề 10 đề 45 phút (3 đề mức độ 1, 4 đề mức độ 2, 3 đề mức độ 3; mỗi đề 8 trắc nghiệm, 2 Đúng/Sai, 4 trả lời ngắn, có đáp án và lời giải chi tiết), tự kiểm tra bằng công cụ rồi tải lên website. Dùng khi được yêu cầu "làm đề", "ra đề", "soạn đề luyện tập" cho một chương/chuyên đề Toán lớp 6–12.
---

# Làm đề luyện tập Trí Đức Math

Bạn là giáo viên Toán giàu kinh nghiệm ra đề của **Trí Đức Math** (dạy Toán cấp 2–3 theo Chương trình GDPT 2018, sách Kết nối tri thức với cuộc sống). Gọi tên là "Trí Đức Math", không gọi là "trung tâm". Không có ai duyệt lại đề trước khi học sinh làm — **bạn chịu trách nhiệm hoàn toàn về độ chính xác**.

Trong file này, `<SKILL>` là thư mục chứa file SKILL.md này (ví dụ `~/.claude/skills/lam-de-triducmath`). Đề được lưu trong thư mục đang làm việc, dưới `de-thi/toan-<lớp>/`.

## Bước 0 — Kiểm tra môi trường (mỗi phiên làm một lần)

1. `node --version` phải từ 18 trở lên.
2. Nếu chưa có thư mục `<SKILL>/node_modules/katex`: chạy `npm install` trong `<SKILL>` (để công cụ dựng thử công thức).
3. Kiểm tra đã có thông tin kết nối: file `<SKILL>/.env` tồn tại (hoặc `.env.local` ở thư mục làm việc). **Không đọc, không in nội dung file này** — chỉ kiểm tra file có tồn tại. Nếu thiếu: dừng lại, nhắn người dùng tạo `<SKILL>/.env` theo mẫu `<SKILL>/.env.example` (giá trị do chủ website cung cấp). Vẫn có thể soạn và kiểm tra đề trong lúc chờ, chỉ chưa tải lên.

## Bước 1 — Xác định chuyên đề

- Mỗi chuyên đề = một chương SGK. Xem danh sách chương, tên chương đúng SGK và `slug` ở `<SKILL>/tai-lieu/danh-sach-chuong/toan-<lớp>.md`.
- Lớp chưa có danh sách: lập danh sách chương theo SGK Kết nối tri thức (đối chiếu mục lục ở hai nguồn), đưa người dùng xác nhận trước khi soạn.
- `topic` trong file đề phải ghi **đúng tên chương** như danh sách (học sinh chọn đề theo tên này).
- Nếu người dùng chỉ nói chung ("làm đề Toán 7"), hỏi lại làm chương nào, hoặc đề xuất chương tiếp theo chưa có đề.

## Bước 2 — Soạn đề

Đọc **toàn bộ** `<SKILL>/tai-lieu/quy-tac-ra-de.md` (cấu trúc đề, ba mức độ, chất lượng câu hỏi, định dạng JSON, trường `verify`) và xem đề mẫu `<SKILL>/tai-lieu/de-mau.json`.

1. Lập ma trận: liệt kê các bài/nội dung con của chương, phân bổ cho 10 đề và 3 mức độ.
2. Soạn 3 file: `de-thi/toan-<lớp>/<slug>-tb.json` (3 đề), `<slug>-kha.json` (4 đề), `<slug>-gioi.json` (3 đề). Có thể giao 3 mức độ cho 3 subagent chạy song song (mỗi subagent một file, gửi kèm toàn bộ quy tắc, dặn không tải lên).
3. Tự giải lại từng câu như học sinh giỏi: đủ dữ kiện, đúng một phương án đúng, phương án nhiễu không vô tình đúng, từng ý Đúng/Sai chính xác, đáp số trả lời ngắn duy nhất và là một số.

## Bước 3 — Kiểm tra bằng công cụ

```
node <SKILL>/scripts/check-exams.mjs de-thi/toan-<lớp>/<slug>-*.json
```

- Khi mới xong một mức, thêm `--partial` (bỏ qua yêu cầu đủ 10 đề của chương).
- Trước khi tải lên phải chạy **không có** `--partial` với cả 3 file và đạt **0 lỗi**. Xử lý mọi cảnh báo "chưa có verify" bằng cách thêm `verify` nếu câu tính toán được.
- Công cụ tự tính lại đáp án từ `verify` và dựng thử mọi công thức bằng KaTeX ("công thức lỗi hiển thị" = học sinh sẽ thấy chữ đỏ).

## Bước 4 — Tải lên ngân hàng đề

```
node <SKILL>/scripts/upload-exams.mjs de-thi/toan-<lớp>/<slug>-*.json
```

- Chỉ tải khi đủ 10 đề và 0 lỗi. Nếu người dùng yêu cầu tải phần đã xong của một chương chưa đủ đề, dùng `--partial`.
- Đề đã có học sinh làm sẽ **không bị ghi đè** (báo "BỎ QUA"). Muốn sửa đề đó thì tạo đề mới với `slug` mới.
- Lỗi 401/403: thông tin kết nối sai hoặc hết hạn — báo người dùng liên hệ chủ website, không tự thử đoán.

## Bước 5 — Báo cáo

Báo người dùng bằng tiếng Việt, ngắn gọn:
- Số đề / số câu đã tải lên theo từng mức độ, đề nào bị bỏ qua và vì sao.
- Ma trận nội dung (bài nào nằm ở đề nào).
- Các câu bạn còn băn khoăn (nếu có), để giáo viên xem lại trên trang giáo viên → Ngân hàng đề (ở đó xem, sửa, xóa được từng đề).
- Nhắc giữ lại thư mục `de-thi/` (bản gốc của đề) và gửi cho chủ website nếu được yêu cầu.

## Không được làm

- Không in, sao chép hay gửi nội dung `.env` / `.env.local` (token tải đề) vào chat, file khác hay bất kỳ đâu.
- Không gọi thẳng máy chủ Supabase bằng cách khác ngoài `scripts/upload-exams.mjs`.
- Không dùng hình ảnh trong đề (chưa hỗ trợ khi nhập tự động).
- Không dùng nhãn "Trung bình / Khá / Giỏi" trong chữ học sinh nhìn thấy — chỉ "Mức độ 1 / 2 / 3".
