import { Hono } from "hono";
import type { Env, Variables } from "../types";
import { authMiddleware, requireRole, WRITE_ROLES } from "../middleware/auth";
import { badRequest, notFound } from "../lib/http";
import { logAktivitas } from "../lib/audit";

const route = new Hono<{ Bindings: Env; Variables: Variables }>();
route.use("*", authMiddleware);

route.get("/:pegawaiId/jabatan", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT rj.*, uk.nama as unit_kerja_nama, jf.nama as jenjang_nama
     FROM riwayat_jabatan rj
     JOIN unit_kerja uk ON uk.id = rj.unit_kerja_id
     LEFT JOIN jenjang_jabatan_fungsional jf ON jf.id = rj.jenjang_jabatan_fungsional_id
     WHERE rj.pegawai_id = ?
     ORDER BY rj.tmt_jabatan DESC`
  )
    .bind(c.req.param("pegawaiId"))
    .all();
  return c.json(results);
});

route.post("/:pegawaiId/jabatan", requireRole(...WRITE_ROLES), async (c) => {
  const pegawaiId = c.req.param("pegawaiId");
  const user = c.get("user");
  const body = await c.req.json();
  if (!body.jenis || !body.jabatan_nama || !body.unit_kerja_id || !body.tmt_jabatan) {
    throw badRequest("jenis, jabatan_nama, unit_kerja_id, tmt_jabatan wajib diisi");
  }

  const pegawai = await c.env.DB.prepare(`SELECT id FROM pegawai WHERE id = ?`).bind(pegawaiId).first();
  if (!pegawai) throw notFound("Pegawai tidak ditemukan");

  const setInactive = body.jadikan_aktif !== false;
  if (setInactive) {
    await c.env.DB.prepare(`UPDATE riwayat_jabatan SET is_aktif = 0 WHERE pegawai_id = ? AND is_aktif = 1`).bind(pegawaiId).run();
  }

  const result = await c.env.DB.prepare(
    `INSERT INTO riwayat_jabatan (pegawai_id, jenis, jabatan_nama, jenjang_jabatan_fungsional_id, unit_kerja_id, no_sk, tanggal_sk, tmt_jabatan, pejabat_penetap, dokumen_id, is_aktif, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      pegawaiId, body.jenis, body.jabatan_nama, body.jenjang_jabatan_fungsional_id ?? null, body.unit_kerja_id,
      body.no_sk ?? null, body.tanggal_sk ?? null, body.tmt_jabatan, body.pejabat_penetap ?? null,
      body.dokumen_id ?? null, setInactive ? 1 : 0, user.id
    )
    .run();

  if (setInactive) {
    await c.env.DB.prepare(
      `UPDATE pegawai SET jenis_jabatan = ?, jabatan_struktural_nama = ?, jenjang_jabatan_fungsional_id = ?, jabatan_nama_display = ?, updated_by = ?, updated_at = datetime('now')
       WHERE id = ?`
    )
      .bind(
        body.jenis,
        body.jenis === "struktural" ? body.jabatan_nama : null,
        body.jenjang_jabatan_fungsional_id ?? null,
        body.jabatan_nama,
        user.id,
        pegawaiId
      )
      .run();
  }

  const id = result.meta.last_row_id;
  await logAktivitas(c.env, user, "create", "riwayat_jabatan", id as number, body, c.get("requestIp"));
  return c.json({ id }, 201);
});

export default route;
