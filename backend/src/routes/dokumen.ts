import { Hono } from "hono";
import { nowIso, uuid, writeAuditLog } from "../lib/db";
import { requireRole } from "../middleware/rbac";
import type { Env, Variables } from "../types";

export const dokumenRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();
const EDITOR_ROLES = ["SUPER_ADMIN", "ADMIN_KEPEGAWAIAN"] as const;

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const MAX_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB

dokumenRoutes.get("/pegawai/:pegawaiId", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT id, pegawai_id, entity_type, entity_id, jenis_dokumen, nama_file, mime_type, ukuran_bytes, versi,
            is_current_version, keterangan, uploaded_by, uploaded_at
     FROM dokumen WHERE pegawai_id = ? ORDER BY uploaded_at DESC`
  )
    .bind(c.req.param("pegawaiId"))
    .all();
  return c.json({ data: results });
});

dokumenRoutes.get("/:id/riwayat-versi", async (c) => {
  const id = c.req.param("id");
  const doc = await c.env.DB.prepare(`SELECT * FROM dokumen WHERE id = ?`).bind(id).first<{ dokumen_induk_id: string | null; id: string }>();
  if (!doc) return c.json({ error: "Dokumen tidak ditemukan." }, 404);
  const rootId = doc.dokumen_induk_id ?? doc.id;
  const { results } = await c.env.DB.prepare(
    `SELECT id, nama_file, versi, is_current_version, uploaded_by, uploaded_at FROM dokumen
     WHERE id = ? OR dokumen_induk_id = ? ORDER BY versi DESC`
  )
    .bind(rootId, rootId)
    .all();
  return c.json({ data: results });
});

interface UploadedFile {
  name: string;
  type: string;
  size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
}

dokumenRoutes.post("/upload", requireRole(...EDITOR_ROLES), async (c) => {
  const authUser = c.get("authUser");
  const form = await c.req.formData();
  const rawFile = form.get("file");
  const pegawaiId = form.get("pegawaiId")?.toString();
  const entityType = form.get("entityType")?.toString() ?? "PEGAWAI";
  const entityId = form.get("entityId")?.toString() ?? null;
  const jenisDokumen = form.get("jenisDokumen")?.toString();
  const keterangan = form.get("keterangan")?.toString() ?? null;
  const dokumenIndukId = form.get("dokumenIndukId")?.toString() ?? null;

  if (!rawFile || typeof rawFile === "string") return c.json({ error: "File wajib diunggah." }, 400);
  const file = rawFile as unknown as UploadedFile;
  if (!jenisDokumen) return c.json({ error: "Jenis dokumen wajib dipilih." }, 400);
  if (!ALLOWED_MIME.has(file.type)) {
    return c.json({ error: "Tipe file tidak didukung. Gunakan PDF, JPG, PNG, atau WEBP." }, 400);
  }
  if (file.size > MAX_SIZE_BYTES) {
    return c.json({ error: "Ukuran file maksimum 15 MB." }, 400);
  }

  const id = uuid();
  const now = nowIso();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const r2Key = `dokumen/${pegawaiId ?? "umum"}/${id}-${safeName}`;

  await c.env.DOCS_BUCKET.put(r2Key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  });

  let versi = 1;
  if (dokumenIndukId) {
    await c.env.DB.prepare(`UPDATE dokumen SET is_current_version = 0 WHERE id = ? OR dokumen_induk_id = ?`)
      .bind(dokumenIndukId, dokumenIndukId)
      .run();
    const maxVersi = await c.env.DB.prepare(
      `SELECT MAX(versi) as maxVersi FROM dokumen WHERE id = ? OR dokumen_induk_id = ?`
    )
      .bind(dokumenIndukId, dokumenIndukId)
      .first<{ maxVersi: number }>();
    versi = (maxVersi?.maxVersi ?? 1) + 1;
  }

  await c.env.DB.prepare(
    `INSERT INTO dokumen (id, pegawai_id, entity_type, entity_id, jenis_dokumen, nama_file, r2_key, mime_type, ukuran_bytes, versi, is_current_version, dokumen_induk_id, keterangan, uploaded_by, uploaded_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,1,?,?,?,?)`
  )
    .bind(
      id,
      pegawaiId ?? null,
      entityType,
      entityId,
      jenisDokumen,
      file.name,
      r2Key,
      file.type,
      file.size,
      versi,
      dokumenIndukId,
      keterangan,
      authUser.id,
      now
    )
    .run();

  await writeAuditLog(c.env.DB, {
    user: authUser,
    aksi: "UPLOAD",
    entityType: "DOKUMEN",
    entityId: id,
    dataSesudah: { pegawaiId, jenisDokumen, namaFile: file.name, ukuranBytes: file.size, versi },
  });

  return c.json({ data: { id, versi } }, 201);
});

dokumenRoutes.get("/:id/file", async (c) => {
  const id = c.req.param("id");
  const doc = await c.env.DB.prepare(`SELECT * FROM dokumen WHERE id = ?`).bind(id).first<{
    r2_key: string;
    mime_type: string | null;
    nama_file: string;
  }>();
  if (!doc) return c.json({ error: "Dokumen tidak ditemukan." }, 404);

  const object = await c.env.DOCS_BUCKET.get(doc.r2_key);
  if (!object) return c.json({ error: "File tidak ditemukan di penyimpanan." }, 404);

  return new Response(object.body, {
    headers: {
      "Content-Type": doc.mime_type ?? "application/octet-stream",
      "Content-Disposition": `inline; filename="${doc.nama_file}"`,
      "Cache-Control": "private, max-age=300",
    },
  });
});

dokumenRoutes.delete("/:id", requireRole(...EDITOR_ROLES), async (c) => {
  const authUser = c.get("authUser");
  const id = c.req.param("id");
  const doc = await c.env.DB.prepare(`SELECT * FROM dokumen WHERE id = ?`).bind(id).first<{ r2_key: string }>();
  if (!doc) return c.json({ error: "Dokumen tidak ditemukan." }, 404);

  await c.env.DOCS_BUCKET.delete(doc.r2_key);
  await c.env.DB.prepare(`DELETE FROM dokumen WHERE id = ?`).bind(id).run();

  await writeAuditLog(c.env.DB, { user: authUser, aksi: "DELETE", entityType: "DOKUMEN", entityId: id, dataSebelum: doc });

  return c.json({ message: "Dokumen berhasil dihapus." });
});
