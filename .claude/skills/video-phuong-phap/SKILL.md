---
name: video-phuong-phap
description: Làm video ngắn (3–5 phút) giới thiệu phương pháp học tập tích cực cho học sinh cấp 2–3, nhân vật thầy Đức dẫn dắt bạn Minh, có giọng đọc, phụ đề, nhạc nền, xuất bản dọc và ngang cho TikTok/Reels/Shorts/YouTube/Facebook. Dùng khi chủ website muốn nghiên cứu phương pháp học, viết kịch bản video, duyệt kịch bản, dựng video, hoặc chuẩn bị đăng video lên mạng xã hội. Mục tiêu: ít nhất 2 video mỗi tuần.
---

# Video phương pháp học tập — Trí Đức Math

Quy trình có **2 lần duyệt** của chủ website: duyệt kịch bản, rồi duyệt video. Không bỏ qua bước duyệt nào. Video không tự đăng — chủ website tự tải lên mạng xã hội bằng các file đã chuẩn bị.

Thư mục `video/`:
- `KICH-BAN.md` — định dạng kịch bản (nhân vật, cấu trúc, quy tắc).
- `danh-sach-phuong-phap.md` — danh sách phương pháp đã nghiên cứu + trạng thái.
- `kich-ban/<slug>.json` — kịch bản. `_mau.json` là mẫu thử ngắn.
- `nhac/` — nhạc nền miễn phí bản quyền do chủ website tải về (mp3/m4a/wav).
- `xuat/<slug>/` — kết quả: `<slug>-ngang.mp4`, `<slug>-doc.mp4`, `<slug>.srt`, `dang-mxh.md`, ảnh bìa.
- `scripts/` — công cụ; `src/` — hoạt hình (Remotion, React).

## Bước 1 — Nghiên cứu & viết kịch bản
- Giao cho agent **nghien-cuu-phuong-phap** (Agent tool, `subagent_type: "nghien-cuu-phuong-phap"`; nếu chưa có trong danh sách thì dùng `general-purpose` và bảo nó đọc `.claude/agents/nghien-cuu-phuong-phap.md`). Mỗi tuần: 2 kịch bản cho 2 phương pháp tiếp theo trong `danh-sach-phuong-phap.md` (trạng thái "chưa làm"), xen kẽ ví dụ Toán cấp 2 và cấp 3.
- Kiểm tra lại: `node video/scripts/kiem-tra-kich-ban.mjs video/kich-ban/<slug>.json` → 0 lỗi. Tự giải lại mọi phép toán trong ví dụ.

## Bước 2 — Chủ website duyệt kịch bản
- Xuất bản đọc duyệt: `node video/scripts/doc-kich-ban.mjs video/kich-ban/<slug>.json` → `video/kich-ban/<slug>.md` (lời thoại theo cảnh, nội dung bảng, nguồn). Gửi file đó cho chủ website (SendUserFile) kèm tóm tắt câu chuyện.
- Sửa theo góp ý, kiểm tra lại. Chỉ sang bước 3 khi chủ website nói duyệt rõ ràng.
- Có thể dựng bản nháp trước để xem phong cách: `node video/scripts/lam-video.mjs <file> --nhap --chi-anh` (vài khung hình) hoặc `--nhap` (cả video, giọng Edge miễn phí).

## Bước 3 — Dựng video
`node video/scripts/lam-video.mjs video/kich-ban/<slug>.json`
- Tự tạo giọng đọc (FPT.AI nếu `.env.local` có `FPT_TTS_API_KEY`; không có thì dùng giọng Edge và ghi rõ "BẢN XEM THỬ"), phụ đề cháy chữ + file `.srt`, nhạc nền (chọn từ `video/nhac/`, giảm âm lượng khi có lời), hai khổ: ngang 1920×1080 và dọc 1080×1920.
- Thời gian dựng: ~2 phút máy cho mỗi phút video (cả 2 khổ).
- Thêm `--chi-doc` / `--chi-ngang` để dựng một khổ.
- Biến môi trường giọng trong `.env.local`: `FPT_VOICE_DUC` (mặc định `leminh`), `FPT_VOICE_MINH` (mặc định `minhquang`), `FPT_SPEED_DUC`, `FPT_SPEED_MINH` (−3…3). Đổi giọng → dựng lại sẽ tự tạo lại giọng đọc.

## Bước 4 — Chủ website duyệt video
- Gửi file video (SendUserFile) và ảnh bìa; tóm tắt thời lượng, nhạc dùng, giọng dùng.
- Sửa → chỉnh kịch bản/`src/` → dựng lại.
- Duyệt xong: cập nhật trạng thái trong `danh-sach-phuong-phap.md` thành "đã dựng — chờ đăng".

## Bước 5 — Chuẩn bị đăng (chủ website tự đăng)
Gửi `dang-mxh.md` và hướng dẫn ngắn:
- **TikTok / Instagram Reels / YouTube Shorts / Facebook Reels**: `<slug>-doc.mp4`. Shorts tối đa 3 phút (video dài hơn → đăng bản ngang lên YouTube thường).
- **YouTube** (video thường): `<slug>-ngang.mp4`, tải `<slug>.srt` vào mục Phụ đề, ảnh bìa `anh-bia-ngang.png`.
- **Facebook Page**: `<slug>-ngang.mp4` hoặc bản dọc; tải `.srt` (đổi tên thành `<tên>.vi_VN.srt`).
- Sau khi chủ website báo đã đăng: ghi link vào `danh-sach-phuong-phap.md`, trạng thái "đã xuất bản".

## Lưu ý
- Nhân vật, màu sắc, logo đã cố định trong `src/` — giữ nhất quán giữa các tập.
- Không hứa hẹn điểm số, không bịa số liệu nghiên cứu, không gọi Trí Đức Math là "trung tâm".
- File video, giọng đọc, nhạc không đưa lên Git (đã có trong .gitignore).
