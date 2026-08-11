-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'ADMIN_KEPEGAWAIAN', 'KEPALA_BIDANG', 'KEPALA_DINAS', 'PEGAWAI');

-- CreateEnum
CREATE TYPE "JenisKelamin" AS ENUM ('L', 'P');

-- CreateEnum
CREATE TYPE "StatusKepegawaian" AS ENUM ('CPNS', 'PNS', 'PPPK');

-- CreateEnum
CREATE TYPE "StatusAktifPegawai" AS ENUM ('AKTIF', 'PENSIUN', 'MUTASI_KELUAR', 'MENINGGAL', 'CUTI_DI_LUAR_TANGGUNGAN', 'NON_AKTIF_LAINNYA');

-- CreateEnum
CREATE TYPE "JenisJabatan" AS ENUM ('STRUKTURAL', 'FUNGSIONAL_TERTENTU', 'PELAKSANA');

-- CreateEnum
CREATE TYPE "JenisKenaikanPangkat" AS ENUM ('REGULER', 'FUNGSIONAL', 'PILIHAN');

-- CreateEnum
CREATE TYPE "StatusTindakLanjut" AS ENUM ('BELUM_DIPROSES', 'SEDANG_DIUSULKAN', 'SK_TERBIT', 'DITUNDA');

-- CreateEnum
CREATE TYPE "JenisDokumen" AS ENUM ('SK_CPNS', 'SK_PNS', 'SK_PANGKAT', 'IJAZAH', 'SERTIFIKAT_DIKLAT', 'PAK', 'SKP', 'USULAN_KENAIKAN_PANGKAT', 'FOTO', 'LAINNYA');

-- CreateEnum
CREATE TYPE "PredikatSkp" AS ENUM ('SANGAT_BAIK', 'BAIK', 'CUKUP', 'KURANG', 'SANGAT_KURANG');

-- CreateEnum
CREATE TYPE "JenjangFungsional" AS ENUM ('PEMULA', 'TERAMPIL', 'MAHIR', 'PENYELIA', 'AHLI_PERTAMA', 'AHLI_MUDA', 'AHLI_MADYA', 'AHLI_UTAMA');

