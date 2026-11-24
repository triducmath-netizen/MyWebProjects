// Trí Đức Math — tạo và quản lý tài khoản đăng nhập.
// Chạy trên máy chủ Supabase (Edge Function), dùng khóa service role nên
// trình duyệt không bao giờ thấy khóa này.
//
// Hành động:
//   create_parent  { student_id }                tài khoản HỌC SINH (đăng nhập bằng mã HS) — giáo viên lớp đó hoặc quản trị
//   reset_parent   { student_id }                cấp lại mật khẩu học sinh — giáo viên lớp đó hoặc quản trị
//                  Mật khẩu học sinh = 6 chữ số trong mã (TDM000123 → 000123); học sinh phải tự đổi ở lần đăng nhập đầu.
//   change_student_password { password }         HỌC SINH tự đổi mật khẩu (đúng 6 chữ số)
//   delete_parent  { student_id }                xóa tài khoản học sinh — chỉ quản trị
//   reset_linked_parent { student_id, parent_id, password }  cấp lại mật khẩu PHỤ HUYNH đã liên kết với học sinh
//                                                — giáo viên lớp đó hoặc quản trị
//   create_teacher { email, full_name, password } chỉ quản trị
//   reset_teacher  { teacher_id, password }      chỉ quản trị
//   delete_teacher { teacher_id }                chỉ quản trị

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

// Ghi vai trò vào hồ sơ. Không dựa vào trigger lúc tạo tài khoản, vì Supabase
// có thể ghi app_metadata sau khi trigger đã chạy (hồ sơ khi đó bị mặc định là 'parent').
// deno-lint-ignore no-explicit-any
async function writeProfile(admin: any, id: string, role: string, fullName: string, email: string) {
  const { error } = await admin.from("profiles")
    .upsert({ id, role, full_name: fullName, email }, { onConflict: "id" });
  return error;
}

function validPassword(p: unknown): p is string {
  return typeof p === "string" && p.length >= 8 && p.length <= 72;
}

// Mật khẩu ban đầu của học sinh: 6 chữ số trong mã TDMxxxxxx; mã kiểu cũ → 6 chữ số ngẫu nhiên.
function initialStudentPassword(code: string): string {
  const m = /^TDM(\d{6})$/.exec(code);
  if (m) return m[1];
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1000000;
  return String(n).padStart(6, "0");
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

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return reply(400, { error: "Dữ liệu không hợp lệ" });
  }
  const action = body.action;

  // Học sinh tự đổi mật khẩu: đúng 6 chữ số, khác mật khẩu ban đầu.
  if (action === "change_student_password") {
    const { data: me1 } = await admin.from("students").select("id, code")
      .eq("parent_id", who.user.id).maybeSingle();
    if (!me1) return reply(403, { error: "Chỉ tài khoản học sinh dùng được chức năng này" });
    const pw = body.password;
    if (typeof pw !== "string" || !/^\d{6}$/.test(pw)) {
      return reply(400, { error: "Mật khẩu phải gồm đúng 6 chữ số" });
    }
    const m = /^TDM(\d{6})$/.exec(me1.code);
    if (m && m[1] === pw) return reply(400, { error: "Hãy chọn mật khẩu khác mật khẩu ban đầu" });
    const { error } = await admin.auth.admin.updateUserById(who.user.id, { password: pw });
    if (error) return reply(400, { error: error.message });
    await admin.from("students").update({ password_changed: true }).eq("id", me1.id);
    return reply(200, { ok: true });
  }

  const { data: me } = await admin
    .from("profiles").select("role").eq("id", who.user.id).single();
  const role = me?.role as string | undefined;
  if (role !== "admin" && role !== "teacher") {
    return reply(403, { error: "Không có quyền" });
  }

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
    const { s, err } = await loadStudentForCaller(body.student_id);
    if (err) return err;
    const password = initialStudentPassword(s!.code);

    if (action === "create_parent") {
      if (s!.parent_id) return reply(409, { error: "Học sinh này đã có tài khoản" });
      const email = `${s!.code.toLowerCase()}@${PARENT_EMAIL_DOMAIN}`;
      const { data: created, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        app_metadata: { role: "parent", full_name: s!.full_name },
      });
      if (error || !created.user) {
        return reply(400, { error: error?.message ?? "Không tạo được tài khoản" });
      }
      const profErr = await writeProfile(admin, created.user.id, "parent", s!.full_name, email);
      if (profErr) {
        await admin.auth.admin.deleteUser(created.user.id);
        return reply(500, { error: "Không tạo được hồ sơ học sinh" });
      }
      const { error: linkErr } = await admin
        .from("students").update({ parent_id: created.user.id, password_changed: false }).eq("id", s!.id);
      if (linkErr) {
        await admin.auth.admin.deleteUser(created.user.id);
        return reply(500, { error: "Không gắn được tài khoản với học sinh" });
      }
      return reply(200, { ok: true, login_code: s!.code, password });
    }

    if (!s!.parent_id) return reply(404, { error: "Học sinh này chưa có tài khoản" });
    const { error } = await admin.auth.admin.updateUserById(s!.parent_id, { password });
    if (error) return reply(400, { error: error.message });
    await admin.from("students").update({ password_changed: false }).eq("id", s!.id);
    return reply(200, { ok: true, login_code: s!.code, password });
  }

  if (action === "reset_linked_parent") {
    if (!validPassword(body.password)) {
      return reply(400, { error: "Mật khẩu cần từ 8 đến 72 ký tự" });
    }
    const { s, err } = await loadStudentForCaller(body.student_id);
    if (err) return err;
    if (typeof body.parent_id !== "string") return reply(400, { error: "Thiếu phụ huynh" });
    const { data: link } = await admin.from("parent_links").select("parent_id")
      .eq("student_id", s!.id).eq("parent_id", body.parent_id).maybeSingle();
    if (!link) return reply(404, { error: "Phụ huynh này chưa liên kết với học sinh" });
    const { data: p } = await admin.from("profiles").select("role, email").eq("id", body.parent_id).maybeSingle();
    if (p?.role !== "parent") return reply(400, { error: "Không phải tài khoản phụ huynh" });
    const { error } = await admin.auth.admin.updateUserById(body.parent_id, { password: body.password });
    if (error) return reply(400, { error: error.message });
    return reply(200, { ok: true, login: p.email });
  }

  if (action === "delete_teacher") {
    if (role !== "admin") return reply(403, { error: "Chỉ quản trị viên được làm việc này" });
    if (typeof body.teacher_id !== "string") return reply(400, { error: "Thiếu giáo viên" });
    if (body.teacher_id === who.user.id) return reply(400, { error: "Không thể tự xóa tài khoản quản trị" });
    const { data: t } = await admin
      .from("profiles").select("role").eq("id", body.teacher_id).maybeSingle();
    if (!t || t.role === "admin") return reply(404, { error: "Không tìm thấy giáo viên" });
    const { data: kid } = await admin
      .from("students").select("id").eq("parent_id", body.teacher_id).maybeSingle();
    if (kid) return reply(400, { error: "Đây là tài khoản phụ huynh, không phải giáo viên" });
    const { error } = await admin.auth.admin.deleteUser(body.teacher_id);
    if (error) return reply(400, { error: error.message });
    return reply(200, { ok: true });
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
      const profErr = await writeProfile(admin, created.user.id, "teacher", fullName, email);
      if (profErr) {
        await admin.auth.admin.deleteUser(created.user.id);
        return reply(500, { error: "Không tạo được hồ sơ giáo viên" });
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
