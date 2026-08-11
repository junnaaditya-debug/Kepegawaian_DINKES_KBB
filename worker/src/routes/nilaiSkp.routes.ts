import { Hono } from "hono";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import type { AppEnv } from "../types";
import { nilaiSkp, pegawai } from "../db/schema";
import { AppError } from "../utils/errors";
import { parseBody } from "../utils/validate";
import { catatAudit } from "../utils/audit";
import { newId, nowIso } from "../utils/id";
import { requireAuth, requireRole } from "../middleware/auth";

const app = new Hono<AppEnv>();
app.use("*", requireAuth);

app.get("/:pegawaiId/nilai-skp", async (c) => {
  const db = c.get("db");
  const rows = await db.select().from(nilaiSkp).where(eq(nilaiSkp.pegawaiId, c.req.param("pegawaiId"))).orderBy(desc(nilaiSkp.tahun));
  return c.json(rows);
});

const schema = z.object({
  tahun: z.union([z.string(), z.number()]),
  predikat: z.enum(["SANGAT_BAIK", "BAIK", "CUKUP", "KURANG", "SANGAT_KURANG"]),
  nilaiAngka: z.union([z.string(), z.number()]).optional(),
  keterangan: z.string().optional(),
});

app.post("/:pegawaiId/nilai-skp", requireRole("SUPER_ADMIN", "ADMIN_KEPEGAWAIAN"), async (c) => {
  const pegawaiId = c.req.param("pegawaiId");
  const db = c.get("db");
  const authUser = c.get("user");

  const pegRows = await db.select().from(pegawai).where(eq(pegawai.id, pegawaiId)).limit(1);
  if (!pegRows[0]) throw new AppError(404, "Pegawai tidak ditemukan");

  const body = parseBody(schema, await c.req.json());
  const tahun = Number(body.tahun);

  const existing = await db.select().from(nilaiSkp).where(and(eq(nilaiSkp.pegawaiId, pegawaiId), eq(nilaiSkp.tahun, tahun))).limit(1);

  if (existing[0]) {
    const updated = {
      predikat: body.predikat,
      nilaiAngka: body.nilaiAngka != null ? Number(body.nilaiAngka) : null,
      keterangan: body.keterangan || null,
      updatedAt: nowIso(),
    };
    await db.update(nilaiSkp).set(updated).where(eq(nilaiSkp.id, existing[0].id));
    await catatAudit(db, { userId: authUser.id, aksi: "UPSERT", entitas: "NilaiSkp", entitasId: existing[0].id, dataSesudah: updated });
    return c.json({ ...existing[0], ...updated }, 201);
  }

  const row = {
    id: newId(),
    pegawaiId,
    tahun,
    predikat: body.predikat,
    nilaiAngka: body.nilaiAngka != null ? Number(body.nilaiAngka) : null,
    keterangan: body.keterangan || null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  await db.insert(nilaiSkp).values(row);
  await catatAudit(db, { userId: authUser.id, aksi: "UPSERT", entitas: "NilaiSkp", entitasId: row.id, dataSesudah: row });
  return c.json(row, 201);
});

app.delete("/:pegawaiId/nilai-skp/:id", requireRole("SUPER_ADMIN", "ADMIN_KEPEGAWAIAN"), async (c) => {
  const { pegawaiId, id } = c.req.param();
  const db = c.get("db");
  const authUser = c.get("user");

  const existingRows = await db.select().from(nilaiSkp).where(eq(nilaiSkp.id, id)).limit(1);
  const existing = existingRows[0];
  if (!existing || existing.pegawaiId !== pegawaiId) throw new AppError(404, "Nilai SKP tidak ditemukan");

  await db.delete(nilaiSkp).where(eq(nilaiSkp.id, id));
  await catatAudit(db, { userId: authUser.id, aksi: "DELETE", entitas: "NilaiSkp", entitasId: id, dataSebelum: existing });
  return c.body(null, 204);
});

export default app;
