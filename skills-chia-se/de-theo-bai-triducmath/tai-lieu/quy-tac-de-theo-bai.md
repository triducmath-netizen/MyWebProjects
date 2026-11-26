# Quy tắc ra đề kiểm tra theo bài — Trí Đức Math

Đọc kỹ toàn bộ trước khi soạn. `scripts/check-lesson-exams.mjs` chặn mọi đề sai các quy tắc có đánh dấu **(chặn)**.

## 1. Cấu trúc và thang điểm (theo đề THPT 2025) — (chặn)

Thang điểm 10, đánh số câu liên tục. Ghi `time_limit_min: 90` (thời gian chuẩn của đề; khi giao bài về nhà, giáo viên tự chọn thời gian làm hoặc để không giới hạn):

| Phần | Dạng (`kind`) | Câu | Số câu | Điểm/câu | Tổng |
|---|---|---|---|---|---|
| I | Trắc nghiệm 4 phương án (`mcq`) | 1–12 | 12 | 0,25 | 3 |
| II | Đúng/Sai, mỗi câu 4 ý a–d (`tf`) | 13–16 | 4 | 1 | 4 |
| III | Trả lời ngắn (`short`) | 17–22 | 6 | 0,5 | 3 |

- Web tự chấm Đúng/Sai theo số ý đúng: 1 ý 0,1 · 2 ý 0,25 · 3 ý 0,5 · 4 ý 1,0 điểm.
- Đúng thứ tự: 12 `mcq` → 4 `tf` → 6 `short`.

## 2. Ma trận mức độ và toán thực tế — (chặn)

- Mỗi câu ghi `muc`: `"NB"` (nhận biết), `"TH"` (thông hiểu), `"VD"` (vận dụng). Tỉ lệ ≈ 4:3:3 trên 22 câu, tức 9–10 NB, 6–7 TH, 6 VD. Công cụ cho phép NB 8–10, TH 6–8, VD 5–7.
- Mỗi câu ghi `thuc_te`: `true`/`false`. Tổng điểm các câu thực tế **≥ 2,0** (20%). Câu thực tế có thể ở bất kỳ phần nào (một câu Đúng/Sai thực tế = 1 điểm).
- `muc` và `thuc_te` chỉ để kiểm tra nội bộ và in ma trận cho giáo viên; **không** gửi lên web, **không** viết vào chữ học sinh thấy.

## 3. Phạm vi kiến thức

- Chỉ dùng kiến thức của bài đó và các bài **trước** nó (theo mục lục SGK Kết nối tri thức). Kiến thức các bài sau bị loại.
- Phương pháp tính chỉ dùng khi SGK của bài có (ví dụ đổi biến, từng phần). Không chắc thì không dùng.
- Bối cảnh thực tế lấy từ SGK (HĐ mở đầu, ví dụ, bài tập) rồi đổi số liệu; số liệu hợp lý, phù hợp tuổi học sinh.

## 4. Hạn chế bấm máy tính

Đề làm bằng tay, không cần máy tính cầm tay.

- **Phần I, II**: đáp số trong phương án có thể là số nguyên, phân số tối giản, biểu thức chính xác có $\pi$, $e$, căn đơn giản (ví dụ `$\frac{9\pi}{4}$`, `$e - \frac{1}{2}$`, `$\frac{14}{3}$`).
- **Phần III — (chặn)**: đáp số **phải là một số** (số nguyên hoặc thập phân hữu hạn), tốt nhất ≤ 4 ký tự kể cả dấu "−" và dấu phẩy (phiếu THPT có 4 ô). Web chấm bằng cách so số, nên `9π/4`, `14/3`, `2√3` sẽ bị chấm sai. Nếu kết quả tự nhiên là biểu thức, đổi câu hỏi để ra số: hỏi "$a + b$ bằng bao nhiêu" khi kết quả là $\frac{a}{b}$, hỏi tích phân có kết quả nguyên, hoặc hỏi giá trị làm tròn chỉ khi phép làm tròn kiểm tra được bằng suy luận. Có thể liệt kê cách viết tương đương trong `answer`, ví dụ `["2.5", "2,5"]`.
- Không ra câu cần nhân/chia số lớn, khai căn hay tính lũy thừa phải dùng máy (công cụ cảnh báo khi có số từ 5 chữ số).
- Với ý Đúng/Sai và phương án so sánh, ưu tiên mệnh đề kiểm tra bằng suy luận ("lớn hơn 10", "nhỏ hơn $\pi$") thay vì một số lẻ chính xác.

