import { Router } from "express";
import bcrypt from "bcryptjs";
import { body } from "express-validator";
import { prisma } from "../utils/prisma";
import { asyncHandler, AppError } from "../utils/AppError";
import { requireAuth, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { catatAudit } from "../utils/audit";

const router = Router();
router.use(requireAuth, requireRole("SUPER_ADMIN"));

const SELECT_FIELDS = {
  id: true,
  username: true,
  email: true,
  nama: true,
  role: true,
  unitKerjaId: true,
  pegawaiId: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  unitKerja: { select: { id: true, nama: true } },
} as const;

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const data = await prisma.user.findMany({ select: SELECT_FIELDS, orderBy: { nama: "asc" } });
    res.json(data);
  })
);

router.post(
  "/",
  [
    body("username").isLength({ min: 3 }),
    body("password").isLength({ min: 8 }),
    body("nama").notEmpty(),
    body("role").isIn(["SUPER_ADMIN", "ADMIN_KEPEGAWAIAN", "KEPALA_BIDANG", "KEPALA_DINAS", "PEGAWAI"]),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { username, password, email, nama, role, unitKerjaId, pegawaiId } = req.body;
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) throw new AppError(409, "Username sudah digunakan");
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { username, passwordHash, email: email || null, nama, role, unitKerjaId: unitKerjaId || null, pegawaiId: pegawaiId || null },
      select: SELECT_FIELDS,
    });
    await catatAudit({ userId: req.user!.id, aksi: "CREATE", entitas: "User", entitasId: user.id, dataSesudah: user });
    res.status(201).json(user);
  })
);

router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError(404, "User tidak ditemukan");
    const { email, nama, role, unitKerjaId, pegawaiId, isActive } = req.body;
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { email: email ?? undefined, nama: nama ?? undefined, role: role ?? undefined, unitKerjaId: unitKerjaId ?? undefined, pegawaiId: pegawaiId ?? undefined, isActive: isActive ?? undefined },
      select: SELECT_FIELDS,
    });
    await catatAudit({ userId: req.user!.id, aksi: "UPDATE", entitas: "User", entitasId: user.id, dataSebelum: existing, dataSesudah: user });
    res.json(user);
  })
);

router.post(
  "/:id/reset-password",
  [body("newPassword").isLength({ min: 8 })],
  validate,
  asyncHandler(async (req, res) => {
    const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError(404, "User tidak ditemukan");
    const passwordHash = await bcrypt.hash(req.body.newPassword, 10);
    await prisma.user.update({ where: { id: req.params.id }, data: { passwordHash } });
    await catatAudit({ userId: req.user!.id, aksi: "RESET_PASSWORD", entitas: "User", entitasId: existing.id });
    res.json({ message: "Password berhasil direset" });
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError(404, "User tidak ditemukan");
    if (existing.id === req.user!.id) throw new AppError(400, "Tidak dapat menghapus akun sendiri");
    await prisma.user.delete({ where: { id: req.params.id } });
    await catatAudit({ userId: req.user!.id, aksi: "DELETE", entitas: "User", entitasId: existing.id, dataSebelum: { ...existing, passwordHash: undefined } });
    res.status(204).send();
  })
);

export default router;
