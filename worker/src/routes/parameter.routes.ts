import { Hono } from "hono";
import { z } from "zod";
import { eq } from "drizzle-orm";
import type { AppEnv } from "../types";
import { jenisJabatanFungsional, parameterAturan, parameterJenjangAngkaKredit, periodeKenaikanPangkat } from "../db/schema";
import { AppError } from "../utils/errors";
import { parseBody } from "../utils/validate";
import { catatAudit } from "../utils/audit";
import { newId, nowIso } from "../utils/id";
import { requireAuth, requireRole } from "../middleware/auth";

const app = new Hono<AppEnv>();
app.use("*", requireAuth);

// ---- Parameter aturan umum ----
app.get("/aturan", async (c) => {
  const db = c.get("db");
  let rows = await db.select().from(parameterAturan).limit(1);
  if (!rows[0]) {
    await db.insert(parameterAturan).values({ updatedAt: nowIso() });
    rows = await db.select().from(parameterAturan).limit(1);
  }
  return c.json(rows[0]);
});

const aturanSchema = z.object({
  masaKerjaMinimumTahun: z.union([z.string(), z.number()]),
  predikatSkpMinimum: z.enum(["SANGAT_BAIK", "BAIK", "CUKUP", "KURANG", "SANGAT_KURANG"]),
  reminderBulanSebelum1: z.union([z.string(), z.number()]),
  reminderBulanSebelum2: z.union([z.string(), z.number()]),
  wajibValidasiSkp: z.boolean().optional(),
});

app.put("/aturan", requireRole("SUPER_ADMIN"), async (c) => {
  const db = c.get("db");
  const authUser = c.get("user");
  let existingRows = await db.select().from(parameterAturan).limit(1);
  if (!existingRows[0]) {
    await db.insert(parameterAturan).values({ updatedAt: nowIso() });
    existingRows = await db.select().from(parameterAturan).limit(1);
  }
  const existing = existingRows[0];

  const body = parseBody(aturanSchema, await c.req.json());
  const updated = {
    masaKerjaMinimumTahun: Number(body.masaKerjaMinimumTahun),
    predikatSkpMinimum: body.predikatSkpMinimum,
    reminderBulanSebelum1: Number(body.reminderBulanSebelum1),
    reminderBulanSebelum2: Number(body.reminderBulanSebelum2),
    wajibValidasiSkp: !!body.wajibValidasiSkp,
    updatedAt: nowIso(),
    updatedBy: authUser.id,
  };
  await db.update(parameterAturan).set(updated).where(eq(parameterAturan.id, existing.id));
  await catatAudit(db, { userId: authUser.id, aksi: "UPDATE", entitas: "ParameterAturan", entitasId: String(existing.id), dataSebelum: existing, dataSesudah: updated });
  return c.json({ ...existing, ...updated });
});

// ---- Periode kenaikan pangkat ----
app.get("/periode", async (c) => {
  const db = c.get("db");
  const rows = await db.select().from(periodeKenaikanPangkat).orderBy(periodeKenaikanPangkat.bulan, periodeKenaikanPangkat.tanggal);
  return c.json(rows);
});

const periodeSchema = z.object({ bulan: z.union([z.string(), z.number()]), tanggal: z.union([z.string(), z.number()]), label: z.string().min(1), aktif: z.boolean().optional() });

app.post("/periode", requireRole("SUPER_ADMIN"), async (c) => {
  const db = c.get("db");
  const authUser = c.get("user");
  const body = parseBody(periodeSchema, await c.req.json());
  const row = { id: newId(), bulan: Number(body.bulan), tanggal: Number(body.tanggal), label: body.label, aktif: body.aktif ?? true };
  await db.insert(periodeKenaikanPangkat).values(row);
  await catatAudit(db, { userId: authUser.id, aksi: "CREATE", entitas: "PeriodeKenaikanPangkat", entitasId: row.id, dataSesudah: row });
  return c.json(row, 201);
});

