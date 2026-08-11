import { Router } from "express";
import { prisma } from "../utils/prisma";
import { asyncHandler } from "../utils/AppError";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();
router.use(requireAuth, requireRole("SUPER_ADMIN", "ADMIN_KEPEGAWAIAN"));

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { entitas, userId, page = "1", pageSize = "50" } = req.query as Record<string, string>;
    const where: any = {};
    if (entitas) where.entitas = entitas;
    if (userId) where.userId = userId;

    const take = Math.min(Number(pageSize) || 50, 200);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

    const [total, data] = await Promise.all([
      prisma.logAktivitas.count({ where }),
      prisma.logAktivitas.findMany({
        where,
        include: { user: { select: { id: true, nama: true, username: true } } },
        orderBy: { createdAt: "desc" },
        take,
        skip,
      }),
    ]);

    res.json({ data, total, page: Number(page) || 1, pageSize: take });
  })
);

export default router;
