import { Router } from "express";
import { body } from "express-validator";
import { prisma } from "../utils/prisma";
import { asyncHandler, AppError } from "../utils/AppError";
import { requireAuth, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { catatAudit } from "../utils/audit";
import { getPeriodeTerdekat } from "../services/promotionEngine";

const router = Router();
router.use(requireAuth);

router.get(
  "/:pegawaiId/riwayat-pangkat",
  asyncHandler(async (req, res) => {
    const data = await prisma.riwayatPangkatGolongan.findMany({
      where: { pegawaiId: req.params.pegawaiId },
      orderBy: { tmt: "desc" },
      include: { dokumen: true },
    });
    res.json(data);
  })
);

/**
 * Input riwayat pangkat baru = input SK Kenaikan Pangkat baru.
 * FR-2.1, FR-4.6, BR-6: mengarsipkan riwayat lama (isAktif=false), mengaktifkan yang baru,
 * dan menandai status usulan kenaikan pangkat periode terkait menjadi SK_TERBIT.
 */
router.post(
  "/:pegawaiId/riwayat-pangkat",
  requireRole("SUPER_ADMIN", "ADMIN_KEPEGAWAIAN"),
  [body("golonganRuang").notEmpty(), body("namaPangkat").notEmpty(), body("tmt").isISO8601()],
  validate,
  asyncHandler(async (req, res) => {
    const pegawai = await prisma.pegawai.findUnique({ where: { id: req.params.pegawaiId } });
    if (!pegawai) throw new AppError(404, "Pegawai tidak ditemukan");

    const tmt = new Date(req.body.tmt);

    const result = await prisma.$transaction(async (tx) => {
      await tx.riwayatPangkatGolongan.updateMany({
        where: { pegawaiId: req.params.pegawaiId, isAktif: true },
        data: { isAktif: false },
      });

      const created = await tx.riwayatPangkatGolongan.create({
        data: {
          pegawaiId: req.params.pegawaiId,
          golonganRuang: req.body.golonganRuang,
          namaPangkat: req.body.namaPangkat,
          tmt,
          nomorSk: req.body.nomorSk || null,
          tanggalSk: req.body.tanggalSk ? new Date(req.body.tanggalSk) : null,
          pejabatPenetap: req.body.pejabatPenetap || null,
          dokumenId: req.body.dokumenId || null,
          isAktif: true,
        },
      });

      const periode = await getPeriodeTerdekat(tmt);
      await tx.statusUsulanKenaikanPangkat.updateMany({
        where: {
          pegawaiId: req.params.pegawaiId,
          periodeTahun: periode.tahun,
          periodeBulan: periode.bulan,
          status: { not: "SK_TERBIT" },
        },
        data: { status: "SK_TERBIT", updatedById: req.user!.id },
      });

      return created;
    });

    await catatAudit({ userId: req.user!.id, aksi: "CREATE", entitas: "RiwayatPangkatGolongan", entitasId: result.id, dataSesudah: result });
    res.status(201).json(result);
  })
);

router.put(
  "/:pegawaiId/riwayat-pangkat/:id",
  requireRole("SUPER_ADMIN", "ADMIN_KEPEGAWAIAN"),
  asyncHandler(async (req, res) => {
    const existing = await prisma.riwayatPangkatGolongan.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.pegawaiId !== req.params.pegawaiId) throw new AppError(404, "Riwayat pangkat tidak ditemukan");
    const data: any = { ...req.body };
    delete data.pegawaiId;
    delete data.isAktif;
    if (data.tmt) data.tmt = new Date(data.tmt);
    if (data.tanggalSk) data.tanggalSk = new Date(data.tanggalSk);
    const updated = await prisma.riwayatPangkatGolongan.update({ where: { id: req.params.id }, data });
    await catatAudit({ userId: req.user!.id, aksi: "UPDATE", entitas: "RiwayatPangkatGolongan", entitasId: updated.id, dataSebelum: existing, dataSesudah: updated });
    res.json(updated);
  })
);

router.delete(
  "/:pegawaiId/riwayat-pangkat/:id",
  requireRole("SUPER_ADMIN"),
  asyncHandler(async (req, res) => {
    const existing = await prisma.riwayatPangkatGolongan.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.pegawaiId !== req.params.pegawaiId) throw new AppError(404, "Riwayat pangkat tidak ditemukan");
    if (existing.isAktif) throw new AppError(400, "Riwayat pangkat aktif tidak dapat dihapus. Hapus riwayat non-aktif atau input riwayat baru.");
    await prisma.riwayatPangkatGolongan.delete({ where: { id: req.params.id } });
    await catatAudit({ userId: req.user!.id, aksi: "DELETE", entitas: "RiwayatPangkatGolongan", entitasId: existing.id, dataSebelum: existing });
    res.status(204).send();
  })
);

export default router;
