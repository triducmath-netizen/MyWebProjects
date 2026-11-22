# Cài đặt cổng phụ huynh — Trí Đức Math

Làm **một lần duy nhất**, khoảng 20 phút. Các bước có đánh dấu 🤖 thì Claude làm giúp được.

## Bước 1. Tạo dự án Supabase (bạn tự làm)

1. Vào https://supabase.com, bấm **Start your project** và đăng nhập bằng GitHub (tài khoản `triducmath-netizen`).
2. Bấm **New project**:
   - **Name:** `tri-duc-math`
   - **Database Password:** bấm *Generate a password* rồi **lưu lại ở nơi an toàn**.
   - **Region:** `Southeast Asia (Singapore)`
   - **Plan:** Free
3. Chờ khoảng 2 phút để dự án khởi tạo xong.

## Bước 2. Tạo bảng dữ liệu và phân quyền

1. Trong Supabase, mở **SQL Editor** → **New query**.
2. Mở file `supabase/migrations/20261122000000_parent_portal.sql`, chép **toàn bộ** nội dung, dán vào ô truy vấn rồi bấm **Run**.
3. Kết quả phải báo *Success. No rows returned*.

## Bước 3. Tắt tự đăng ký tài khoản

**Authentication → Sign In / Providers**: tắt **Allow new users to sign up**. Chỉ giáo viên mới tạo tài khoản cho phụ huynh.

## Bước 4. Đưa hàm tạo tài khoản lên 🤖

Hàm `manage-accounts` dùng để tạo tài khoản phụ huynh và giáo viên.

**Cách A — trên trang Supabase:** **Edge Functions → Deploy a new function → Via Editor**, đặt tên `manage-accounts`, dán nội dung file `supabase/functions/manage-accounts/index.ts` rồi bấm **Deploy**.

**Cách B — Claude làm qua dòng lệnh:** chạy `npx supabase login`, đăng nhập trên trình duyệt, rồi nhờ Claude chạy lệnh deploy.

## Bước 5. Tạo tài khoản quản trị cho bạn

1. **Authentication → Users → Add user → Create new user**: nhập email và mật khẩu của bạn, tick **Auto Confirm User**.
2. Mở **SQL Editor**, chạy câu lệnh sau (thay email bằng email bạn vừa tạo):

```sql
update public.profiles
set role = 'admin', full_name = 'Trí Đức Math'
where id = (select id from auth.users where email = 'email-cua-ban@gmail.com');
```

## Bước 6. Nối website với Supabase 🤖

Vào **Project Settings → API**, gửi cho Claude 2 giá trị:
- **Project URL** (dạng `https://xxxx.supabase.co`)
- **anon public** key

Hai giá trị này được phép công khai. **Không gửi khóa `service_role`** cho bất kỳ ai.

## Sử dụng hằng ngày

| Việc | Ai làm | Ở đâu |
|---|---|---|
| Tạo lớp, tạo tài khoản giáo viên, giao lớp | Quản trị | Trang giáo viên → *Lớp & giáo viên* |
| Thêm học sinh, tạo tài khoản phụ huynh | Giáo viên | Trang giáo viên → *Học sinh & tài khoản* |
| Tạo bài kiểm tra tuần, tải đề, nhập điểm, nhận xét, tải bài làm | Giáo viên | Trang giáo viên → *Nhập kết quả* |
| Xem kết quả, đề bài, bài làm, nhận xét | Phụ huynh | Cổng phụ huynh |

- Phụ huynh đăng nhập bằng **mã học sinh** và mật khẩu do giáo viên cấp, sau đó tự đổi mật khẩu.
- Quên mật khẩu: giáo viên bấm **Cấp lại mật khẩu** rồi gửi mật khẩu mới qua Zalo.
- Ảnh chụp bài làm được tự thu nhỏ trước khi tải lên để tiết kiệm dung lượng.

## Giới hạn gói miễn phí

- 1 GB lưu file. Mỗi ảnh sau khi thu nhỏ khoảng 200–400 KB, tức khoảng 3.000 ảnh.
- Dự án **tạm dừng nếu 7 ngày liền không ai dùng**; đăng nhập vào Supabase và bấm *Restore* để bật lại. Khi dùng hằng tuần thì không bị dừng.
- Khi gần đầy, có thể xóa bài cũ hoặc nâng cấp gói Pro (25 USD/tháng).
