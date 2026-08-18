import { Hono } from "hono";
import { nowIso, uuid, writeAuditLog } from "../lib/db";
import { requireRole } from "../middleware/rbac";
import type { Env, Variables } from "../types";

export const riwayatPendidikanRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();
const EDITOR_ROLES = ["SUPER_ADMIN", "ADMIN_KEPEGAWAIAN"] as const;

riwayatPendidikanRoutes.get("/pegawai/:pegawaiId", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM riwayat_pendidikan WHERE pegawai_id = ? ORDER BY tahun_lulus DESC`
  )
    .bind(c.req.param("pegawaiId"))
    .all();
  return c.json({ data: results });
});

riwayatPendidikanRoutes.post("/", requireRole(...EDITOR_ROLES), async (c) => {
  const authUser = c.get("authUser");
  const body = await c.req.json<{
    pegawaiId?: string;
    jenjangPendidikan?: string;
    jurusan?: string;
    namaInstitusi?: string;
    tahunLulus?: number;
    noIjazah?: string;
  }>().catch(() => ({} as never));

  if (!body.pegawaiId || !body.jenjangPendidikan) {
    return c.json({ error: "Pegawai dan jenjang pendidikan wajib diisi." }, 400);
  }

  const id = uuid();
  await c.env.DB.prepare(
    `INSERT INTO riwayat_pendidikan (id, pegawai_id, jenjang_pendidikan, jurusan, nama_institusi, tahun_lulus, no_ijazah, created_at, created_by)
     VALUES (?,?,?,?,?,?,?,?,?)`
  )
    .bind(
      id,
      body.pegawaiId,
      body.jenjangPendidikan,
      body.jurusan ?? null,
      body.namaInstitusi ?? null,
      body.tahunLulus ?? null,
      body.noIjazah ?? null,
      nowIso(),
      authUser.id
    )
    .run();

  await writeAuditLog(c.env.DB, {
    user: authUser,
    aksi: "CREATE",
    entityType: "RIWAYAT_PENDIDIKAN",
    entityId: id,
    dataSesudah: body,
  });

  return c.json({ data: { id } }, 201);
});

riwayatPendidikanRoutes.delete("/:id", requireRole(...EDITOR_ROLES), async (c) => {
  const authUser = c.get("authUser");
  const id = c.req.param("id");
  const existing = await c.env.DB.prepare(`SELECT * FROM riwayat_pendidikan WHERE id = ?`).bind(id).first();
  if (!existing) return c.json({ error: "Riwayat pendidikan tidak ditemukan." }, 404);

  await c.env.DB.prepare(`DELETE FROM riwayat_pendidikan WHERE id = ?`).bind(id).run();

  await writeAuditLog(c.env.DB, {
    user: authUser,
    aksi: "DELETE",
    entityType: "RIWAYAT_PENDIDIKAN",
    entityId: id,
    dataSebelum: existing,
  });

  return c.json({ message: "Riwayat pendidikan berhasil dihapus." });
});
