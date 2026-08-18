import { Hono } from "hono";
import { nowIso, writeAuditLog } from "../lib/db";
import { scopedUnitKerjaId } from "../middleware/rbac";
import { evaluatePegawai, loadEngineParams, type PegawaiRow } from "../lib/promotionEngine";
import { buildExcelWorkbook } from "../lib/excel";
import { buildTableReportPdf } from "../lib/pdf";
import type { Env, Variables } from "../types";

export const laporanRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

function excelResponse(buffer: ArrayBuffer, filename: string): Response {
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

function pdfResponse(bytes: Uint8Array, filename: string): Response {
  return new Response(bytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

laporanRoutes.get("/pegawai/export", async (c) => {
  const authUser = c.get("authUser");
  const format = c.req.query("format") ?? "excel";
  const scopeUnit = scopedUnitKerjaId(authUser);

  const where = ["p.is_active = 1"];
  const binds: unknown[] = [];
  if (scopeUnit) {
    where.push("p.unit_kerja_id = ?");
    binds.push(scopeUnit);
  }

  const { results } = await c.env.DB.prepare(
    `SELECT p.nip, p.nama, p.status_kepegawaian, p.status_aktif, uk.nama as unit_kerja_nama,
            p.nama_jabatan, p.jenjang_jabatan, p.golongan_ruang_aktif, p.nama_pangkat_aktif, p.tmt_pangkat_aktif
     FROM pegawai p LEFT JOIN unit_kerja uk ON uk.id = p.unit_kerja_id
     WHERE ${where.join(" AND ")} ORDER BY p.nama`
  )
    .bind(...binds)
    .all<Record<string, string | null>>();

  const headers = ["NIP", "Nama", "Status Kepegawaian", "Status Aktif", "Unit Kerja", "Jabatan", "Jenjang", "Gol/Ruang", "Pangkat", "TMT Pangkat"];
  const rows = results.map((r) => [
    r.nip, r.nama, r.status_kepegawaian, r.status_aktif, r.unit_kerja_nama, r.nama_jabatan, r.jenjang_jabatan, r.golongan_ruang_aktif, r.nama_pangkat_aktif, r.tmt_pangkat_aktif,
  ]);

  await writeAuditLog(c.env.DB, { user: authUser, aksi: "EXPORT", entityType: "PEGAWAI", deskripsi: `Export laporan daftar pegawai (${format}), ${results.length} baris.` });

  if (format === "pdf") {
    const bytes = await buildTableReportPdf({
      title: "Laporan Data Pegawai",
      subtitle: `Total: ${results.length} pegawai — dicetak ${new Date().toLocaleDateString("id-ID")}`,
      columns: [
        { label: "NIP", width: 100 },
        { label: "Nama", width: 130 },
        { label: "Status", width: 55 },
        { label: "Unit Kerja", width: 110 },
        { label: "Jabatan", width: 110 },
        { label: "Jenjang", width: 90 },
        { label: "Gol/Ruang", width: 55 },
        { label: "Pangkat", width: 90 },
        { label: "TMT Pangkat", width: 65 },
      ],
      rows: results.map((r) => [r.nip, r.nama, r.status_kepegawaian, r.unit_kerja_nama, r.nama_jabatan, r.jenjang_jabatan, r.golongan_ruang_aktif, r.nama_pangkat_aktif, r.tmt_pangkat_aktif]),
      generatedBy: authUser.username,
    });
    return pdfResponse(bytes, "laporan-data-pegawai.pdf");
  }

  const buffer = buildExcelWorkbook("Data Pegawai", headers, rows);
  return excelResponse(buffer, "laporan-data-pegawai.xlsx");
});

laporanRoutes.get("/kenaikan-pangkat/export", async (c) => {
  const authUser = c.get("authUser");
  const format = c.req.query("format") ?? "excel";
  const rentangBulan = parseInt(c.req.query("rentangBulan") ?? "6", 10);
  const scopeUnit = scopedUnitKerjaId(authUser);

  const where = ["p.status_aktif = 'AKTIF'"];
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
  const candidates = pegawaiRows
    .map((row) => evaluatePegawai(row, params, asOf))
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .filter((k) => k.bulanMenujuPeriode !== null && k.bulanMenujuPeriode <= rentangBulan)
    .sort((a, b) => (a.bulanMenujuPeriode ?? 999) - (b.bulanMenujuPeriode ?? 999));

  await writeAuditLog(c.env.DB, {
    user: authUser,
    aksi: "EXPORT",
    entityType: "USULAN_KENAIKAN_PANGKAT",
    deskripsi: `Export laporan usulan kenaikan pangkat (${format}), ${candidates.length} pegawai, rentang ${rentangBulan} bulan.`,
  });

  const headers = ["NIP", "Nama", "Unit Kerja", "Jenis Kenaikan", "Gol/Ruang Saat Ini", "Pangkat Saat Ini", "TMT Pangkat", "Sudah Memenuhi Syarat", "Proyeksi Periode", "Angka Kredit Kumulatif", "Kekurangan Angka Kredit"];
  const rows = candidates.map((k) => [
    k.pegawai.nip,
    k.pegawai.nama,
    k.pegawai.unit_kerja_nama,
    k.jenisKenaikan === "REGULER" ? "Reguler" : "Pilihan/Fungsional",
    k.pegawai.golongan_ruang_aktif,
    k.pegawai.nama_pangkat_aktif,
    k.pegawai.tmt_pangkat_aktif,
    k.memenuhiSyarat ? "Ya" : "Belum",
    k.proyeksiPeriodeBerikutnya,
    k.angkaKreditKumulatif,
    k.angkaKreditGap,
  ]);

  if (format === "pdf") {
    const bytes = await buildTableReportPdf({
      title: "Daftar Usulan Kenaikan Pangkat",
      subtitle: `Rentang proyeksi: ${rentangBulan} bulan ke depan — Total: ${candidates.length} pegawai`,
      columns: [
        { label: "NIP", width: 95 },
        { label: "Nama", width: 120 },
        { label: "Unit Kerja", width: 100 },
        { label: "Jenis", width: 75 },
        { label: "Gol/Ruang", width: 55 },
        { label: "Pangkat", width: 85 },
        { label: "TMT Pangkat", width: 65 },
        { label: "Memenuhi Syarat", width: 65 },
        { label: "Proyeksi Periode", width: 65 },
        { label: "AK Kumulatif", width: 55 },
        { label: "Kekurangan AK", width: 55 },
      ],
      rows,
      generatedBy: authUser.username,
    });
    return pdfResponse(bytes, "usulan-kenaikan-pangkat.pdf");
  }

  const buffer = buildExcelWorkbook("Usulan Kenaikan Pangkat", headers, rows);
  return excelResponse(buffer, "usulan-kenaikan-pangkat.xlsx");
});
