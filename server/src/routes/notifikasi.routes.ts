import { Router } from "express";
import { prisma } from "../utils/prisma";
import { asyncHandler, AppError } from "../utils/AppError";
import { requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const data = await prisma.notifikasi.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    const unreadCount = await prisma.notifikasi.count({ where: { userId: req.user!.id, isRead: false } });
    res.json({ data, unreadCount });
  })
);

router.put(
  "/:id/baca",
  asyncHandler(async (req, res) => {
    const existing = await prisma.notifikasi.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.userId !== req.user!.id) throw new AppError(404, "Notifikasi tidak ditemukan");
    const updated = await prisma.notifikasi.update({ where: { id: req.params.id }, data: { isRead: true } });
    res.json(updated);
  })
);

router.put(
  "/baca-semua",
  asyncHandler(async (req, res) => {
    await prisma.notifikasi.updateMany({ where: { userId: req.user!.id, isRead: false }, data: { isRead: true } });
    res.json({ message: "Semua notifikasi ditandai sudah dibaca" });
  })
);

export default router;
