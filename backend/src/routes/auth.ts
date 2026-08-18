import { Hono } from "hono";
import { hashPassword, verifyPassword } from "../lib/password";
import { signJwt } from "../lib/jwt";
import { nowIso, uuid, writeAuditLog } from "../lib/db";
import { authMiddleware } from "../middleware/auth";
import type { Env, Variables } from "../types";

export const authRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

authRoutes.post("/login", async (c) => {
  const body = await c.req.json<{ username?: string; password?: string }>().catch(() => ({} as never));
  const username = body.username?.trim();
  const password = body.password;

  if (!username || !password) {
    return c.json({ error: "Username dan password wajib diisi." }, 400);
  }

  const ip = c.req.header("CF-Connecting-IP") ?? null;
  const ua = c.req.header("User-Agent") ?? null;

  const user = await c.env.DB.prepare(
    `SELECT id, username, password_hash, nama_lengkap, role, unit_kerja_id, pegawai_id, is_active
     FROM users WHERE username = ?`
  )
    .bind(username)
    .first<{
      id: string;
      username: string;
      password_hash: string;
      nama_lengkap: string;
      role: string;
      unit_kerja_id: string | null;
      pegawai_id: string | null;
      is_active: number;
    }>();

  if (!user || !user.is_active) {
    await writeAuditLog(c.env.DB, {
      user: null,
      aksi: "LOGIN_FAILED",
      entityType: "USER",
      deskripsi: `Percobaan login gagal untuk username "${username}" (tidak ditemukan/nonaktif).`,
      ipAddress: ip,
      userAgent: ua,
    });
    return c.json({ error: "Username atau password salah." }, 401);
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    await writeAuditLog(c.env.DB, {
      user: null,
      aksi: "LOGIN_FAILED",
      entityType: "USER",
      entityId: user.id,
      deskripsi: `Percobaan login gagal untuk username "${username}" (password salah).`,
      ipAddress: ip,
      userAgent: ua,
    });
    return c.json({ error: "Username atau password salah." }, 401);
  }

  const ttl = parseInt(c.env.ACCESS_TOKEN_TTL_SECONDS || "28800", 10);
  const token = await signJwt(
    {
      sub: user.id,
      username: user.username,
      role: user.role,
      unitKerjaId: user.unit_kerja_id,
      pegawaiId: user.pegawai_id,
    },
    c.env.JWT_SECRET,
    c.env.JWT_ISSUER,
    ttl
  );

  await c.env.DB.prepare(`UPDATE users SET last_login_at = ? WHERE id = ?`).bind(nowIso(), user.id).run();
  await writeAuditLog(c.env.DB, {
    user: {
      id: user.id,
      username: user.username,
      role: user.role as never,
      unitKerjaId: user.unit_kerja_id,
      pegawaiId: user.pegawai_id,
    },
    aksi: "LOGIN",
    entityType: "USER",
    entityId: user.id,
    deskripsi: `Login berhasil.`,
    ipAddress: ip,
    userAgent: ua,
  });

  return c.json({
    token,
    expiresIn: ttl,
    user: {
      id: user.id,
      username: user.username,
      namaLengkap: user.nama_lengkap,
      role: user.role,
      unitKerjaId: user.unit_kerja_id,
      pegawaiId: user.pegawai_id,
    },
  });
});

authRoutes.get("/me", authMiddleware, async (c) => {
  const authUser = c.get("authUser");
  const user = await c.env.DB.prepare(
    `SELECT u.id, u.username, u.email, u.nama_lengkap, u.role, u.unit_kerja_id, u.pegawai_id, uk.nama as unit_kerja_nama
     FROM users u LEFT JOIN unit_kerja uk ON uk.id = u.unit_kerja_id
     WHERE u.id = ?`
  )
    .bind(authUser.id)
    .first();
  if (!user) return c.json({ error: "User tidak ditemukan." }, 404);
  return c.json({ data: user });
});

authRoutes.post("/change-password", authMiddleware, async (c) => {
  const authUser = c.get("authUser");
  const body = await c.req.json<{ oldPassword?: string; newPassword?: string }>().catch(() => ({} as never));
  if (!body.oldPassword || !body.newPassword) {
    return c.json({ error: "Password lama dan baru wajib diisi." }, 400);
  }
  if (body.newPassword.length < 8) {
    return c.json({ error: "Password baru minimal 8 karakter." }, 400);
  }

  const user = await c.env.DB.prepare(`SELECT id, password_hash FROM users WHERE id = ?`)
    .bind(authUser.id)
    .first<{ id: string; password_hash: string }>();
  if (!user) return c.json({ error: "User tidak ditemukan." }, 404);

  const valid = await verifyPassword(body.oldPassword, user.password_hash);
  if (!valid) return c.json({ error: "Password lama tidak sesuai." }, 400);

  const newHash = await hashPassword(body.newPassword);
  await c.env.DB.prepare(`UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = ? WHERE id = ?`)
    .bind(newHash, nowIso(), authUser.id)
    .run();

  await writeAuditLog(c.env.DB, {
    user: authUser,
    aksi: "UPDATE",
    entityType: "USER",
    entityId: authUser.id,
    deskripsi: "Pengguna mengubah password sendiri.",
  });

  return c.json({ message: "Password berhasil diubah." });
});