app.put("/periode/:id", requireRole("SUPER_ADMIN"), async (c) => {
  const id = c.req.param("id");
  const db = c.get("db");
  const authUser = c.get("user");
  const existingRows = await db.select().from(periodeKenaikanPangkat).where(eq(periodeKenaikanPangkat.id, id)).limit(1);
  if (!existingRows[0]) throw new AppError(404, "Periode tidak ditemukan");

  const body = parseBody(periodeSchema.partial(), await c.req.json());
  const updated: Record<string, unknown> = {};
  if (body.bulan != null) updated.bulan = Number(body.bulan);
  if (body.tanggal != null) updated.tanggal = Number(body.tanggal);
  if (body.label != null) updated.label = body.label;
  if (body.aktif != null) updated.aktif = body.aktif;

  await db.update(periodeKenaikanPangkat).set(updated).where(eq(periodeKenaikanPangkat.id, id));
  await catatAudit(db, { userId: authUser.id, aksi: "UPDATE", entitas: "PeriodeKenaikanPangkat", entitasId: id, dataSebelum: existingRows[0], dataSesudah: updated });
  return c.json({ ...existingRows[0], ...updated });
});

app.delete("/periode/:id", requireRole("SUPER_ADMIN"), async (c) => {
  const id = c.req.param("id");
  const db = c.get("db");
  const authUser = c.get("user");
  const existingRows = await db.select().from(periodeKenaikanPangkat).where(eq(periodeKenaikanPangkat.id, id)).limit(1);
  if (!existingRows[0]) throw new AppError(404, "Periode tidak ditemukan");
  await db.delete(periodeKenaikanPangkat).where(eq(periodeKenaikanPangkat.id, id));
  await catatAudit(db, { userId: authUser.id, aksi: "DELETE", entitas: "PeriodeKenaikanPangkat", entitasId: id, dataSebelum: existingRows[0] });
  return c.body(null, 204);
});

// ---- Jenis jabatan fungsional & ambang batas angka kredit ----
app.get("/jabatan-fungsional", async (c) => {
  const db = c.get("db");
  const jenis = await db.select().from(jenisJabatanFungsional).orderBy(jenisJabatanFungsional.nama);
  const jenjang = await db.select().from(parameterJenjangAngkaKredit).orderBy(parameterJenjangAngkaKredit.urutan);
  const grouped = jenis.map((j) => ({ ...j, jenjangAngkaKredit: jenjang.filter((jk) => jk.jenisJabatanFungsionalId === j.id) }));
  return c.json(grouped);
});

const jenisSchema = z.object({ nama: z.string().min(1), rumpun: z.string().optional() });

app.post("/jabatan-fungsional", requireRole("SUPER_ADMIN"), async (c) => {
  const db = c.get("db");
  const authUser = c.get("user");
  const body = parseBody(jenisSchema, await c.req.json());
  const row = { id: newId(), nama: body.nama, rumpun: body.rumpun || null };
  await db.insert(jenisJabatanFungsional).values(row);
  await catatAudit(db, { userId: authUser.id, aksi: "CREATE", entitas: "JenisJabatanFungsional", entitasId: row.id, dataSesudah: row });
  return c.json(row, 201);
});

app.delete("/jabatan-fungsional/:id", requireRole("SUPER_ADMIN"), async (c) => {
  const id = c.req.param("id");
  const db = c.get("db");
  const authUser = c.get("user");
  const existingRows = await db.select().from(jenisJabatanFungsional).where(eq(jenisJabatanFungsional.id, id)).limit(1);
  if (!existingRows[0]) throw new AppError(404, "Jenis jabatan fungsional tidak ditemukan");
  await db.delete(parameterJenjangAngkaKredit).where(eq(parameterJenjangAngkaKredit.jenisJabatanFungsionalId, id));
  await db.delete(jenisJabatanFungsional).where(eq(jenisJabatanFungsional.id, id));
  await catatAudit(db, { userId: authUser.id, aksi: "DELETE", entitas: "JenisJabatanFungsional", entitasId: id, dataSebelum: existingRows[0] });
  return c.body(null, 204);
});

