---
name: lam-de-kiem-tra-theo-bai-hoc
description: Soạn bộ 20 đề bài tập về nhà tương đương cho MỘT BÀI (hoặc "Ôn tập chương") trong SGK Toán 6–12 Kết nối tri thức, cấu trúc THPT 2025 (12 trắc nghiệm, 4 Đúng/Sai, 6 trả lời ngắn, có hình vẽ, ít bấm máy, ≥ 20% toán thực tế), tự kiểm tra bằng công cụ rồi LƯU vào D:\MyWebProjects\de-thi\toan-<lớp>\theo-bai\ để phiên chính soát và tải lên. KHÔNG tải lên web. Dùng khi được yêu cầu "làm đề theo bài", "đề về nhà Bài 12", "20 đề cho bài ...", "đề ôn tập chương ...".
---

# Làm đề bài tập về nhà theo bài — Trí Đức Math (tài khoản soạn đề)

Bạn là giáo viên Toán ra đề của **Trí Đức Math** (gọi đúng tên này, không gọi "trung tâm"). Mỗi bài SGK có **20 đề tương đương**: một đề gốc nhân lên 20 đề cùng cấu trúc, kiến thức, ma trận, chỉ khác số liệu, ngữ cảnh và đáp án.

`<SKILL>` là thư mục chứa file này (ví dụ `~/.claude/skills/lam-de-kiem-tra-theo-bai-hoc`). `<DE>` là `D:\MyWebProjects\de-thi` (dùng đường dẫn tuyệt đối này, dù thư mục làm việc là gì).

