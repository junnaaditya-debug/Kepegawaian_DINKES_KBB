import { Hono } from "hono";
import type { Env, Variables } from "../types";
import { authMiddleware, requireRole, WRITE_ROLES } from "../middleware/auth";
import { badRequest, notFound } from "../lib/http";
import { logAktivitas } from "../lib/audit";

const route = new Hono<{ Bindings: Env; Variables: Variables }>();
route.use("*", authMiddleware);

route.get("/:pegawaiId/angka-kredit", async (c) => {
  const pegawaiId = c.req.param("pegawaiId");
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM angka_kredit WHERE pegawai_id = ? ORDER BY tanggal_pak DESC`
  )
    .bind(pegawaiId)
    .all();

  const pegawai = await c.env.DB.prepare(
    `SELECT p.jenjang_jabatan_fungsional_id, jf.nama as jenjang_nama, jf.angka_kredit_kumulatif_minimal,
            jf.jenis_jabatan_fungsional_id, jf.urutan,
            (SELECT jf2.id FROM jenjang_jabatan_fungsional jf2
             WHERE jf2.jenis_jabatan_fungsional_id = jf.jenis_jabatan_fungsional_id AND jf2.urutan = jf.urutan + 1) as jenjang_berikutnya_id
     FROM pegawai p LEFT JOIN jenjang_jabatan_fungsional jf ON jf.id = p.jenjang_jabatan_fungsional_id
     WHERE p.id = ?`
  )
    .bind(pegawaiId)
    .first<any>();

  let gap: { jenjangBerikutnyaNama: string | null; ambangBatas: number | null; kumulatifSaatIni: number; sisaKebutuhan: number | null } | null = null;
  if (pegawai?.jenjang_berikutnya_id) {
    const next = await c.env.DB.prepare(
      `SELECT nama, angka_kredit_kumulatif_minimal FROM jenjang_jabatan_fungsional WHERE id = ?`
    )
      .bind(pegawai.jenjang_berikutnya_id)
      .first<{ nama: string; angka_kredit_kumulatif_minimal: number }>();
    const terbaru = (results as any[]).find((r) => r.is_terbaru) ?? results[0];
    const kumulatif = terbaru?.angka_kredit_kumulatif ?? 0;
    gap = {
      jenjangBerikutnyaNama: next?.nama ?? null,
      ambangBatas: next?.angka_kredit_kumulatif_minimal ?? null,
      kumulatifSaatIni: kumulatif,
      sisaKebutuhan: next ? Math.max(0, next.angka_kredit_kumulatif_minimal - kumulatif) : null,
    };
  }

  return c.json({ data: results, gap });
});

route.post("/:pegawaiId/angka-kredit", requireRole(...WRITE_ROLES), async (c) => {
  const pegawaiId = c.req.param("pegawaiId");
  const user = c.get("user");
  const body = await c.req.json();

  const pegawai = await c.env.DB.prepare(`SELECT id FROM pegawai WHERE id = ?`).bind(pegawaiId).first();
  if (!pegawai) throw notFound("Pegawai tidak ditemukan");

  const utama = Number(body.angka_kredit_utama ?? 0);
  const profesi = Number(body.angka_kredit_pengembangan_profesi ?? 0);
  const penunjang = Number(body.angka_kredit_penunjang ?? 0);
  const kumulatif = body.angka_kredit_kumulatif != null ? Number(body.angka_kredit_kumulatif) : utama + profesi + penunjang;
  if (Number.isNaN(kumulatif)) throw badRequest("Nilai angka kredit tidak valid");

  if (body.is_terbaru !== false) {
    await c.env.DB.prepare(`UPDATE angka_kredit SET is_terbaru = 0 WHERE pegawai_id = ?`).bind(pegawaiId).run();
  }

  const result = await c.env.DB.prepare(
    `INSERT INTO angka_kredit (pegawai_id, no_pak, tanggal_pak, periode_mulai, periode_selesai, angka_kredit_utama, angka_kredit_pengembangan_profesi, angka_kredit_penunjang, angka_kredit_kumulatif, dokumen_id, is_terbaru, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      pegawaiId, body.no_pak ?? null, body.tanggal_pak ?? null, body.periode_mulai ?? null, body.periode_selesai ?? null,
      utama, profesi, penunjang, kumulatif, body.dokumen_id ?? null,
      body.is_terbaru !== false ? 1 : 0, user.id
    )
    .run();

  const id = result.meta.last_row_id;
  await logAktivitas(c.env, user, "create", "angka_kredit", id as number, body, c.get("requestIp"));
  return c.json({ id }, 201);
});

export default route;
