// Trí Đức Math — nhập đề vào ngân hàng đề (đề luyện tập và đề bài tập về nhà theo bài).
// Dùng bởi công cụ tools/upload-exams.mjs (agent ra đề), xác thực bằng mã khoá
// EXAM_IMPORT_TOKEN (đặt trong Supabase → Edge Functions → Secrets).
// Khi deploy: TẮT "Verify JWT" cho hàm này (hàm tự kiểm tra mã khoá).
//
// POST { exams: [ { slug, title, grade, topic, level, time_limit_min?, description?,
//                   sort_order?, usage?, chapter?, lesson_no?, questions: [ { kind, prompt, options?, points, answer, explanation?,
//                                               image_png?, explanation_image_png? } ] } ] }
// image_png / explanation_image_png: ảnh PNG mã hoá base64 (tuỳ chọn, tối đa 2 MB mỗi ảnh),
// lưu vào kho "tdm" tại quizzes/<id đề>/... (hình câu) và quizzes/<id đề>/sol/... (hình lời giải).
// usage: "practice" (mặc định, đề luyện tập) | "homework" (đề tương đương của một bài, dùng để
// giáo viên giao bài về nhà — học sinh không thấy ở mục luyện đề). chapter: tên chương SGK,
// lesson_no: số thứ tự bài (để sắp xếp); tên bài nằm ở topic.
// Đề đã có học sinh làm thì không ghi đè (trả về "skipped"). Hình cũ còn được bài về nhà đã giao
// dùng thì giữ lại.

import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-import-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

// deno-lint-ignore no-explicit-any
type Any = any;

const MAX_PNG = 2 * 1024 * 1024;
// Giải mã base64 → bytes PNG; trả null nếu không phải PNG hợp lệ hoặc quá lớn.
function decodePng(b64: unknown): Uint8Array | null {
  if (typeof b64 !== "string" || !b64.length || b64.length > Math.ceil(MAX_PNG / 3) * 4 + 8) return null;
  let bytes: Uint8Array;
  try { bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)); } catch { return null; }
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length > MAX_PNG || sig.some((v, i) => bytes[i] !== v)) return null;
  return bytes;
}