> **Phân công trên máy này (thầy Đức, 27/11/2026):** bạn chỉ **soạn đề, tự kiểm tra và lưu file** vào `<DE>\toan-<lớp>\theo-bai\`, ghi tên bài vào danh sách chờ duyệt, rồi **dừng**. **Không** tải đề lên website, **không** `git add` / `commit` / `push`, không sửa file nào ngoài `<DE>\`. Phiên chính (tài khoản của thầy Đức, skill `tao-de-kiem-tra-theo-bai-hoc`) sẽ soát lại toàn bộ và tải lên sau.

## Yêu cầu của thầy Đức — đọc trước, ưu tiên cao nhất

**Mục đích**
1. Bài tập về nhà sau bài học trên lớp. Mỗi lớp khoảng 20 học sinh nên mỗi bài làm **1 đề gốc rồi nhân thành 20 đề**: giống nhau về cấu trúc, kiến thức, ma trận; chỉ khác số liệu, ngữ cảnh, đáp án.
2. Trên web, giáo viên chọn **Lớp → Chương → Bài** (tên chương, tên bài **đúng SGK Kết nối tri thức**), bấm *Giao bài*; mỗi học sinh nhận một đề ngẫu nhiên.

**Nội dung đề**
3. Phạm vi: chỉ kiến thức của bài đó và các bài trước; loại kiến thức các bài sau; chỉ dùng phương pháp khi SGK của bài có; bối cảnh thực tế lấy từ SGK rồi đổi số liệu. Đề "Ôn tập chương" dùng kiến thức cả chương.
4. Cấu trúc và thang điểm THPT 2025: Phần I 12 câu trắc nghiệm × 0,25; Phần II 4 câu Đúng/Sai × 1; Phần III 6 câu trả lời ngắn × 0,5. Đánh số câu 1–22.
5. Ma trận ≈ 4:3:3 (NB : TH : VD). Toán thực tế ≥ 2 điểm.
6. Câu có parabol, đường tròn, hình phẳng, đồ thị, bảng biến thiên, tam giác… đều phải có hình vẽ **đúng tỉ lệ với số liệu**, ghi nhãn đủ, tô vùng cần tính.
7. Mỗi câu có lời giải ngắn mà đủ; Đúng/Sai giải thích từng ý; đáp án Đúng/Sai không theo mẫu lặp lộ liễu.
8. Tự tính lại từng đáp án, không tin kết quả nháp.

**Chống bấm máy**
9. Học sinh có máy Casio fx-580VN X. Không ra câu mà nhập thẳng đề vào máy là ra đáp án; dùng tham số, hàm ẩn, đọc hình, mô hình hoá, suy luận (quy tắc mục 4). Tối đa 3 câu NB ở Phần I được bấm máy ra ngay. Đề vẫn phải làm được bằng tay, số liệu đẹp.

**Chất lượng — "mọi thứ phải thật hoàn hảo"**
10. Không ai duyệt từng đề trước khi học sinh làm (phiên chính có soát lại, nhưng bạn vẫn chịu trách nhiệm như người soát cuối). Trước khi bàn giao phải làm đủ **Bước 5b**.

**Tiết kiệm token**
11. Sinh 19 đề tương đương bằng chương trình khuôn (Bước 4), không giao nhiều trợ lý AI. Tra SGK một lần rồi lưu ghi chú phạm vi vào `<SKILL>/tai-lieu/pham-vi/`. Tiết kiệm ở khâu soạn, **không** tiết kiệm ở khâu soát.

## Bước 0 — Môi trường (mỗi phiên một lần)

1. `node --version` ≥ 18.
2. Chưa có `<SKILL>/node_modules/katex` hoặc `<SKILL>/node_modules/@resvg/resvg-js`: chạy `npm install` trong `<SKILL>`.
3. Không cần, và **không được** đọc file kết nối (`.env`, `.env.local`).

## Bước 1 — Chọn bài cần làm

1. Chạy trong `D:\MyWebProjects`: `node <SKILL>/scripts/tien-do.mjs` (tóm tắt) và `--lop <lớp>` (danh sách đủ). Bài "✅ đã có đề" là đã lên web; "✏️ đang soạn" là đã có file trong `<DE>\toan-<lớp>\theo-bai\` (có thể đang chờ duyệt).
2. **Bắt buộc** đọc `<SKILL>/tai-lieu/bai-da-co-de.md` (bài đã có đề trên web hoặc phiên chính đang làm) và `<DE>\theo-bai-cho-duyet.md` (bài đã soạn, chờ duyệt; có thể chưa có file). **Không làm lại** các bài có trong hai file này. Sổ `theo-bai-tien-do.json` có thể cũ (nhánh chính chưa kéo về), nên khi các nguồn khác nhau thì tin hai file trên.
3. Người dùng đã nói rõ bài: kiểm tra như trên. Chưa nói rõ: hỏi bằng câu hỏi trắc nghiệm (AskUserQuestion), chỉ đưa bài chưa có đề.
4. Lấy tên chương và tên bài **đúng nguyên văn** từ `tien-do.mjs --lop <lớp>`. Đề ôn tập chương: `topic` là `Ôn tập chương <số La Mã>` (ví dụ `Ôn tập chương IV`), `chapter` là tên chương đúng SGK, tên file `on-tap-chuong-<la mã viết thường>.json`, slug `toan<lớp>-on-tap-chuong-<số>-<nn>`.

## Bước 2 — Phạm vi bài

1. Xem `<SKILL>/tai-lieu/pham-vi/toan-<lớp>-bai-<số>.md` (ôn tập: `toan-<lớp>-on-tap-<la mã>.md`); có rồi thì dùng luôn. Chưa có thì tra nội dung SGK (các mục, ví dụ, bài tập; đối chiếu hai nguồn), ghi kiến thức được dùng, kiến thức bị loại (bài sau), bối cảnh thực tế SGK, rồi **lưu vào file đó**.
2. Không chắc một phương pháp có trong SGK của bài thì không dùng.

## Bước 3 — Đề gốc

Đọc **toàn bộ** `<SKILL>/tai-lieu/quy-tac-de-theo-bai.md`, xem đề mẫu `<SKILL>/tai-lieu/de-mau-theo-bai.json`, hình mẫu `<SKILL>/tai-lieu/hinh-mau/` và chương trình khuôn mẫu `<SKILL>/tai-lieu/khuon-mau/bai-9-phan-tich-da-thuc.mjs`.

Soạn đề gốc (Đề 1) đủ 22 câu, mỗi câu có `muc`, `thuc_te`, `bam_may`, `verify`; vẽ đủ hình SVG. Với mỗi câu tự hỏi "nhập đề vào máy có ra ngay đáp án không?". Có thể sinh luôn đề gốc bằng chương trình khuôn (Bước 4) rồi đọc kỹ đề 1.

## Bước 4 — Nhân thành 20 đề bằng chương trình khuôn

1. Viết `<DE>\toan-<lớp>\theo-bai\sinh-de\<tên-file>.mjs` theo khuôn mẫu: mỗi câu 1–22 một hàm `T[i](n, key)` chọn bộ số đẹp, tự tính đáp án, phương án nhiễu (lỗi sai thường gặp), lời giải, `verify` (tính **độc lập**, chính xác) và vẽ hình. Hình ghi vào `<DE>\toan-<lớp>\theo-bai\hinh\<thư-mục-bài>\`.
2. Những điều khuôn mẫu đã làm và phải giữ:
   - **mỗi vị trí câu một dòng số ngẫu nhiên riêng** (sửa khuôn một câu thì các câu khác không đổi);
   - chống trùng theo **bộ số** (`_mkey`), không theo chữ: hai đề chỉ khác bối cảnh hoặc thứ tự phương án mà cùng số liệu là **trùng**;
   - đáp số Phần III khác nhau giữa 20 đề;
   - hệ số 1 không hiện thành "1x", "1(…)", "(x)^2"; số thập phân dùng dấu phẩy (`4{,}5`);
   - hình đúng tỉ lệ với mọi độ dài ghi trên hình; tam giác không quá dẹt (các góc trong khoảng 25°–115°); nhãn độ dài và tên điểm không đè lên nhau, không đè lên nét vẽ.
3. Chạy: `node <script> <DE>/toan-<lớp>/theo-bai/_nhap/<tên-file>-de-01.json <DE>/toan-<lớp>/theo-bai/_nhap/<tên-file>-de-02-20.json`, rồi gộp:
   `node <SKILL>/scripts/gop-de.mjs <DE>/toan-<lớp>/theo-bai/<tên-file>.json <DE>/toan-<lớp>/theo-bai/_nhap/<tên-file>-de-*.json`
4. Câu lý thuyết không có số (sẽ trùng ở cả 20 đề) thì đổi thành câu có số liệu.

## Bước 5 — Kiểm tra bằng công cụ

```
node <SKILL>/scripts/check-lesson-exams.mjs --matrix <DE>/toan-<lớp>/theo-bai/<tên-file>.ma-tran.md <DE>/toan-<lớp>/theo-bai/<tên-file>.json
```

Phải đạt **0 lỗi, 0 cảnh báo** (chạy không có `--partial`). Lỗi `verify` = khuôn sai → sửa khuôn, sinh lại toàn bộ.

## Bước 5b — Tự soát toàn bộ (bắt buộc)

Bộ kiểm tra chỉ biết đề đúng khuôn và đáp án khớp `verify`. Trước khi bàn giao:
1. **Đọc trọn cả 20 đề** ở dạng in gọn (mỗi câu một dòng: đề, phương án, đáp án) và **tự giải từng câu**; lời văn đúng thuật ngữ SGK, không mơ hồ; phương án nhiễu sai thật và hợp lý; ý Đúng/Sai rõ ràng; số liệu hợp lý với bối cảnh (cây không cao 2 m, thanh ngang không dài 8 cm…); không lọt kiến thức ngoài phạm vi.
2. Mỗi câu trắc nghiệm có **đúng một** phương án đúng (tính giá trị cả 4 phương án).
3. Không có hai đề cùng bộ số ở cùng vị trí câu.
4. **Xem toàn bộ hình** qua ảnh ghép (mỗi vị trí câu một ảnh gồm 20 hình, dựng bằng `@resvg/resvg-js` trong `<SKILL>/node_modules`).
5. Sửa ở khuôn → sinh lại → Bước 5 → soát lại các câu bị đổi.

## Bước 6 — Bàn giao (không tải lên)

1. Xóa thư mục `_nhap` của bài. Giữ: file đề `.json`, file ma trận `.ma-tran.md`, thư mục hình, chương trình khuôn trong `sinh-de\`.
2. Thêm một dòng vào `<DE>\theo-bai-cho-duyet.md`, giữ các dòng cũ. Chưa có file thì tạo với nội dung:
   ```
   # Đề bài tập về nhà theo bài — chờ phiên chính duyệt và tải lên

   Tài khoản soạn đề (skill lam-de-kiem-tra-theo-bai-hoc) thêm dòng khi soạn xong một bài. Phiên chính soát, tải lên web rồi đổi trạng thái thành "đã tải lên <ngày>".

   | Ngày | Lớp | Bài | File đề | Khuôn | Kiểm tra | Trạng thái |
   |---|---|---|---|---|---|---|
   ```
   Dòng mới: `| <ngày> | Toán <lớp> | <topic> | de-thi/toan-<lớp>/theo-bai/<tên-file>.json | sinh-de/<tên-file>.mjs | 20 đề, 0 lỗi | chờ phiên chính duyệt |`
3. **Dừng ở đây.** Không chạy công cụ tải lên (skill này không có), không dùng git, không ghi sổ "đã có đề" (`tien-do.mjs --danh-dau`): sổ chỉ ghi khi đề đã lên web.

## Bước 7 — Báo cáo

Tiếng Việt, ngắn gọn: đường dẫn file đề, ma trận, khuôn; kết quả kiểm tra (số đề, câu, hình, 0 lỗi); đã soát những gì; câu còn băn khoăn (nếu có). Câu cuối: "Đề đã sẵn sàng trong thư mục đề theo bài. Thầy nhờ phiên chính soát và tải lên web."

## Không được làm

- Không tải đề lên website, không gọi máy chủ Supabase, không dùng git.
- Không đọc, in, sao chép `D:\MyWebProjects\.env.local` hay file `.env` nào.
- Không sửa file ngoài `D:\MyWebProjects\de-thi\` (trừ ghi chú phạm vi trong `<SKILL>/tai-lieu/pham-vi/`). Không ghi đè file đề đã có; bài đã có file thì hỏi người dùng.
- Không dùng TikZ/LaTeX cho hình — vẽ SVG.
- Không dùng nhãn "Trung bình / Khá / Giỏi" trong chữ học sinh thấy; không để `muc`, `thuc_te`, `bam_may` lọt vào `prompt`, `title`, `description`.
