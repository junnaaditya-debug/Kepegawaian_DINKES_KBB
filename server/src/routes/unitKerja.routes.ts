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
  "/",
  asyncHandler(async (_req, res) => {
    const data = await prisma.unitKerja.findMany({
      orderBy: { nama: "asc" },
      include: { parent: { select: { id: true, nama: true } }, _count: { select: { pegawai: true } } },
    });
    res.json(data);
  })
);

router.post(
  "/",
  requireRole("SUPER_ADMIN", "ADMIN_KEPEGAWAIAN"),
  [body("nama").notEmpty(), body("jenis").notEmpty()],
  validate,
  asyncHandler(async (req, res) => {
    const { nama, jenis, alamat, parentId } = req.body;
    const unit = await prisma.unitKerja.create({ data: { nama, jenis, alamat, parentId: parentId || null } });
    await catatAudit({ userId: req.user!.id, aksi: "CREATE", entitas: "UnitKerja", entitasId: unit.id, dataSesudah: unit });
    res.status(201).json(unit);
  })
);

router.put(
  "/:id",
  requireRole("SUPER_ADMIN", "ADMIN_KEPEGAWAIAN"),
  asyncHandler(async (req, res) => {
    const existing = await prisma.unitKerja.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError(404, "Unit kerja tidak ditemukan");
    const { nama, jenis, alamat, parentId } = req.body;
    const unit = await prisma.unitKerja.update({
      where: { id: req.params.id },
      data: { nama, jenis, alamat, parentId: parentId || null },
    });
    await catatAudit({
      userId: req.user!.id,
      aksi: "UPDATE",
      entitas: "UnitKerja",
      entitasId: unit.id,
      dataSebelum: existing,
      dataSesudah: unit,
    });
    res.json(unit);
  })
);

router.delete(
  "/:id",
  requireRole("SUPER_ADMIN"),
  asyncHandler(async (req, res) => {
    const existing = await prisma.unitKerja.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError(404, "Unit kerja tidak ditemukan");
    await prisma.unitKerja.delete({ where: { id: req.params.id } });
    await catatAudit({ userId: req.user!.id, aksi: "DELETE", entitas: "UnitKerja", entitasId: existing.id, dataSebelum: existing });
    res.status(204).send();
  })
);

export default router;
