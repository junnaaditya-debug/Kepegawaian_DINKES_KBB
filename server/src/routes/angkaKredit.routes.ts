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
  "/:pegawaiId/angka-kredit",
  asyncHandler(async (req, res) => {
    const data = await prisma.angkaKredit.findMany({
      where: { pegawaiId: req.params.pegawaiId },
      orderBy: { tanggalPak: "desc" },
      include: { dokumen: true },
    });
    res.json(data);
  })
);

router.post(
  "/:pegawaiId/angka-kredit",
  requireRole("SUPER_ADMIN", "ADMIN_KEPEGAWAIAN"),
  [
    body("nomorPak").notEmpty(),
    body("tanggalPak").isISO8601(),
    body("periodePenilaianAwal").isISO8601(),
    body("periodePenilaianAkhir").isISO8601(),
    body("angkaKreditKumulatif").isFloat({ min: 0 }),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const pegawai = await prisma.pegawai.findUnique({ where: { id: req.params.pegawaiId } });
    if (!pegawai) throw new AppError(404, "Pegawai tidak ditemukan");
    const created = await prisma.angkaKredit.create({
      data: {
        pegawaiId: req.params.pegawaiId,
        nomorPak: req.body.nomorPak,
        tanggalPak: new Date(req.body.tanggalPak),
        periodePenilaianAwal: new Date(req.body.periodePenilaianAwal),
        periodePenilaianAkhir: new Date(req.body.periodePenilaianAkhir),
        angkaKreditKumulatif: Number(req.body.angkaKreditKumulatif),
        unsurUtama: req.body.unsurUtama != null ? Number(req.body.unsurUtama) : null,
        unsurPengembanganProfesi: req.body.unsurPengembanganProfesi != null ? Number(req.body.unsurPengembanganProfesi) : null,
        unsurPenunjang: req.body.unsurPenunjang != null ? Number(req.body.unsurPenunjang) : null,
        dokumenId: req.body.dokumenId || null,
      },
    });
    await catatAudit({ userId: req.user!.id, aksi: "CREATE", entitas: "AngkaKredit", entitasId: created.id, dataSesudah: created });
    res.status(201).json(created);
  })
);

router.put(
  "/:pegawaiId/angka-kredit/:id",
  requireRole("SUPER_ADMIN", "ADMIN_KEPEGAWAIAN"),
  asyncHandler(async (req, res) => {
    const existing = await prisma.angkaKredit.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.pegawaiId !== req.params.pegawaiId) throw new AppError(404, "Data angka kredit tidak ditemukan");
    const data: any = { ...req.body };
    delete data.pegawaiId;
    if (data.tanggalPak) data.tanggalPak = new Date(data.tanggalPak);
    if (data.periodePenilaianAwal) data.periodePenilaianAwal = new Date(data.periodePenilaianAwal);
    if (data.periodePenilaianAkhir) data.periodePenilaianAkhir = new Date(data.periodePenilaianAkhir);
    if (data.angkaKreditKumulatif != null) data.angkaKreditKumulatif = Number(data.angkaKreditKumulatif);
    const updated = await prisma.angkaKredit.update({ where: { id: req.params.id }, data });
    await catatAudit({ userId: req.user!.id, aksi: "UPDATE", entitas: "AngkaKredit", entitasId: updated.id, dataSebelum: existing, dataSesudah: updated });
    res.json(updated);
  })
);

router.delete(
  "/:pegawaiId/angka-kredit/:id",
  requireRole("SUPER_ADMIN", "ADMIN_KEPEGAWAIAN"),
  asyncHandler(async (req, res) => {
    const existing = await prisma.angkaKredit.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.pegawaiId !== req.params.pegawaiId) throw new AppError(404, "Data angka kredit tidak ditemukan");
    await prisma.angkaKredit.delete({ where: { id: req.params.id } });
    await catatAudit({ userId: req.user!.id, aksi: "DELETE", entitas: "AngkaKredit", entitasId: existing.id, dataSebelum: existing });
    res.status(204).send();
  })
);

export default router;
