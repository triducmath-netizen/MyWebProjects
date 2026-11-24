// Trí Đức Math — phụ huynh tự đăng ký tài khoản.
// Phụ huynh phải có MÃ LIÊN KẾT của con (giáo viên gửi) mới đăng ký được,
// nên người lạ không tự tạo tài khoản hay xem được thông tin học sinh nào.
// Nhập sai mã quá 10 lần/giờ từ cùng một máy thì bị tạm khóa.
// Khi deploy: TẮT "Verify JWT" (người đăng ký chưa có tài khoản để đăng nhập).
//
// POST { login, password, full_name, link_code }
//   login: số điện thoại (0912345678, +84912345678) hoặc email.

import { createClient } from "jsr:@supabase/supabase-js@2";

const PHONE_EMAIL_DOMAIN = "ph.triducmath.vn";
const STUDENT_EMAIL_DOMAIN = "hs.triducmath.vn";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

// Số điện thoại → email nội bộ; email giữ nguyên. Trả về null nếu không hợp lệ.
function loginToEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim().toLowerCase();
  if (s.includes("@")) {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s) || s.length > 200) return null;
    if (s.endsWith("@" + PHONE_EMAIL_DOMAIN) || s.endsWith("@" + STUDENT_EMAIL_DOMAIN)) return null;
    return s;
  }
  let d = s.replace(/[\s.\-()]/g, "");
  if (d.startsWith("+84")) d = "0" + d.slice(3);
  else if (/^84\d{9}$/.test(d)) d = "0" + d.slice(2);
  if (!/^0\d{9}$/.test(d)) return null;
  return `${d}@${PHONE_EMAIL_DOMAIN}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply(405, { error: "Chỉ hỗ trợ POST" });

  // deno-lint-ignore no-explicit-any
  let body: any;
  try { body = await req.json(); } catch { return reply(400, { error: "Dữ liệu không hợp lệ" }); }

  const email = loginToEmail(body?.login);
  if (!email) return reply(400, { error: "Số điện thoại (10 số) hoặc email chưa đúng" });
  const password = body?.password;
  if (typeof password !== "string" || password.length < 8 || password.length > 72) {
    return reply(400, { error: "Mật khẩu cần từ 8 đến 72 ký tự" });
  }
  const fullName = typeof body?.full_name === "string" ? body.full_name.trim().slice(0, 100) : "";
  if (!fullName) return reply(400, { error: "Vui lòng nhập họ tên phụ huynh" });
  const linkCode = typeof body?.link_code === "string" ? body.link_code.slice(0, 40) : "";
  if (!linkCode.trim()) return reply(400, { error: "Vui lòng nhập mã liên kết" });
  // Khóa đếm số lần nhập sai: địa chỉ máy người đăng ký.
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim()
    || req.headers.get("x-real-ip") || "khong-ro";
  const key = "ip:" + ip;

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  // 1) Kiểm tra mã trước khi tạo tài khoản (nhập sai được đếm).
  const { data: chk, error: chkErr } = await admin.rpc("link_by_code_internal", {
    p_parent: null, p_link_code: linkCode, p_key: key,
  });
  if (chkErr) return reply(500, { error: "Máy chủ đang bận, vui lòng thử lại" });
  if (!chk?.ok) return reply(400, { error: chk?.error ?? "Mã không đúng" });

  // 2) Tạo tài khoản phụ huynh.
  const { data: created, error: ce } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
    app_metadata: { role: "parent", full_name: fullName },
  });
  if (ce || !created?.user) {
    const exists = /already|registered|exists/i.test(ce?.message ?? "");
    return reply(exists ? 409 : 400, {
      error: exists
        ? "Số điện thoại / email này đã có tài khoản. Hãy đăng nhập rồi nhập mã ở ô \"Liên kết với học sinh\"."
        : (ce?.message ?? "Không tạo được tài khoản"),
    });
  }
  const uid = created.user.id;
  const { error: pe } = await admin.from("profiles")
    .upsert({ id: uid, role: "parent", full_name: fullName, email }, { onConflict: "id" });
  if (pe) {
    await admin.auth.admin.deleteUser(uid);
    return reply(500, { error: "Không tạo được hồ sơ phụ huynh" });
  }

  // 3) Liên kết với học sinh có mã liên kết này.
  const { data: link, error: le } = await admin.rpc("link_by_code_internal", {
    p_parent: uid, p_link_code: linkCode, p_key: key,
  });
  if (le || !link?.ok) {
    await admin.auth.admin.deleteUser(uid);
    return reply(400, { error: link?.error ?? "Không liên kết được với học sinh" });
  }
  return reply(200, { ok: true, email, student: link.full_name });
});
