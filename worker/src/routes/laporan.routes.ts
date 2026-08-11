import { Hono } from "hono";
import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { AppEnv } from "../types";
import { pegawai, unitKerja, riwayatPangkatGolongan, riwayatJabatan } from "../db/schema";
import { requireAuth } from "../middleware/auth";
import { catatAudit } from "../utils/audit";
import { deteksiKenaikanPangkat, type KandidatKenaikanPangkat } from "../services/promotionEngine";
import { eq } from "drizzle-orm";

const app = new Hono<AppEnv>();
app.use("*", requireAuth);

const BULAN_LABEL = ["", "Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

async function ambilKandidat(c: any): Promise<KandidatKenaikanPangkat[]> {
  const db = c.get("db");
  const authUser = c.get("user");
  const { bulanKeDepan, unitKerjaId, jenisKenaikan } = c.req.query();

  let kandidat = await deteksiKenaikanPangkat(db, { bulanKeDepan: bulanKeDepan ? Number(bulanKeDepan) : undefined, unitKerjaId });
  if (authUser.role === "KEPALA_BIDANG" && authUser.unitKerjaId) {
    kandidat = kandidat.filter((k) => k.unitKerjaId === authUser.unitKerjaId);
  }
  if (jenisKenaikan) kandidat = kandidat.filter((k) => k.jenisKenaikan === jenisKenaikan);
  kandidat.sort((a, b) => a.proyeksiPeriode.tahun - b.proyeksiPeriode.tahun || a.proyeksiPeriode.bulan - b.proyeksiPeriode.bulan || a.nama.localeCompare(b.nama));
  return kandidat;
}

app.get("/kenaikan-pangkat/excel", async (c) => {
  const kandidat = await ambilKandidat(c);
  const db = c.get("db");
  const authUser = c.get("user");

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Usulan Kenaikan Pangkat");
  sheet.columns = [
    { header: "No", key: "no", width: 5 },
    { header: "NIP", key: "nip", width: 20 },
    { header: "Nama", key: "nama", width: 30 },
    { header: "Unit Kerja", key: "unitKerja", width: 25 },
    { header: "Jenis Kenaikan", key: "jenis", width: 15 },
    { header: "Golongan Saat Ini", key: "golongan", width: 15 },
    { header: "TMT Golongan", key: "tmt", width: 15 },
    { header: "Masa Kerja (thn)", key: "masaKerja", width: 15 },
    { header: "Angka Kredit", key: "ak", width: 15 },
    { header: "AK Dibutuhkan", key: "akButuh", width: 15 },
    { header: "Predikat SKP", key: "skp", width: 15 },
    { header: "Proyeksi Periode", key: "periode", width: 20 },
    { header: "Status", key: "status", width: 18 },
  ];
  sheet.getRow(1).font = { bold: true };
  kandidat.forEach((k, i) => {
    sheet.addRow({
      no: i + 1,
      nip: k.nip,
      nama: k.nama,
      unitKerja: k.unitKerjaNama || "-",
      jenis: k.jenisKenaikan,
      golongan: k.golonganSaatIni,
      tmt: k.golonganTmt.slice(0, 10),
      masaKerja: k.masaKerjaTahun ?? "-",
      ak: k.angkaKreditKumulatif ?? "-",
      akButuh: k.angkaKreditDibutuhkan ?? "-",
      skp: k.predikatSkpTerakhir ?? "-",
      periode: `${BULAN_LABEL[k.proyeksiPeriode.bulan]} ${k.proyeksiPeriode.tahun}`,
      status: k.statusTindakLanjut,
    });
  });
  const buffer = await workbook.xlsx.writeBuffer();

  await catatAudit(db, { userId: authUser.id, aksi: "EXPORT", entitas: "LaporanKenaikanPangkat", deskripsi: `Export Excel ${kandidat.length} baris` });

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="laporan-kenaikan-pangkat-${Date.now()}.xlsx"`,
    },
  });
});

app.get("/kenaikan-pangkat/pdf", async (c) => {
  const kandidat = await ambilKandidat(c);
  const db = c.get("db");
  const authUser = c.get("user");

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pageWidth = 842; // A4 landscape
  const pageHeight = 595;
  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - 40;

  const drawText = (text: string, x: number, yPos: number, opts: { bold?: boolean; size?: number } = {}) => {
    page.drawText(text, { x, y: yPos, size: opts.size ?? 8, font: opts.bold ? fontBold : font, color: rgb(0, 0, 0) });
  };

  drawText("Daftar Usulan Kenaikan Pangkat", pageWidth / 2 - 100, y, { bold: true, size: 14 });
  y -= 18;
  drawText("SIMPEG-DINKES KBB - Dinas Kesehatan Kabupaten Bandung Barat", pageWidth / 2 - 140, y, { size: 9 });
  y -= 14;
  drawText(`Dicetak: ${new Date().toLocaleString("id-ID")}`, pageWidth - 220, y, { size: 8 });
  y -= 20;

  const colX = [30, 60, 130, 250, 350, 410, 470, 540, 590, 660];
  const headers = ["No", "NIP", "Nama", "Unit Kerja", "Jenis", "Golongan", "Masa Kerja", "Periode", "Status", ""];

  const drawRow = (values: string[], bold = false) => {
    values.forEach((v, i) => drawText(v.slice(0, 26), colX[i], y, { bold }));
    y -= 14;
    if (y < 40) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - 40;
    }
  };

  drawRow(headers, true);
  kandidat.forEach((k, i) => {
    drawRow([
      String(i + 1),
      k.nip,
      k.nama,
      k.unitKerjaNama || "-",
      k.jenisKenaikan,
      k.golonganSaatIni,
      k.masaKerjaTahun != null ? `${k.masaKerjaTahun} thn` : "-",
      `${BULAN_LABEL[k.proyeksiPeriode.bulan]} ${k.proyeksiPeriode.tahun}`,
      k.statusTindakLanjut,
    ]);
  });

  const bytes = await pdfDoc.save();
  await catatAudit(db, { userId: authUser.id, aksi: "EXPORT", entitas: "LaporanKenaikanPangkat", deskripsi: `Export PDF ${kandidat.length} baris` });

  return new Response(bytes, {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="laporan-kenaikan-pangkat-${Date.now()}.pdf"` },
  });
});

