import { Hono } from "hono";
import { z } from "zod";
import { and, desc, eq, inArray } from "drizzle-orm";
import type { AppEnv } from "../types";
import { pegawai, riwayatJabatan, unitKerja } from "../db/schema";
import { AppError } from "../utils/errors";
import { parseBody } from "../utils/validate";
import { catatAudit } from "../utils/audit";
import { newId, nowIso } from "../utils/id";
import { requireAuth, requireRole } from "../middleware/auth";

const app = new Hono<AppEnv>();
app.use("*", requireAuth);

app.get("/:pegawaiId/riwayat-jabatan", async (c) => {
  const db = c.get("db");
  const pegawaiId = c.req.param("pegawaiId");
  const rows = await db.select().from(riwayatJabatan).where(eq(riwayatJabatan.pegawaiId, pegawaiId)).orderBy(desc(riwayatJabatan.tmtJabatan));
  const unitIds = [...new Set(rows.map((r) => r.unitKerjaId).filter(Boolean))] as string[];
  const units = unitIds.length ? await db.select().from(unitKerja).where(inArray(unitKerja.id, unitIds)) : [];
  const unitMap = new Map(units.map((u) => [u.id, u]));
  return c.json(rows.map((r) => ({ ...r, unitKerja: r.unitKerjaId ? unitMap.get(r.unitKerjaId) || null : null })));
});

const jabatanSchema = z.object({
  jenisJabatan: z.enum(["STRUKTURAL", "FUNGSIONAL_TERTENTU", "PELAKSANA"]),
  namaJabatan: z.string().min(1),
  jenjangJabatan: z.enum(["PEMULA", "TERAMPIL", "MAHIR", "PENYELIA", "AHLI_PERTAMA", "AHLI_MUDA", "AHLI_MADYA", "AHLI_UTAMA"]).optional(),
  unitKerjaId: z.string().optional(),
  tmtJabatan: z.string(),
  nomorSk: z.string().optional(),
  tanggalSk: z.string().optional(),
  dokumenId: z.string().optional(),
});

app.post("/:pegawaiId/riwayat-jabatan", requireRole("SUPER_ADMIN", "ADMIN_KEPEGAWAIAN"), async (c) => {
  const pegawaiId = c.req.param("pegawaiId");
  const db = c.get("db");
  const authUser = c.get("user");

  const pegRows = await db.select().from(pegawai).where(eq(pegawai.id, pegawaiId)).limit(1);
  if (!pegRows[0]) throw new AppError(404, "Pegawai tidak ditemukan");

  const body = parseBody(jabatanSchema, await c.req.json());

  await db.update(riwayatJabatan).set({ isAktif: false, tglSelesai: body.tmtJabatan, updatedAt: nowIso() }).where(and(eq(riwayatJabatan.pegawaiId, pegawaiId), eq(riwayatJabatan.isAktif, true)));

  const row = {
    id: newId(),
    pegawaiId,
    jenisJabatan: body.jenisJabatan,
    namaJabatan: body.namaJabatan,
    jenjangJabatan: body.jenjangJabatan || null,
    unitKerjaId: body.unitKerjaId || null,
    tmtJabatan: body.tmtJabatan,
    tglSelesai: null,
    isAktif: true,
    nomorSk: body.nomorSk || null,
    tanggalSk: body.tanggalSk || null,
    dokumenId: body.dokumenId || null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  await db.insert(riwayatJabatan).values(row);
  await catatAudit(db, { userId: authUser.id, aksi: "CREATE", entitas: "RiwayatJabatan", entitasId: row.id, dataSesudah: row });
  return c.json(row, 201);
});

app.put("/:pegawaiId/riwayat-jabatan/:id", requireRole("SUPER_ADMIN", "ADMIN_KEPEGAWAIAN"), async (c) => {
  const { pegawaiId, id } = c.req.param();
  const db = c.get("db");
  const authUser = c.get("user");

  const existingRows = await db.select().from(riwayatJabatan).where(eq(riwayatJabatan.id, id)).limit(1);
  const existing = existingRows[0];
  if (!existing || existing.pegawaiId !== pegawaiId) throw new AppError(404, "Riwayat jabatan tidak ditemukan");

  const body = parseBody(jabatanSchema.partial(), await c.req.json());
  const updated = { ...body, updatedAt: nowIso() };
  await db.update(riwayatJabatan).set(updated).where(eq(riwayatJabatan.id, id));
  await catatAudit(db, { userId: authUser.id, aksi: "UPDATE", entitas: "RiwayatJabatan", entitasId: id, dataSebelum: existing, dataSesudah: updated });
  return c.json({ ...existing, ...updated });
});

app.delete("/:pegawaiId/riwayat-jabatan/:id", requireRole("SUPER_ADMIN"), async (c) => {
  const { pegawaiId, id } = c.req.param();
  const db = c.get("db");
  const authUser = c.get("user");

  const existingRows = await db.select().from(riwayatJabatan).where(eq(riwayatJabatan.id, id)).limit(1);
  const existing = existingRows[0];
  if (!existing || existing.pegawaiId !== pegawaiId) throw new AppError(404, "Riwayat jabatan tidak ditemukan");

  await db.delete(riwayatJabatan).where(eq(riwayatJabatan.id, id));
  await catatAudit(db, { userId: authUser.id, aksi: "DELETE", entitas: "RiwayatJabatan", entitasId: id, dataSebelum: existing });
  return c.body(null, 204);
});

export default app;
