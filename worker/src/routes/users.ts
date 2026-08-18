import { Hono } from "hono";
import type { Env, Variables } from "../types";
import { authMiddleware, requireRole } from "../middleware/auth";
import { badRequest, conflict, notFound } from "../lib/http";
import { logAktivitas } from "../lib/audit";
import { hashPassword } from "../lib/crypto";

const route = new Hono<{ Bindings: Env; Variables: Variables }>();
route.use("*", authMiddleware, requireRole("super_admin"));

const SELECT = `
  SELECT u.id, u.username, u.email, u.full_name, u.role_id, r.code as role_code, r.name as role_name,
         u.unit_kerja_id, uk.nama as unit_kerja_nama, u.pegawai_id, u.is_active, u.must_change_password,
         u.last_login_at, u.created_at
  FROM users u
  JOIN roles r ON r.id = u.role_id
  LEFT JOIN unit_kerja uk ON uk.id = u.unit_kerja_id
`;

route.get("/", async (c) => {
  const { results } = await c.env.DB.prepare(`${SELECT} ORDER BY u.username`).all();
  return c.json(results);
});

route.get("/roles", async (c) => {
  const { results } = await c.env.DB.prepare(`SELECT id, code, name, description FROM roles ORDER BY id`).all();
  return c.json(results);
});

route.get("/:id", async (c) => {
  const row = await c.env.DB.prepare(`${SELECT} WHERE u.id = ?`).bind(c.req.param("id")).first();
  if (!row) throw notFound("User tidak ditemukan");
  return c.json(row);
});

route.post("/", async (c) => {
  const body = await c.req.json();
  const { username, email, password, fullName, roleId, unitKerjaId, pegawaiId } = body;
  if (!username || !password || !fullName || !roleId) {
    throw badRequest("username, password, fullName, roleId wajib diisi");
  }
  if (password.length < 8) throw badRequest("Password minimal 8 karakter");

  const dupe = await c.env.DB.prepare(`SELECT id FROM users WHERE username = ?`).bind(username).first();
  if (dupe) throw conflict("Username sudah digunakan");

  const passwordHash = await hashPassword(password);
  const result = await c.env.DB.prepare(
    `INSERT INTO users (username, email, password_hash, full_name, role_id, unit_kerja_id, pegawai_id, must_change_password)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1)`
  )
    .bind(username, email ?? null, passwordHash, fullName, roleId, unitKerjaId ?? null, pegawaiId ?? null)
    .run();

  const id = result.meta.last_row_id;
  await logAktivitas(c.env, c.get("user"), "create", "users", id as number, { username, roleId }, c.get("requestIp"));
  return c.json({ id }, 201);
});

route.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const { email, fullName, roleId, unitKerjaId, pegawaiId, isActive } = body;
  const existing = await c.env.DB.prepare(`SELECT id FROM users WHERE id = ?`).bind(id).first();
  if (!existing) throw notFound("User tidak ditemukan");

  await c.env.DB.prepare(
    `UPDATE users SET email = ?, full_name = ?, role_id = ?, unit_kerja_id = ?, pegawai_id = ?, is_active = ?, updated_at = datetime('now')
     WHERE id = ?`
  )
    .bind(email ?? null, fullName, roleId, unitKerjaId ?? null, pegawaiId ?? null, isActive ?? 1, id)
    .run();

  await logAktivitas(c.env, c.get("user"), "update", "users", Number(id), body, c.get("requestIp"));
  return c.json({ ok: true });
});

route.post("/:id/reset-password", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const newPassword: string = body.newPassword ?? crypto.randomUUID().slice(0, 12);
  if (newPassword.length < 8) throw badRequest("Password minimal 8 karakter");

  const existing = await c.env.DB.prepare(`SELECT id FROM users WHERE id = ?`).bind(id).first();
  if (!existing) throw notFound("User tidak ditemukan");

  const passwordHash = await hashPassword(newPassword);
  await c.env.DB.prepare(
    `UPDATE users SET password_hash = ?, must_change_password = 1, updated_at = datetime('now') WHERE id = ?`
  )
    .bind(passwordHash, id)
    .run();

  await logAktivitas(c.env, c.get("user"), "update", "users", Number(id), { action: "reset_password" }, c.get("requestIp"));
  return c.json({ ok: true, temporaryPassword: body.newPassword ? undefined : newPassword });
});

route.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const actingUser = c.get("user");
  if (Number(id) === actingUser.id) throw badRequest("Tidak dapat menonaktifkan akun sendiri");
  const existing = await c.env.DB.prepare(`SELECT id FROM users WHERE id = ?`).bind(id).first();
  if (!existing) throw notFound("User tidak ditemukan");
  await c.env.DB.prepare(`UPDATE users SET is_active = 0, updated_at = datetime('now') WHERE id = ?`).bind(id).run();
  await logAktivitas(c.env, actingUser, "delete", "users", Number(id), { action: "deactivate" }, c.get("requestIp"));
  return c.json({ ok: true });
});

export default route;
