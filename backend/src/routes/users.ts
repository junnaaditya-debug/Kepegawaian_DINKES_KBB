import { Hono } from "hono";
import { hashPassword } from "../lib/password";
import { nowIso, uuid, writeAuditLog, parsePagination } from "../lib/db";
import { requireRole } from "../middleware/rbac";
import type { Env, Variables } from "../types";

export const userRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

userRoutes.use("*", requireRole("SUPER_ADMIN"));

userRoutes.get("/", async (c) => {
  const { page, pageSize } = parsePagination(c.req.query() as Record<string, string>);
  const search = c.req.query("search")?.trim();

  let where = "1=1";
  const binds: unknown[] = [];
  if (search) {
    where += ` AND (u.username LIKE ? OR u.nama_lengkap LIKE ?)`;
    binds.push(`%${search}%`, `%${search}%`);
  }

  const totalRow = await c.env.DB.prepare(`SELECT COUNT(*) as total FROM users u WHERE ${where}`)
    .bind(...binds)
    .first<{ total: number }>();

  const { results } = await c.env.DB.prepare(
    `SELECT u.id, u.username, u.email, u.nama_lengkap, u.role, u.unit_kerja_id, uk.nama as unit_kerja_nama,
            u.pegawai_id, u.is_active, u.last_login_at, u.created_at
     FROM users u LEFT JOIN unit_kerja uk ON uk.id = u.unit_kerja_id
     WHERE ${where}
     ORDER BY u.nama_lengkap
     LIMIT ? OFFSET ?`
  )
    .bind(...binds, pageSize, (page - 1) * pageSize)
    .all();

  return c.json({ data: results, pagination: { page, pageSize, total: totalRow?.total ?? 0 } });
});

userRoutes.post("/", async (c) => {
  const authUser = c.get("authUser");
  const body = await c.req.json<{
    username?: string;
    email?: string;
    password?: string;
    namaLengkap?: string;
    role?: string;
    unitKerjaId?: string | null;
    pegawaiId?: string | null;
  }>().catch(() => ({} as never));

  if (!body.username || !body.password || !body.namaLengkap || !body.role) {
    return c.json({ error: "Username, password, nama lengkap, dan role wajib diisi." }, 400);
  }
  if (body.password.length < 8) {
    return c.json({ error: "Password minimal 8 karakter." }, 400);
  }

  const dupe = await c.env.DB.prepare(`SELECT id FROM users WHERE username = ?`).bind(body.username).first();
  if (dupe) return c.json({ error: "Username sudah digunakan." }, 409);

  const id = uuid();
  const now = nowIso();
  const passwordHash = await hashPassword(body.password);

  await c.env.DB.prepare(
    `INSERT INTO users (id, username, email, password_hash, nama_lengkap, role, unit_kerja_id, pegawai_id, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
  )
    .bind(
      id,
      body.username,
      body.email ?? null,
      passwordHash,
      body.namaLengkap,
      body.role,
      body.unitKerjaId ?? null,
      body.pegawaiId ?? null,
      now,
      now
    )
    .run();

  await writeAuditLog(c.env.DB, {
    user: authUser,
    aksi: "CREATE",
    entityType: "USER",
    entityId: id,
    dataSesudah: { ...body, password: undefined },
  });

  return c.json({ data: { id } }, 201);
});

userRoutes.put("/:id", async (c) => {
  const authUser = c.get("authUser");
  const id = c.req.param("id");
  const existing = await c.env.DB.prepare(`SELECT * FROM users WHERE id = ?`).bind(id).first<Record<string, unknown>>();
  if (!existing) return c.json({ error: "User tidak ditemukan." }, 404);

  const body = await c.req.json<{
    email?: string;
    namaLengkap?: string;
    role?: string;
    unitKerjaId?: string | null;
    pegawaiId?: string | null;
    isActive?: boolean;
    password?: string;
  }>().catch(() => ({} as never));

  const passwordHash = body.password ? await hashPassword(body.password) : (existing.password_hash as string);
  if (body.password && body.password.length < 8) {
    return c.json({ error: "Password minimal 8 karakter." }, 400);
  }

  await c.env.DB.prepare(
    `UPDATE users SET email = ?, nama_lengkap = ?, role = ?, unit_kerja_id = ?, pegawai_id = ?, is_active = ?, password_hash = ?, updated_at = ?
     WHERE id = ?`
  )
    .bind(
      body.email ?? existing.email,
      body.namaLengkap ?? existing.nama_lengkap,
      body.role ?? existing.role,
      body.unitKerjaId !== undefined ? body.unitKerjaId : existing.unit_kerja_id,
      body.pegawaiId !== undefined ? body.pegawaiId : existing.pegawai_id,
      body.isActive !== undefined ? (body.isActive ? 1 : 0) : existing.is_active,
      passwordHash,
      nowIso(),
      id
    )
    .run();

  await writeAuditLog(c.env.DB, {
    user: authUser,
    aksi: "UPDATE",
    entityType: "USER",
    entityId: id,
    dataSebelum: { ...existing, password_hash: undefined },
    dataSesudah: { ...body, password: undefined },
  });

  return c.json({ message: "User berhasil diperbarui." });
});

userRoutes.delete("/:id", async (c) => {
  const authUser = c.get("authUser");
  const id = c.req.param("id");
  if (id === authUser.id) return c.json({ error: "Tidak dapat menonaktifkan akun sendiri." }, 400);

  const existing = await c.env.DB.prepare(`SELECT * FROM users WHERE id = ?`).bind(id).first();
  if (!existing) return c.json({ error: "User tidak ditemukan." }, 404);

  await c.env.DB.prepare(`UPDATE users SET is_active = 0, updated_at = ? WHERE id = ?`).bind(nowIso(), id).run();

  await writeAuditLog(c.env.DB, {
    user: authUser,
    aksi: "DELETE",
    entityType: "USER",
    entityId: id,
    dataSebelum: existing,
    deskripsi: "User dinonaktifkan.",
  });

  return c.json({ message: "User berhasil dinonaktifkan." });
});