const jenjangSchema = z.object({
  jenjang: z.enum(["PEMULA", "TERAMPIL", "MAHIR", "PENYELIA", "AHLI_PERTAMA", "AHLI_MUDA", "AHLI_MADYA", "AHLI_UTAMA"]),
  golonganRuang: z.string().min(1),
  angkaKreditMinimum: z.union([z.string(), z.number()]),
  urutan: z.union([z.string(), z.number()]),
});

app.post("/jabatan-fungsional/:id/jenjang", requireRole("SUPER_ADMIN"), async (c) => {
  const jenisId = c.req.param("id");
  const db = c.get("db");
  const authUser = c.get("user");
  const jenisRows = await db.select().from(jenisJabatanFungsional).where(eq(jenisJabatanFungsional.id, jenisId)).limit(1);
  if (!jenisRows[0]) throw new AppError(404, "Jenis jabatan fungsional tidak ditemukan");

  const body = parseBody(jenjangSchema, await c.req.json());
  const row = {
    id: newId(),
    jenisJabatanFungsionalId: jenisId,
    jenjang: body.jenjang,
    golonganRuang: body.golonganRuang,
    angkaKreditMinimum: Number(body.angkaKreditMinimum),
    urutan: Number(body.urutan),
  };
  await db.insert(parameterJenjangAngkaKredit).values(row);
  await catatAudit(db, { userId: authUser.id, aksi: "CREATE", entitas: "ParameterJenjangAngkaKredit", entitasId: row.id, dataSesudah: row });
  return c.json(row, 201);
});

app.put("/jenjang/:id", requireRole("SUPER_ADMIN"), async (c) => {
  const id = c.req.param("id");
  const db = c.get("db");
  const authUser = c.get("user");
  const existingRows = await db.select().from(parameterJenjangAngkaKredit).where(eq(parameterJenjangAngkaKredit.id, id)).limit(1);
  if (!existingRows[0]) throw new AppError(404, "Jenjang angka kredit tidak ditemukan");

  const body = parseBody(jenjangSchema.partial(), await c.req.json());
  const updated: Record<string, unknown> = {};
  if (body.jenjang != null) updated.jenjang = body.jenjang;
  if (body.golonganRuang != null) updated.golonganRuang = body.golonganRuang;
  if (body.angkaKreditMinimum != null) updated.angkaKreditMinimum = Number(body.angkaKreditMinimum);
  if (body.urutan != null) updated.urutan = Number(body.urutan);

  await db.update(parameterJenjangAngkaKredit).set(updated).where(eq(parameterJenjangAngkaKredit.id, id));
  await catatAudit(db, { userId: authUser.id, aksi: "UPDATE", entitas: "ParameterJenjangAngkaKredit", entitasId: id, dataSebelum: existingRows[0], dataSesudah: updated });
  return c.json({ ...existingRows[0], ...updated });
});

app.delete("/jenjang/:id", requireRole("SUPER_ADMIN"), async (c) => {
  const id = c.req.param("id");
  const db = c.get("db");
  const authUser = c.get("user");
  const existingRows = await db.select().from(parameterJenjangAngkaKredit).where(eq(parameterJenjangAngkaKredit.id, id)).limit(1);
  if (!existingRows[0]) throw new AppError(404, "Jenjang angka kredit tidak ditemukan");
  await db.delete(parameterJenjangAngkaKredit).where(eq(parameterJenjangAngkaKredit.id, id));
  await catatAudit(db, { userId: authUser.id, aksi: "DELETE", entitas: "ParameterJenjangAngkaKredit", entitasId: id, dataSebelum: existingRows[0] });
  return c.body(null, 204);
});

export default app;