-- CreateTable
CREATE TABLE "UnitKerja" (
    "id" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "jenis" TEXT NOT NULL,
    "alamat" TEXT,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnitKerja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT,
    "passwordHash" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "unitKerjaId" TEXT,
    "pegawaiId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pegawai" (
    "id" TEXT NOT NULL,
    "nip" TEXT NOT NULL,
    "nipLama" TEXT,
    "nama" TEXT NOT NULL,
    "gelarDepan" TEXT,
    "gelarBelakang" TEXT,
    "tempatLahir" TEXT,
    "tanggalLahir" TIMESTAMP(3),
    "jenisKelamin" "JenisKelamin" NOT NULL,
    "alamat" TEXT,
    "noHp" TEXT,
    "email" TEXT,
    "fotoUrl" TEXT,
    "agama" TEXT,
    "statusKepegawaian" "StatusKepegawaian" NOT NULL,
    "tmtCpns" TIMESTAMP(3),
    "tmtPns" TIMESTAMP(3),
    "statusAktif" "StatusAktifPegawai" NOT NULL DEFAULT 'AKTIF',
    "tanggalNonAktif" TIMESTAMP(3),
    "keteranganNonAktif" TEXT,
    "unitKerjaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "Pegawai_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiwayatPendidikan" (
    "id" TEXT NOT NULL,
    "pegawaiId" TEXT NOT NULL,
    "jenjang" TEXT NOT NULL,
    "jurusan" TEXT,
    "namaInstitusi" TEXT,
    "tahunLulus" INTEGER,
    "nomorIjazah" TEXT,
    "dokumenId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiwayatPendidikan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiwayatJabatan" (
    "id" TEXT NOT NULL,
    "pegawaiId" TEXT NOT NULL,
    "jenisJabatan" "JenisJabatan" NOT NULL,
    "namaJabatan" TEXT NOT NULL,
    "jenjangJabatan" "JenjangFungsional",
    "unitKerjaId" TEXT,
    "tmtJabatan" TIMESTAMP(3) NOT NULL,
    "tglSelesai" TIMESTAMP(3),
    "isAktif" BOOLEAN NOT NULL DEFAULT true,
    "nomorSk" TEXT,
    "tanggalSk" TIMESTAMP(3),
    "dokumenId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiwayatJabatan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiwayatPangkatGolongan" (
    "id" TEXT NOT NULL,
    "pegawaiId" TEXT NOT NULL,
    "golonganRuang" TEXT NOT NULL,
    "namaPangkat" TEXT NOT NULL,
    "tmt" TIMESTAMP(3) NOT NULL,
    "nomorSk" TEXT,
    "tanggalSk" TIMESTAMP(3),
    "pejabatPenetap" TEXT,
    "isAktif" BOOLEAN NOT NULL DEFAULT true,
    "dokumenId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiwayatPangkatGolongan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AngkaKredit" (
    "id" TEXT NOT NULL,
    "pegawaiId" TEXT NOT NULL,
    "nomorPak" TEXT NOT NULL,
    "tanggalPak" TIMESTAMP(3) NOT NULL,
    "periodePenilaianAwal" TIMESTAMP(3) NOT NULL,
    "periodePenilaianAkhir" TIMESTAMP(3) NOT NULL,
    "angkaKreditKumulatif" DOUBLE PRECISION NOT NULL,
    "unsurUtama" DOUBLE PRECISION,
    "unsurPengembanganProfesi" DOUBLE PRECISION,
    "unsurPenunjang" DOUBLE PRECISION,
    "dokumenId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AngkaKredit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NilaiSkp" (
    "id" TEXT NOT NULL,
    "pegawaiId" TEXT NOT NULL,
    "tahun" INTEGER NOT NULL,
    "predikat" "PredikatSkp" NOT NULL,
    "nilaiAngka" DOUBLE PRECISION,
    "keterangan" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NilaiSkp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParameterAturan" (
    "id" SERIAL NOT NULL,
    "masaKerjaMinimumTahun" INTEGER NOT NULL DEFAULT 4,
    "predikatSkpMinimum" "PredikatSkp" NOT NULL DEFAULT 'BAIK',
    "reminderBulanSebelum1" INTEGER NOT NULL DEFAULT 6,
    "reminderBulanSebelum2" INTEGER NOT NULL DEFAULT 3,
    "wajibValidasiSkp" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "ParameterAturan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PeriodeKenaikanPangkat" (
    "id" TEXT NOT NULL,
    "bulan" INTEGER NOT NULL,
    "tanggal" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "aktif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "PeriodeKenaikanPangkat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JenisJabatanFungsional" (
    "id" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "rumpun" TEXT,

    CONSTRAINT "JenisJabatanFungsional_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParameterJenjangAngkaKredit" (
    "id" TEXT NOT NULL,
    "jenisJabatanFungsionalId" TEXT NOT NULL,
    "jenjang" "JenjangFungsional" NOT NULL,
    "golonganRuang" TEXT NOT NULL,
    "angkaKreditMinimum" DOUBLE PRECISION NOT NULL,
    "urutan" INTEGER NOT NULL,

    CONSTRAINT "ParameterJenjangAngkaKredit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatusUsulanKenaikanPangkat" (
    "id" TEXT NOT NULL,
    "pegawaiId" TEXT NOT NULL,
    "periodeTahun" INTEGER NOT NULL,
    "periodeBulan" INTEGER NOT NULL,
    "jenisKenaikan" "JenisKenaikanPangkat" NOT NULL,
    "status" "StatusTindakLanjut" NOT NULL DEFAULT 'BELUM_DIPROSES',
    "catatan" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StatusUsulanKenaikanPangkat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dokumen" (
    "id" TEXT NOT NULL,
    "pegawaiId" TEXT,
    "jenisDokumen" "JenisDokumen" NOT NULL,
    "namaFile" TEXT NOT NULL,
    "namaAsli" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "ukuran" INTEGER NOT NULL,
    "versi" INTEGER NOT NULL DEFAULT 1,
    "dokumenIndukId" TEXT,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Dokumen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notifikasi" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "judul" TEXT NOT NULL,
    "pesan" TEXT NOT NULL,
    "jenis" TEXT NOT NULL,
    "link" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notifikasi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogAktivitas" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "aksi" TEXT NOT NULL,
    "entitas" TEXT NOT NULL,
    "entitasId" TEXT,
    "deskripsi" TEXT,
    "dataSebelum" JSONB,
    "dataSesudah" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LogAktivitas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_pegawaiId_key" ON "User"("pegawaiId");

-- CreateIndex
CREATE UNIQUE INDEX "Pegawai_nip_key" ON "Pegawai"("nip");

-- CreateIndex
CREATE INDEX "Pegawai_nama_idx" ON "Pegawai"("nama");

-- CreateIndex
CREATE INDEX "Pegawai_statusAktif_idx" ON "Pegawai"("statusAktif");

-- CreateIndex
CREATE UNIQUE INDEX "RiwayatPendidikan_dokumenId_key" ON "RiwayatPendidikan"("dokumenId");

-- CreateIndex
CREATE UNIQUE INDEX "RiwayatJabatan_dokumenId_key" ON "RiwayatJabatan"("dokumenId");

-- CreateIndex
CREATE INDEX "RiwayatJabatan_pegawaiId_isAktif_idx" ON "RiwayatJabatan"("pegawaiId", "isAktif");

-- CreateIndex
CREATE UNIQUE INDEX "RiwayatPangkatGolongan_dokumenId_key" ON "RiwayatPangkatGolongan"("dokumenId");

-- CreateIndex
CREATE INDEX "RiwayatPangkatGolongan_pegawaiId_isAktif_idx" ON "RiwayatPangkatGolongan"("pegawaiId", "isAktif");

-- CreateIndex
CREATE UNIQUE INDEX "AngkaKredit_dokumenId_key" ON "AngkaKredit"("dokumenId");

-- CreateIndex
CREATE INDEX "AngkaKredit_pegawaiId_idx" ON "AngkaKredit"("pegawaiId");

-- CreateIndex
CREATE UNIQUE INDEX "NilaiSkp_pegawaiId_tahun_key" ON "NilaiSkp"("pegawaiId", "tahun");

-- CreateIndex
CREATE UNIQUE INDEX "JenisJabatanFungsional_nama_key" ON "JenisJabatanFungsional"("nama");

-- CreateIndex
CREATE UNIQUE INDEX "ParameterJenjangAngkaKredit_jenisJabatanFungsionalId_jenjan_key" ON "ParameterJenjangAngkaKredit"("jenisJabatanFungsionalId", "jenjang");

-- CreateIndex
CREATE INDEX "StatusUsulanKenaikanPangkat_periodeTahun_periodeBulan_idx" ON "StatusUsulanKenaikanPangkat"("periodeTahun", "periodeBulan");

-- CreateIndex
CREATE UNIQUE INDEX "StatusUsulanKenaikanPangkat_pegawaiId_periodeTahun_periodeB_key" ON "StatusUsulanKenaikanPangkat"("pegawaiId", "periodeTahun", "periodeBulan", "jenisKenaikan");

-- CreateIndex
CREATE INDEX "Dokumen_pegawaiId_idx" ON "Dokumen"("pegawaiId");

-- CreateIndex
CREATE INDEX "Notifikasi_userId_isRead_idx" ON "Notifikasi"("userId", "isRead");

-- CreateIndex
CREATE INDEX "LogAktivitas_entitas_entitasId_idx" ON "LogAktivitas"("entitas", "entitasId");

-- CreateIndex
CREATE INDEX "LogAktivitas_userId_idx" ON "LogAktivitas"("userId");

-- CreateIndex
CREATE INDEX "LogAktivitas_createdAt_idx" ON "LogAktivitas"("createdAt");

-- AddForeignKey
ALTER TABLE "UnitKerja" ADD CONSTRAINT "UnitKerja_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "UnitKerja"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_unitKerjaId_fkey" FOREIGN KEY ("unitKerjaId") REFERENCES "UnitKerja"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_pegawaiId_fkey" FOREIGN KEY ("pegawaiId") REFERENCES "Pegawai"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pegawai" ADD CONSTRAINT "Pegawai_unitKerjaId_fkey" FOREIGN KEY ("unitKerjaId") REFERENCES "UnitKerja"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiwayatPendidikan" ADD CONSTRAINT "RiwayatPendidikan_pegawaiId_fkey" FOREIGN KEY ("pegawaiId") REFERENCES "Pegawai"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiwayatPendidikan" ADD CONSTRAINT "RiwayatPendidikan_dokumenId_fkey" FOREIGN KEY ("dokumenId") REFERENCES "Dokumen"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiwayatJabatan" ADD CONSTRAINT "RiwayatJabatan_pegawaiId_fkey" FOREIGN KEY ("pegawaiId") REFERENCES "Pegawai"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiwayatJabatan" ADD CONSTRAINT "RiwayatJabatan_unitKerjaId_fkey" FOREIGN KEY ("unitKerjaId") REFERENCES "UnitKerja"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiwayatJabatan" ADD CONSTRAINT "RiwayatJabatan_dokumenId_fkey" FOREIGN KEY ("dokumenId") REFERENCES "Dokumen"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiwayatPangkatGolongan" ADD CONSTRAINT "RiwayatPangkatGolongan_pegawaiId_fkey" FOREIGN KEY ("pegawaiId") REFERENCES "Pegawai"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiwayatPangkatGolongan" ADD CONSTRAINT "RiwayatPangkatGolongan_dokumenId_fkey" FOREIGN KEY ("dokumenId") REFERENCES "Dokumen"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AngkaKredit" ADD CONSTRAINT "AngkaKredit_pegawaiId_fkey" FOREIGN KEY ("pegawaiId") REFERENCES "Pegawai"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AngkaKredit" ADD CONSTRAINT "AngkaKredit_dokumenId_fkey" FOREIGN KEY ("dokumenId") REFERENCES "Dokumen"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NilaiSkp" ADD CONSTRAINT "NilaiSkp_pegawaiId_fkey" FOREIGN KEY ("pegawaiId") REFERENCES "Pegawai"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParameterJenjangAngkaKredit" ADD CONSTRAINT "ParameterJenjangAngkaKredit_jenisJabatanFungsionalId_fkey" FOREIGN KEY ("jenisJabatanFungsionalId") REFERENCES "JenisJabatanFungsional"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatusUsulanKenaikanPangkat" ADD CONSTRAINT "StatusUsulanKenaikanPangkat_pegawaiId_fkey" FOREIGN KEY ("pegawaiId") REFERENCES "Pegawai"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatusUsulanKenaikanPangkat" ADD CONSTRAINT "StatusUsulanKenaikanPangkat_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dokumen" ADD CONSTRAINT "Dokumen_pegawaiId_fkey" FOREIGN KEY ("pegawaiId") REFERENCES "Pegawai"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dokumen" ADD CONSTRAINT "Dokumen_dokumenIndukId_fkey" FOREIGN KEY ("dokumenIndukId") REFERENCES "Dokumen"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dokumen" ADD CONSTRAINT "Dokumen_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notifikasi" ADD CONSTRAINT "Notifikasi_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogAktivitas" ADD CONSTRAINT "LogAktivitas_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
