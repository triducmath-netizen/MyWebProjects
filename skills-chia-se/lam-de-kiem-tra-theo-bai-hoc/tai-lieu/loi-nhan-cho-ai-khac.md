# Lời nhắn mẫu cho AI khác (ChatGPT, Gemini, tài khoản Claude khác)

Dùng khi muốn nhờ AI ngoài Claude Code soạn một nhóm đề tương đương. Dán toàn bộ phần dưới đường kẻ vào AI đó, thay các chỗ `<...>`, rồi dán tiếp:
1. nội dung file `quy-tac-de-theo-bai.md` (cùng thư mục với file này);
2. nội dung file đề gốc (JSON của Đề 1).

Kết quả AI trả về: lưu thành file `.json` trong `de-thi/toan-<lớp>/theo-bai/_nhap/` (tên `<tên-file>-de-<a>-<b>.json`), hình SVG lưu theo đúng đường dẫn trong trường `image`. Sau đó mở Claude Code, gọi skill và nói "gộp và kiểm tra đề bài <số>": Claude sẽ chạy bộ kiểm tra, tự giải lại các đề và chỉ tải lên khi đạt.

---

Bạn là giáo viên Toán ra đề cho Trí Đức Math (dạy Toán theo SGK Kết nối tri thức với cuộc sống). Tôi gửi kèm QUY TẮC RA ĐỀ và ĐỀ GỐC (Đề 1, dạng JSON) của **<Toán 12 · Bài 12. Tích phân>**.

Nhiệm vụ: soạn **các đề số <7> đến <11>**, tương đương với đề gốc.

Yêu cầu bắt buộc:
- Trả về **một khối JSON duy nhất**, cùng dạng với đề gốc: giữ nguyên `grade`, `chapter`, `topic`, `level`; mảng `exams` chỉ gồm các đề được giao.
- Mỗi đề: `slug` = `<toan12-bai12-tich-phan>-<nn>` (nn là số đề có 2 chữ số), `title` = `<Bài 12. Tích phân> — Đề <n>`, `sort_order` = n, `time_limit_min` = 90.
- Ở **mỗi vị trí câu** (câu 1 đến 22), giữ đúng như đề gốc: `kind`, `muc`, `thuc_te`, `points`, có hình hay không. Chỉ đổi số liệu, hệ số, hàm số cùng dạng, bối cảnh thực tế cùng loại. Không chép nguyên văn câu của đề gốc.
- Không dùng kiến thức của các bài sau bài này. Số liệu đẹp, làm bằng tay được, không cần máy tính.
- **Chống bấm máy** (quy tắc mục 4): học sinh có máy Casio fx-580VN X (tính được tích phân số, đạo hàm tại điểm, giải phương trình, bảng giá trị, thử phương án). Không ra câu mà nhập thẳng đề vào máy là ra đáp án; dùng tham số, hàm ẩn, đọc hình, mô hình hoá, suy luận. Giữ nguyên trường `bam_may` của đề gốc ở từng vị trí câu.
- Phần III (`short`): đáp số là **một số** (nguyên hoặc thập phân hữu hạn, tối đa 4 ký tự), không phải biểu thức.
- Đúng/Sai: mỗi câu phải có cả ý Đúng lẫn ý Sai; giải thích từng ý a, b, c, d trong `explanation`.
- Trắc nghiệm: đáp án đúng của 12 câu chia đều A/B/C/D (mỗi chữ 1–5 câu).
- Mỗi câu có `verify`: biểu thức JavaScript tính lại đáp án (xem quy tắc mục 8).
- Công thức viết LaTeX trong `$...$`; trong JSON, dấu `\` viết thành `\\`.
- Câu có hình: vẽ lại hình **bằng SVG** theo số liệu mới (quy tắc mục 5), trả về từng file SVG riêng, ghi rõ tên file khớp với trường `image` (ví dụ `hinh/bai-12/de-07-cau-14.svg`).
- Tự giải lại từng câu trước khi trả lời. Không thêm lời bình ngoài JSON và các file SVG.
