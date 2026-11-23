# Định dạng kịch bản video — Trí Đức Math (video giấu mặt)

Video **giấu mặt**: không có nhân vật, không có hình người. Chỉ có **giọng thầy Đức** dẫn dắt các em tìm hiểu một phương pháp học, kèm đồ hoạ chuyển động (chữ, từ khoá, các bước, bảng Toán, biểu tượng) và phụ đề.

Mỗi video là một file `video/kich-ban/<slug>.json`. Máy đọc file này để tạo giọng đọc, phụ đề, đồ hoạ và xuất video. Kiểm tra bằng `node video/scripts/kiem-tra-kich-ban.mjs <file>`.

## Người dẫn
- **Thầy Đức** (`"duc"`) — người duy nhất nói trong video. Giáo viên Toán của Trí Đức Math: điềm đạm, gần gũi, hài hước nhẹ. Nói trực tiếp với người xem: xưng "thầy", gọi "các em" / "em".
- **Câu đầu tiên luôn là đúng "Chào các em!"** — không tự giới thiệu tên, không giới thiệu kênh. Câu sau vào thẳng vấn đề.
- Có thể kể tình huống ("Có bạn học sinh lớp 8 kể với thầy…") nhưng **không có nhân vật thứ hai nói**.

## Cấu trúc gợi ý (3–5 phút, ~550–850 chữ lời đọc)
1. `mo-dau` — chào, nêu vấn đề quen thuộc của học sinh (một câu "móc").
2. `giang` — vì sao cách học thường gặp chưa hiệu quả; giới thiệu phương pháp.
3. `bang` — phương pháp là gì, vì sao hiệu quả (dựa trên nghiên cứu, nói đơn giản).
4. `vi-du` — **ví dụ minh họa bằng một bài Toán thật** (cấp 2 hoặc 3): thầy làm mẫu cách áp dụng, chỉ ra lỗi hay gặp.
5. `bang` — các bước áp dụng tại nhà (3–5 bước).
6. `giang` — lưu ý thực tế, kết quả có thể mong đợi (khiêm tốn, không hứa điểm số).
7. `tong-ket` — 3 ý chính để nhớ.
8. `ket-thuc` — lời nhắn + kêu gọi nhẹ (luyện đề trên triducmath.vn).

## Khung JSON

```json
{
  "slug": "tu-kiem-tra-tri-nho",
  "tieu_de": "Tự kiểm tra trí nhớ: học ít mà nhớ lâu",
  "phuong_phap": "Luyện tập truy hồi (Retrieval practice)",
  "doi_tuong": "Học sinh cấp 2 và cấp 3",
  "nhac": "vui-tuoi-ukulele.wav",
  "nguon": [ { "ten": "Roediger & Karpicke (2006), Psychological Science", "url": "https://..." } ],
  "canh": [
    { "loai": "mo-dau", "tieu_de": "Học ít mà nhớ lâu", "phu_de": "Thử cách tự kiểm tra trí nhớ",
      "loi": [
        { "nguoi": "duc", "cau": "Chào các em!" },
        { "nguoi": "duc", "cau": "Em đọc bài ba lần, thấy quen hết, mà vào kiểm tra lại quên?", "chu": "Đọc 3 lần vẫn quên?", "bieu_tuong": "sach" }
      ] },
    { "loai": "giang", "tieu_de": "Vì sao đọc lại chưa đủ?",
      "loi": [ { "nguoi": "duc", "cau": "Đọc lại làm em quen mắt, nhưng quen mắt chưa phải là nhớ.", "chu": "Quen mắt ≠ nhớ", "bieu_tuong": "mat" } ] },
    { "loai": "bang", "tieu_de": "Luyện tập truy hồi là gì?",
      "noi_dung": ["Gấp sách lại", "Tự nhớ và viết ra", "Mở sách, chấm và sửa"],
      "loi": [ { "nguoi": "duc", "cau": "..." } ] },
    { "loai": "vi-du", "tieu_de": "Thử với hằng đẳng thức",
      "de_bai": "Viết lại hằng đẳng thức $(a-b)^2$ mà không nhìn sách.",
      "loi_giai": ["Viết nhầm: $(a-b)^2 = a^2 - b^2$ ✗", "Thử $a=3, b=1$: $4 \\ne 8$", "Đúng: $(a-b)^2 = a^2 - 2ab + b^2$"],
      "loi": [ { "nguoi": "duc", "cau": "..." } ] },
    { "loai": "tong-ket", "tieu_de": "Ba điều cần nhớ", "noi_dung": ["...", "...", "..."], "loi": [ { "nguoi": "duc", "cau": "..." } ] },
    { "loai": "ket-thuc", "loi": [ { "nguoi": "duc", "cau": "Chúc các em học vui. Hẹn gặp lại!" } ] }
  ],
  "dang_mxh": { "tieu_de": "...", "mo_ta": "...", "hashtag": ["#hoctap", "#triducmath"], "caption_ngan": "..." }
}
```

## Quy tắc
- `loai`: `mo-dau` | `giang` | `bang` | `vi-du` | `tong-ket` | `ket-thuc`.
- Mọi câu đều `"nguoi": "duc"`. Mỗi `cau` **tối đa 28 chữ** (phụ đề vừa 2 dòng).
- `chu` (tuỳ chọn, nên có ở cảnh `mo-dau` và `giang`): cụm chữ **≤ 8 chữ** hiện to trên màn hình khi thầy đọc câu đó — từ khoá, câu hỏi, con số đáng nhớ. Không chép nguyên câu đọc.
- `bieu_tuong` (tuỳ chọn): hình minh hoạ đi kèm `chu`. Chọn trong: `sach`, `mat`, `nao`, `but`, `lich`, `dong-ho`, `bong-den`, `muc-tieu`, `dau-hoi`, `dau-tich`, `dau-x`, `bieu-do`, `lap-lai`, `ngoi-sao`, `ngu`, `trai-tim`.
- Công thức Toán viết LaTeX trong `$...$` **chỉ ở `noi_dung`, `de_bai`, `loi_giai`, `chu`** (hiện trên màn hình). Trong `cau` (lời đọc) viết bằng chữ: "a trừ b bình phương", "x bằng 2".
- Không hứa hẹn điểm số, không bịa số liệu nghiên cứu, không gọi Trí Đức Math là "trung tâm", không nhắc thương hiệu khác.
- Ngôn từ hợp lứa tuổi 11–18: gần gũi, không lóng thô, không chê bai học sinh.
- Toàn bộ lời đọc: 550–850 chữ (≈ 3,5–5 phút).