## 5. Hình vẽ — (chặn khi câu nhắc tới hình mà thiếu file)

- Mọi câu có parabol, đường tròn, hình phẳng giới hạn, đồ thị, bảng biến thiên, hình không gian… đều phải có hình. Câu có cụm "hình vẽ / hình bên / như hình / bảng biến thiên / cho đồ thị" mà thiếu `image` bị chặn.
- **Vẽ bằng SVG** (không dùng TikZ: web không dựng được LaTeX ra hình). Mỗi hình một file `.svg`, ghi đường dẫn tương đối so với file JSON vào `image` (hình đi kèm câu hỏi) hoặc `explanation_image` (hình đi kèm lời giải). Khi tải lên, công cụ đổi SVG sang PNG rộng 900 px.
- Quy ước vẽ (xem `hinh-mau/`):
  - `viewBox` theo tọa độ điểm ảnh, ví dụ `0 0 400 300`; không đặt `width`/`height` cố định cũng được.
  - Nền trắng, nét đen `stroke-width` 1.5–2; trục có mũi tên, nhãn `x`, `y`, `O` in nghiêng (`font-style="italic"`), font `Times New Roman`, cỡ 16–18.
  - Vùng cần tính tô màu nhạt (ví dụ `#cfe3ff`, `fill-opacity` 0.7), đường biên đậm hơn.
  - Ghi nhãn các giao điểm, tọa độ đặc biệt, độ dài cạnh cần thiết. Không ghi đáp số lên hình câu hỏi.
  - Vẽ đường cong bằng `<path>` hoặc `<polyline>` với tọa độ tính sẵn (có thể viết đoạn Node ngắn để sinh tọa độ từ hàm số rồi dán vào SVG). Hình phải **đúng tỉ lệ** với dữ kiện: giao điểm đúng vị trí, parabol đúng đỉnh.
  - Bảng biến thiên: vẽ bằng `<line>`, `<text>`, mũi tên đi lên/xuống bằng `<line>` có `marker-end`.
  - Chữ toán trong hình chỉ dùng ký tự thường (`y = x² − 2x`, `π`, `√`), không dùng `$...$`.
  - Cấm `<script>`, `<foreignObject>`, liên kết ra ngoài, ảnh nhúng từ web.
- Trên web, hình hiện ngay dưới câu dẫn nên không lo tách trang.
- Ở các đề tương đương, cùng vị trí câu có hình thì đề nào cũng phải có hình (vẽ lại theo số liệu của đề đó).

## 6. Dựng 20 đề tương đương — (chặn)

- Ở cùng vị trí câu, 20 đề phải cùng `kind`, `muc`, `thuc_te`.
- Chỉ đổi số liệu, hệ số, hàm cùng dạng, bối cảnh cùng loại. Không chép nguyên văn câu giữa các đề (công cụ chặn câu trùng).
- Độ khó tương đương: không đổi số làm câu dễ hẳn (ví dụ hệ số 0) hoặc khó hẳn (số xấu).

## 7. Chất lượng câu hỏi và lời giải

