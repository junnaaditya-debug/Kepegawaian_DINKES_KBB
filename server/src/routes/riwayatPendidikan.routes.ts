import { Router } from "express";
import { body } from "express-validator";
import { prisma } from "../utils/prisma";
import { asyncHandler, AppError } from "../utils/AppError";
import { requireAuth, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { catatAudit } from "../utils/audit";

const router = Router();
router.use(requireAuth);

router.get(
  "/:pegawaiId/riwayat-pendidikan",
  asyncHandler(async (req, res) => {
    const data = await prisma.riwayatPendidikan.findMany({
      where: { pegawaiId: req.params.pegawaiId },
      orderBy: { tahunLulus: "desc" },
      include: { dokumen: true },
    });
    res.json(data);
  })
);

router.post(
  "/:pegawaiId/riwayat-pendidikan",
  requireRole("SUPER_ADMIN", "ADMIN_KEPEGAWAIAN"),
  [body("jenjang").notEmpty()],
  validate,
  asyncHandler(async (req, res) => {
    const pegawai = await prisma.pegawai.findUnique({ where: { id: req.params.pegawaiId } });
    if (!pegawai) throw new AppError(404, "Pegawai tidak ditemukan");
    const created = await prisma.riwayatPendidikan.create({
      data: {
        pegawaiId: req.params.pegawaiId,
        jenjang: req.body.jenjang,
        jurusan: req.body.jurusan || null,
        namaInstitusi: req.body.namaInstitusi || null,
        tahunLulus: req.body.tahunLulus ? Number(req.body.tahunLulus) : null,
        nomorIjazah: req.body.nomorIjazah || null,
        dokumenId: req.body.dokumenId || null,
      },
    });
    await catatAudit({ userId: req.user!.id, aksi: "CREATE", entitas: "RiwayatPendidikan", entitasId: created.id, dataSesudah: created });
    res.status(201).json(created);
  })
);

router.put(
  "/:pegawaiId/riwayat-pendidikan/:id",
  requireRole("SUPER_ADMIN", "ADMIN_KEPEGAWAIAN"),
  asyncHandler(async (req, res) => {
    const existing = await prisma.riwayatPendidikan.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.pegawaiId !== req.params.pegawaiId) throw new AppError(404, "Riwayat pendidikan tidak ditemukan");
    const data: any = { ...req.body };
    delete data.pegawaiId;
    if (data.tahunLulus) data.tahunLulus = Number(data.tahunLulus);
    const updated = await prisma.riwayatPendidikan.update({ where: { id: req.params.id }, data });
    await catatAudit({ userId: req.user!.id, aksi: "UPDATE", entitas: "RiwayatPendidikan", entitasId: updated.id, dataSebelum: existing, dataSesudah: updated });
    res.json(updated);
  })
);

router.delete(
  "/:pegawaiId/riwayat-pendidikan/:id",
  requireRole("SUPER_ADMIN", "ADMIN_KEPEGAWAIAN"),
  asyncHandler(async (req, res) => {
    const existing = await prisma.riwayatPendidikan.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.pegawaiId !== req.params.pegawaiId) throw new AppError(404, "Riwayat pendidikan tidak ditemukan");
    await prisma.riwayatPendidikan.delete({ where: { id: req.params.id } });
    await catatAudit({ userId: req.user!.id, aksi: "DELETE", entitas: "RiwayatPendidikan", entitasId: existing.id, dataSebelum: existing });
    res.status(204).send();
  })
);

export default router;
