// Trí Đức Math — tạo và quản lý tài khoản đăng nhập.
// Chạy trên máy chủ Supabase (Edge Function), dùng khóa service role nên
// trình duyệt không bao giờ thấy khóa này.
//
// Hành động:
//   create_parent  { student_id, password }      giáo viên lớp đó hoặc quản trị
//   reset_parent   { student_id, password }      giáo viên lớp đó hoặc quản trị
//   delete_parent  { student_id }                chỉ quản trị
//   create_teacher { email, full_name, password } chỉ quản trị
//   reset_teacher  { teacher_id, password }      chỉ quản trị

import { createClient } from "jsr:@supabase/supabase-js@2";

const PARENT_EMAIL_DOMAIN = "hs.triducmath.vn";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function reply(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function validPassword(p: unknown): p is string {
  return typeof p === "string" && p.length >= 8 && p.length <= 72;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply(405, { error: "Chỉ hỗ trợ POST" });

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  // Xác định người gọi từ token đăng nhập của họ.
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return reply(401, { error: "Chưa đăng nhập" });
  const { data: who, error: whoErr } = await admin.auth.getUser(token);
  if (whoErr || !who?.user) return reply(401, { error: "Phiên đăng nhập không hợp lệ" });

  const { data: me } = await admin
    .from("profiles").select("role").eq("id", who.user.id).single();
  const role = me?.role as string | undefined;
  if (role !== "admin" && role !== "teacher") {
    return reply(403, { error: "Không có quyền" });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return reply(400, { error: "Dữ liệu không hợp lệ" });
  }
  const action = body.action;

  // Giáo viên chỉ được thao tác với học sinh lớp mình phụ trách.
  async function loadStudentForCaller(studentId: unknown) {
    if (typeof studentId !== "number") return { err: reply(400, { error: "Thiếu mã học sinh" }) };
    const { data: s } = await admin
      .from("students").select("id, code, full_name, class_id, parent_id")
      .eq("id", studentId).single();
    if (!s) return { err: reply(404, { error: "Không tìm thấy học sinh" }) };
    if (role !== "admin") {
      const { data: tc } = await admin
        .from("teacher_classes").select("class_id")
        .eq("teacher_id", who.user!.id).eq("class_id", s.class_id).maybeSingle();
      if (!tc) return { err: reply(403, { error: "Học sinh không thuộc lớp bạn phụ trách" }) };
    }
    return { s };
  }

  if (action === "delete_parent") {
    if (role !== "admin") return reply(403, { error: "Chỉ quản trị viên được xóa học sinh" });
    const { s, err } = await loadStudentForCaller(body.student_id);
    if (err) return err;
    if (!s!.parent_id) return reply(200, { ok: true });
    const { error } = await admin.auth.admin.deleteUser(s!.parent_id);
    if (error) return reply(400, { error: error.message });
    return reply(200, { ok: true });
  }

  if (action === "create_parent" || action === "reset_parent") {
    if (!validPassword(body.password)) {
      return reply(400, { error: "Mật khẩu cần từ 8 đến 72 ký tự" });
    }
    const { s, err } = await loadStudentForCaller(body.student_id);
    if (err) return err;

    if (action === "create_parent") {
      if (s!.parent_id) return reply(409, { error: "Học sinh này đã có tài khoản phụ huynh" });
      const email = `${s!.code.toLowerCase()}@${PARENT_EMAIL_DOMAIN}`;
      const { data: created, error } = await admin.auth.admin.createUser({
        email,
        password: body.password,
        email_confirm: true,
        app_metadata: { role: "parent", full_name: `Phụ huynh ${s!.full_name}` },
      });
      if (error || !created.user) {
        return reply(400, { error: error?.message ?? "Không tạo được tài khoản" });
      }
      const { error: linkErr } = await admin
        .from("students").update({ parent_id: created.user.id }).eq("id", s!.id);
      if (linkErr) {
        await admin.auth.admin.deleteUser(created.user.id);
        return reply(500, { error: "Không gắn được tài khoản với học sinh" });
      }
      return reply(200, { ok: true, login_code: s!.code });
    }

    if (!s!.parent_id) return reply(404, { error: "Học sinh này chưa có tài khoản phụ huynh" });
    const { error } = await admin.auth.admin.updateUserById(s!.parent_id, {
      password: body.password,
    });
    if (error) return reply(400, { error: error.message });
    return reply(200, { ok: true, login_code: s!.code });
  }

  if (action === "create_teacher" || action === "reset_teacher") {
    if (role !== "admin") return reply(403, { error: "Chỉ quản trị viên được làm việc này" });
    if (!validPassword(body.password)) {
      return reply(400, { error: "Mật khẩu cần từ 8 đến 72 ký tự" });
    }

    if (action === "create_teacher") {
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      const fullName = typeof body.full_name === "string" ? body.full_name.trim() : "";
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return reply(400, { error: "Email không hợp lệ" });
      if (!fullName) return reply(400, { error: "Thiếu họ tên giáo viên" });
      const { data: created, error } = await admin.auth.admin.createUser({
        email,
        password: body.password,
        email_confirm: true,
        app_metadata: { role: "teacher", full_name: fullName },
      });
      if (error || !created.user) {
        return reply(400, { error: error?.message ?? "Không tạo được tài khoản" });
      }
      return reply(200, { ok: true, teacher_id: created.user.id });
    }

    if (typeof body.teacher_id !== "string") return reply(400, { error: "Thiếu giáo viên" });
    const { data: t } = await admin
      .from("profiles").select("role").eq("id", body.teacher_id).single();
    if (t?.role !== "teacher") return reply(404, { error: "Không tìm thấy giáo viên" });
    const { error } = await admin.auth.admin.updateUserById(body.teacher_id, {
      password: body.password,
    });
    if (error) return reply(400, { error: error.message });
    return reply(200, { ok: true });
  }

  return reply(400, { error: "Hành động không hợp lệ" });
});
