import { Hono } from "hono";
import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import type { AppEnv } from "../types";
import { pegawai, riwayatPendidikan } from "../db/schema";
import { AppError } from "../utils/errors";
import { parseBody } from "../utils/validate";
import { catatAudit } from "../utils/audit";
import { newId, nowIso } from "../utils/id";
import { requireAuth, requireRole } from "../middleware/auth";

const app = new Hono<AppEnv>();
app.use("*", requireAuth);

app.get("/:pegawaiId/riwayat-pendidikan", async (c) => {
  const db = c.get("db");
  const rows = await db.select().from(riwayatPendidikan).where(eq(riwayatPendidikan.pegawaiId, c.req.param("pegawaiId"))).orderBy(desc(riwayatPendidikan.tahunLulus));
  return c.json(rows);
});

const schema = z.object({
  jenjang: z.string().min(1),
  jurusan: z.string().optional(),
  namaInstitusi: z.string().optional(),
  tahunLulus: z.union([z.string(), z.number()]).optional(),
  nomorIjazah: z.string().optional(),
  dokumenId: z.string().optional(),
});

app.post("/:pegawaiId/riwayat-pendidikan", requireRole("SUPER_ADMIN", "ADMIN_KEPEGAWAIAN"), async (c) => {
  const pegawaiId = c.req.param("pegawaiId");
  const db = c.get("db");
  const authUser = c.get("user");

  const pegRows = await db.select().from(pegawai).where(eq(pegawai.id, pegawaiId)).limit(1);
  if (!pegRows[0]) throw new AppError(404, "Pegawai tidak ditemukan");

  const body = parseBody(schema, await c.req.json());
  const row = {
    id: newId(),
    pegawaiId,
    jenjang: body.jenjang,
    jurusan: body.jurusan || null,
    namaInstitusi: body.namaInstitusi || null,
    tahunLulus: body.tahunLulus ? Number(body.tahunLulus) : null,
    nomorIjazah: body.nomorIjazah || null,
    dokumenId: body.dokumenId || null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  await db.insert(riwayatPendidikan).values(row);
  await catatAudit(db, { userId: authUser.id, aksi: "CREATE", entitas: "RiwayatPendidikan", entitasId: row.id, dataSesudah: row });
  return c.json(row, 201);
});

app.put("/:pegawaiId/riwayat-pendidikan/:id", requireRole("SUPER_ADMIN", "ADMIN_KEPEGAWAIAN"), async (c) => {
  const { pegawaiId, id } = c.req.param();
  const db = c.get("db");
  const authUser = c.get("user");

  const existingRows = await db.select().from(riwayatPendidikan).where(eq(riwayatPendidikan.id, id)).limit(1);
  const existing = existingRows[0];
  if (!existing || existing.pegawaiId !== pegawaiId) throw new AppError(404, "Riwayat pendidikan tidak ditemukan");

  const body = parseBody(schema.partial(), await c.req.json());
  const updated = { ...body, tahunLulus: body.tahunLulus ? Number(body.tahunLulus) : undefined, updatedAt: nowIso() };
  await db.update(riwayatPendidikan).set(updated).where(eq(riwayatPendidikan.id, id));
  await catatAudit(db, { userId: authUser.id, aksi: "UPDATE", entitas: "RiwayatPendidikan", entitasId: id, dataSebelum: existing, dataSesudah: updated });
  return c.json({ ...existing, ...updated });
});

app.delete("/:pegawaiId/riwayat-pendidikan/:id", requireRole("SUPER_ADMIN", "ADMIN_KEPEGAWAIAN"), async (c) => {
  const { pegawaiId, id } = c.req.param();
  const db = c.get("db");
  const authUser = c.get("user");

  const existingRows = await db.select().from(riwayatPendidikan).where(eq(riwayatPendidikan.id, id)).limit(1);
  const existing = existingRows[0];
  if (!existing || existing.pegawaiId !== pegawaiId) throw new AppError(404, "Riwayat pendidikan tidak ditemukan");

  await db.delete(riwayatPendidikan).where(eq(riwayatPendidikan.id, id));
  await catatAudit(db, { userId: authUser.id, aksi: "DELETE", entitas: "RiwayatPendidikan", entitasId: id, dataSebelum: existing });
  return c.body(null, 204);
});

export default app;
