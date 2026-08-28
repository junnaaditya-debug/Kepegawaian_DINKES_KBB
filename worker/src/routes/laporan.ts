import { Hono } from "hono";
import type { Env, Variables } from "../types";
import { authMiddleware, unitScopeFilter } from "../middleware/auth";
import { buildWorkbook } from "../lib/excel";
import { buildTablePdf } from "../lib/pdf";
import { logAktivitas } from "../lib/audit";
import { getDeteksiKenaikanPangkat } from "../lib/kenaikanPangkat";

const route = new Hono<{ Bindings: Env; Variables: Variables }>();
route.use("*", authMiddleware);

async function fetchKenaikanPangkatRows(c: any) {
  const user = c.get("user");
  const q = c.req.query();
  let unitKerjaId = q.unitKerjaId ? Number(q.unitKerjaId) : undefined;
  const scope = unitScopeFilter(user);
  if (scope) unitKerjaId = Number(scope.param);
  return getDeteksiKenaikanPangkat(c.env, {
    rentangBulan: parseInt(q.rentangBulan ?? "6", 10),
    jenis: q.jenis,
    unitKerjaId,
    jenisKepegawaian: q.jenisKepegawaian,
    golongan: q.golongan,
    status: q.status,
    periodeTahun: q.periodeTahun ? Number(q.periodeTahun) : undefined,
    periodeBulan: q.periodeBulan ? Number(q.periodeBulan) : undefined,
    tanggalPengusulanDari: q.tanggalPengusulanDari,
    tanggalPengusulanSampai: q.tanggalPengusulanSampai,
  });
}

route.get("/pegawai/excel", async (c) => {
  const user = c.get("user");
  const q = c.req.query();
  const scope = unitScopeFilter(user);
  const clauses: string[] = ["p.status_aktif = 'aktif'"];
  const params: unknown[] = [];
  if (scope) {
    clauses.push(scope.sql);
    params.push(scope.param);
  }
  if (q.unitKerjaId) {
    clauses.push("p.unit_kerja_id = ?");
    params.push(q.unitKerjaId);
  }
  const { results } = await c.env.DB.prepare(
    `SELECT p.nip, p.nama, uk.nama as unit_kerja, p.jenis_jabatan, p.jabatan_nama_display,
            p.golongan_ruang_aktif, p.nama_pangkat_aktif, p.tmt_pangkat_aktif, p.status_kepegawaian
     FROM pegawai p JOIN unit_kerja uk ON uk.id = p.unit_kerja_id
     WHERE ${clauses.join(" AND ")} ORDER BY p.nama`
  )
    .bind(...params)
    .all<any>();

  const buffer = buildWorkbook([
    {
      name: "Data Pegawai",
      headers: ["NIP", "Nama", "Unit Kerja", "Jenis Jabatan", "Jabatan", "Golongan", "Pangkat", "TMT Pangkat", "Status Kepegawaian"],
      rows: results.map((r: any) => [r.nip, r.nama, r.unit_kerja, r.jenis_jabatan, r.jabatan_nama_display, r.golongan_ruang_aktif, r.nama_pangkat_aktif, r.tmt_pangkat_aktif, r.status_kepegawaian]),
    },
  ]);

  await logAktivitas(c.env, user, "export", "pegawai", null, { format: "excel", rows: results.length }, c.get("requestIp"));
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="data-pegawai-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
});

route.get("/pegawai/pdf", async (c) => {
  const user = c.get("user");
  const scope = unitScopeFilter(user);
  const clauses: string[] = ["p.status_aktif = 'aktif'"];
  const params: unknown[] = [];
  if (scope) {
    clauses.push(scope.sql);
    params.push(scope.param);
  }
  const { results } = await c.env.DB.prepare(
    `SELECT p.nip, p.nama, uk.nama as unit_kerja, p.jabatan_nama_display, p.golongan_ruang_aktif, p.nama_pangkat_aktif
     FROM pegawai p JOIN unit_kerja uk ON uk.id = p.unit_kerja_id
     WHERE ${clauses.join(" AND ")} ORDER BY p.nama`
  )
    .bind(...params)
    .all<any>();

  const pdfBytes = await buildTablePdf({
    title: "Daftar Pegawai — Dinas Kesehatan Kabupaten Bandung Barat",
    subtitle: `Total: ${results.length} pegawai aktif`,
    columns: [
      { header: "NIP", key: "nip", width: 110 },
      { header: "Nama", key: "nama", width: 180 },
      { header: "Unit Kerja", key: "unit_kerja", width: 160 },
      { header: "Jabatan", key: "jabatan_nama_display", width: 160 },
      { header: "Golongan", key: "golongan_ruang_aktif", width: 70 },
      { header: "Pangkat", key: "nama_pangkat_aktif", width: 120 },
    ],
    rows: results,
    generatedBy: user.fullName,
  });

  await logAktivitas(c.env, user, "export", "pegawai", null, { format: "pdf", rows: results.length }, c.get("requestIp"));
  return new Response(pdfBytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="data-pegawai-${new Date().toISOString().slice(0, 10)}.pdf"`,
    },
  });
});

route.get("/kenaikan-pangkat/excel", async (c) => {
  const data = await fetchKenaikanPangkatRows(c);
  const user = c.get("user");

  const buffer = buildWorkbook([
    {
      name: "Usulan Kenaikan Pangkat",
      headers: ["NIP", "Nama", "Unit Kerja", "Jenis Kenaikan", "Golongan Saat Ini", "Golongan Berikutnya", "Periode", "Status", "Tanggal Pengusulan", "Diverifikasi Atasan"],
      rows: data.map((r) => [r.nip, r.nama, r.unitKerjaNama, r.jenisKenaikan, r.golonganSaatIni, r.golonganBerikutnya, r.periodeLabel, r.status, r.tanggalPengusulan, r.diverifikasiAtasan ? "Ya" : "Belum"]),
    },
  ]);

  await logAktivitas(c.env, user, "export", "kenaikan_pangkat", null, { format: "excel", rows: data.length }, c.get("requestIp"));
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="usulan-kenaikan-pangkat-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
});

route.get("/kenaikan-pangkat/pdf", async (c) => {
  const data = await fetchKenaikanPangkatRows(c);
  const user = c.get("user");

  const pdfBytes = await buildTablePdf({
    title: "Daftar Usulan Kenaikan Pangkat — Dinas Kesehatan Kabupaten Bandung Barat",
    subtitle: `Total: ${data.length} pegawai`,
    columns: [
      { header: "NIP", key: "nip", width: 100 },
      { header: "Nama", key: "nama", width: 150 },
      { header: "Unit Kerja", key: "unitKerjaNama", width: 130 },
      { header: "Jenis", key: "jenisKenaikan", width: 70 },
      { header: "Gol. Saat Ini", key: "golonganSaatIni", width: 70 },
      { header: "Gol. Berikutnya", key: "golonganBerikutnya", width: 80 },
      { header: "Periode", key: "periodeLabel", width: 90 },
      { header: "Status", key: "status", width: 90 },
      { header: "Tgl. Pengusulan", key: "tanggalPengusulan", width: 90 },
    ],
    rows: data as unknown as Record<string, string | number | null>[],
    generatedBy: user.fullName,
  });

  await logAktivitas(c.env, user, "export", "kenaikan_pangkat", null, { format: "pdf", rows: data.length }, c.get("requestIp"));
  return new Response(pdfBytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="usulan-kenaikan-pangkat-${new Date().toISOString().slice(0, 10)}.pdf"`,
    },
  });
});

export default route;
