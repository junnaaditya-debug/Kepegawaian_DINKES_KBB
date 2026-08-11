import { Router } from "express";
import { prisma } from "../utils/prisma";
import { asyncHandler } from "../utils/AppError";
import { requireAuth } from "../middleware/auth";
import { pegawaiScopeWhere } from "../services/scope";
import { deteksiKenaikanPangkat } from "../services/promotionEngine";

const router = Router();
router.use(requireAuth);

router.get(
  "/ringkasan",
  asyncHandler(async (req, res) => {
    const scope = pegawaiScopeWhere(req.user!);

    const [totalPegawai, totalAktif, perGolongan, perJenisKelamin, perStatusKepegawaian, kandidat] = await Promise.all([
      prisma.pegawai.count({ where: scope }),
      prisma.pegawai.count({ where: { ...scope, statusAktif: "AKTIF" } }),
      prisma.riwayatPangkatGolongan.groupBy({
        by: ["golonganRuang"],
        where: { isAktif: true, pegawai: scope },
        _count: { _all: true },
      }),
      prisma.pegawai.groupBy({ by: ["jenisKelamin"], where: scope, _count: { _all: true } }),
      prisma.pegawai.groupBy({ by: ["statusKepegawaian"], where: scope, _count: { _all: true } }),
      deteksiKenaikanPangkat({ bulanKeDepan: 12, unitKerjaId: req.user!.role === "KEPALA_BIDANG" ? req.user!.unitKerjaId || undefined : undefined }),
    ]);

    const dueBerjalan = kandidat.filter((k) => {
      const now = new Date();
      return k.proyeksiPeriode.tahun === now.getFullYear() && k.proyeksiPeriode.bulan <= now.getMonth() + 1;
    }).length;

    const perJenisJabatan = await prisma.riwayatJabatan.groupBy({
      by: ["jenisJabatan"],
      where: { isAktif: true, pegawai: scope },
      _count: { _all: true },
    });

    res.json({
      totalPegawai,
      totalAktif,
      totalNonAktif: totalPegawai - totalAktif,
      perGolongan: perGolongan.map((g) => ({ golongan: g.golonganRuang, jumlah: g._count._all })),
      perJenisKelamin: perJenisKelamin.map((g) => ({ jenisKelamin: g.jenisKelamin, jumlah: g._count._all })),
      perStatusKepegawaian: perStatusKepegawaian.map((g) => ({ status: g.statusKepegawaian, jumlah: g._count._all })),
      perJenisJabatan: perJenisJabatan.map((g) => ({ jenis: g.jenisJabatan, jumlah: g._count._all })),
      dueKenaikanPangkatBerjalan: dueBerjalan,
      dueKenaikanPangkat12Bulan: kandidat.length,
    });
  })
);

export default router;
