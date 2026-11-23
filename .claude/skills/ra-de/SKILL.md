---
name: ra-de
description: Ra bộ đề luyện tập Toán theo chuyên đề (10 đề: 3 đề mức độ 1, 4 đề mức độ 2, 3 đề mức độ 3; mỗi đề 8 trắc nghiệm, 2 Đúng/Sai, 4 trả lời ngắn, 45 phút, có lời giải chi tiết) và tải lên ngân hàng đề trên triducmath.vn. Dùng khi chủ website muốn thêm đề / chuyên đề mới cho học sinh luyện.
---

# Ra đề luyện tập theo chuyên đề

1. Xác định lớp và chuyên đề (ví dụ "Toán 7 – Số hữu tỉ"). Nếu chưa rõ phạm vi kiến thức, liệt kê nội dung chuyên đề theo CT GDPT 2018 và hỏi chủ website.
2. Giao cho agent **giao-vien-ra-de** (đọc `.claude/agents/giao-vien-ra-de.md`). Để nhanh, có thể chạy 3 agent song song, mỗi agent một mức độ (file `de-thi/toan-<lớp>/<slug>-tb.json`, `-kha.json`, `-gioi.json`), dặn dùng `--partial` khi tự kiểm tra và **không tải lên**.
3. Kiểm tra toàn bộ: `node tools/check-exams.mjs de-thi/toan-<lớp>/<slug>-*.json` → 0 lỗi, 0 cảnh báo (công cụ tự tính lại đáp án có `verify` và dựng thử mọi công thức bằng KaTeX). Tự giải thử vài câu khó.
4. Tải lên: `node tools/upload-exams.mjs de-thi/toan-<lớp>/<slug>-*.json` (dùng `.env.local`: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `EXAM_IMPORT_TOKEN`, `EXAM_IMPORT_FUNCTION`).
5. Commit file đề, báo chủ website: số đề / câu theo mức độ, ma trận nội dung, các câu "giáo viên" còn băn khoăn.
6. Cập nhật `noi-dung/thong-tin-xac-thuc.md` (mục Luyện đề theo chuyên đề) — danh sách chuyên đề hiện có.

Ghi chú: đề đã có học sinh làm sẽ không bị ghi đè khi tải lại; muốn sửa thì tạo đề mới (slug mới).
