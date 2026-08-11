import { Hono } from "hono";
import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import type { AppEnv } from "../types";
import { unitKerja, pegawai } from "../db/schema";
import { AppError } from "../utils/errors";
import { parseBody } from "../utils/validate";
import { catatAudit } from "../utils/audit";
import { newId, nowIso } from "../utils/id";
import { requireAuth, requireRole } from "../middleware/auth";

const app = new Hono<AppEnv>();
app.use("*", requireAuth);

app.get("/", async (c) => {
  const db = c.get("db");
  const units = await db.select().from(unitKerja).orderBy(unitKerja.nama);
  const counts = await db.select({ unitKerjaId: pegawai.unitKerjaId, jumlah: sql<number>`count(*)`.as("jumlah") }).from(pegawai).groupBy(pegawai.unitKerjaId);
  const countMap = new Map(counts.map((c2) => [c2.unitKerjaId, c2.jumlah]));
  const parentMap = new Map(units.map((u) => [u.id, u.nama]));

  return c.json(
    units.map((u) => ({
      ...u,
      parent: u.parentId ? { id: u.parentId, nama: parentMap.get(u.parentId) || "" } : null,
      _count: { pegawai: countMap.get(u.id) || 0 },
    }))
  );
});

const unitSchema = z.object({ nama: z.string().min(1), jenis: z.string().min(1), alamat: z.string().optional(), parentId: z.string().optional() });

app.post("/", requireRole("SUPER_ADMIN", "ADMIN_KEPEGAWAIAN"), async (c) => {
  const body = parseBody(unitSchema, await c.req.json());
  const db = c.get("db");
  const authUser = c.get("user");

  const row = { id: newId(), nama: body.nama, jenis: body.jenis, alamat: body.alamat || null, parentId: body.parentId || null, createdAt: nowIso(), updatedAt: nowIso() };
  await db.insert(unitKerja).values(row);
  await catatAudit(db, { userId: authUser.id, aksi: "CREATE", entitas: "UnitKerja", entitasId: row.id, dataSesudah: row });
  return c.json(row, 201);
});

app.put("/:id", requireRole("SUPER_ADMIN", "ADMIN_KEPEGAWAIAN"), async (c) => {
  const id = c.req.param("id");
  const db = c.get("db");
  const authUser = c.get("user");

  const existingRows = await db.select().from(unitKerja).where(eq(unitKerja.id, id)).limit(1);
  const existing = existingRows[0];
  if (!existing) throw new AppError(404, "Unit kerja tidak ditemukan");

  const body = parseBody(unitSchema, await c.req.json());
  const updated = { nama: body.nama, jenis: body.jenis, alamat: body.alamat || null, parentId: body.parentId || null, updatedAt: nowIso() };
  await db.update(unitKerja).set(updated).where(eq(unitKerja.id, id));
  await catatAudit(db, { userId: authUser.id, aksi: "UPDATE", entitas: "UnitKerja", entitasId: id, dataSebelum: existing, dataSesudah: updated });
  return c.json({ ...existing, ...updated });
});

app.delete("/:id", requireRole("SUPER_ADMIN"), async (c) => {
  const id = c.req.param("id");
  const db = c.get("db");
  const authUser = c.get("user");

  const existingRows = await db.select().from(unitKerja).where(eq(unitKerja.id, id)).limit(1);
  const existing = existingRows[0];
  if (!existing) throw new AppError(404, "Unit kerja tidak ditemukan");

  await db.delete(unitKerja).where(eq(unitKerja.id, id));
  await catatAudit(db, { userId: authUser.id, aksi: "DELETE", entitas: "UnitKerja", entitasId: id, dataSebelum: existing });
  return c.body(null, 204);
});

export default app;
