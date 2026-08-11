import { Hono } from "hono";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import type { AppEnv } from "../types";
import { pegawai, statusUsulanKenaikanPangkat } from "../db/schema";
import { AppError } from "../utils/errors";
import { parseBody } from "../utils/validate";
import { catatAudit } from "../utils/audit";
import { newId, nowIso } from "../utils/id";
import { requireAuth, requireRole } from "../middleware/auth";
import { deteksiKenaikanPangkat } from "../services/promotionEngine";

const app = new Hono<AppEnv>();
app.use("*", requireAuth);

app.get("/", async (c) => {
  const db = c.get("db");
  const authUser = c.get("user");
  const { bulanKeDepan, unitKerjaId, jenisKenaikan, status } = c.req.query();

  let kandidat = await deteksiKenaikanPangkat(db, { bulanKeDepan: bulanKeDepan ? Number(bulanKeDepan) : undefined, unitKerjaId });

  if (authUser.role === "KEPALA_BIDANG" && authUser.unitKerjaId) {
    kandidat = kandidat.filter((k) => k.unitKerjaId === authUser.unitKerjaId);
  }
  if (jenisKenaikan) kandidat = kandidat.filter((k) => k.jenisKenaikan === jenisKenaikan);
  if (status) kandidat = kandidat.filter((k) => k.statusTindakLanjut === status);

  kandidat.sort((a, b) => a.proyeksiPeriode.tahun - b.proyeksiPeriode.tahun || a.proyeksiPeriode.bulan - b.proyeksiPeriode.bulan || a.nama.localeCompare(b.nama));

  return c.json({ data: kandidat, total: kandidat.length });
});

const statusSchema = z.object({
  pegawaiId: z.string().min(1),
  periodeTahun: z.union([z.string(), z.number()]),
  periodeBulan: z.union([z.string(), z.number()]),
  jenisKenaikan: z.enum(["REGULER", "FUNGSIONAL", "PILIHAN"]),
  status: z.enum(["BELUM_DIPROSES", "SEDANG_DIUSULKAN", "SK_TERBIT", "DITUNDA"]),
  catatan: z.string().optional(),
});

app.put("/status", requireRole("SUPER_ADMIN", "ADMIN_KEPEGAWAIAN"), async (c) => {
  const db = c.get("db");
  const authUser = c.get("user");
  const body = parseBody(statusSchema, await c.req.json());

  const pegRows = await db.select().from(pegawai).where(eq(pegawai.id, body.pegawaiId)).limit(1);
  const peg = pegRows[0];
  if (!peg) throw new AppError(404, "Pegawai tidak ditemukan");

  const periodeTahun = Number(body.periodeTahun);
  const periodeBulan = Number(body.periodeBulan);

  const existing = await db
    .select()
    .from(statusUsulanKenaikanPangkat)
    .where(
      and(
        eq(statusUsulanKenaikanPangkat.pegawaiId, body.pegawaiId),
        eq(statusUsulanKenaikanPangkat.periodeTahun, periodeTahun),
        eq(statusUsulanKenaikanPangkat.periodeBulan, periodeBulan),
        eq(statusUsulanKenaikanPangkat.jenisKenaikan, body.jenisKenaikan)
      )
    )
    .limit(1);

  let result;
  if (existing[0]) {
    result = { ...existing[0], status: body.status, catatan: body.catatan || null, updatedById: authUser.id, updatedAt: nowIso() };
    await db
      .update(statusUsulanKenaikanPangkat)
      .set({ status: body.status, catatan: body.catatan || null, updatedById: authUser.id, updatedAt: nowIso() })
      .where(eq(statusUsulanKenaikanPangkat.id, existing[0].id));
  } else {
    result = {
      id: newId(),
      pegawaiId: body.pegawaiId,
      periodeTahun,
      periodeBulan,
      jenisKenaikan: body.jenisKenaikan,
      status: body.status,
      catatan: body.catatan || null,
      updatedById: authUser.id,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    await db.insert(statusUsulanKenaikanPangkat).values(result);
  }

  await catatAudit(db, {
    userId: authUser.id,
    aksi: "UPDATE_STATUS",
    entitas: "StatusUsulanKenaikanPangkat",
    entitasId: result.id,
    dataSebelum: existing[0],
    dataSesudah: result,
    deskripsi: `Status kenaikan pangkat ${peg.nama} diubah menjadi ${body.status}`,
  });

  return c.json(result);
});

export default app;
