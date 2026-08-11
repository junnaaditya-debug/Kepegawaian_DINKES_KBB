import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { body } from "express-validator";
import { prisma } from "../utils/prisma";
import { asyncHandler, AppError } from "../utils/AppError";
import { validate } from "../middleware/validate";
import { catatAudit } from "../utils/audit";
import { requireAuth } from "../middleware/auth";

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET as string;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "8h";

router.post(
  "/login",
  [body("username").notEmpty(), body("password").notEmpty()],
  validate,
  asyncHandler(async (req, res) => {
    const { username, password } = req.body;
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user || !user.isActive) {
      throw new AppError(401, "Username atau password salah");
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      await catatAudit({
        userId: user.id,
        aksi: "LOGIN_GAGAL",
        entitas: "User",
        entitasId: user.id,
        ipAddress: req.ip,
      });
      throw new AppError(401, "Username atau password salah");
    }

    const payload = {
      id: user.id,
      username: user.username,
      role: user.role,
      unitKerjaId: user.unitKerjaId,
      pegawaiId: user.pegawaiId,
    };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await catatAudit({
      userId: user.id,
      aksi: "LOGIN",
      entitas: "User",
      entitasId: user.id,
      ipAddress: req.ip,
    });

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        nama: user.nama,
        role: user.role,
        unitKerjaId: user.unitKerjaId,
        pegawaiId: user.pegawaiId,
        email: user.email,
      },
    });
  })
);

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        username: true,
        nama: true,
        role: true,
        unitKerjaId: true,
        pegawaiId: true,
        email: true,
        unitKerja: { select: { id: true, nama: true } },
      },
    });
    if (!user) throw new AppError(404, "User tidak ditemukan");
    res.json(user);
  })
);

router.post(
  "/change-password",
  requireAuth,
  [body("oldPassword").notEmpty(), body("newPassword").isLength({ min: 8 })],
  validate,
  asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) throw new AppError(404, "User tidak ditemukan");
    const valid = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!valid) throw new AppError(400, "Password lama salah");
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    await catatAudit({ userId: user.id, aksi: "GANTI_PASSWORD", entitas: "User", entitasId: user.id });
    res.json({ message: "Password berhasil diubah" });
  })
);

export default router;