function validateExam(e: Any): string | null {
  if (!e || typeof e !== "object") return "đề không hợp lệ";
  if (typeof e.slug !== "string" || !/^[a-z0-9-]{3,80}$/.test(e.slug)) return "slug phải gồm chữ thường, số, dấu -";
  if (typeof e.title !== "string" || !e.title.trim()) return "thiếu title";
  if (!Number.isInteger(e.grade) || e.grade < 6 || e.grade > 12) return "grade phải từ 6 đến 12";
  if (typeof e.topic !== "string" || !e.topic.trim()) return "thiếu topic";
  if (!["tb", "kha", "gioi"].includes(e.level)) return "level phải là tb | kha | gioi";
  if (e.usage != null && !["practice", "homework"].includes(e.usage)) return "usage phải là practice | homework";
  if (e.chapter != null && (typeof e.chapter !== "string" || !e.chapter.trim())) return "chapter không hợp lệ";
  if (e.lesson_no != null && (!Number.isInteger(e.lesson_no) || e.lesson_no < 1 || e.lesson_no > 999)) return "lesson_no không hợp lệ";
  if (e.time_limit_min != null && (!Number.isInteger(e.time_limit_min) || e.time_limit_min < 1 || e.time_limit_min > 600)) return "time_limit_min không hợp lệ";
  if (!Array.isArray(e.questions) || !e.questions.length || e.questions.length > 100) return "questions phải có 1–100 câu";
  for (const [i, q] of e.questions.entries()) {
    const at = `câu ${i + 1}`;
    if (!["mcq", "tf", "short"].includes(q.kind)) return `${at}: kind không hợp lệ`;
    if (typeof q.prompt !== "string" || !q.prompt.trim()) return `${at}: thiếu prompt`;
    if (typeof q.points !== "number" || !(q.points > 0) || q.points > 100) return `${at}: points không hợp lệ`;
    if (q.kind === "mcq" || q.kind === "tf") {
      if (!Array.isArray(q.options) || q.options.length !== 4 || q.options.some((o: Any) => typeof o !== "string" || !o.trim())) return `${at}: cần đúng 4 options`;
    }
    if (q.kind === "mcq" && !(Number.isInteger(q.answer) && q.answer >= 0 && q.answer <= 3)) return `${at}: answer trắc nghiệm phải là 0–3`;
    if (q.kind === "tf" && !(Array.isArray(q.answer) && q.answer.length === 4 && q.answer.every((v: Any) => typeof v === "boolean"))) return `${at}: answer Đúng/Sai phải là 4 giá trị true/false`;
    if (q.kind === "short" && !(Array.isArray(q.answer) && q.answer.length && q.answer.every((v: Any) => typeof v === "string" && v.trim()))) return `${at}: answer trả lời ngắn phải là mảng chuỗi`;
    if (q.image_png != null && !decodePng(q.image_png)) return `${at}: image_png phải là ảnh PNG base64, tối đa 2 MB`;
    if (q.explanation_image_png != null && !decodePng(q.explanation_image_png)) return `${at}: explanation_image_png phải là ảnh PNG base64, tối đa 2 MB`;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply(405, { error: "Chỉ hỗ trợ POST" });

  const expected = Deno.env.get("EXAM_IMPORT_TOKEN") ?? "";
  const got = req.headers.get("x-import-token") ?? "";
  if (expected.length < 24 || !safeEqual(got, expected)) return reply(401, { error: "Sai mã khoá nhập đề" });

  let body: Any;
  try { body = await req.json(); } catch { return reply(400, { error: "JSON không hợp lệ" }); }
  if (!Array.isArray(body?.exams) || !body.exams.length || body.exams.length > 50) {
    return reply(400, { error: "exams phải là mảng 1–50 đề" });
  }
  for (const [i, e] of body.exams.entries()) {
    const err = validateExam(e);
    if (err) return reply(400, { error: `Đề ${i + 1} (${e?.slug ?? "?"}): ${err}` });
  }

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  const bucket = db.storage.from("tdm");
  // Tải một ảnh PNG lên kho, trả về đường dẫn (hoặc ném lỗi).
  const putPng = async (folder: string, b64: string) => {
    const path = `${folder}/${crypto.randomUUID()}.png`;
    const { error } = await bucket.upload(path, decodePng(b64)!, { contentType: "image/png", upsert: false });
    if (error) throw new Error(`tải ảnh: ${error.message}`);
    return path;
  };
  // Đường dẫn ảnh đang gắn với các câu của một đề (để xoá khi ghi đè / khi lỗi).
  const imagesOf = async (quizId: number) => {
    const { data: qs } = await db.from("quiz_questions").select("id, image_path").eq("quiz_id", quizId);
    const ids = (qs ?? []).map((q: Any) => q.id);
    const { data: ks } = ids.length
      ? await db.from("quiz_keys").select("explanation_image_path").in("question_id", ids)
      : { data: [] };
    return [...(qs ?? []).map((q: Any) => q.image_path), ...(ks ?? []).map((k: Any) => k.explanation_image_path)]
      .filter(Boolean) as string[];
  };
  const removeFiles = async (paths: string[]) => { if (paths.length) await bucket.remove(paths); };
  // Bỏ các hình còn được câu hỏi / lời giải khác dùng (bài về nhà đã chép từ đề này).
  const unused = async (paths: string[]) => {
    if (!paths.length) return paths;
    const { data: q } = await db.from("quiz_questions").select("image_path").in("image_path", paths);
    const { data: k } = await db.from("quiz_keys").select("explanation_image_path").in("explanation_image_path", paths);
    const used = new Set([...(q ?? []).map((x: Any) => x.image_path), ...(k ?? []).map((x: Any) => x.explanation_image_path)]);
    return paths.filter((p) => !used.has(p));
  };

  const results: Any[] = [];
  for (const e of body.exams) {
    const row = {
      class_id: null, title: e.title.trim(), grade: e.grade, topic: e.topic.trim(), level: e.level,
      slug: e.slug, time_limit_min: e.time_limit_min ?? null, description: e.description ?? null,
      sort_order: Number.isInteger(e.sort_order) ? e.sort_order : 0, published: true,
      usage: e.usage ?? "practice", chapter: e.chapter?.trim() ?? null, lesson_no: e.lesson_no ?? null,
      show_key_after: "submit", created_by: null,
    };
    const { data: existing } = await db.from("quizzes").select("id").eq("slug", e.slug).maybeSingle();
    let quizId: number;
    let oldImages: string[] = [];
    if (existing) {
      const { count } = await db.from("quiz_attempts").select("id", { count: "exact", head: true }).eq("quiz_id", existing.id);
      if ((count ?? 0) > 0) { results.push({ slug: e.slug, status: "skipped", reason: "đã có học sinh làm" }); continue; }
      const { error: ue } = await db.from("quizzes").update(row).eq("id", existing.id);
      if (ue) { results.push({ slug: e.slug, status: "error", reason: ue.message }); continue; }
      oldImages = await imagesOf(existing.id);
      await db.from("quiz_questions").delete().eq("quiz_id", existing.id);
      quizId = existing.id;
    } else {
      const { data: ins, error: ie } = await db.from("quizzes").insert(row).select("id").single();
      if (ie || !ins) { results.push({ slug: e.slug, status: "error", reason: ie?.message }); continue; }
      quizId = ins.id;
    }

    let failed: string | null = null;
    const newImages: string[] = [];
    for (const [i, q] of e.questions.entries()) {
      let image_path: string | null = null;
      let explanation_image_path: string | null = null;
      try {
        if (q.image_png) newImages.push(image_path = await putPng(`quizzes/${quizId}`, q.image_png));
        if (q.explanation_image_png) newImages.push(explanation_image_path = await putPng(`quizzes/${quizId}/sol`, q.explanation_image_png));
      } catch (err) { failed = `câu ${i + 1}: ${(err as Error).message}`; break; }
      const { data: qrow, error: qe } = await db.from("quiz_questions").insert({
        quiz_id: quizId, position: i + 1, kind: q.kind, prompt: q.prompt,
        options: q.kind === "short" ? null : q.options, points: q.points, image_path,
      }).select("id").single();
      if (qe || !qrow) { failed = `câu ${i + 1}: ${qe?.message}`; break; }
      const { error: ke } = await db.from("quiz_keys").insert({
        question_id: qrow.id, answer: q.answer, explanation: q.explanation ?? null, explanation_image_path,
      });
      if (ke) { failed = `đáp án câu ${i + 1}: ${ke.message}`; break; }
    }
    // Ảnh cũ của đề đã ghi đè: xóa nếu không còn bài nào dùng.
    await removeFiles(await unused(oldImages));
    if (failed) {
      await db.from("quizzes").delete().eq("id", quizId);
      // Ảnh vừa tải chỉ đề này dùng.
      await removeFiles(newImages);
      results.push({ slug: e.slug, status: "error", reason: failed });
    } else {
      results.push({ slug: e.slug, status: existing ? "updated" : "created", quiz_id: quizId, questions: e.questions.length, images: newImages.length });
    }
  }
  return reply(200, { ok: true, results });
});
