import { Router } from "express";
import { body } from "express-validator";
import { prisma } from "../utils/prisma";
import { asyncHandler, AppError } from "../utils/AppError";
import { requireAuth, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { catatAudit } from "../utils/audit";

const router = Router();
router.use(requireAuth);

// ---- Parameter aturan umum (masa kerja, predikat SKP, reminder) ----
router.get(
  "/aturan",
  asyncHandler(async (_req, res) => {
    let parameter = await prisma.parameterAturan.findFirst();
    if (!parameter) {
      parameter = await prisma.parameterAturan.create({ data: {} });
    }
    res.json(parameter);
  })
);

router.put(
  "/aturan",
  requireRole("SUPER_ADMIN"),
  [
    body("masaKerjaMinimumTahun").isInt({ min: 1 }),
    body("predikatSkpMinimum").isIn(["SANGAT_BAIK", "BAIK", "CUKUP", "KURANG", "SANGAT_KURANG"]),
    body("reminderBulanSebelum1").isInt({ min: 0 }),
    body("reminderBulanSebelum2").isInt({ min: 0 }),
  ],
  validate,
  asyncHandler(async (req, res) => {
    let existing = await prisma.parameterAturan.findFirst();
    if (!existing) existing = await prisma.parameterAturan.create({ data: {} });

    const updated = await prisma.parameterAturan.update({
      where: { id: existing.id },
      data: {
        masaKerjaMinimumTahun: Number(req.body.masaKerjaMinimumTahun),
        predikatSkpMinimum: req.body.predikatSkpMinimum,
        reminderBulanSebelum1: Number(req.body.reminderBulanSebelum1),
        reminderBulanSebelum2: Number(req.body.reminderBulanSebelum2),
        wajibValidasiSkp: !!req.body.wajibValidasiSkp,
        updatedBy: req.user!.id,
      },
    });
    await catatAudit({ userId: req.user!.id, aksi: "UPDATE", entitas: "ParameterAturan", entitasId: String(updated.id), dataSebelum: existing, dataSesudah: updated });
    res.json(updated);
  })
);

// ---- Periode kenaikan pangkat (BR-1) ----
router.get(
  "/periode",
  asyncHandler(async (_req, res) => {
    const data = await prisma.periodeKenaikanPangkat.findMany({ orderBy: [{ bulan: "asc" }, { tanggal: "asc" }] });
    res.json(data);
  })
);

router.post(
  "/periode",
  requireRole("SUPER_ADMIN"),
  [body("bulan").isInt({ min: 1, max: 12 }), body("tanggal").isInt({ min: 1, max: 31 }), body("label").notEmpty()],
  validate,
  asyncHandler(async (req, res) => {
    const created = await prisma.periodeKenaikanPangkat.create({
      data: { bulan: Number(req.body.bulan), tanggal: Number(req.body.tanggal), label: req.body.label, aktif: req.body.aktif ?? true },
    });
    await catatAudit({ userId: req.user!.id, aksi: "CREATE", entitas: "PeriodeKenaikanPangkat", entitasId: created.id, dataSesudah: created });
    res.status(201).json(created);
  })
);

router.put(
  "/periode/:id",
  requireRole("SUPER_ADMIN"),
  asyncHandler(async (req, res) => {
    const existing = await prisma.periodeKenaikanPangkat.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError(404, "Periode tidak ditemukan");
    const updated = await prisma.periodeKenaikanPangkat.update({
      where: { id: req.params.id },
      data: { bulan: req.body.bulan ?? undefined, tanggal: req.body.tanggal ?? undefined, label: req.body.label ?? undefined, aktif: req.body.aktif ?? undefined },
    });
    await catatAudit({ userId: req.user!.id, aksi: "UPDATE", entitas: "PeriodeKenaikanPangkat", entitasId: updated.id, dataSebelum: existing, dataSesudah: updated });
    res.json(updated);
  })
);

router.delete(
  "/periode/:id",
  requireRole("SUPER_ADMIN"),
  asyncHandler(async (req, res) => {
    const existing = await prisma.periodeKenaikanPangkat.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError(404, "Periode tidak ditemukan");
    await prisma.periodeKenaikanPangkat.delete({ where: { id: req.params.id } });
    await catatAudit({ userId: req.user!.id, aksi: "DELETE", entitas: "PeriodeKenaikanPangkat", entitasId: existing.id, dataSebelum: existing });
    res.status(204).send();
  })
);

// ---- Jenis jabatan fungsional & ambang batas angka kredit per jenjang (BR-3) ----
router.get(
  "/jabatan-fungsional",
  asyncHandler(async (_req, res) => {
    const data = await prisma.jenisJabatanFungsional.findMany({
      orderBy: { nama: "asc" },
      include: { jenjangAngkaKredit: { orderBy: { urutan: "asc" } } },
    });
    res.json(data);
  })
);

router.post(
  "/jabatan-fungsional",
  requireRole("SUPER_ADMIN"),
  [body("nama").notEmpty()],
  validate,
  asyncHandler(async (req, res) => {
    const created = await prisma.jenisJabatanFungsional.create({ data: { nama: req.body.nama, rumpun: req.body.rumpun || null } });
    await catatAudit({ userId: req.user!.id, aksi: "CREATE", entitas: "JenisJabatanFungsional", entitasId: created.id, dataSesudah: created });
    res.status(201).json(created);
  })
);

router.delete(
  "/jabatan-fungsional/:id",
  requireRole("SUPER_ADMIN"),
  asyncHandler(async (req, res) => {
    const existing = await prisma.jenisJabatanFungsional.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError(404, "Jenis jabatan fungsional tidak ditemukan");
    await prisma.jenisJabatanFungsional.delete({ where: { id: req.params.id } });
    await catatAudit({ userId: req.user!.id, aksi: "DELETE", entitas: "JenisJabatanFungsional", entitasId: existing.id, dataSebelum: existing });
    res.status(204).send();
  })
);

router.post(
  "/jabatan-fungsional/:id/jenjang",
  requireRole("SUPER_ADMIN"),
  [body("jenjang").notEmpty(), body("golonganRuang").notEmpty(), body("angkaKreditMinimum").isFloat({ min: 0 }), body("urutan").isInt({ min: 0 })],
  validate,
  asyncHandler(async (req, res) => {
    const jenis = await prisma.jenisJabatanFungsional.findUnique({ where: { id: req.params.id } });
    if (!jenis) throw new AppError(404, "Jenis jabatan fungsional tidak ditemukan");
    const created = await prisma.parameterJenjangAngkaKredit.create({
      data: {
        jenisJabatanFungsionalId: req.params.id,
        jenjang: req.body.jenjang,
        golonganRuang: req.body.golonganRuang,
        angkaKreditMinimum: Number(req.body.angkaKreditMinimum),
        urutan: Number(req.body.urutan),
      },
    });
    await catatAudit({ userId: req.user!.id, aksi: "CREATE", entitas: "ParameterJenjangAngkaKredit", entitasId: created.id, dataSesudah: created });
    res.status(201).json(created);
  })
);

router.put(
  "/jenjang/:id",
  requireRole("SUPER_ADMIN"),
  asyncHandler(async (req, res) => {
    const existing = await prisma.parameterJenjangAngkaKredit.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError(404, "Jenjang angka kredit tidak ditemukan");
    const updated = await prisma.parameterJenjangAngkaKredit.update({
      where: { id: req.params.id },
      data: {
        jenjang: req.body.jenjang ?? undefined,
        golonganRuang: req.body.golonganRuang ?? undefined,
        angkaKreditMinimum: req.body.angkaKreditMinimum != null ? Number(req.body.angkaKreditMinimum) : undefined,
        urutan: req.body.urutan != null ? Number(req.body.urutan) : undefined,
      },
    });
    await catatAudit({ userId: req.user!.id, aksi: "UPDATE", entitas: "ParameterJenjangAngkaKredit", entitasId: updated.id, dataSebelum: existing, dataSesudah: updated });
    res.json(updated);
  })
);

router.delete(
  "/jenjang/:id",
  requireRole("SUPER_ADMIN"),
  asyncHandler(async (req, res) => {
    const existing = await prisma.parameterJenjangAngkaKredit.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError(404, "Jenjang angka kredit tidak ditemukan");
    await prisma.parameterJenjangAngkaKredit.delete({ where: { id: req.params.id } });
    await catatAudit({ userId: req.user!.id, aksi: "DELETE", entitas: "ParameterJenjangAngkaKredit", entitasId: existing.id, dataSebelum: existing });
    res.status(204).send();
  })
);

export default router;
