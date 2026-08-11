import { Hono } from "hono";
import { z } from "zod";
import { and, desc, eq, ne } from "drizzle-orm";
import type { AppEnv } from "../types";
import { pegawai, riwayatPangkatGolongan, statusUsulanKenaikanPangkat } from "../db/schema";
import { AppError } from "../utils/errors";
import { parseBody } from "../utils/validate";
import { catatAudit } from "../utils/audit";
import { newId, nowIso } from "../utils/id";
import { requireAuth, requireRole } from "../middleware/auth";
import { getPeriodeTerdekat } from "../services/promotionEngine";

const app = new Hono<AppEnv>();
app.use("*", requireAuth);

app.get("/:pegawaiId/riwayat-pangkat", async (c) => {
  const db = c.get("db");
  const pegawaiId = c.req.param("pegawaiId");
  const rows = await db.select().from(riwayatPangkatGolongan).where(eq(riwayatPangkatGolongan.pegawaiId, pegawaiId)).orderBy(desc(riwayatPangkatGolongan.tmt));
  return c.json(rows);
});

const pangkatSchema = z.object({
  golonganRuang: z.string().min(1),
  namaPangkat: z.string().min(1),
  tmt: z.string(),
  nomorSk: z.string().optional(),
  tanggalSk: z.string().optional(),
  pejabatPenetap: z.string().optional(),
  dokumenId: z.string().optional(),
});

/**
 * FR-2.1, FR-4.6, BR-6: mengarsipkan riwayat pangkat aktif sebelumnya, mengaktifkan yang
 * baru, dan menandai status usulan kenaikan pangkat periode terkait menjadi SK Terbit.
 */
app.post("/:pegawaiId/riwayat-pangkat", requireRole("SUPER_ADMIN", "ADMIN_KEPEGAWAIAN"), async (c) => {
  const pegawaiId = c.req.param("pegawaiId");
  const db = c.get("db");
  const authUser = c.get("user");

  const pegRows = await db.select().from(pegawai).where(eq(pegawai.id, pegawaiId)).limit(1);
  if (!pegRows[0]) throw new AppError(404, "Pegawai tidak ditemukan");

  const body = parseBody(pangkatSchema, await c.req.json());
  const tmt = new Date(body.tmt);

  await db.update(riwayatPangkatGolongan).set({ isAktif: false, updatedAt: nowIso() }).where(and(eq(riwayatPangkatGolongan.pegawaiId, pegawaiId), eq(riwayatPangkatGolongan.isAktif, true)));

  const row = {
    id: newId(),
    pegawaiId,
    golonganRuang: body.golonganRuang,
    namaPangkat: body.namaPangkat,
    tmt: body.tmt,
    nomorSk: body.nomorSk || null,
    tanggalSk: body.tanggalSk || null,
    pejabatPenetap: body.pejabatPenetap || null,
    dokumenId: body.dokumenId || null,
    isAktif: true,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  await db.insert(riwayatPangkatGolongan).values(row);

  const periode = await getPeriodeTerdekat(db, tmt);
  await db
    .update(statusUsulanKenaikanPangkat)
    .set({ status: "SK_TERBIT", updatedById: authUser.id, updatedAt: nowIso() })
    .where(
      and(
        eq(statusUsulanKenaikanPangkat.pegawaiId, pegawaiId),
        eq(statusUsulanKenaikanPangkat.periodeTahun, periode.tahun),
        eq(statusUsulanKenaikanPangkat.periodeBulan, periode.bulan),
        ne(statusUsulanKenaikanPangkat.status, "SK_TERBIT")
      )
    );

  await catatAudit(db, { userId: authUser.id, aksi: "CREATE", entitas: "RiwayatPangkatGolongan", entitasId: row.id, dataSesudah: row });
  return c.json(row, 201);
});

app.put("/:pegawaiId/riwayat-pangkat/:id", requireRole("SUPER_ADMIN", "ADMIN_KEPEGAWAIAN"), async (c) => {
  const { pegawaiId, id } = c.req.param();
  const db = c.get("db");
  const authUser = c.get("user");

  const existingRows = await db.select().from(riwayatPangkatGolongan).where(eq(riwayatPangkatGolongan.id, id)).limit(1);
  const existing = existingRows[0];
  if (!existing || existing.pegawaiId !== pegawaiId) throw new AppError(404, "Riwayat pangkat tidak ditemukan");

  const body = parseBody(pangkatSchema.partial(), await c.req.json());
  const updated = { ...body, updatedAt: nowIso() };
  await db.update(riwayatPangkatGolongan).set(updated).where(eq(riwayatPangkatGolongan.id, id));
  await catatAudit(db, { userId: authUser.id, aksi: "UPDATE", entitas: "RiwayatPangkatGolongan", entitasId: id, dataSebelum: existing, dataSesudah: updated });
  return c.json({ ...existing, ...updated });
});

app.delete("/:pegawaiId/riwayat-pangkat/:id", requireRole("SUPER_ADMIN"), async (c) => {
  const { pegawaiId, id } = c.req.param();
  const db = c.get("db");
  const authUser = c.get("user");

  const existingRows = await db.select().from(riwayatPangkatGolongan).where(eq(riwayatPangkatGolongan.id, id)).limit(1);
  const existing = existingRows[0];
  if (!existing || existing.pegawaiId !== pegawaiId) throw new AppError(404, "Riwayat pangkat tidak ditemukan");
  if (existing.isAktif) throw new AppError(400, "Riwayat pangkat aktif tidak dapat dihapus. Hapus riwayat non-aktif atau input riwayat baru.");

  await db.delete(riwayatPangkatGolongan).where(eq(riwayatPangkatGolongan.id, id));
  await catatAudit(db, { userId: authUser.id, aksi: "DELETE", entitas: "RiwayatPangkatGolongan", entitasId: id, dataSebelum: existing });
  return c.body(null, 204);
});

export default app;
