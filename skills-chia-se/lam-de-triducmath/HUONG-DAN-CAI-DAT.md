# Cài skill "lam-de-triducmath" trên tài khoản / máy khác

Skill này chạy trong **Claude Code** (ứng dụng Claude trên máy tính, thẻ Code; hoặc lệnh `claude` trong Terminal). Nó cần chạy lệnh `node` và gửi đề lên triducmath.vn, nên **không dùng được trong khung chat thường của claude.ai**.

## 1. Chuẩn bị trên máy kia (làm một lần)

1. Cài **Node.js** bản LTS (từ 18 trở lên): https://nodejs.org
2. Cài ứng dụng **Claude** (Claude Desktop) rồi đăng nhập bằng tài khoản Claude kia (gói Pro/Max hoặc Team có Claude Code).

## 2. Chép skill vào máy kia

Giải nén `lam-de-triducmath.zip` rồi đặt thư mục `lam-de-triducmath` vào thư mục skill cá nhân:

- Windows: `C:\Users\<tên-người-dùng>\.claude\skills\lam-de-triducmath\`
- macOS / Linux: `~/.claude/skills/lam-de-triducmath/`

Sau khi chép, trong thư mục đó phải thấy ngay file `SKILL.md` (không lồng thêm một thư mục nữa).

Cách khác: đặt vào `.claude/skills/lam-de-triducmath/` bên trong một thư mục dự án — khi đó skill chỉ có trong dự án đó.

## 3. Thông tin kết nối (bắt buộc để tải đề lên)

1. Trong thư mục skill, sao chép `.env.example` thành `.env`.
2. Điền 4 giá trị do chủ website (thầy Đức) gửi riêng: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `EXAM_IMPORT_FUNCTION`, `EXAM_IMPORT_TOKEN`.

`EXAM_IMPORT_TOKEN` là mật khẩu cho phép ghi vào ngân hàng đề: gửi qua kênh riêng (Zalo cá nhân), không dán vào chat với Claude, không đưa lên GitHub. Khi cần thu hồi quyền, chủ website đổi token trên Supabase rồi gửi token mới.

## 4. Cài thư viện kiểm tra công thức (một lần)

Mở Terminal / PowerShell trong thư mục skill và chạy:

```
npm install
```

(Nếu quên, Claude sẽ tự chạy khi dùng skill lần đầu.)

## 5. Dùng skill

1. Mở Claude → thẻ **Code**, chọn một thư mục làm việc (ví dụ `D:\De-TriDucMath`). Đề sẽ được lưu ở `de-thi/` trong thư mục này.
2. Gõ:

```
/lam-de-triducmath Toán 7 – Chương I: Số hữu tỉ
```

hoặc nói tự nhiên: "Làm đề luyện tập Toán 8 chương Đa thức cho Trí Đức Math". Claude sẽ soạn 10 đề, tự kiểm tra, tải lên và báo kết quả.

3. Kiểm tra skill đã được nhận: gõ `/` trong ô chat, thấy `lam-de-triducmath` trong danh sách là được. Nếu không thấy, đóng mở lại ứng dụng và kiểm tra lại đường dẫn ở bước 2.

## 6. Sau khi làm xong

- Đề hiện ngay trên trang học sinh (đúng khối lớp) và trong trang giáo viên → Ngân hàng đề, nơi giáo viên xem, sửa, xóa được.
- Gửi lại thư mục `de-thi/` cho chủ website để lưu bản gốc.
