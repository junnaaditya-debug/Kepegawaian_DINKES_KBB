import { Hono } from "hono";
import { nowIso } from "../lib/db";
import { scopedUnitKerjaId } from "../middleware/rbac";
import { evaluatePegawai, loadEngineParams, type PegawaiRow } from "../lib/promotionEngine";
import type { Env, Variables } from "../types";

export const dashboardRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

dashboardRoutes.get("/summary", async (c) => {
  const authUser = c.get("authUser");
  const scopeUnit = scopedUnitKerjaId(authUser);
  const unitFilter = scopeUnit ? "AND unit_kerja_id = ?" : "";
  const unitBind = scopeUnit ? [scopeUnit] : [];

  const [totalRow, perGolongan, perJenisJabatan, perStatusKepegawaian, perUnit] = await Promise.all([
    c.env.DB.prepare(`SELECT COUNT(*) as total FROM pegawai WHERE status_aktif = 'AKTIF' ${unitFilter}`)
      .bind(...unitBind)
      .first<{ total: number }>(),
    c.env.DB.prepare(
      `SELECT golongan_ruang_aktif as label, COUNT(*) as jumlah FROM pegawai WHERE status_aktif = 'AKTIF' ${unitFilter} GROUP BY golongan_ruang_aktif ORDER BY golongan_ruang_aktif`
    )
      .bind(...unitBind)
      .all(),
    c.env.DB.prepare(
      `SELECT jenis_jabatan as label, COUNT(*) as jumlah FROM pegawai WHERE status_aktif = 'AKTIF' ${unitFilter} GROUP BY jenis_jabatan`
    )
      .bind(...unitBind)
      .all(),
    c.env.DB.prepare(
      `SELECT status_kepegawaian as label, COUNT(*) as jumlah FROM pegawai WHERE status_aktif = 'AKTIF' ${unitFilter} GROUP BY status_kepegawaian`
    )
      .bind(...unitBind)
      .all(),
    c.env.DB.prepare(
      `SELECT uk.nama as label, COUNT(*) as jumlah FROM pegawai p JOIN unit_kerja uk ON uk.id = p.unit_kerja_id
       WHERE p.status_aktif = 'AKTIF' ${scopeUnit ? "AND p.unit_kerja_id = ?" : ""} GROUP BY uk.nama ORDER BY jumlah DESC LIMIT 15`
    )
      .bind(...unitBind)
      .all(),
  ]);

  const where: string[] = ["p.status_aktif = 'AKTIF'"];
  const binds: unknown[] = [];
  if (scopeUnit) {
    where.push("p.unit_kerja_id = ?");
    binds.push(scopeUnit);
  }
  const { results: pegawaiRows } = await c.env.DB.prepare(
    `SELECT p.id, p.nip, p.nama, p.unit_kerja_id, uk.nama as unit_kerja_nama, p.status_kepegawaian, p.status_aktif,
            p.jenis_jabatan, p.nama_jabatan, p.jenjang_jabatan, p.golongan_ruang_aktif, p.nama_pangkat_aktif,
            p.tmt_pangkat_aktif, p.predikat_skp_terakhir,
            (SELECT angka_kredit_kumulatif FROM angka_kredit ak WHERE ak.pegawai_id = p.id AND ak.is_current = 1 LIMIT 1) as angka_kredit_kumulatif
     FROM pegawai p LEFT JOIN unit_kerja uk ON uk.id = p.unit_kerja_id
     WHERE ${where.join(" AND ")}`
  )
    .bind(...binds)
    .all<PegawaiRow>();

  const params = await loadEngineParams(c.env.DB);
  const asOf = nowIso();
  const evaluated = pegawaiRows.map((r) => evaluatePegawai(r, params, asOf)).filter((r): r is NonNullable<typeof r> => r !== null);

  const dueSekarang = evaluated.filter((k) => k.memenuhiSyarat).length;
  const due3Bulan = evaluated.filter((k) => k.bulanMenujuPeriode !== null && k.bulanMenujuPeriode <= 3).length;
  const due6Bulan = evaluated.filter((k) => k.bulanMenujuPeriode !== null && k.bulanMenujuPeriode <= 6).length;
  const due12Bulan = evaluated.filter((k) => k.bulanMenujuPeriode !== null && k.bulanMenujuPeriode <= 12).length;

  const statusCounts = await c.env.DB.prepare(
    `SELECT status, COUNT(*) as jumlah FROM status_usulan_kenaikan_pangkat GROUP BY status`
  ).all<{ status: string; jumlah: number }>();

  return c.json({
    data: {
      totalPegawaiAktif: totalRow?.total ?? 0,
      komposisiGolongan: perGolongan.results,
      komposisiJenisJabatan: perJenisJabatan.results,
      komposisiStatusKepegawaian: perStatusKepegawaian.results,
      komposisiUnitKerja: perUnit.results,
      kenaikanPangkat: {
        sudahWaktunya: dueSekarang,
        due3Bulan,
        due6Bulan,
        due12Bulan,
      },
      statusTindakLanjut: statusCounts.results,
      asOf,
    },
  });
});

dashboardRoutes.get("/tren-kenaikan-pangkat", async (c) => {
  const authUser = c.get("authUser");
  const scopeUnit = scopedUnitKerjaId(authUser);
  const unitJoin = scopeUnit ? "JOIN pegawai p2 ON p2.id = r.pegawai_id AND p2.unit_kerja_id = ?" : "";
  const binds = scopeUnit ? [scopeUnit] : [];

  const { results } = await c.env.DB.prepare(
    `SELECT substr(r.tmt_pangkat, 1, 4) as tahun, COUNT(*) as jumlah
     FROM riwayat_pangkat_golongan r ${unitJoin}
     GROUP BY tahun ORDER BY tahun DESC LIMIT 10`
  )
    .bind(...binds)
    .all();

  return c.json({ data: results.reverse() });
});
