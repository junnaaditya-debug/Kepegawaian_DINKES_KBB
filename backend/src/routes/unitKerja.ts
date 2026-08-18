import { Hono } from "hono";
import { nowIso, uuid, writeAuditLog } from "../lib/db";
import { requireRole } from "../middleware/rbac";
import type { Env, Variables } from "../types";

export const unitKerjaRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

unitKerjaRoutes.get("/", async (c) => {
  const includeInactive = c.req.query("includeInactive") === "1";
  const sql = includeInactive
    ? `SELECT * FROM unit_kerja ORDER BY nama`
    : `SELECT * FROM unit_kerja WHERE is_active = 1 ORDER BY nama`;
  const { results } = await c.env.DB.prepare(sql).all();
  return c.json({ data: results });
});

unitKerjaRoutes.get("/:id", async (c) => {
  const item = await c.env.DB.prepare(`SELECT * FROM unit_kerja WHERE id = ?`).bind(c.req.param("id")).first();
  if (!item) return c.json({ error: "Unit kerja tidak ditemukan." }, 404);
  return c.json({ data: item });
});

unitKerjaRoutes.post("/", requireRole("SUPER_ADMIN", "ADMIN_KEPEGAWAIAN"), async (c) => {
  const authUser = c.get("authUser");
  const body = await c.req.json<{
    kode?: string;
    nama?: string;
    jenis?: string;
    parentId?: string | null;
    alamat?: string;
  }>().catch(() => ({} as never));

  if (!body.nama || !body.jenis) {
    return c.json({ error: "Nama dan jenis unit kerja wajib diisi." }, 400);
  }

  const id = uuid();
  const now = nowIso();
  await c.env.DB.prepare(
    `INSERT INTO unit_kerja (id, kode, nama, jenis, parent_id, alamat, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`
  )
    .bind(id, body.kode ?? null, body.nama, body.jenis, body.parentId ?? null, body.alamat ?? null, now, now)
    .run();

  await writeAuditLog(c.env.DB, {
    user: authUser,
    aksi: "CREATE",
    entityType: "UNIT_KERJA",
    entityId: id,
    dataSesudah: body,
  });

  return c.json({ data: { id } }, 201);
});

unitKerjaRoutes.put("/:id", requireRole("SUPER_ADMIN", "ADMIN_KEPEGAWAIAN"), async (c) => {
  const authUser = c.get("authUser");
  const id = c.req.param("id");
  const existing = await c.env.DB.prepare(`SELECT * FROM unit_kerja WHERE id = ?`).bind(id).first();
  if (!existing) return c.json({ error: "Unit kerja tidak ditemukan." }, 404);

  const body = await c.req.json<{
    kode?: string;
    nama?: string;
    jenis?: string;
    parentId?: string | null;
    alamat?: string;
    isActive?: boolean;
  }>().catch(() => ({} as never));

  await c.env.DB.prepare(
    `UPDATE unit_kerja SET kode = ?, nama = ?, jenis = ?, parent_id = ?, alamat = ?, is_active = ?, updated_at = ? WHERE id = ?`
  )
    .bind(
      body.kode ?? (existing as { kode: string | null }).kode,
      body.nama ?? (existing as { nama: string }).nama,
      body.jenis ?? (existing as { jenis: string }).jenis,
      body.parentId !== undefined ? body.parentId : (existing as { parent_id: string | null }).parent_id,
      body.alamat ?? (existing as { alamat: string | null }).alamat,
      body.isActive !== undefined ? (body.isActive ? 1 : 0) : (existing as { is_active: number }).is_active,
      nowIso(),
      id
    )
    .run();

  await writeAuditLog(c.env.DB, {
    user: authUser,
    aksi: "UPDATE",
    entityType: "UNIT_KERJA",
    entityId: id,
    dataSebelum: existing,
    dataSesudah: body,
  });

  return c.json({ message: "Unit kerja berhasil diperbarui." });
});

unitKerjaRoutes.delete("/:id", requireRole("SUPER_ADMIN"), async (c) => {
  const authUser = c.get("authUser");
  const id = c.req.param("id");
  const existing = await c.env.DB.prepare(`SELECT * FROM unit_kerja WHERE id = ?`).bind(id).first();
  if (!existing) return c.json({ error: "Unit kerja tidak ditemukan." }, 404);

  await c.env.DB.prepare(`UPDATE unit_kerja SET is_active = 0, updated_at = ? WHERE id = ?`).bind(nowIso(), id).run();

  await writeAuditLog(c.env.DB, {
    user: authUser,
    aksi: "DELETE",
    entityType: "UNIT_KERJA",
    entityId: id,
    dataSebelum: existing,
    deskripsi: "Unit kerja dinonaktifkan (soft delete).",
  });

  return c.json({ message: "Unit kerja berhasil dinonaktifkan." });
});
