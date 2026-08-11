import { Router } from "express";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { prisma } from "../utils/prisma";
import { asyncHandler } from "../utils/AppError";
import { requireAuth } from "../middleware/auth";
import { deteksiKenaikanPangkat } from "../services/promotionEngine";
import { catatAudit } from "../utils/audit";

const router = Router();
router.use(requireAuth);

const BULAN_LABEL = [
  "", "Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

async function ambilKandidat(req: any) {
  const { bulanKeDepan, unitKerjaId, jenisKenaikan } = req.query as Record<string, string>;
  let kandidat = await deteksiKenaikanPangkat({ bulanKeDepan: bulanKeDepan ? Number(bulanKeDepan) : undefined, unitKerjaId });
  if (req.user!.role === "KEPALA_BIDANG" && req.user!.unitKerjaId) {
    kandidat = kandidat.filter((k) => k.unitKerjaId === req.user!.unitKerjaId);
  }
  if (jenisKenaikan) kandidat = kandidat.filter((k) => k.jenisKenaikan === jenisKenaikan);
  kandidat.sort((a, b) => a.proyeksiPeriode.tahun - b.proyeksiPeriode.tahun || a.proyeksiPeriode.bulan - b.proyeksiPeriode.bulan || a.nama.localeCompare(b.nama));
  return kandidat;
}

// FR-6.2, FR-6.3: laporan usulan kenaikan pangkat, export Excel.
router.get(
  "/kenaikan-pangkat/excel",
  asyncHandler(async (req, res) => {
    const kandidat = await ambilKandidat(req);

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
        tmt: k.golonganTmt.toISOString().slice(0, 10),
        masaKerja: k.masaKerjaTahun ?? "-",
        ak: k.angkaKreditKumulatif ?? "-",
        akButuh: k.angkaKreditDibutuhkan ?? "-",
        skp: k.predikatSkpTerakhir ?? "-",
        periode: `${BULAN_LABEL[k.proyeksiPeriode.bulan]} ${k.proyeksiPeriode.tahun}`,
        status: k.statusTindakLanjut,
      });
    });

    await catatAudit({ userId: req.user!.id, aksi: "EXPORT", entitas: "LaporanKenaikanPangkat", deskripsi: `Export Excel ${kandidat.length} baris` });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="laporan-kenaikan-pangkat-${Date.now()}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  })
);

// FR-6.2, FR-6.3: laporan usulan kenaikan pangkat, export PDF siap cetak.
router.get(
  "/kenaikan-pangkat/pdf",
  asyncHandler(async (req, res) => {
    const kandidat = await ambilKandidat(req);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="laporan-kenaikan-pangkat-${Date.now()}.pdf"`);

    const doc = new PDFDocument({ margin: 30, size: "A4", layout: "landscape" });
    doc.pipe(res);

    doc.fontSize(14).text("Daftar Usulan Kenaikan Pangkat", { align: "center" });
    doc.fontSize(10).text("SIMPEG-DINKES KBB - Dinas Kesehatan Kabupaten Bandung Barat", { align: "center" });
    doc.moveDown();
    doc.fontSize(9).text(`Dicetak: ${new Date().toLocaleString("id-ID")}`, { align: "right" });
    doc.moveDown();

    const colWidths = [25, 70, 120, 110, 70, 60, 60, 60, 70, 60];
    const headers = ["No", "NIP", "Nama", "Unit Kerja", "Jenis", "Golongan", "Masa Kerja", "AK", "Periode", "Status"];
    let y = doc.y;
    let x = doc.x;

    const drawRow = (values: string[], bold = false) => {
      doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(8);
      let cx = x;
      values.forEach((v, i) => {
        doc.text(v, cx, y, { width: colWidths[i], ellipsis: true });
        cx += colWidths[i];
      });
      y += 16;
      if (y > doc.page.height - 40) {
        doc.addPage();
        y = 40;
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
        k.angkaKreditKumulatif != null ? String(k.angkaKreditKumulatif) : "-",
        `${BULAN_LABEL[k.proyeksiPeriode.bulan]} ${k.proyeksiPeriode.tahun}`,
        k.statusTindakLanjut,
      ]);
    });

    await catatAudit({ userId: req.user!.id, aksi: "EXPORT", entitas: "LaporanKenaikanPangkat", deskripsi: `Export PDF ${kandidat.length} baris` });

    doc.end();
  })
);

// FR-1.7 export daftar pegawai
router.get(
  "/pegawai/excel",
  asyncHandler(async (req, res) => {
    const data = await prisma.pegawai.findMany({
      include: { unitKerja: true, riwayatPangkatGolongan: { where: { isAktif: true }, take: 1 }, riwayatJabatan: { where: { isAktif: true }, take: 1 } },
      orderBy: { nama: "asc" },
    });

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
    data.forEach((p, i) => {
      sheet.addRow({
        no: i + 1,
        nip: p.nip,
        nama: p.nama,
        jk: p.jenisKelamin,
        status: p.statusKepegawaian,
        unit: p.unitKerja?.nama || "-",
        golongan: p.riwayatPangkatGolongan[0]?.golonganRuang || "-",
        jabatan: p.riwayatJabatan[0]?.namaJabatan || "-",
        aktif: p.statusAktif,
      });
    });

    await catatAudit({ userId: req.user!.id, aksi: "EXPORT", entitas: "Pegawai", deskripsi: `Export Excel daftar pegawai (${data.length} baris)` });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="daftar-pegawai-${Date.now()}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  })
);

export default router;
