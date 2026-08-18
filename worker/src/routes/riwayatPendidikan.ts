import { Hono } from "hono";
import type { Env, Variables } from "../types";
import { authMiddleware, requireRole, WRITE_ROLES } from "../middleware/auth";
import { badRequest, notFound } from "../lib/http";
import { logAktivitas } from "../lib/audit";

const route = new Hono<{ Bindings: Env; Variables: Variables }>();
route.use("*", authMiddleware);

route.get("/:pegawaiId/pendidikan", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM riwayat_pendidikan WHERE pegawai_id = ? ORDER BY tahun_lulus DESC`
  )
    .bind(c.req.param("pegawaiId"))
    .all();
  return c.json(results);
});

route.post("/:pegawaiId/pendidikan", requireRole(...WRITE_ROLES), async (c) => {
  const pegawaiId = c.req.param("pegawaiId");
  const user = c.get("user");
  const body = await c.req.json();
  if (!body.jenjang) throw badRequest("jenjang wajib diisi");

  const pegawai = await c.env.DB.prepare(`SELECT id FROM pegawai WHERE id = ?`).bind(pegawaiId).first();
  if (!pegawai) throw notFound("Pegawai tidak ditemukan");

  if (body.is_pendidikan_terakhir) {
    await c.env.DB.prepare(`UPDATE riwayat_pendidikan SET is_pendidikan_terakhir = 0 WHERE pegawai_id = ?`).bind(pegawaiId).run();
  }

  const result = await c.env.DB.prepare(
    `INSERT INTO riwayat_pendidikan (pegawai_id, jenjang, jurusan, nama_institusi, tahun_lulus, no_ijazah, dokumen_id, is_pendidikan_terakhir, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      pegawaiId, body.jenjang, body.jurusan ?? null, body.nama_institusi ?? null,
      body.tahun_lulus ?? null, body.no_ijazah ?? null, body.dokumen_id ?? null,
      body.is_pendidikan_terakhir ? 1 : 0, user.id
    )
    .run();

  const id = result.meta.last_row_id;
  await logAktivitas(c.env, user, "create", "riwayat_pendidikan", id as number, body, c.get("requestIp"));
  return c.json({ id }, 201);
});

route.delete("/:pegawaiId/pendidikan/:id", requireRole(...WRITE_ROLES), async (c) => {
  const result = await c.env.DB.prepare(
    `DELETE FROM riwayat_pendidikan WHERE id = ? AND pegawai_id = ?`
  )
    .bind(c.req.param("id"), c.req.param("pegawaiId"))
    .run();
  if (result.meta.changes === 0) throw notFound("Riwayat pendidikan tidak ditemukan");
  await logAktivitas(c.env, c.get("user"), "delete", "riwayat_pendidikan", Number(c.req.param("id")), null, c.get("requestIp"));
  return c.json({ ok: true });
});

export default route;
