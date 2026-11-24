# Quy tắc ra đề Trí Đức Math

Đọc kỹ toàn bộ trước khi soạn. Công cụ `scripts/check-exams.mjs` chặn mọi đề sai cấu trúc.

## 1. Cấu trúc mỗi đề (bắt buộc, công cụ kiểm tra sẽ chặn nếu sai)

Đề 45 phút, thang điểm 10:

| Phần | Dạng | Số câu | Điểm/câu | Tổng |
|---|---|---|---|---|
| I | Trắc nghiệm 4 phương án (`mcq`) | 8 | 0,5 | 4 |
| II | Đúng/Sai, mỗi câu 4 ý a–d (`tf`) | 2 | 2 | 4 |
| III | Trả lời ngắn (`short`) | 4 | 0,5 | 2 |

- Thứ tự câu: 8 câu `mcq` → 2 câu `tf` → 4 câu `short`.
- Câu Đúng/Sai được chấm tự động theo tỉ lệ thi THPT: đúng 1/2/3/4 ý được 10%/25%/50%/100% điểm câu.
- Trả lời ngắn: đáp số **là một số** (số nguyên hoặc thập phân, tối đa 6 ký tự kể cả dấu "−" và dấu phẩy). Không dùng phân số, đơn vị hay chữ trong đáp số; nếu kết quả là phân số thì hỏi theo cách cho ra số thập phân hữu hạn hoặc số nguyên. Có thể liệt kê thêm cách viết tương đương trong `answer` (ví dụ `["-12"]`, `["2.5", "2,5"]`).

## 2. Ba mức độ (mỗi chuyên đề: 3 đề mức độ 1, 4 đề mức độ 2, 3 đề mức độ 3)

Trên website và trong mọi chữ học sinh nhìn thấy (`title`, `description`, lời giải) **chỉ gọi là "Mức độ 1 / 2 / 3"** (kèm "cơ bản / vận dụng / nâng cao" nếu cần), **không** dùng "Trung bình / Khá / Giỏi" để tránh dán nhãn học sinh. Mã `level` trong file vẫn giữ nguyên `tb` / `kha` / `gioi`.

- **Mức độ 1 — cơ bản (`tb`)**: chủ yếu Nhận biết + Thông hiểu (≈ 70%), Vận dụng đơn giản 1–2 bước. Số liệu gọn, ít bẫy. Dành cho học sinh đang củng cố nền tảng.
- **Mức độ 2 — vận dụng (`kha`)**: Thông hiểu + Vận dụng (≈ 50/50), bài nhiều bước, bối cảnh thực tế, có bẫy về dấu / thứ tự thực hiện.
- **Mức độ 3 — nâng cao (`gioi`)**: Vận dụng + Vận dụng cao (≥ 60%), bài tổng hợp, suy luận, tìm điều kiện, đếm/biện luận, bài toán thực tế mở.

`description` mỗi đề bắt đầu bằng: `"Đề luyện tập mức độ 1 (cơ bản): ..."`, `"... mức độ 2 (vận dụng): ..."`, `"... mức độ 3 (nâng cao): ..."`.

Trong mỗi mức, các đề phải **khác nhau thật sự**: khác số liệu, khác bối cảnh, khác cách hỏi; không chỉ đổi số. Bao phủ đều các nội dung của chuyên đề trên toàn bộ 10 đề.

## 3. Chất lượng câu hỏi

