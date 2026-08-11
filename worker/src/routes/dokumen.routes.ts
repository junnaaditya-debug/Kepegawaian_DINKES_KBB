import { Hono } from "hono";
import { and, desc, eq, or } from "drizzle-orm";
import type { AppEnv } from "../types";
import { dokumen } from "../db/schema";
import { AppError } from "../utils/errors";
import { catatAudit } from "../utils/audit";
import { newId, nowIso } from "../utils/id";
import { requireAuth, requireRole } from "../middleware/auth";

const app = new Hono<AppEnv>();
app.use("*", requireAuth);

const ALLOWED_MIME = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

app.get("/", async (c) => {
  const db = c.get("db");
  const { pegawaiId, jenisDokumen } = c.req.query();
  const conditions = [];
  if (pegawaiId) conditions.push(eq(dokumen.pegawaiId, pegawaiId));
  if (jenisDokumen) conditions.push(eq(dokumen.jenisDokumen, jenisDokumen as any));
  const rows = await db.select().from(dokumen).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(dokumen.createdAt));
  return c.json(rows.map((d) => ({ ...d, url: `/dokumen/file/${d.id}` })));
});

app.post("/upload", requireRole("SUPER_ADMIN", "ADMIN_KEPEGAWAIAN"), async (c) => {
  const db = c.get("db");
  const authUser = c.get("user");
  const formData = await c.req.formData();

  const file = formData.get("file");
  const jenisDokumen = formData.get("jenisDokumen");
  const pegawaiId = formData.get("pegawaiId");
  const dokumenIndukId = formData.get("dokumenIndukId");

  if (!file || !(file instanceof File)) throw new AppError(400, "File wajib diunggah");
  if (!jenisDokumen || typeof jenisDokumen !== "string") throw new AppError(400, "Jenis dokumen wajib diisi");
  if (!ALLOWED_MIME.has(file.type)) throw new AppError(400, "Tipe file tidak didukung. Gunakan PDF, JPG, PNG, atau WEBP.");
  if (file.size > MAX_UPLOAD_BYTES) throw new AppError(400, "Ukuran file maksimal 10MB");

  let versi = 1;
  if (dokumenIndukId && typeof dokumenIndukId === "string") {
    const indukRows = await db.select().from(dokumen).where(eq(dokumen.id, dokumenIndukId)).limit(1);
    if (!indukRows[0]) throw new AppError(404, "Dokumen induk tidak ditemukan");
    const existingVersions = await db.select().from(dokumen).where(or(eq(dokumen.id, dokumenIndukId), eq(dokumen.dokumenIndukId, dokumenIndukId)));
    versi = existingVersions.length + 1;
  }

  const id = newId();
  const r2Key = `dokumen/${id}-${file.name}`;
  const buffer = await file.arrayBuffer();
  await c.env.DOKUMEN_BUCKET.put(r2Key, buffer, { httpMetadata: { contentType: file.type } });

  const row = {
    id,
    pegawaiId: typeof pegawaiId === "string" ? pegawaiId : null,
    jenisDokumen: jenisDokumen as any,
    namaFile: r2Key.split("/").pop()!,
    namaAsli: file.name,
    r2Key,
    mimeType: file.type,
    ukuran: file.size,
    versi,
    dokumenIndukId: typeof dokumenIndukId === "string" ? dokumenIndukId : null,
    uploadedById: authUser.id,
    createdAt: nowIso(),
  };
  await db.insert(dokumen).values(row);
  await catatAudit(db, { userId: authUser.id, aksi: "UPLOAD", entitas: "Dokumen", entitasId: row.id, dataSesudah: { ...row, r2Key: undefined } });

  return c.json({ ...row, url: `/dokumen/file/${row.id}` }, 201);
});

app.get("/:id/versi", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const rows = await db.select().from(dokumen).where(eq(dokumen.id, id)).limit(1);
  const doc = rows[0];
  if (!doc) throw new AppError(404, "Dokumen tidak ditemukan");

  const rootId = doc.dokumenIndukId || doc.id;
  const versions = await db.select().from(dokumen).where(or(eq(dokumen.id, rootId), eq(dokumen.dokumenIndukId, rootId)));
  versions.sort((a, b) => a.versi - b.versi);
  return c.json(versions.map((d) => ({ ...d, url: `/dokumen/file/${d.id}` })));
});

app.get("/file/:id", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const rows = await db.select().from(dokumen).where(eq(dokumen.id, id)).limit(1);
  const doc = rows[0];
  if (!doc) throw new AppError(404, "Dokumen tidak ditemukan");

  const object = await c.env.DOKUMEN_BUCKET.get(doc.r2Key);
  if (!object) throw new AppError(404, "File tidak ditemukan di penyimpanan");

  c.header("Content-Type", doc.mimeType);
  c.header("Content-Disposition", `inline; filename="${doc.namaAsli}"`);
  return c.body(object.body as any);
});

app.delete("/:id", requireRole("SUPER_ADMIN", "ADMIN_KEPEGAWAIAN"), async (c) => {
  const db = c.get("db");
  const authUser = c.get("user");
  const id = c.req.param("id");

  const rows = await db.select().from(dokumen).where(eq(dokumen.id, id)).limit(1);
  const doc = rows[0];
  if (!doc) throw new AppError(404, "Dokumen tidak ditemukan");

  await db.delete(dokumen).where(eq(dokumen.id, id));
  await c.env.DOKUMEN_BUCKET.delete(doc.r2Key);
  await catatAudit(db, { userId: authUser.id, aksi: "DELETE", entitas: "Dokumen", entitasId: id, dataSebelum: { ...doc, r2Key: undefined } });
  return c.body(null, 204);
});

export default app;
