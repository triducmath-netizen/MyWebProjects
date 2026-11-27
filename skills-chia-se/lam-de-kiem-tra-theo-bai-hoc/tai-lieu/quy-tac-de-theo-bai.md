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
- `muc`, `thuc_te` và `bam_may` (mục 4.3) chỉ để kiểm tra nội bộ và in ma trận cho giáo viên; **không** gửi lên web, **không** viết vào chữ học sinh thấy.

## 3. Phạm vi kiến thức

- Chỉ dùng kiến thức của bài đó và các bài **trước** nó (theo mục lục SGK Kết nối tri thức). Kiến thức các bài sau bị loại.
- Phương pháp tính chỉ dùng khi SGK của bài có (ví dụ đổi biến, từng phần). Không chắc thì không dùng.
- Bối cảnh thực tế lấy từ SGK (HĐ mở đầu, ví dụ, bài tập) rồi đổi số liệu; số liệu hợp lý, phù hợp tuổi học sinh.

## 4. Chống bấm máy tính — (chặn một phần)

Mục tiêu: học sinh **không thể bấm máy tính ra ngay đáp án**; máy chỉ được giúp phần cộng trừ nhân chia vặt. Học sinh phải hiểu bài mới làm được. Đề cũng phải làm được hoàn toàn bằng tay.

### 4.1. Máy tính học sinh làm được gì (Casio fx-580VN X, fx-880BTG, Vinacal…)
- Tính giá trị biểu thức số, lũy thừa, căn, lôgarit, lượng giác, giai thừa, tổ hợp, chỉnh hợp.
- **Tích phân xác định** với cận là số; **đạo hàm tại một điểm**; tổng $\sum$.
- **Giải phương trình** (SOLVE), phương trình bậc 2–4, hệ đến 4 ẩn, bất phương trình bậc 2–4.
- **Bảng giá trị** (TABLE) để dò cực trị, GTLN–GTNN, số nghiệm, tính đơn điệu trên một đoạn.
- **Thử từng phương án** bằng CALC (thay $x$ của 4 phương án vào phương trình / bất phương trình / đẳng thức).
- Vectơ (tích vô hướng, tích có hướng, độ dài), ma trận, thống kê (trung bình, phương sai, độ lệch chuẩn từ bảng số liệu), hồi quy.

Câu nào mà **chỉ cần nhập đề bài vào máy là ra đáp án** (hoặc thử 4 phương án là ra) thì coi là câu **bấm máy được**.

### 4.2. Cách ra câu để máy không giải thay
- **Tham số, chữ thay số**: hỏi điều kiện của $m$, đếm số giá trị nguyên của $m$, tìm $a$ để $\int_0^a f(x)\,dx = 6$, kết quả dạng $a + b\ln 2$ rồi hỏi $a + b$ (đổi dạng sao cho không đoán được bằng cách thử).
- **Hàm ẩn / dữ kiện trừu tượng**: cho $\int_0^2 f(x)\,dx = 3$, cho $f'(x) = \ldots$ và $f(0) = 1$, cho tính chất của $f$ thay vì công thức của $f$.
- **Đọc hình, bảng biến thiên, đồ thị**: dữ kiện nằm trên hình, máy không đọc được.
- **Mô hình hoá bài toán thực tế**: học sinh phải tự lập hàm số / tích phân / phương trình từ tình huống; khi đã lập xong thì phép tính còn lại nên nhẹ.
- **Suy luận, so sánh, đúng/sai về tính chất**: "hàm số đồng biến trên khoảng nào", "mệnh đề nào luôn đúng với mọi $x$", "dấu của…", "giá trị lớn hơn 10" — kiểm bằng lập luận chứ không bằng một số lẻ.
- **Đếm, biện luận, tìm điều kiện**: số nghiệm theo $m$, số điểm cực trị của $f(|x|)$, số giá trị nguyên thỏa mãn.
- **Phương án dạng biểu thức chứa chữ** ($\frac{a^2}{2}$, $2m - 1$, $F(x) = \ldots + C$) thay vì 4 số mà máy thử được.
- **Đáp số Phần III** là số, nên phải ra kiểu: tham số, đếm, hàm ẩn, đọc hình, mô hình hoá, "$a + b + c$" từ dạng biểu diễn. **Không** ra "Tính $\int_1^3 (x^2 - 1)\,dx$", "Tính $f'(2)$ với $f(x) = \ldots$", "Giải phương trình…" rồi hỏi nghiệm.

Ví dụ đổi câu (Bài 12. Tích phân):
- Bấm máy được: "Tính $\int_0^2 (2x + 1)\,dx$" → máy cho ngay $6$.
- Chống máy: "Biết $\int_0^2 f(x)\,dx = 3$. Tính $\int_0^2 \left[2f(x) + x\right]dx$" → phải dùng tính chất tích phân; đáp số $8$.
- Chống máy: "Tìm số thực $a > 0$ sao cho $\int_0^a (2x + 1)\,dx = 6$" → phải lập $a^2 + a = 6$ (máy giải được phương trình, nhưng phải tự lập ra trước).

### 4.3. Trường `bam_may` — (chặn)
- Mỗi câu ghi `"bam_may": true` nếu nhập thẳng đề vào máy (hoặc thử 4 phương án) là ra đáp án; ngược lại `false`. Ghi trung thực: công cụ còn tự dò một số mẫu câu bấm máy được (tích phân số, đạo hàm tại điểm, giải phương trình số) và cảnh báo.
- Cho phép **tối đa 3 câu** `bam_may: true` mỗi đề, **chỉ ở Phần I và chỉ mức NB**. Phần II, Phần III và mọi câu TH/VD phải `false`.
- Ý Đúng/Sai: không để **cả 4 ý** đều là phép tính số máy làm được; ít nhất 2 ý phải cần suy luận / đọc hình / mô hình hoá.

### 4.4. Đáp số, độ lớn số
- **Phần I, II**: đáp số trong phương án có thể là số nguyên, phân số tối giản, biểu thức chính xác có $\pi$, $e$, căn đơn giản, hoặc biểu thức chứa chữ.
- **Phần III — (chặn)**: đáp số **phải là một số** (số nguyên hoặc thập phân hữu hạn), tốt nhất ≤ 4 ký tự kể cả dấu "−" và dấu phẩy (phiếu THPT có 4 ô). Web chấm bằng cách so số, nên `9π/4`, `14/3`, `2√3` sẽ bị chấm sai. Có thể liệt kê cách viết tương đương trong `answer`, ví dụ `["2.5", "2,5"]`.
- Không ra câu cần nhân/chia số lớn, khai căn hay tính lũy thừa phải dùng máy (công cụ cảnh báo khi có số từ 5 chữ số). Số liệu đẹp để làm tay nhanh.

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
        { "kind": "mcq", "muc": "NB", "thuc_te": false, "bam_may": false, "prompt": "...", "options": ["...", "...", "...", "..."], "answer": 0, "points": 0.25, "verify": "...", "explanation": "..." },
        { "kind": "tf", "muc": "TH", "thuc_te": true, "bam_may": false, "prompt": "...", "options": ["a) ...", "b) ...", "c) ...", "d) ..."], "answer": [true, false, true, false], "points": 1, "explanation": "a) Đúng vì ... b) Sai vì ..." },
        { "kind": "short", "muc": "VD", "thuc_te": false, "bam_may": false, "prompt": "...", "image": "hinh/bai-12/de-01-cau-17.svg", "answer": ["9"], "points": 0.5, "verify": "...", "explanation": "..." }
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
