import { Router } from "express";
import multer from "multer";
import ExcelJS from "exceljs";
import { body } from "express-validator";
import { prisma } from "../utils/prisma";
import { asyncHandler, AppError } from "../utils/AppError";
import { requireAuth, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { catatAudit } from "../utils/audit";
import { pegawaiScopeWhere } from "../services/scope";

const router = Router();
router.use(requireAuth);

const memUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { q, unitKerjaId, jenisKelamin, statusAktif, statusKepegawaian, page = "1", pageSize = "20" } = req.query as Record<string, string>;

    const where: any = { ...pegawaiScopeWhere(req.user!) };
    if (q) {
      where.OR = [
        { nama: { contains: q, mode: "insensitive" } },
        { nip: { contains: q, mode: "insensitive" } },
        { nipLama: { contains: q, mode: "insensitive" } },
      ];
    }
    if (unitKerjaId) where.unitKerjaId = unitKerjaId;
    if (jenisKelamin) where.jenisKelamin = jenisKelamin;
    if (statusAktif) where.statusAktif = statusAktif;
    if (statusKepegawaian) where.statusKepegawaian = statusKepegawaian;

    const take = Math.min(Number(pageSize) || 20, 100);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

    const [total, data] = await Promise.all([
      prisma.pegawai.count({ where }),
      prisma.pegawai.findMany({
        where,
        include: {
          unitKerja: { select: { id: true, nama: true } },
          riwayatPangkatGolongan: { where: { isAktif: true }, take: 1 },
          riwayatJabatan: { where: { isAktif: true }, take: 1 },
        },
        orderBy: { nama: "asc" },
        take,
        skip,
      }),
    ]);

    res.json({ data, total, page: Number(page) || 1, pageSize: take });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const scope = pegawaiScopeWhere(req.user!);
    const pegawai = await prisma.pegawai.findFirst({
      where: { id: req.params.id, ...scope },
      include: {
        unitKerja: true,
        riwayatPendidikan: { orderBy: { tahunLulus: "desc" }, include: { dokumen: true } },
        riwayatJabatan: { orderBy: { tmtJabatan: "desc" }, include: { unitKerja: true, dokumen: true } },
        riwayatPangkatGolongan: { orderBy: { tmt: "desc" }, include: { dokumen: true } },
        angkaKredit: { orderBy: { tanggalPak: "desc" }, include: { dokumen: true } },
        nilaiSkp: { orderBy: { tahun: "desc" } },
        dokumen: { orderBy: { createdAt: "desc" } },
        statusUsulanKenaikanPangkat: { orderBy: [{ periodeTahun: "desc" }, { periodeBulan: "desc" }] },
      },
    });
    if (!pegawai) throw new AppError(404, "Pegawai tidak ditemukan");
    res.json(pegawai);
  })
);

const pegawaiValidators = [
  body("nip").isLength({ min: 8 }).withMessage("NIP wajib diisi minimal 8 karakter"),
  body("nama").notEmpty().withMessage("Nama wajib diisi"),
  body("jenisKelamin").isIn(["L", "P"]),
  body("statusKepegawaian").isIn(["CPNS", "PNS", "PPPK"]),
];

router.post(
  "/",
  requireRole("SUPER_ADMIN", "ADMIN_KEPEGAWAIAN"),
  pegawaiValidators,
  validate,
  asyncHandler(async (req, res) => {
    const existing = await prisma.pegawai.findUnique({ where: { nip: req.body.nip } });
    if (existing) throw new AppError(409, "NIP sudah terdaftar");

    const data = { ...req.body, createdBy: req.user!.id, updatedBy: req.user!.id };
    if (data.tanggalLahir) data.tanggalLahir = new Date(data.tanggalLahir);
    if (data.tmtCpns) data.tmtCpns = new Date(data.tmtCpns);
    if (data.tmtPns) data.tmtPns = new Date(data.tmtPns);

    const pegawai = await prisma.pegawai.create({ data });
    await catatAudit({ userId: req.user!.id, aksi: "CREATE", entitas: "Pegawai", entitasId: pegawai.id, dataSesudah: pegawai });
    res.status(201).json(pegawai);
  })
);

