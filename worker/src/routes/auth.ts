import { Hono } from "hono";
import type { Env, Variables } from "../types";
import { hashPassword, verifyPassword, signJwt, sha256Hex, randomToken } from "../lib/crypto";
import { badRequest, unauthorized } from "../lib/http";
import { logAktivitas } from "../lib/audit";
import { authMiddleware } from "../middleware/auth";

const auth = new Hono<{ Bindings: Env; Variables: Variables }>();

interface UserRow {
  id: number;
  username: string;
  email: string | null;
  password_hash: string;
  full_name: string;
  role_id: number;
  role_code: string;
  unit_kerja_id: number | null;
  pegawai_id: number | null;
  is_active: number;
  must_change_password: number;
}

const USER_SELECT = `
  SELECT u.id, u.username, u.email, u.password_hash, u.full_name, u.role_id,
         r.code as role_code, u.unit_kerja_id, u.pegawai_id, u.is_active, u.must_change_password
  FROM users u JOIN roles r ON r.id = u.role_id
`;

async function issueTokens(c: any, row: UserRow) {
  const accessTtl = parseInt(c.env.ACCESS_TOKEN_TTL_SECONDS, 10);
  const refreshTtl = parseInt(c.env.REFRESH_TOKEN_TTL_SECONDS, 10);
  const now = Math.floor(Date.now() / 1000);

  const accessToken = await signJwt(
    {
      sub: row.id,
      username: row.username,
      role: row.role_code,
      roleId: row.role_id,
      unitKerjaId: row.unit_kerja_id,
      pegawaiId: row.pegawai_id,
      fullName: row.full_name,
      iss: c.env.JWT_ISSUER,
      exp: now + accessTtl,
    },
    c.env.JWT_SECRET
  );

  const refreshToken = randomToken(32);
  const refreshHash = await sha256Hex(refreshToken);
  const expiresAt = new Date((now + refreshTtl) * 1000).toISOString();
  await c.env.DB.prepare(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)`
  )
    .bind(row.id, refreshHash, expiresAt)
    .run();

  return { accessToken, refreshToken, expiresIn: accessTtl };
}

function publicUser(row: UserRow) {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    fullName: row.full_name,
    role: row.role_code,
    unitKerjaId: row.unit_kerja_id,
    pegawaiId: row.pegawai_id,
    mustChangePassword: !!row.must_change_password,
  };
}

auth.post("/login", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { username, password } = body as { username?: string; password?: string };
  if (!username || !password) throw badRequest("username dan password wajib diisi");

  const ip = c.req.header("CF-Connecting-IP") ?? "unknown";
  const row = await c.env.DB.prepare(`${USER_SELECT} WHERE u.username = ?`).bind(username).first<UserRow>();

  if (!row || !row.is_active) {
    await logAktivitas(c.env, null, "login_failed", "auth", null, { username }, ip);
    throw unauthorized("Username atau password salah");
  }

  const valid = await verifyPassword(password, row.password_hash);
  if (!valid) {
    await logAktivitas(c.env, null, "login_failed", "auth", row.id, { username }, ip);
    throw unauthorized("Username atau password salah");
  }

  const tokens = await issueTokens(c, row);
  await c.env.DB.prepare(`UPDATE users SET last_login_at = datetime('now') WHERE id = ?`).bind(row.id).run();
  await logAktivitas(
    c.env,
    { id: row.id, username: row.username, fullName: row.full_name, role: row.role_code as any, roleId: row.role_id, unitKerjaId: row.unit_kerja_id, pegawaiId: row.pegawai_id },
    "login",
    "auth",
    row.id,
    null,
    ip
  );

  return c.json({ ...tokens, user: publicUser(row) });
});

auth.post("/refresh", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { refreshToken } = body as { refreshToken?: string };
  if (!refreshToken) throw badRequest("refreshToken wajib diisi");

  const hash = await sha256Hex(refreshToken);
  const tokenRow = await c.env.DB.prepare(
    `SELECT id, user_id, expires_at, revoked_at FROM refresh_tokens WHERE token_hash = ?`
  )
    .bind(hash)
    .first<{ id: number; user_id: number; expires_at: string; revoked_at: string | null }>();

  if (!tokenRow || tokenRow.revoked_at || new Date(tokenRow.expires_at).getTime() < Date.now()) {
    throw unauthorized("Refresh token tidak valid atau kedaluwarsa");
  }

  const row = await c.env.DB.prepare(`${USER_SELECT} WHERE u.id = ?`).bind(tokenRow.user_id).first<UserRow>();
  if (!row || !row.is_active) throw unauthorized("Akun tidak aktif");

  await c.env.DB.prepare(`UPDATE refresh_tokens SET revoked_at = datetime('now') WHERE id = ?`).bind(tokenRow.id).run();
  const tokens = await issueTokens(c, row);
  return c.json({ ...tokens, user: publicUser(row) });
});

auth.post("/logout", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { refreshToken } = body as { refreshToken?: string };
  if (refreshToken) {
    const hash = await sha256Hex(refreshToken);
    await c.env.DB.prepare(`UPDATE refresh_tokens SET revoked_at = datetime('now') WHERE token_hash = ?`).bind(hash).run();
  }
  return c.json({ ok: true });
});

auth.get("/me", authMiddleware, async (c) => {
  const user = c.get("user");
  const row = await c.env.DB.prepare(`${USER_SELECT} WHERE u.id = ?`).bind(user.id).first<UserRow>();
  if (!row) throw unauthorized();
  return c.json(publicUser(row));
});

auth.post("/change-password", authMiddleware, async (c) => {
  const user = c.get("user");
  const body = await c.req.json().catch(() => ({}));
  const { oldPassword, newPassword } = body as { oldPassword?: string; newPassword?: string };
  if (!oldPassword || !newPassword) throw badRequest("oldPassword dan newPassword wajib diisi");
  if (newPassword.length < 8) throw badRequest("Password baru minimal 8 karakter");

  const row = await c.env.DB.prepare(`SELECT password_hash FROM users WHERE id = ?`).bind(user.id).first<{ password_hash: string }>();
  if (!row || !(await verifyPassword(oldPassword, row.password_hash))) {
    throw unauthorized("Password lama salah");
  }

  const newHash = await hashPassword(newPassword);
  await c.env.DB.prepare(
    `UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = datetime('now') WHERE id = ?`
  )
    .bind(newHash, user.id)
    .run();
  await logAktivitas(c.env, user, "update", "users", user.id, { action: "change_password" }, c.get("requestIp"));

  return c.json({ ok: true });
});

export default auth;
