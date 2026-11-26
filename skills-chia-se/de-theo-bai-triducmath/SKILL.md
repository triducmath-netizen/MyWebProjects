---
name: de-theo-bai-triducmath
description: Soạn bộ 20 đề bài tập về nhà tương đương cho MỘT BÀI trong SGK Toán 6–12 (Kết nối tri thức) theo cấu trúc THPT 2025 — 12 trắc nghiệm, 4 Đúng/Sai, 6 trả lời ngắn, thang 10 — có hình vẽ, ít bấm máy, ≥ 20% toán thực tế, đáp án và lời giải chi tiết; tự kiểm tra bằng công cụ rồi tải lên ngân hàng đề triducmath.vn để giáo viên giao về nhà (mỗi học sinh nhận ngẫu nhiên một đề). Dùng khi được yêu cầu "ra đề theo bài", "đề về nhà Bài 12", "20 đề cho bài ...".
---

# Đề bài tập về nhà theo bài — Trí Đức Math

Bạn là giáo viên Toán ra đề của **Trí Đức Math** (gọi đúng tên này, không gọi "trung tâm"). Mỗi bài SGK có **20 đề tương đương**: một đề gốc nhân lên 20 đề cùng cấu trúc, kiến thức, ma trận, chỉ khác số liệu, ngữ cảnh và đáp án. Không ai duyệt từng đề trước khi học sinh làm, nên **bạn tự chịu trách nhiệm** về độ chính xác và mọi ràng buộc dưới đây.

**Cách dùng trên website:** đề tải lên là đề "bài tập về nhà" (học sinh không thấy ở mục luyện đề). Giáo viên vào Trang giáo viên → *Bài tập trực tuyến* → *Giao bài tập về nhà theo bài học*, chọn **Chương → Bài**, đặt hạn nộp, bấm **Giao bài**. Máy chủ chọn ngẫu nhiên cho mỗi học sinh một đề riêng (lớp ≤ 20 em thì không em nào trùng đề); bài hiện ở thẻ *Bài giáo viên giao* của học sinh. Vì vậy tên chương và tên bài phải **đúng nguyên văn SGK Kết nối tri thức** — đó là chữ giáo viên thấy ở thanh chọn.

`<SKILL>` là thư mục chứa file này. Đề lưu ở thư mục đang làm việc, dưới `de-thi/toan-<lớp>/theo-bai/`.

## Bước 0 — Môi trường (mỗi phiên một lần)

1. `node --version` ≥ 18.
2. Chưa có `<SKILL>/node_modules/katex` hoặc `<SKILL>/node_modules/@resvg/resvg-js`: chạy `npm install` trong `<SKILL>`.
3. Kiểm tra **có tồn tại** một trong các file kết nối: `<SKILL>/.env`, `<SKILL>/../lam-de-triducmath/.env`, hoặc `.env.local` ở thư mục làm việc. **Không đọc, không in nội dung.** Thiếu thì vẫn soạn và kiểm tra được, chỉ chưa tải lên; nhắn người dùng tạo `<SKILL>/.env` theo `<SKILL>/.env.example`.

## Bước 1 — Chọn bài cần làm (hỏi người dùng)

1. Chạy `node <SKILL>/scripts/tien-do.mjs` (trong thư mục làm việc). Công cụ đọc mục lục SGK `<SKILL>/tai-lieu/muc-luc-sgk.json` và sổ tiến độ `de-thi/theo-bai-tien-do.json`, rồi liệt kê từng lớp: bài **đã có đề**, **đang soạn dở**, **chưa làm**.
2. Nếu người dùng đã nói rõ bài (ví dụ "đề Bài 12 Toán 12"): kiểm tra bài đó trong danh sách. Bài đã có đề → báo lại và hỏi có muốn làm lại không (làm lại thì dùng slug mới, xem Bước 4).
3. Nếu chưa nói rõ: hỏi bằng câu hỏi trắc nghiệm (AskUserQuestion). Lựa chọn đầu tiên là bài đang soạn dở (nếu có); các lựa chọn còn lại là bài chưa làm đầu tiên của lớp người dùng hay làm (xem `--lop <lớp>` để có danh sách đủ). Chỉ đưa bài **chưa có đề**.
4. Lấy tên chương và tên bài **đúng nguyên văn** từ mục lục (`--lop <lớp>` in ra). Không tự gõ lại. Tên file gợi ý cũng do công cụ in ra.

## Bước 2 — Xác định phạm vi bài

1. Tra nội dung SGK của bài đó (các mục, ví dụ, HĐ mở đầu, bài tập; đối chiếu hai nguồn). Ghi danh sách kiến thức ĐƯỢC dùng.
2. Liệt kê kiến thức của **các bài sau** bị loại trừ. Ví dụ: diện tích hình phẳng và thể tích vật thể tròn xoay thuộc Bài 13, không dùng trong Bài 12 (Tích phân).
3. Chỉ dùng phương pháp (đổi biến, từng phần, …) khi SGK của bài đó có. Không chắc thì không dùng.
4. Bối cảnh thực tế lấy từ SGK (HĐ mở đầu, ví dụ, bài tập có ngữ cảnh) rồi đổi số liệu; không sáng tác bối cảnh ngoài chương trình.

