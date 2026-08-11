import { Hono } from "hono";
import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import type { AppEnv } from "../types";
import { angkaKredit, pegawai } from "../db/schema";
import { AppError } from "../utils/errors";
import { parseBody } from "../utils/validate";
import { catatAudit } from "../utils/audit";
import { newId, nowIso } from "../utils/id";
import { requireAuth, requireRole } from "../middleware/auth";

const app = new Hono<AppEnv>();
app.use("*", requireAuth);

app.get("/:pegawaiId/angka-kredit", async (c) => {
  const db = c.get("db");
  const rows = await db.select().from(angkaKredit).where(eq(angkaKredit.pegawaiId, c.req.param("pegawaiId"))).orderBy(desc(angkaKredit.tanggalPak));
  return c.json(rows);
});

const schema = z.object({
  nomorPak: z.string().min(1),
  tanggalPak: z.string(),
  periodePenilaianAwal: z.string(),
  periodePenilaianAkhir: z.string(),
  angkaKreditKumulatif: z.union([z.string(), z.number()]),
  unsurUtama: z.union([z.string(), z.number()]).optional(),
  unsurPengembanganProfesi: z.union([z.string(), z.number()]).optional(),
  unsurPenunjang: z.union([z.string(), z.number()]).optional(),
  dokumenId: z.string().optional(),
});

app.post("/:pegawaiId/angka-kredit", requireRole("SUPER_ADMIN", "ADMIN_KEPEGAWAIAN"), async (c) => {
  const pegawaiId = c.req.param("pegawaiId");
  const db = c.get("db");
  const authUser = c.get("user");

  const pegRows = await db.select().from(pegawai).where(eq(pegawai.id, pegawaiId)).limit(1);
  if (!pegRows[0]) throw new AppError(404, "Pegawai tidak ditemukan");

  const body = parseBody(schema, await c.req.json());
  const row = {
    id: newId(),
    pegawaiId,
    nomorPak: body.nomorPak,
    tanggalPak: body.tanggalPak,
    periodePenilaianAwal: body.periodePenilaianAwal,
    periodePenilaianAkhir: body.periodePenilaianAkhir,
    angkaKreditKumulatif: Number(body.angkaKreditKumulatif),
    unsurUtama: body.unsurUtama != null ? Number(body.unsurUtama) : null,
    unsurPengembanganProfesi: body.unsurPengembanganProfesi != null ? Number(body.unsurPengembanganProfesi) : null,
    unsurPenunjang: body.unsurPenunjang != null ? Number(body.unsurPenunjang) : null,
    dokumenId: body.dokumenId || null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  await db.insert(angkaKredit).values(row);
  await catatAudit(db, { userId: authUser.id, aksi: "CREATE", entitas: "AngkaKredit", entitasId: row.id, dataSesudah: row });
  return c.json(row, 201);
});

app.put("/:pegawaiId/angka-kredit/:id", requireRole("SUPER_ADMIN", "ADMIN_KEPEGAWAIAN"), async (c) => {
  const { pegawaiId, id } = c.req.param();
  const db = c.get("db");
  const authUser = c.get("user");

  const existingRows = await db.select().from(angkaKredit).where(eq(angkaKredit.id, id)).limit(1);
  const existing = existingRows[0];
  if (!existing || existing.pegawaiId !== pegawaiId) throw new AppError(404, "Data angka kredit tidak ditemukan");

  const body = parseBody(schema.partial(), await c.req.json());
  const updated: Record<string, unknown> = { ...body, updatedAt: nowIso() };
  if (body.angkaKreditKumulatif != null) updated.angkaKreditKumulatif = Number(body.angkaKreditKumulatif);
  if (body.unsurUtama != null) updated.unsurUtama = Number(body.unsurUtama);
  if (body.unsurPengembanganProfesi != null) updated.unsurPengembanganProfesi = Number(body.unsurPengembanganProfesi);
  if (body.unsurPenunjang != null) updated.unsurPenunjang = Number(body.unsurPenunjang);

  await db.update(angkaKredit).set(updated).where(eq(angkaKredit.id, id));
  await catatAudit(db, { userId: authUser.id, aksi: "UPDATE", entitas: "AngkaKredit", entitasId: id, dataSebelum: existing, dataSesudah: updated });
  return c.json({ ...existing, ...updated });
});

app.delete("/:pegawaiId/angka-kredit/:id", requireRole("SUPER_ADMIN", "ADMIN_KEPEGAWAIAN"), async (c) => {
  const { pegawaiId, id } = c.req.param();
  const db = c.get("db");
  const authUser = c.get("user");

  const existingRows = await db.select().from(angkaKredit).where(eq(angkaKredit.id, id)).limit(1);
  const existing = existingRows[0];
  if (!existing || existing.pegawaiId !== pegawaiId) throw new AppError(404, "Data angka kredit tidak ditemukan");

  await db.delete(angkaKredit).where(eq(angkaKredit.id, id));
  await catatAudit(db, { userId: authUser.id, aksi: "DELETE", entitas: "AngkaKredit", entitasId: id, dataSebelum: existing });
  return c.body(null, 204);
});

export default app;
