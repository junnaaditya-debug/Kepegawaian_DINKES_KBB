import { Hono } from "hono";
import type { Env, Variables } from "../types";
import { authMiddleware, requireRole, WRITE_ROLES } from "../middleware/auth";
import { badRequest, notFound } from "../lib/http";
import { logAktivitas } from "../lib/audit";

const route = new Hono<{ Bindings: Env; Variables: Variables }>();
route.use("*", authMiddleware);

route.get("/:pegawaiId/pangkat", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM riwayat_pangkat_golongan WHERE pegawai_id = ? ORDER BY tmt_pangkat DESC`
  )
    .bind(c.req.param("pegawaiId"))
    .all();
  return c.json(results);
});

/**
 * BR-6: satu pegawai hanya punya satu status pangkat/golongan aktif. Menambah
 * riwayat baru otomatis mengarsipkan (is_aktif=0, read-only) riwayat lama dan
 * memperbarui data pangkat/golongan aktif pada entitas pegawai (FR-4.6).
 */
route.post("/:pegawaiId/pangkat", requireRole(...WRITE_ROLES), async (c) => {
  const pegawaiId = c.req.param("pegawaiId");
  const user = c.get("user");
  const body = await c.req.json();
  if (!body.golongan_ruang || !body.nama_pangkat || !body.tmt_pangkat) {
    throw badRequest("golongan_ruang, nama_pangkat, tmt_pangkat wajib diisi");
  }

  const pegawai = await c.env.DB.prepare(`SELECT id FROM pegawai WHERE id = ?`).bind(pegawaiId).first();
  if (!pegawai) throw notFound("Pegawai tidak ditemukan");

  await c.env.DB.prepare(`UPDATE riwayat_pangkat_golongan SET is_aktif = 0 WHERE pegawai_id = ? AND is_aktif = 1`)
    .bind(pegawaiId)
    .run();

  const result = await c.env.DB.prepare(
    `INSERT INTO riwayat_pangkat_golongan (pegawai_id, golongan_ruang, nama_pangkat, tmt_pangkat, no_sk, tanggal_sk, pejabat_penetap, jenis_kenaikan, dokumen_id, is_aktif, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`
  )
    .bind(
      pegawaiId, body.golongan_ruang, body.nama_pangkat, body.tmt_pangkat,
      body.no_sk ?? null, body.tanggal_sk ?? null, body.pejabat_penetap ?? null,
      body.jenis_kenaikan ?? "reguler", body.dokumen_id ?? null, user.id
    )
    .run();
  const riwayatId = result.meta.last_row_id as number;

  await c.env.DB.prepare(
    `UPDATE pegawai SET golongan_ruang_aktif = ?, nama_pangkat_aktif = ?, tmt_pangkat_aktif = ?, updated_by = ?, updated_at = datetime('now')
     WHERE id = ?`
  )
    .bind(body.golongan_ruang, body.nama_pangkat, body.tmt_pangkat, user.id, pegawaiId)
    .run();

  // If this SK closes out an open usulan kenaikan pangkat, link it (FR-4.6 / FR-6 acceptance criteria).
  if (body.status_usulan_id) {
    await c.env.DB.prepare(
      `UPDATE status_usulan_kenaikan_pangkat SET status = 'sk_terbit', riwayat_pangkat_golongan_id = ?, updated_by = ?, updated_at = datetime('now')
       WHERE id = ? AND pegawai_id = ?`
    )
      .bind(riwayatId, user.id, body.status_usulan_id, pegawaiId)
      .run();
  }

  await logAktivitas(c.env, user, "create", "riwayat_pangkat_golongan", riwayatId, body, c.get("requestIp"));
  return c.json({ id: riwayatId }, 201);
});

export default route;