- Trắc nghiệm: đúng một phương án đúng; phương án nhiễu lấy từ lỗi sai thường gặp. Đáp án đúng của 12 câu phân bố đều A/B/C/D (mỗi chữ 1–5 câu, chặn nếu lệch).
- Đúng/Sai: 4 ý cùng một dữ kiện, độ khó tăng dần a → d, có cả ý Đúng lẫn Sai (chặn nếu 4 ý cùng đáp án). 4 câu Đúng/Sai của một đề không dùng chung một mẫu đáp án; các đề tương đương cũng nên đổi mẫu.
- Lời giải cho mọi câu: nêu công thức, các bước tính, kết luận. Trắc nghiệm chỉ ra lỗi dẫn tới phương án nhiễu chính. Đúng/Sai giải thích **từng ý a, b, c, d** (Đúng/Sai và vì sao).
- Công thức LaTeX trong `$...$` hoặc `$$...$$`. Trong JSON, `\` viết thành `\\`. Độ: `^\circ`, không viết `\,^\circ` (KaTeX lỗi). Công cụ dựng thử mọi công thức.
- Dùng thuật ngữ SGK Việt Nam.

## 8. Trường `verify` (rất nên có)

Biểu thức JavaScript, công cụ chạy để tính lại đáp án:
- `short`: trả về số bằng đáp số.
- `mcq`: trả về số bằng giá trị phương án đúng; nếu phương án là biểu thức (có $\pi$, phân số…), trả về **chỉ số 0–3** của phương án đúng (ví dụ so sánh giá trị số của từng phương án với tích phân tính gần đúng).
- `tf`: trả về mảng 4 giá trị `true/false`.

Tích phân có thể kiểm bằng tổng Simpson trong `verify`, ví dụ:
`"(()=>{const f=x=>x*x;const a=0,b=3,n=1000,h=(b-a)/n;let s=f(a)+f(b);for(let i=1;i<n;i++)s+=(i%2?4:2)*f(a+i*h);return Math.round(s*h/3*1e6)/1e6;})()"`

## 9. Định dạng file

Một file cho cả bài: `de-thi/toan-<lớp>/theo-bai/bai-<số>-<slug>.json`.

```json
{
  "grade": 12,
  "chapter": "Chương IV. Nguyên hàm và tích phân",
  "topic": "Bài 12. Tích phân",
  "level": "kha",
  "exams": [
    {
      "slug": "toan12-bai12-tich-phan-01",
      "title": "Bài 12. Tích phân — Đề 1",
      "sort_order": 1,
      "time_limit_min": 90,
      "description": "Đề kiểm tra Bài 12 (Tích phân), cấu trúc THPT: 12 trắc nghiệm, 4 Đúng/Sai, 6 trả lời ngắn.",
      "questions": [
        { "kind": "mcq", "muc": "NB", "thuc_te": false, "prompt": "...", "options": ["...", "...", "...", "..."], "answer": 0, "points": 0.25, "verify": "...", "explanation": "..." },
        { "kind": "tf", "muc": "TH", "thuc_te": true, "prompt": "...", "options": ["a) ...", "b) ...", "c) ...", "d) ..."], "answer": [true, false, true, false], "points": 1, "explanation": "a) Đúng vì ... b) Sai vì ..." },
        { "kind": "short", "muc": "VD", "thuc_te": false, "prompt": "...", "image": "hinh/bai-12/de-01-cau-17.svg", "answer": ["9"], "points": 0.5, "verify": "...", "explanation": "..." }
      ]
    }
  ]
}
```

- `chapter` **(chặn)**: đúng dạng `Chương <số La Mã>. <tên chương đúng SGK>` — giáo viên chọn chương theo chữ này.
- `topic` **(chặn)**: đúng dạng `Bài <số>. <tên bài đúng SGK>` — giáo viên chọn bài theo chữ này; số bài dùng để sắp thứ tự.
- Không cần ghi `usage`: công cụ tải lên tự đánh dấu là đề bài tập về nhà.
- `level`: mặc định `"kha"`. Cả 20 đề cùng mức vì mỗi đề đã trộn NB/TH/VD (chỉ dùng để lọc ở Ngân hàng đề của giáo viên).
- `slug`: `toan<lớp>-bai<số>-<slug>-<nn>` (nn = 01…20), chỉ chữ thường, số, dấu `-`, không trùng.
- `title`: `Bài <số>. <tên bài> — Đề <n>`. `sort_order`: 1…20.
- `answer`: `mcq` là chỉ số 0–3 (0 = A); `tf` là 4 giá trị true/false theo thứ tự a–d; `short` là mảng chuỗi số.
- `options` của `tf`: 4 mệnh đề, nên bắt đầu bằng `a) `, `b) `, `c) `, `d) `.
- Tuỳ chọn: `image`, `explanation_image` (đường dẫn file `.svg`/`.png`), `verify`.

## 10. Đầu ra

- File JSON của bài (bản gốc, giữ trong `de-thi/`).
- Thư mục hình SVG.
- File ma trận đề `bai-<số>-<slug>.ma-tran.md` (do `check-lesson-exams.mjs --matrix` sinh) cho giáo viên.
- Không cần làm PDF: trên web, học sinh và giáo viên đều có nút "Tải đề (PDF)".
