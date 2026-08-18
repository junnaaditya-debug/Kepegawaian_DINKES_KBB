import { Hono } from "hono";
import type { Env, Variables } from "../types";
import { authMiddleware, unitScopeFilter } from "../middleware/auth";

const route = new Hono<{ Bindings: Env; Variables: Variables }>();
route.use("*", authMiddleware);

route.get("/ringkasan", async (c) => {
  const user = c.get("user");
  const scope = unitScopeFilter(user);
  const scopeSql = scope ? `AND ${scope.sql}` : "";
  const scopeParam = scope ? [scope.param] : [];

  const totalPegawai = await c.env.DB.prepare(
    `SELECT COUNT(*) as n FROM pegawai WHERE status_aktif = 'aktif' ${scopeSql}`
  )
    .bind(...scopeParam)
    .first<{ n: number }>();

  const { results: perGolongan } = await c.env.DB.prepare(
    `SELECT golongan_ruang_aktif as golongan, COUNT(*) as jumlah FROM pegawai
     WHERE status_aktif = 'aktif' AND golongan_ruang_aktif IS NOT NULL ${scopeSql}
     GROUP BY golongan_ruang_aktif ORDER BY golongan_ruang_aktif`
  )
    .bind(...scopeParam)
    .all();

  const { results: perJenisJabatan } = await c.env.DB.prepare(
    `SELECT jenis_jabatan, COUNT(*) as jumlah FROM pegawai WHERE status_aktif = 'aktif' ${scopeSql} GROUP BY jenis_jabatan`
  )
    .bind(...scopeParam)
    .all();

  const { results: perUnit } = await c.env.DB.prepare(
    `SELECT uk.nama as unit_kerja, COUNT(*) as jumlah FROM pegawai p JOIN unit_kerja uk ON uk.id = p.unit_kerja_id
     WHERE p.status_aktif = 'aktif' ${scopeSql} GROUP BY uk.nama ORDER BY jumlah DESC`
  )
    .bind(...scopeParam)
    .all();

  const { results: perStatusKepegawaian } = await c.env.DB.prepare(
    `SELECT status_kepegawaian, COUNT(*) as jumlah FROM pegawai WHERE status_aktif = 'aktif' ${scopeSql} GROUP BY status_kepegawaian`
  )
    .bind(...scopeParam)
    .all();

  const { results: statusUsulan } = await c.env.DB.prepare(
    `SELECT s.status, COUNT(*) as jumlah FROM status_usulan_kenaikan_pangkat s
     JOIN pegawai p ON p.id = s.pegawai_id
     WHERE 1=1 ${scopeSql} GROUP BY s.status`
  )
    .bind(...scopeParam)
    .all();

  const { results: trenTahunan } = await c.env.DB.prepare(
    `SELECT substr(rpg.tmt_pangkat, 1, 4) as tahun, COUNT(*) as jumlah
     FROM riwayat_pangkat_golongan rpg JOIN pegawai p ON p.id = rpg.pegawai_id
     WHERE rpg.jenis_kenaikan != 'cpns' ${scopeSql}
     GROUP BY tahun ORDER BY tahun DESC LIMIT 8`
  )
    .bind(...scopeParam)
    .all();

  return c.json({
    totalPegawaiAktif: totalPegawai?.n ?? 0,
    komposisiGolongan: perGolongan,
    komposisiJenisJabatan: perJenisJabatan,
    komposisiUnitKerja: perUnit,
    komposisiStatusKepegawaian: perStatusKepegawaian,
    statusUsulanKenaikanPangkat: statusUsulan,
    trenKenaikanPangkatTahunan: trenTahunan,
  });
});

export default route;