app.get("/pegawai/excel", async (c) => {
  const db = c.get("db");
  const authUser = c.get("user");

  const [pegawaiRows, units, pangkatRows, jabatanRows] = await Promise.all([
    db.select().from(pegawai).orderBy(pegawai.nama),
    db.select().from(unitKerja),
    db.select().from(riwayatPangkatGolongan).where(eq(riwayatPangkatGolongan.isAktif, true)),
    db.select().from(riwayatJabatan).where(eq(riwayatJabatan.isAktif, true)),
  ]);
  const unitMap = new Map(units.map((u) => [u.id, u.nama]));
  const pangkatMap = new Map(pangkatRows.map((r) => [r.pegawaiId, r]));
  const jabatanMap = new Map(jabatanRows.map((r) => [r.pegawaiId, r]));

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Daftar Pegawai");
  sheet.columns = [
    { header: "No", key: "no", width: 5 },
    { header: "NIP", key: "nip", width: 20 },
    { header: "Nama", key: "nama", width: 30 },
    { header: "Jenis Kelamin", key: "jk", width: 12 },
    { header: "Status Kepegawaian", key: "status", width: 15 },
    { header: "Unit Kerja", key: "unit", width: 25 },
    { header: "Golongan", key: "golongan", width: 12 },
    { header: "Jabatan", key: "jabatan", width: 25 },
    { header: "Status Aktif", key: "aktif", width: 15 },
  ];
  sheet.getRow(1).font = { bold: true };
  pegawaiRows.forEach((p, i) => {
    sheet.addRow({
      no: i + 1,
      nip: p.nip,
      nama: p.nama,
      jk: p.jenisKelamin,
      status: p.statusKepegawaian,
      unit: p.unitKerjaId ? unitMap.get(p.unitKerjaId) || "-" : "-",
      golongan: pangkatMap.get(p.id)?.golonganRuang || "-",
      jabatan: jabatanMap.get(p.id)?.namaJabatan || "-",
      aktif: p.statusAktif,
    });
  });
  const buffer = await workbook.xlsx.writeBuffer();

  await catatAudit(db, { userId: authUser.id, aksi: "EXPORT", entitas: "Pegawai", deskripsi: `Export Excel daftar pegawai (${pegawaiRows.length} baris)` });

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="daftar-pegawai-${Date.now()}.xlsx"`,
    },
  });
});

export default app;