- Đúng kiến thức, đúng phạm vi lớp; dùng thuật ngữ SGK Việt Nam; câu chữ ngắn gọn, rõ nghĩa, không đánh đố vì câu chữ.
- **Phương án nhiễu** lấy từ lỗi sai thường gặp của học sinh (sai dấu, quên đổi dấu khi bỏ ngoặc, nhầm thứ tự phép tính, nhầm bội/ước…), không vô lý.
- Đáp án đúng của 8 câu trắc nghiệm **phân bố đều** A/B/C/D (không quá 4 câu cùng một chữ).
- Mỗi câu Đúng/Sai: 4 ý cùng một dữ kiện, có cả ý Đúng lẫn ý Sai, độ khó tăng dần từ a đến d.
- Bối cảnh thực tế phù hợp tuổi học sinh, số liệu hợp lý (nhiệt độ, độ cao so với mực nước biển, tiền lãi/lỗ, tầng hầm, điểm thưởng/phạt…).
- **Lời giải chi tiết** cho mọi câu: trình bày từng bước như giáo viên chữa bài; với trắc nghiệm nêu vì sao chọn đáp án đúng và chỉ ra lỗi dẫn tới phương án nhiễu chính; với Đúng/Sai giải thích **từng ý a, b, c, d**.
- Công thức viết bằng LaTeX trong `$...$` (trong dòng) hoặc `$$...$$` (dòng riêng). Số âm viết `$-5$`; phép nhân `\cdot`; phân số `\frac{a}{b}`. Chú ý: trong JSON, dấu `\` phải viết thành `\\` (ví dụ `"$3 \\cdot (-4)$"`).
- Độ C viết `$-4^\circ\mathrm{C}$` hoặc `$-4\,{}^\circ\mathrm{C}$`; **không** viết `\,^\circ` (KaTeX báo lỗi, hiện chữ đỏ trên web). Công cụ kiểm tra dựng thử mọi công thức bằng KaTeX và báo "công thức lỗi hiển thị" nếu sai.
- Không dùng hình ảnh (chưa hỗ trợ khi nhập tự động).
- Chỉ dùng kiến thức **đã học đến chuyên đề đó** theo CT GDPT 2018 (ví dụ: Toán 6 chưa học kí hiệu giá trị tuyệt đối $|a|$, lũy thừa số mũ âm, phân số âm ở chương Số nguyên).

## 4. Định dạng file

Mỗi mức độ một file trong thư mục `de-thi/toan-<lớp>/` (tạo trong thư mục đang làm việc), tên `<slug-chuyên-đề>-<mức>.json`, ví dụ `de-thi/toan-6/so-nguyen-tb.json`:

```json
{
  "grade": 6,
  "topic": "Số nguyên",
  "exams": [
    {
      "slug": "toan6-so-nguyen-tb-01",
      "title": "Số nguyên — Đề 1",
      "level": "tb",
      "sort_order": 1,
      "time_limit_min": 45,
      "description": "Đề luyện tập mức độ 1 (cơ bản): cộng, trừ, so sánh số nguyên.",
      "questions": [
        { "kind": "mcq", "prompt": "Kết quả của phép tính $(-7) + 4$ là", "options": ["$-3$", "$3$", "$-11$", "$11$"],
          "answer": 0, "points": 0.5, "verify": "(-7) + 4",
          "explanation": "Cộng hai số nguyên khác dấu: ..." },
        { "kind": "tf", "prompt": "Cho các số nguyên $a = -5$, $b = 3$. Xét tính đúng sai của các khẳng định sau:",
          "options": ["$a + b = -2$", "$a \\cdot b = 15$", "$a < b$", "$a - b = -8$"],
          "answer": [true, false, true, true], "points": 2,
          "verify": "[(-5)+3===-2, (-5)*3===15, -5<3, (-5)-3===-8]",
          "explanation": "a) ... b) ... c) ... d) ..." },
        { "kind": "short", "prompt": "Tính $(-12) - (-20)$.", "answer": ["8"], "points": 0.5,
          "verify": "(-12) - (-20)", "explanation": "..." }
      ]
    }
  ]
}
```

- `slug`: `toan<lớp>-<slug-chuyên-đề>-<mức>-<2 chữ số>`, không dấu, duy nhất. `title`: "<Chuyên đề> — Đề <n>". `sort_order`: số thứ tự đề trong mức.
- `answer`: `mcq` → chỉ số 0–3 (0 = A); `tf` → 4 giá trị `true/false`; `short` → mảng chuỗi số.
- `verify` (**bắt buộc với mọi câu tính toán được**): một biểu thức JavaScript tự tính lại đáp án. `mcq` → giá trị số của phương án đúng; `short` → đáp số; `tf` → mảng 4 boolean. Có sẵn `Math` và hàm `gcd(a, b)`. Viết `verify` **độc lập với đáp án bạn nghĩ ra** (tính lại từ đề bài), không chép hằng số. Câu thuần lý thuyết (không tính được) thì bỏ `verify` và tự kiểm tra kỹ hơn.

Xem đề mẫu đầy đủ (14 câu, đúng chuẩn) ở `tai-lieu/de-mau.json`.