## Bước 3 — Soạn đề gốc (Claude chính tự làm)

Đọc **toàn bộ** `<SKILL>/tai-lieu/quy-tac-de-theo-bai.md` (cấu trúc, ma trận, hạn chế bấm máy, hình vẽ, định dạng JSON, `verify`) và xem đề mẫu `<SKILL>/tai-lieu/de-mau-theo-bai.json` cùng hình mẫu `<SKILL>/tai-lieu/hinh-mau/`.

1. Soạn **đề gốc** (Đề 1): đủ 22 câu, ghi `muc` (NB/TH/VD), `thuc_te`, `bam_may`, `verify` cho từng câu; vẽ đủ hình SVG.
   **Chống bấm máy là yêu cầu hàng đầu** (quy tắc mục 4): học sinh có máy Casio fx-580VN X tính được tích phân số, đạo hàm tại điểm, giải phương trình, bảng giá trị và thử từng phương án. Với mỗi câu, tự hỏi "nhập đề vào máy có ra ngay đáp án không?"; nếu có thì đổi sang tham số, hàm ẩn, đọc hình, mô hình hoá hoặc suy luận. Tối đa 3 câu NB ở Phần I được phép bấm máy ra ngay.
2. Lưu vào `de-thi/toan-<lớp>/theo-bai/_nhap/<tên-file>-de-01.json`; hình ở `de-thi/toan-<lớp>/theo-bai/hinh/bai-<số>/de-01-cau-<mm>.svg`.
3. Chạy bộ kiểm tra với `--partial` cho riêng file này đến khi **0 lỗi**, và tự giải lại từng câu. Đề gốc là khuôn cho 19 đề kia: sai ở đây sẽ nhân lên 20 lần.

## Bước 4 — Nhân thành 19 đề tương đương (chia việc cho AI khác)

Đề 2–20 là việc lặp lại theo khuôn, nên **giao cho subagent dùng model rẻ hơn** để Claude chính đỡ tải. Claude chính chỉ soạn đề gốc, gộp và kiểm tra.