router.put(
  "/:id",
  requireRole("SUPER_ADMIN", "ADMIN_KEPEGAWAIAN"),
  asyncHandler(async (req, res) => {
    const existing = await prisma.pegawai.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError(404, "Pegawai tidak ditemukan");

    const data: any = { ...req.body, updatedBy: req.user!.id };
    delete data.id;
    delete data.nip; // NIP tidak dapat diubah lewat endpoint update umum
    if (data.tanggalLahir) data.tanggalLahir = new Date(data.tanggalLahir);
    if (data.tmtCpns) data.tmtCpns = new Date(data.tmtCpns);
    if (data.tmtPns) data.tmtPns = new Date(data.tmtPns);
    if (data.tanggalNonAktif) data.tanggalNonAktif = new Date(data.tanggalNonAktif);

    const pegawai = await prisma.pegawai.update({ where: { id: req.params.id }, data });
    await catatAudit({
      userId: req.user!.id,
      aksi: "UPDATE",
      entitas: "Pegawai",
      entitasId: pegawai.id,
      dataSebelum: existing,
      dataSesudah: pegawai,
    });
    res.json(pegawai);
  })
);

router.delete(
  "/:id",
  requireRole("SUPER_ADMIN"),
  asyncHandler(async (req, res) => {
    const existing = await prisma.pegawai.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError(404, "Pegawai tidak ditemukan");
    await prisma.pegawai.delete({ where: { id: req.params.id } });
    await catatAudit({ userId: req.user!.id, aksi: "DELETE", entitas: "Pegawai", entitasId: existing.id, dataSebelum: existing });
    res.status(204).send();
  })
);

// Bulk import dari Excel (.xlsx). Kolom yang diharapkan pada baris header:
// nip, nipLama, nama, jenisKelamin, statusKepegawaian, tmtCpns, tmtPns, unitKerjaNama
router.post(
  "/import",
  requireRole("SUPER_ADMIN", "ADMIN_KEPEGAWAIAN"),
  memUpload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new AppError(400, "File Excel wajib diunggah");

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new AppError(400, "File Excel kosong");

    const header = (sheet.getRow(1).values as any[]).map((v) => String(v || "").trim().toLowerCase());
    const colIndex = (name: string) => header.findIndex((h) => h === name.toLowerCase());

    const idxNip = colIndex("nip");
    const idxNama = colIndex("nama");
    if (idxNip === -1 || idxNama === -1) {
      throw new AppError(400, "Kolom 'nip' dan 'nama' wajib ada pada file Excel");
    }
    const idxNipLama = colIndex("nipLama");
    const idxJenisKelamin = colIndex("jenisKelamin");
    const idxStatusKepegawaian = colIndex("statusKepegawaian");
    const idxUnitKerjaNama = colIndex("unitKerjaNama");

    const unitKerjaList = await prisma.unitKerja.findMany();
    const unitByName = new Map(unitKerjaList.map((u) => [u.nama.toLowerCase(), u.id]));

    let sukses = 0;
    const gagal: { baris: number; alasan: string }[] = [];

    for (let rowIdx = 2; rowIdx <= sheet.rowCount; rowIdx++) {
      const row = sheet.getRow(rowIdx);
      const nip = String(row.getCell(idxNip).value || "").trim();
      const nama = String(row.getCell(idxNama).value || "").trim();
      if (!nip || !nama) continue;

      try {
        const jenisKelamin = idxJenisKelamin > -1 ? String(row.getCell(idxJenisKelamin).value || "L").trim().toUpperCase() : "L";
        const statusKepegawaian = idxStatusKepegawaian > -1 ? String(row.getCell(idxStatusKepegawaian).value || "PNS").trim().toUpperCase() : "PNS";
        const unitKerjaNama = idxUnitKerjaNama > -1 ? String(row.getCell(idxUnitKerjaNama).value || "").trim() : "";
        const unitKerjaId = unitKerjaNama ? unitByName.get(unitKerjaNama.toLowerCase()) : undefined;

        await prisma.pegawai.upsert({
          where: { nip },
          update: { nama },
          create: {
            nip,
            nipLama: idxNipLama > -1 ? String(row.getCell(idxNipLama).value || "") || null : null,
            nama,
            jenisKelamin: (["L", "P"].includes(jenisKelamin) ? jenisKelamin : "L") as any,
            statusKepegawaian: (["CPNS", "PNS", "PPPK"].includes(statusKepegawaian) ? statusKepegawaian : "PNS") as any,
            unitKerjaId: unitKerjaId || null,
            createdBy: req.user!.id,
            updatedBy: req.user!.id,
          },
        });
        sukses++;
      } catch (e: any) {
        gagal.push({ baris: rowIdx, alasan: e.message || "Gagal menyimpan" });
      }
    }

    await catatAudit({
      userId: req.user!.id,
      aksi: "IMPORT",
      entitas: "Pegawai",
      deskripsi: `Import massal: ${sukses} sukses, ${gagal.length} gagal`,
    });

    res.json({ sukses, gagal });
  })
);

export default router;
