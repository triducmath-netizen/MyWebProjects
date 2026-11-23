# Định dạng kịch bản video — Trí Đức Math

Mỗi video là một file `video/kich-ban/<slug>.json`. Máy đọc file này để tạo giọng đọc, phụ đề, hoạt hình và xuất video. **Viết đúng định dạng** — công cụ `node video/scripts/kiem-tra-kich-ban.mjs <file>` sẽ báo lỗi nếu sai.

## Nhân vật
- **Thầy Đức** (`"duc"`): giáo viên Toán của Trí Đức Math, khoảng 35 tuổi, điềm đạm, hài hước nhẹ, nói chậm rãi, rõ ràng. Là người dẫn dắt và **giọng đọc chính** của video.
- **Minh** (`"minh"`): học sinh lớp 8–10, tò mò, hay hỏi thẳng, đôi khi lười / chủ quan lúc đầu, rồi tự trải nghiệm phương pháp và thấy hiệu quả. Nói ngắn, đúng giọng tuổi teen nhưng lễ phép (gọi "thầy", xưng "em").

## Cấu trúc gợi ý (3–5 phút, ~550–800 chữ lời thoại)
1. `mo-dau` — tên phương pháp, một câu "móc" (vấn đề Minh gặp phải).
2. `hoi-thoai` — Minh kể khó khăn (học mãi không nhớ, thi quên bài…). Thầy Đức hỏi lại, gợi mở.
3. `bang` — Thầy Đức giới thiệu phương pháp: nó là gì, vì sao hiệu quả (dựa trên nghiên cứu, nói đơn giản).
4. `vi-du` — **ví dụ minh họa cụ thể bằng một bài Toán thật** (cấp 2 hoặc 3), Minh thử áp dụng, có lúc sai rồi sửa.
5. `bang` — các bước áp dụng tại nhà (3–5 bước, mỗi bước 1 câu).
6. `hoi-thoai` — Minh sau 1–2 tuần áp dụng: kết quả, cảm nhận (thực tế, không phóng đại).
7. `tong-ket` — 3 ý chính để nhớ.
8. `ket-thuc` — lời nhắn + kêu gọi nhẹ nhàng (theo dõi kênh, luyện đề trên triducmath.vn).

## Khung JSON

```json
{
  "slug": "tu-kiem-tra-tri-nho",
  "tieu_de": "Tự kiểm tra trí nhớ: học ít mà nhớ lâu",
  "phuong_phap": "Luyện tập truy hồi (Retrieval practice)",
  "doi_tuong": "Học sinh cấp 2 và cấp 3",
  "nguon": [
    { "ten": "Roediger & Karpicke (2006), Psychological Science", "url": "https://..." }
  ],
  "canh": [
    { "loai": "mo-dau", "tieu_de": "Tự kiểm tra trí nhớ", "phu_de": "Học ít mà nhớ lâu",
      "loi": [ { "nguoi": "duc", "cau": "Chào các em, thầy là thầy Đức.", "dieu_bo": "vay-tay" } ] },
    { "loai": "hoi-thoai",
      "loi": [
        { "nguoi": "minh", "cau": "Thầy ơi, em đọc lại bài ba lần mà vào thi vẫn quên.", "dieu_bo": "buon" },
        { "nguoi": "duc", "cau": "Đọc lại thì quen mắt, nhưng chưa chắc đã nhớ.", "dieu_bo": "giang-giai" }
      ] },
    { "loai": "bang", "tieu_de": "Luyện tập truy hồi là gì?",
      "noi_dung": ["Gấp sách lại", "Tự nhớ và viết ra", "Mở sách kiểm tra"],
      "loi": [ { "nguoi": "duc", "cau": "...", "dieu_bo": "chi-bang" } ] },
    { "loai": "vi-du", "tieu_de": "Thử với hằng đẳng thức",
      "de_bai": "Viết lại hằng đẳng thức $(a+b)^2$ mà không nhìn sách.",
      "loi_giai": ["$(a+b)^2 = a^2 + 2ab + b^2$"],
      "loi": [ { "nguoi": "minh", "cau": "...", "dieu_bo": "suy-nghi" } ] },
    { "loai": "tong-ket", "tieu_de": "Ba điều cần nhớ", "noi_dung": ["...", "...", "..."],
      "loi": [ { "nguoi": "duc", "cau": "...", "dieu_bo": "gat-dau" } ] },
    { "loai": "ket-thuc",
      "loi": [ { "nguoi": "duc", "cau": "Hẹn gặp các em ở video sau.", "dieu_bo": "vay-tay" } ] }
  ],
  "dang_mxh": {
    "tieu_de": "Học ít mà nhớ lâu? Thử cách tự kiểm tra trí nhớ | Trí Đức Math",
    "mo_ta": "2–4 câu mô tả + nhắc triducmath.vn",
    "hashtag": ["#hoctap", "#phuongphaphoc", "#toan", "#triducmath"],
    "caption_ngan": "1 câu cho TikTok/Reels/Shorts"
  }
}
```

## Quy tắc
- `loai`: `mo-dau` | `hoi-thoai` | `bang` | `vi-du` | `tong-ket` | `ket-thuc`.
- Mỗi cảnh có `loi` (mảng câu thoại, ít nhất 1). `nguoi`: `duc` | `minh`.
- `dieu_bo` (dáng điệu) — tuỳ chọn, mặc định `binh-thuong`:
  `binh-thuong`, `giang-giai`, `chi-bang`, `suy-nghi`, `vui`, `ngac-nhien`, `buon`, `gat-dau`, `vay-tay`, `viet-bang`.
- Mỗi `cau` **tối đa 28 chữ** (để phụ đề vừa 2 dòng); câu dài thì tách thành nhiều câu.
- Công thức Toán viết LaTeX trong `$...$` **chỉ ở `noi_dung`, `de_bai`, `loi_giai`** (hiện trên bảng). Trong `cau` (lời đọc) viết bằng chữ cho máy đọc được: "a cộng b bình phương", "x bằng 2".
- Không nhắc tên thương hiệu khác, không quảng cáo học phí, không hứa hẹn điểm số.
- Toàn bộ lời thoại: 550–900 chữ (≈ 3–5,5 phút).
- Ngôn từ hợp lứa tuổi 11–18: gần gũi, không dùng từ lóng thô, không chê bai học sinh.
