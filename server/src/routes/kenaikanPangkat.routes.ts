import { Router } from "express";
import { body } from "express-validator";
import { prisma } from "../utils/prisma";
import { asyncHandler, AppError } from "../utils/AppError";
import { requireAuth, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { catatAudit } from "../utils/audit";
import { deteksiKenaikanPangkat } from "../services/promotionEngine";

const router = Router();
router.use(requireAuth);

// FR-4.1, FR-4.2, FR-4.3, FR-4.4: daftar deteksi kenaikan pangkat dengan filter.
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { bulanKeDepan, unitKerjaId, jenisKenaikan, status } = req.query as Record<string, string>;

    let kandidat = await deteksiKenaikanPangkat({
      bulanKeDepan: bulanKeDepan ? Number(bulanKeDepan) : undefined,
      unitKerjaId,
    });

    if (req.user!.role === "KEPALA_BIDANG" && req.user!.unitKerjaId) {
      kandidat = kandidat.filter((k) => k.unitKerjaId === req.user!.unitKerjaId);
    }
    if (jenisKenaikan) kandidat = kandidat.filter((k) => k.jenisKenaikan === jenisKenaikan);
    if (status) kandidat = kandidat.filter((k) => k.statusTindakLanjut === status);

    kandidat.sort((a, b) => a.proyeksiPeriode.tahun - b.proyeksiPeriode.tahun || a.proyeksiPeriode.bulan - b.proyeksiPeriode.bulan || a.nama.localeCompare(b.nama));

    res.json({ data: kandidat, total: kandidat.length });
  })
);

// FR-4.5: tandai status tindak lanjut per pegawai.
router.put(
  "/status",
  requireRole("SUPER_ADMIN", "ADMIN_KEPEGAWAIAN"),
  [
    body("pegawaiId").notEmpty(),
    body("periodeTahun").isInt(),
    body("periodeBulan").isInt(),
    body("jenisKenaikan").isIn(["REGULER", "FUNGSIONAL", "PILIHAN"]),
    body("status").isIn(["BELUM_DIPROSES", "SEDANG_DIUSULKAN", "SK_TERBIT", "DITUNDA"]),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { pegawaiId, periodeTahun, periodeBulan, jenisKenaikan, status, catatan } = req.body;

    const pegawai = await prisma.pegawai.findUnique({ where: { id: pegawaiId } });
    if (!pegawai) throw new AppError(404, "Pegawai tidak ditemukan");

    const existing = await prisma.statusUsulanKenaikanPangkat.findUnique({
      where: { pegawaiId_periodeTahun_periodeBulan_jenisKenaikan: { pegawaiId, periodeTahun, periodeBulan, jenisKenaikan } },
    });

    const result = await prisma.statusUsulanKenaikanPangkat.upsert({
      where: { pegawaiId_periodeTahun_periodeBulan_jenisKenaikan: { pegawaiId, periodeTahun, periodeBulan, jenisKenaikan } },
      update: { status, catatan, updatedById: req.user!.id },
      create: { pegawaiId, periodeTahun, periodeBulan, jenisKenaikan, status, catatan, updatedById: req.user!.id },
    });

    await catatAudit({
      userId: req.user!.id,
      aksi: "UPDATE_STATUS",
      entitas: "StatusUsulanKenaikanPangkat",
      entitasId: result.id,
      dataSebelum: existing,
      dataSesudah: result,
      deskripsi: `Status kenaikan pangkat ${pegawai.nama} diubah menjadi ${status}`,
    });

    res.json(result);
  })
);

export default router;