1. Chạy song song **4 subagent** (công cụ Agent, `model: "sonnet"`), mỗi subagent một nhóm đề: 2–6, 7–11, 12–16, 17–20. Nội dung giao cho mỗi subagent:
   - toàn văn `<SKILL>/tai-lieu/quy-tac-de-theo-bai.md` và file đề gốc;
   - nhóm số đề phải làm, `slug` / `title` / `sort_order` tương ứng (ví dụ `toan12-bai12-tich-phan-07`, `Bài 12. Tích phân — Đề 7`, 7);
   - yêu cầu: giữ đúng dạng câu, `muc`, `thuc_te`, `bam_may`, có/không hình ở từng vị trí; chỉ đổi số liệu, hệ số, hàm cùng dạng, bối cảnh cùng loại; số đẹp, không cần máy tính; mỗi câu có `verify`; vẽ lại hình theo số liệu mới tại `hinh/bai-<số>/de-<nn>-cau-<mm>.svg`;
   - ghi vào **file riêng** `de-thi/toan-<lớp>/theo-bai/_nhap/<tên-file>-de-<a>-<b>.json`, tự chạy `node <SKILL>/scripts/check-lesson-exams.mjs --partial <file>` đến 0 lỗi;
   - **không** tải lên, không sửa file của nhóm khác, không đọc `.env`;
   - **mỗi nhóm một dải số liệu riêng** để tránh trùng câu giữa các nhóm (ví dụ nhóm 1 dùng cận/hệ số 1–3, nhóm 2 dùng 4–6, nhóm 3 dùng số âm, nhóm 4 dùng 7–9), và **đáp số khác nhau giữa các đề** (học sinh cùng lớp không chép được của nhau);
   - nhắc: trong JSON mọi lệnh LaTeX viết `\\` (ví dụ `"$0 \\le t \\le 4$"`); thiếu dấu `\` thì web hiện chữ thường "le", "displaystyle".
   Nếu một trợ lý dừng giữa chừng (hết lượt dùng), kiểm tra file của nó trước: có khi đã ghi xong, chỉ chưa kịp báo cáo.
2. Gộp:
   ```
   node <SKILL>/scripts/gop-de.mjs de-thi/toan-<lớp>/theo-bai/<tên-file>.json de-thi/toan-<lớp>/theo-bai/_nhap/<tên-file>-de-*.json
   ```
3. Claude chính **kiểm tra lại phần AI khác làm**: chạy bộ kiểm tra cả bài (Bước 5); đọc ma trận đề; chọn ngẫu nhiên ít nhất 3 đề, tự giải lại toàn bộ câu không có `verify` và mọi ý Đúng/Sai; xem vài hình PNG. Lỗi ở đề nào thì sửa trực tiếp, hoặc giao lại subagent đó (SendMessage) rồi gộp lại.
4. Không có công cụ Agent (hoặc người dùng muốn tự làm): Claude chính làm tiếp đề 2–20 theo cùng quy tắc.

**Đề do AI ngoài Claude Code soạn** (ChatGPT, Gemini, tài khoản Claude khác): đưa cho AI đó nội dung `<SKILL>/tai-lieu/loi-nhan-cho-ai-khac.md` kèm đề gốc. Lưu kết quả vào `de-thi/toan-<lớp>/theo-bai/_nhap/` rồi gộp và kiểm tra như trên. Coi kết quả của AI ngoài là **chưa tin cậy**: phải qua bộ kiểm tra và Claude chính phải tự giải lại ít nhất một nửa số đề trước khi tải lên.

## Bước 5 — Kiểm tra bằng công cụ

```
node <SKILL>/scripts/check-lesson-exams.mjs --matrix de-thi/toan-<lớp>/theo-bai/<tên-file>.ma-tran.md de-thi/toan-<lớp>/theo-bai/<tên-file>.json
```

- Công cụ chặn: thiếu/sai dạng tên chương (`chapter`) hoặc tên bài (`topic`), sai cấu trúc 12–4–6, sai điểm, không phải 90 phút, mức độ lệch 4:3:3, câu thực tế < 2 điểm, Đúng/Sai 4 ý cùng đáp án, đáp số Phần III không phải số, câu bấm máy ra ngay (quá 3 câu, hoặc ngoài Phần I mức NB, hoặc tự dò thấy mà ghi `bam_may: false`), câu nhắc tới hình mà không có hình, hình SVG hỏng, công thức KaTeX lỗi, câu trùng nguyên văn giữa các đề, 20 đề không cùng cấu trúc, `verify` không khớp đáp án.
- Mới xong một phần: thêm `--partial` (bỏ qua yêu cầu đủ 20 đề).
- Trước khi tải lên: chạy **không** `--partial`, đạt **0 lỗi**. Xử lý cảnh báo "chưa có verify", "nên có hình vẽ", "số từ 5 chữ số" (xem lại có phải bấm máy không).
- `--matrix` ghi ma trận đề (mức độ, cờ thực tế, đáp án trắc nghiệm từng đề) cho giáo viên kiểm tra nhanh.
- Mở thử vài hình PNG để chắc hình đúng (nhãn, giao điểm, vùng tô): công cụ chỉ biết hình dựng được, không biết hình đúng.

## Bước 6 — Tải lên ngân hàng đề

```
node <SKILL>/scripts/upload-lesson-exams.mjs de-thi/toan-<lớp>/theo-bai/<tên-file>.json
```

- Đề được đánh dấu là đề bài tập về nhà (kèm tên chương, số bài) để hiện ở thanh chọn Chương → Bài của giáo viên.
- Hình SVG được đổi sang PNG và gửi kèm; học sinh thấy hình ngay dưới câu hỏi.
- Báo "THIẾU HÌNH": hàm `import-exams` trên Supabase còn bản cũ, chưa nhận ảnh. Dừng lại, báo người dùng deploy lại hàm (nội dung ở `supabase/functions/import-exams/index.ts` của repo website), rồi tải lại.
- Đề đã có học sinh làm **không bị ghi đè** ("BỎ QUA"). Muốn sửa đề đó: tạo đề mới với `slug` mới, hoặc sửa trên trang giáo viên.
- Lỗi 401/403: thông tin kết nối sai/hết hạn. Báo người dùng, không thử đoán.
- Tải đủ 20 đề thành công thì công cụ **tự ghi bài vào sổ tiến độ** (`de-thi/theo-bai-tien-do.json` và `de-thi/TIEN-DO-DE-THEO-BAI.md`), lần sau Bước 1 không hỏi lại bài này. Bài đã có đề từ trước (soạn tay, nơi khác) thì ghi tay: `node <SKILL>/scripts/tien-do.mjs --danh-dau <lớp> <số bài>`.
- Xóa thư mục `_nhap/` của bài sau khi đã gộp và tải xong.

## Bước 7 — Báo cáo

Tiếng Việt, ngắn gọn:
- Số đề / câu / hình đã tải, đề nào bị bỏ qua và vì sao.
- Đường dẫn file ma trận đề.
- Câu còn băn khoăn (nếu có) để giáo viên xem trên trang giáo viên → Ngân hàng đề.
- Nhắc: bài đã sẵn sàng để giao ở *Bài tập trực tuyến → Giao bài tập về nhà theo bài học*.
- Tiến độ chung (chạy lại `tien-do.mjs`) và gợi ý bài nên làm tiếp.

## Không được làm

- Không in, sao chép hay gửi nội dung `.env` / `.env.local`.
- Không gọi máy chủ Supabase bằng cách nào khác ngoài `scripts/upload-lesson-exams.mjs`.
- Không dùng TikZ/LaTeX cho hình (web không dựng được) — vẽ bằng SVG theo quy tắc.
- Không dùng nhãn "Trung bình / Khá / Giỏi" trong chữ học sinh nhìn thấy.
- Không để mức độ (NB/TH/VD) hay cờ thực tế lọt vào `prompt`, `title`, `description` — đó là thông tin nội bộ.
