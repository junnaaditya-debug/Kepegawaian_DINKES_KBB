import { Hono } from "hono";
import { sign } from "hono/jwt";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { eq } from "drizzle-orm";
import type { AppEnv } from "../types";
import { user } from "../db/schema";
import { AppError } from "../utils/errors";
import { parseBody } from "../utils/validate";
import { catatAudit } from "../utils/audit";
import { nowIso } from "../utils/id";
import { requireAuth } from "../middleware/auth";

const app = new Hono<AppEnv>();

const loginSchema = z.object({ username: z.string().min(1), password: z.string().min(1) });

app.post("/login", async (c) => {
  const body = parseBody(loginSchema, await c.req.json());
  const db = c.get("db");

  const rows = await db.select().from(user).where(eq(user.username, body.username)).limit(1);
  const u = rows[0];
  if (!u || !u.isActive) throw new AppError(401, "Username atau password salah");

  const valid = await bcrypt.compare(body.password, u.passwordHash);
  if (!valid) {
    await catatAudit(db, { userId: u.id, aksi: "LOGIN_GAGAL", entitas: "User", entitasId: u.id, ipAddress: c.req.header("cf-connecting-ip") });
    throw new AppError(401, "Username atau password salah");
  }

  const payload = {
    id: u.id,
    username: u.username,
    role: u.role,
    unitKerjaId: u.unitKerjaId,
    pegawaiId: u.pegawaiId,
    exp: Math.floor(Date.now() / 1000) + Number(c.env.JWT_EXPIRES_IN_SECONDS || "28800"),
  };
  const token = await sign(payload, c.env.JWT_SECRET);

  await db.update(user).set({ lastLoginAt: nowIso() }).where(eq(user.id, u.id));
  await catatAudit(db, { userId: u.id, aksi: "LOGIN", entitas: "User", entitasId: u.id, ipAddress: c.req.header("cf-connecting-ip") });

  return c.json({
    token,
    user: { id: u.id, username: u.username, nama: u.nama, role: u.role, unitKerjaId: u.unitKerjaId, pegawaiId: u.pegawaiId, email: u.email },
  });
});

app.get("/me", requireAuth, async (c) => {
  const authUser = c.get("user");
  const db = c.get("db");
  const rows = await db.select().from(user).where(eq(user.id, authUser.id)).limit(1);
  const u = rows[0];
  if (!u) throw new AppError(404, "User tidak ditemukan");
  return c.json({ id: u.id, username: u.username, nama: u.nama, role: u.role, unitKerjaId: u.unitKerjaId, pegawaiId: u.pegawaiId, email: u.email });
});

const changePasswordSchema = z.object({ oldPassword: z.string().min(1), newPassword: z.string().min(8) });

app.post("/change-password", requireAuth, async (c) => {
  const body = parseBody(changePasswordSchema, await c.req.json());
  const authUser = c.get("user");
  const db = c.get("db");

  const rows = await db.select().from(user).where(eq(user.id, authUser.id)).limit(1);
  const u = rows[0];
  if (!u) throw new AppError(404, "User tidak ditemukan");

  const valid = await bcrypt.compare(body.oldPassword, u.passwordHash);
  if (!valid) throw new AppError(400, "Password lama salah");

  const passwordHash = await bcrypt.hash(body.newPassword, 10);
  await db.update(user).set({ passwordHash, updatedAt: nowIso() }).where(eq(user.id, u.id));
  await catatAudit(db, { userId: u.id, aksi: "GANTI_PASSWORD", entitas: "User", entitasId: u.id });

  return c.json({ message: "Password berhasil diubah" });
});

export default app;
