import { Hono } from "hono";
import type { Env, Variables } from "../types";
import { authMiddleware, requireRole, WRITE_ROLES } from "../middleware/auth";
import { badRequest, notFound } from "../lib/http";
import { logAktivitas } from "../lib/audit";

const route = new Hono<{ Bindings: Env; Variables: Variables }>();
route.use("*", authMiddleware);

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
]);
const MAX_SIZE_BYTES = 15 * 1024 * 1024; // 15MB

const JENIS_VALUES = ["sk_cpns", "sk_pns", "sk_pangkat", "sk_jabatan", "ijazah", "sertifikat", "pak", "skp", "usulan_kp", "foto", "lainnya"];

route.get("/", async (c) => {
  const q = c.req.query();
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (q.pegawaiId) {
    clauses.push("pegawai_id = ?");
    params.push(q.pegawaiId);
  }
  if (q.entitasTerkaitTipe && q.entitasTerkaitId) {
    clauses.push("entitas_terkait_tipe = ? AND entitas_terkait_id = ?");
    params.push(q.entitasTerkaitTipe, q.entitasTerkaitId);
  }
  if (q.jenis) {
    clauses.push("jenis = ?");
    params.push(q.jenis);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const { results } = await c.env.DB.prepare(
    `SELECT id, jenis, nama_file, mime_type, ukuran_bytes, pegawai_id, entitas_terkait_tipe, entitas_terkait_id,
            versi, dokumen_induk_id, uploaded_by, uploaded_at
     FROM dokumen ${where} ORDER BY uploaded_at DESC`
  )
    .bind(...params)
    .all();
  return c.json(results);
});

route.get("/:id", async (c) => {
  const row = await c.env.DB.prepare(`SELECT * FROM dokumen WHERE id = ?`).bind(c.req.param("id")).first();
  if (!row) throw notFound("Dokumen tidak ditemukan");
  return c.json(row);
});

route.get("/:id/versions", async (c) => {
  const id = c.req.param("id");
  const current = await c.env.DB.prepare(`SELECT COALESCE(dokumen_induk_id, id) as root_id FROM dokumen WHERE id = ?`).bind(id).first<{ root_id: number }>();
  if (!current) throw notFound("Dokumen tidak ditemukan");
  const { results } = await c.env.DB.prepare(
    `SELECT id, nama_file, versi, uploaded_by, uploaded_at FROM dokumen WHERE id = ? OR dokumen_induk_id = ? ORDER BY versi`
  )
    .bind(current.root_id, current.root_id)
    .all();
  return c.json(results);
});

route.get("/:id/file", async (c) => {
  const row = await c.env.DB.prepare(`SELECT r2_key, mime_type, nama_file FROM dokumen WHERE id = ?`).bind(c.req.param("id")).first<{
    r2_key: string;
    mime_type: string;
    nama_file: string;
  }>();
  if (!row) throw notFound("Dokumen tidak ditemukan");
  const object = await c.env.DOCS.get(row.r2_key);
  if (!object) throw notFound("File tidak ditemukan di penyimpanan");
  return new Response(object.body, {
    headers: {
      "Content-Type": row.mime_type,
      "Content-Disposition": `inline; filename="${encodeURIComponent(row.nama_file)}"`,
      "Cache-Control": "private, max-age=300",
    },
  });
});

route.post("/", requireRole(...WRITE_ROLES), async (c) => {
  const user = c.get("user");
  const form = await c.req.formData();
  const file: unknown = form.get("file");
  const jenis = String(form.get("jenis") ?? "");
  const pegawaiId = form.get("pegawaiId") ? Number(form.get("pegawaiId")) : null;
  const entitasTerkaitTipe = form.get("entitasTerkaitTipe") ? String(form.get("entitasTerkaitTipe")) : null;
  const entitasTerkaitId = form.get("entitasTerkaitId") ? Number(form.get("entitasTerkaitId")) : null;
  const dokumenIndukId = form.get("dokumenIndukId") ? Number(form.get("dokumenIndukId")) : null;

  if (!(file instanceof File)) throw badRequest("File tidak ditemukan (field 'file')");
  if (!JENIS_VALUES.includes(jenis)) throw badRequest(`jenis harus salah satu dari: ${JENIS_VALUES.join(", ")}`);
  if (!ALLOWED_MIME.has(file.type)) throw badRequest("Tipe file harus PDF, PNG, JPEG, atau WEBP");
  if (file.size > MAX_SIZE_BYTES) throw badRequest("Ukuran file maksimal 15MB");

  let versi = 1;
  if (dokumenIndukId) {
    const parent = await c.env.DB.prepare(`SELECT id, pegawai_id FROM dokumen WHERE id = ?`).bind(dokumenIndukId).first<{ id: number; pegawai_id: number }>();
    if (!parent) throw notFound("Dokumen induk tidak ditemukan");
    const maxVersi = await c.env.DB.prepare(
      `SELECT MAX(versi) as v FROM dokumen WHERE id = ? OR dokumen_induk_id = ?`
    )
      .bind(dokumenIndukId, dokumenIndukId)
      .first<{ v: number }>();
    versi = (maxVersi?.v ?? 1) + 1;
  }

  const key = `dokumen/${pegawaiId ?? "umum"}/${jenis}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  await c.env.DOCS.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });

  const result = await c.env.DB.prepare(
    `INSERT INTO dokumen (jenis, nama_file, r2_key, mime_type, ukuran_bytes, pegawai_id, entitas_terkait_tipe, entitas_terkait_id, versi, dokumen_induk_id, uploaded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(jenis, file.name, key, file.type, file.size, pegawaiId, entitasTerkaitTipe, entitasTerkaitId, versi, dokumenIndukId, user.id)
    .run();

  const id = result.meta.last_row_id;
  await logAktivitas(c.env, user, "upload", "dokumen", id as number, { jenis, namaFile: file.name, pegawaiId }, c.get("requestIp"));
  return c.json({ id, versi }, 201);
});

route.delete("/:id", requireRole("super_admin"), async (c) => {
  const id = c.req.param("id");
  const row = await c.env.DB.prepare(`SELECT r2_key FROM dokumen WHERE id = ?`).bind(id).first<{ r2_key: string }>();
  if (!row) throw notFound("Dokumen tidak ditemukan");
  await c.env.DOCS.delete(row.r2_key);
  await c.env.DB.prepare(`DELETE FROM dokumen WHERE id = ?`).bind(id).run();
  await logAktivitas(c.env, c.get("user"), "delete", "dokumen", Number(id), null, c.get("requestIp"));
  return c.json({ ok: true });
});

export default route;
