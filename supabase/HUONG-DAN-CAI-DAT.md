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
2. Chạy **lần lượt từng file** trong thư mục `supabase/migrations/`, theo thứ tự tên file (cũ trước, mới sau). Với mỗi file: chép **toàn bộ** nội dung, dán vào một truy vấn mới rồi bấm **Run**.
   - `20261122000000_parent_portal.sql`: bảng, phân quyền, kho file
   - `20261123000000_grant_table_access.sql`: cấp quyền bảng (dự án Supabase mới cần)
   - `20261123010000_fix_select_policies.sql`: sửa quy tắc xem dữ liệu
   - `20261123020000_admin_only_add_delete_students.sql`: chỉ quản trị được thêm/xóa học sinh
   - `20261123030000_admin_only_edit_students.sql`: chỉ quản trị được sửa tên/chuyển lớp học sinh
   - `20261123040000_online_quizzes.sql`: bài kiểm tra trực tuyến
   - `20261123050000_quiz_question_count.sql`: hiện số câu của đề cho học sinh
   - `20261123060000_practice_bank.sql`: ngân hàng đề luyện tập theo chuyên đề
   - `20261124000000_bank_editing.sql`: giáo viên xem/sửa ngân hàng đề trên trang giáo viên
   - `20261125000000_parent_links.sql`: tài khoản phụ huynh theo dõi các con, mã học sinh tự sinh TDM000001…
   - `20261126000000_student_link_codes.sql`: ngày sinh học sinh, mã liên kết cố định cho từng em (bố và mẹ dùng chung)
   - `20261127000000_admin_only_unlink.sql`: chỉ quản trị được gỡ liên kết phụ huynh – học sinh
   - `20261128000000_delete_class_guard.sql`: không xóa được lớp còn học sinh
   - `20261129000000_trial_signups.sql`: lưu đăng ký học thử từ trang chủ (khách chỉ gửi được, chỉ quản trị xem)
3. Mỗi file phải báo *Success. No rows returned*.

## Bước 3. Tắt tự đăng ký tài khoản

**Authentication → Sign In / Providers**: tắt **Allow new users to sign up**. Chỉ giáo viên mới tạo tài khoản cho phụ huynh.

## Bước 4. Đưa hàm tạo tài khoản lên 🤖

Hàm `manage-accounts` dùng để tạo tài khoản phụ huynh và giáo viên.

**Cách A — trên trang Supabase:** **Edge Functions → Deploy a new function → Via Editor**, đặt tên `manage-accounts`, dán nội dung file `supabase/functions/manage-accounts/index.ts` rồi bấm **Deploy**.

**Cách B — Claude làm qua dòng lệnh:** chạy `npx supabase login`, đăng nhập trên trình duyệt, rồi nhờ Claude chạy lệnh deploy.

**Hàm `parent-signup`** (phụ huynh tự đăng ký): **Deploy a new function → Via Editor**, đặt tên `parent-signup`, dán nội dung `supabase/functions/parent-signup/index.ts`, bấm **Deploy function**, rồi vào **Settings** của hàm, **tắt "Verify JWT"** và bấm **Save changes**.

**Mật khẩu học sinh 6 chữ số:** trong **Authentication → Sign In / Providers → Email**, giữ **Minimum password length = 6** và **Password requirements = No required characters**.

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
| Thêm học sinh: điền họ tên + ngày sinh; máy tự sinh mã TDM…, mật khẩu ban đầu (6 chữ số ngẫu nhiên, chỉ hiện một lần) và mã liên kết | Quản trị | Trang giáo viên → *Học sinh & tài khoản* |
| Xem / đổi mã liên kết, xem / gỡ phụ huynh đã liên kết | Giáo viên | Trang giáo viên → *Học sinh & tài khoản* → *Mã liên kết* |
| Đăng ký tài khoản phụ huynh, liên kết với con | Phụ huynh | Cổng phụ huynh → *Đăng ký tài khoản phụ huynh* / ô *Liên kết với học sinh* |
| Học sinh quên mật khẩu | Phụ huynh hoặc giáo viên | *Đặt lại mật khẩu cho con* / *Cấp lại MK học sinh* |
| Tạo bài kiểm tra tuần, tải đề, nhập điểm, nhận xét, tải bài làm | Giáo viên | Trang giáo viên → *Nhập kết quả* |
| Xem kết quả, đề bài, bài làm, nhận xét | Phụ huynh | Cổng phụ huynh |
| Xem, sửa đề luyện tập (câu hỏi, đáp án, lời giải, thời gian) | Giáo viên | Trang giáo viên → *Ngân hàng đề* |
| Ẩn/hiện đề luyện tập, xóa câu, xóa đề (chỉ đề chưa ai làm) | Quản trị | Trang giáo viên → *Ngân hàng đề* |

- Học sinh đăng nhập bằng **mã học sinh**; lần đầu bắt buộc đổi sang mật khẩu mới gồm đúng 6 chữ số. Mã học sinh không đổi được.
- Phụ huynh đăng nhập bằng **số điện thoại hoặc email** đã đăng ký; chỉ xem được kết quả của các con đã liên kết.
- Mỗi học sinh có **một mã liên kết cố định** (8 ký tự, ví dụ ABCD-EFGH). Mỗi lần nhập một mã là liên kết với một em; bố và mẹ dùng chung mã. Mã không hết hạn; giáo viên bấm *Đổi mã mới* nếu lộ mã (phụ huynh đã liên kết vẫn giữ). Nhập sai quá 10 lần trong 1 giờ thì bị tạm khóa.
- Phụ huynh quên mật khẩu: giáo viên bấm **Cấp lại MK** cạnh tên phụ huynh rồi gửi qua Zalo.
- Ảnh chụp bài làm được tự thu nhỏ trước khi tải lên để tiết kiệm dung lượng.

## Giới hạn gói miễn phí

- 1 GB lưu file. Mỗi ảnh sau khi thu nhỏ khoảng 200–400 KB, tức khoảng 3.000 ảnh.
- Dự án **tạm dừng nếu 7 ngày liền không ai dùng**; đăng nhập vào Supabase và bấm *Restore* để bật lại. Khi dùng hằng tuần thì không bị dừng.
- Khi gần đầy, có thể xóa bài cũ hoặc nâng cấp gói Pro (25 USD/tháng).
