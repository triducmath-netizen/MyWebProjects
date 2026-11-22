// Điền 2 giá trị này từ Supabase → Project Settings → API.
// Khóa "anon public" được phép để công khai: dữ liệu đã được bảo vệ bằng phân quyền (RLS).
// TUYỆT ĐỐI không dán khóa "service_role" vào đây.
export const SUPABASE_URL = 'https://YOUR-PROJECT.supabase.co';
export const SUPABASE_ANON_KEY = 'YOUR-ANON-KEY';

// Phụ huynh đăng nhập bằng mã học sinh; hệ thống đổi mã thành email nội bộ này.
// Phải trùng với PARENT_EMAIL_DOMAIN trong supabase/functions/manage-accounts/index.ts.
export const PARENT_EMAIL_DOMAIN = 'hs.triducmath.vn';
