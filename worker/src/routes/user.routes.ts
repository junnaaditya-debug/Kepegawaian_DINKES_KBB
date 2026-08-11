import { Hono } from "hono";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { eq, inArray } from "drizzle-orm";
import type { AppEnv } from "../types";
import { unitKerja, user } from "../db/schema";
import { AppError } from "../utils/errors";
import { parseBody } from "../utils/validate";
import { catatAudit } from "../utils/audit";
import { newId, nowIso } from "../utils/id";
import { requireAuth, requireRole } from "../middleware/auth";

const app = new Hono<AppEnv>();
app.use("*", requireAuth, requireRole("SUPER_ADMIN"));

function toPublicUser(u: typeof user.$inferSelect, unitNama?: string | null) {
  const { passwordHash, ...rest } = u;
  return { ...rest, unitKerja: u.unitKerjaId ? { id: u.unitKerjaId, nama: unitNama || "" } : null };
}

app.get("/", async (c) => {
  const db = c.get("db");
  const users = await db.select().from(user).orderBy(user.nama);
  const unitIds = [...new Set(users.map((u) => u.unitKerjaId).filter(Boolean))] as string[];
  const units = unitIds.length ? await db.select().from(unitKerja).where(inArray(unitKerja.id, unitIds)) : [];
  const unitMap = new Map(units.map((u) => [u.id, u.nama]));
  return c.json(users.map((u) => toPublicUser(u, u.unitKerjaId ? unitMap.get(u.unitKerjaId) : null)));
});

const createSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(8),
  nama: z.string().min(1),
  email: z.string().optional(),
  role: z.enum(["SUPER_ADMIN", "ADMIN_KEPEGAWAIAN", "KEPALA_BIDANG", "KEPALA_DINAS", "PEGAWAI"]),
  unitKerjaId: z.string().optional(),
  pegawaiId: z.string().optional(),
});

app.post("/", async (c) => {
  const body = parseBody(createSchema, await c.req.json());
  const db = c.get("db");
  const authUser = c.get("user");

  const existing = await db.select().from(user).where(eq(user.username, body.username)).limit(1);
  if (existing[0]) throw new AppError(409, "Username sudah digunakan");

  const passwordHash = await bcrypt.hash(body.password, 10);
  const row = {
    id: newId(),
    username: body.username,
    passwordHash,
    email: body.email || null,
    nama: body.nama,
    role: body.role,
    unitKerjaId: body.unitKerjaId || null,
    pegawaiId: body.pegawaiId || null,
    isActive: true,
    lastLoginAt: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  await db.insert(user).values(row);
  await catatAudit(db, { userId: authUser.id, aksi: "CREATE", entitas: "User", entitasId: row.id, dataSesudah: toPublicUser(row as any) });
  return c.json(toPublicUser(row as any), 201);
});

const updateSchema = z.object({
  email: z.string().optional(),
  nama: z.string().optional(),
  role: z.enum(["SUPER_ADMIN", "ADMIN_KEPEGAWAIAN", "KEPALA_BIDANG", "KEPALA_DINAS", "PEGAWAI"]).optional(),
  unitKerjaId: z.string().optional(),
  pegawaiId: z.string().optional(),
  isActive: z.boolean().optional(),
});

app.put("/:id", async (c) => {
  const id = c.req.param("id");
  const db = c.get("db");
  const authUser = c.get("user");

  const existingRows = await db.select().from(user).where(eq(user.id, id)).limit(1);
  const existing = existingRows[0];
  if (!existing) throw new AppError(404, "User tidak ditemukan");

  const body = parseBody(updateSchema, await c.req.json());
  const updated = { ...body, updatedAt: nowIso() };
  await db.update(user).set(updated).where(eq(user.id, id));
  await catatAudit(db, { userId: authUser.id, aksi: "UPDATE", entitas: "User", entitasId: id, dataSebelum: toPublicUser(existing), dataSesudah: updated });
  return c.json(toPublicUser({ ...existing, ...updated } as any));
});

const resetSchema = z.object({ newPassword: z.string().min(8) });

app.post("/:id/reset-password", async (c) => {
  const id = c.req.param("id");
  const db = c.get("db");
  const authUser = c.get("user");

  const existingRows = await db.select().from(user).where(eq(user.id, id)).limit(1);
  if (!existingRows[0]) throw new AppError(404, "User tidak ditemukan");

  const body = parseBody(resetSchema, await c.req.json());
  const passwordHash = await bcrypt.hash(body.newPassword, 10);
  await db.update(user).set({ passwordHash, updatedAt: nowIso() }).where(eq(user.id, id));
  await catatAudit(db, { userId: authUser.id, aksi: "RESET_PASSWORD", entitas: "User", entitasId: id });
  return c.json({ message: "Password berhasil direset" });
});

app.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const db = c.get("db");
  const authUser = c.get("user");

  if (id === authUser.id) throw new AppError(400, "Tidak dapat menghapus akun sendiri");
  const existingRows = await db.select().from(user).where(eq(user.id, id)).limit(1);
  const existing = existingRows[0];
  if (!existing) throw new AppError(404, "User tidak ditemukan");

  await db.delete(user).where(eq(user.id, id));
  await catatAudit(db, { userId: authUser.id, aksi: "DELETE", entitas: "User", entitasId: id, dataSebelum: toPublicUser(existing) });
  return c.body(null, 204);
});

export default app;
