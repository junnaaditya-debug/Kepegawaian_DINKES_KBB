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
  "/:pegawaiId/nilai-skp",
  asyncHandler(async (req, res) => {
    const data = await prisma.nilaiSkp.findMany({ where: { pegawaiId: req.params.pegawaiId }, orderBy: { tahun: "desc" } });
    res.json(data);
  })
);

router.post(
  "/:pegawaiId/nilai-skp",
  requireRole("SUPER_ADMIN", "ADMIN_KEPEGAWAIAN"),
  [body("tahun").isInt(), body("predikat").isIn(["SANGAT_BAIK", "BAIK", "CUKUP", "KURANG", "SANGAT_KURANG"])],
  validate,
  asyncHandler(async (req, res) => {
    const pegawai = await prisma.pegawai.findUnique({ where: { id: req.params.pegawaiId } });
    if (!pegawai) throw new AppError(404, "Pegawai tidak ditemukan");
    const created = await prisma.nilaiSkp.upsert({
      where: { pegawaiId_tahun: { pegawaiId: req.params.pegawaiId, tahun: Number(req.body.tahun) } },
      update: { predikat: req.body.predikat, nilaiAngka: req.body.nilaiAngka != null ? Number(req.body.nilaiAngka) : null, keterangan: req.body.keterangan || null },
      create: {
        pegawaiId: req.params.pegawaiId,
        tahun: Number(req.body.tahun),
        predikat: req.body.predikat,
        nilaiAngka: req.body.nilaiAngka != null ? Number(req.body.nilaiAngka) : null,
        keterangan: req.body.keterangan || null,
      },
    });
    await catatAudit({ userId: req.user!.id, aksi: "UPSERT", entitas: "NilaiSkp", entitasId: created.id, dataSesudah: created });
    res.status(201).json(created);
  })
);

router.delete(
  "/:pegawaiId/nilai-skp/:id",
  requireRole("SUPER_ADMIN", "ADMIN_KEPEGAWAIAN"),
  asyncHandler(async (req, res) => {
    const existing = await prisma.nilaiSkp.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.pegawaiId !== req.params.pegawaiId) throw new AppError(404, "Nilai SKP tidak ditemukan");
    await prisma.nilaiSkp.delete({ where: { id: req.params.id } });
    await catatAudit({ userId: req.user!.id, aksi: "DELETE", entitas: "NilaiSkp", entitasId: existing.id, dataSebelum: existing });
    res.status(204).send();
  })
);

export default router;
