import { Router } from "express";
import fs from "fs";
import path from "path";
import { body } from "express-validator";
import { prisma } from "../utils/prisma";
import { asyncHandler, AppError } from "../utils/AppError";
import { requireAuth, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { upload, UPLOAD_DIR } from "../middleware/upload";
import { catatAudit } from "../utils/audit";

const router = Router();
router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { pegawaiId, jenisDokumen } = req.query as Record<string, string>;
    const where: any = {};
    if (pegawaiId) where.pegawaiId = pegawaiId;
    if (jenisDokumen) where.jenisDokumen = jenisDokumen;
    const data = await prisma.dokumen.findMany({ where, orderBy: { createdAt: "desc" } });
    res.json(data);
  })
);

router.post(
  "/upload",
  requireRole("SUPER_ADMIN", "ADMIN_KEPEGAWAIAN"),
  upload.single("file"),
  [body("jenisDokumen").notEmpty()],
  validate,
  asyncHandler(async (req, res) => {
    if (!req.file) throw new AppError(400, "File wajib diunggah");
    const { pegawaiId, jenisDokumen, dokumenIndukId } = req.body;

    let versi = 1;
    if (dokumenIndukId) {
      const induk = await prisma.dokumen.findUnique({ where: { id: dokumenIndukId } });
      if (!induk) throw new AppError(404, "Dokumen induk tidak ditemukan");
      const jumlahVersi = await prisma.dokumen.count({ where: { OR: [{ id: dokumenIndukId }, { dokumenIndukId }] } });
      versi = jumlahVersi + 1;
    }

    const created = await prisma.dokumen.create({
      data: {
        pegawaiId: pegawaiId || null,
        jenisDokumen,
        namaFile: req.file.filename,
        namaAsli: req.file.originalname,
        path: req.file.path,
        mimeType: req.file.mimetype,
        ukuran: req.file.size,
        versi,
        dokumenIndukId: dokumenIndukId || null,
        uploadedById: req.user!.id,
      },
    });

    await catatAudit({ userId: req.user!.id, aksi: "UPLOAD", entitas: "Dokumen", entitasId: created.id, dataSesudah: { ...created, path: undefined } });
    res.status(201).json({ ...created, url: `/uploads/${created.namaFile}` });
  })
);

router.get(
  "/:id/versi",
  asyncHandler(async (req, res) => {
    const dokumen = await prisma.dokumen.findUnique({ where: { id: req.params.id } });
    if (!dokumen) throw new AppError(404, "Dokumen tidak ditemukan");
    const rootId = dokumen.dokumenIndukId || dokumen.id;
    const data = await prisma.dokumen.findMany({
      where: { OR: [{ id: rootId }, { dokumenIndukId: rootId }] },
      orderBy: { versi: "asc" },
    });
    res.json(data.map((d) => ({ ...d, url: `/uploads/${d.namaFile}` })));
  })
);

router.delete(
  "/:id",
  requireRole("SUPER_ADMIN", "ADMIN_KEPEGAWAIAN"),
  asyncHandler(async (req, res) => {
    const existing = await prisma.dokumen.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError(404, "Dokumen tidak ditemukan");
    await prisma.dokumen.delete({ where: { id: req.params.id } });
    const filePath = path.resolve(existing.path);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await catatAudit({ userId: req.user!.id, aksi: "DELETE", entitas: "Dokumen", entitasId: existing.id, dataSebelum: { ...existing, path: undefined } });
    res.status(204).send();
  })
);

export default router;
