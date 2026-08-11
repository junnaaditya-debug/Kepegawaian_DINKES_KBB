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
  "/:pegawaiId/riwayat-jabatan",
  asyncHandler(async (req, res) => {
    const data = await prisma.riwayatJabatan.findMany({
      where: { pegawaiId: req.params.pegawaiId },
      orderBy: { tmtJabatan: "desc" },
      include: { unitKerja: true, dokumen: true },
    });
    res.json(data);
  })
);

router.post(
  "/:pegawaiId/riwayat-jabatan",
  requireRole("SUPER_ADMIN", "ADMIN_KEPEGAWAIAN"),
  [body("jenisJabatan").isIn(["STRUKTURAL", "FUNGSIONAL_TERTENTU", "PELAKSANA"]), body("namaJabatan").notEmpty(), body("tmtJabatan").isISO8601()],
  validate,
  asyncHandler(async (req, res) => {
    const pegawai = await prisma.pegawai.findUnique({ where: { id: req.params.pegawaiId } });
    if (!pegawai) throw new AppError(404, "Pegawai tidak ditemukan");

    const result = await prisma.$transaction(async (tx) => {
      await tx.riwayatJabatan.updateMany({ where: { pegawaiId: req.params.pegawaiId, isAktif: true }, data: { isAktif: false, tglSelesai: new Date(req.body.tmtJabatan) } });
      return tx.riwayatJabatan.create({
        data: {
          pegawaiId: req.params.pegawaiId,
          jenisJabatan: req.body.jenisJabatan,
          namaJabatan: req.body.namaJabatan,
          jenjangJabatan: req.body.jenjangJabatan || null,
          unitKerjaId: req.body.unitKerjaId || null,
          tmtJabatan: new Date(req.body.tmtJabatan),
          nomorSk: req.body.nomorSk || null,
          tanggalSk: req.body.tanggalSk ? new Date(req.body.tanggalSk) : null,
          dokumenId: req.body.dokumenId || null,
          isAktif: true,
        },
      });
    });

    await catatAudit({ userId: req.user!.id, aksi: "CREATE", entitas: "RiwayatJabatan", entitasId: result.id, dataSesudah: result });
    res.status(201).json(result);
  })
);

router.put(
  "/:pegawaiId/riwayat-jabatan/:id",
  requireRole("SUPER_ADMIN", "ADMIN_KEPEGAWAIAN"),
  asyncHandler(async (req, res) => {
    const existing = await prisma.riwayatJabatan.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.pegawaiId !== req.params.pegawaiId) throw new AppError(404, "Riwayat jabatan tidak ditemukan");
    const data: any = { ...req.body };
    delete data.pegawaiId;
    if (data.tmtJabatan) data.tmtJabatan = new Date(data.tmtJabatan);
    if (data.tanggalSk) data.tanggalSk = new Date(data.tanggalSk);
    const updated = await prisma.riwayatJabatan.update({ where: { id: req.params.id }, data });
    await catatAudit({ userId: req.user!.id, aksi: "UPDATE", entitas: "RiwayatJabatan", entitasId: updated.id, dataSebelum: existing, dataSesudah: updated });
    res.json(updated);
  })
);

router.delete(
  "/:pegawaiId/riwayat-jabatan/:id",
  requireRole("SUPER_ADMIN"),
  asyncHandler(async (req, res) => {
    const existing = await prisma.riwayatJabatan.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.pegawaiId !== req.params.pegawaiId) throw new AppError(404, "Riwayat jabatan tidak ditemukan");
    await prisma.riwayatJabatan.delete({ where: { id: req.params.id } });
    await catatAudit({ userId: req.user!.id, aksi: "DELETE", entitas: "RiwayatJabatan", entitasId: existing.id, dataSebelum: existing });
    res.status(204).send();
  })
);

export default router;
