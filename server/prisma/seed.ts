import { PrismaClient, JenjangFungsional } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/**
 * CATATAN PENTING (lihat PRD Bagian 6 & 15): Nilai ambang batas angka kredit dan masa kerja
 * di bawah ini adalah PLACEHOLDER berbasis pola umum kenaikan pangkat ASN. Bagian kepegawaian
 * Dinkes KBB WAJIB memvalidasi & menyesuaikan nilai ini melalui halaman Pengaturan Parameter
 * sebelum sistem digunakan untuk produksi, sesuai regulasi BKN/PANRB yang berlaku saat ini.
 */

async function main() {
  console.log("Seeding data awal SIMPEG-DINKES KBB...");

  // ---- Unit Kerja ----
  const dinasInduk = await prisma.unitKerja.upsert({
    where: { id: "unit-dinas-induk" },
    update: {},
    create: { id: "unit-dinas-induk", nama: "Dinas Kesehatan Kabupaten Bandung Barat (Induk)", jenis: "DINAS_INDUK" },
  });

  const puskesmasNames = ["Puskesmas Lembang", "Puskesmas Cisarua", "Puskesmas Padalarang", "Puskesmas Batujajar", "Puskesmas Cililin"];
  const puskesmasList = [];
  for (const nama of puskesmasNames) {
    const unit = await prisma.unitKerja.upsert({
      where: { id: `unit-${nama.toLowerCase().replace(/\s+/g, "-")}` },
      update: {},
      create: { id: `unit-${nama.toLowerCase().replace(/\s+/g, "-")}`, nama, jenis: "PUSKESMAS", parentId: dinasInduk.id },
    });
    puskesmasList.push(unit);
  }

  // ---- Parameter Aturan (BR-1 s.d BR-4) ----
  const existingParameter = await prisma.parameterAturan.findFirst();
  if (!existingParameter) {
    await prisma.parameterAturan.create({
      data: { masaKerjaMinimumTahun: 4, predikatSkpMinimum: "BAIK", reminderBulanSebelum1: 6, reminderBulanSebelum2: 3, wajibValidasiSkp: true },
    });
  }

  // ---- Periode Kenaikan Pangkat (BR-1: umumnya 1 April & 1 Oktober) ----
  const periodeExisting = await prisma.periodeKenaikanPangkat.count();
  if (periodeExisting === 0) {
    await prisma.periodeKenaikanPangkat.createMany({
      data: [
        { bulan: 4, tanggal: 1, label: "Periode April" },
        { bulan: 10, tanggal: 1, label: "Periode Oktober" },
      ],
    });
  }

  // ---- Jenis Jabatan Fungsional Kesehatan & ambang batas angka kredit (BR-3, PLACEHOLDER) ----
  const jenjangTemplate: { jenjang: JenjangFungsional; golongan: string; ak: number; urutan: number }[] = [
    { jenjang: "AHLI_PERTAMA", golongan: "III/a", ak: 0, urutan: 1 },
    { jenjang: "AHLI_MUDA", golongan: "III/c", ak: 100, urutan: 2 },
    { jenjang: "AHLI_MADYA", golongan: "IV/a", ak: 200, urutan: 3 },
    { jenjang: "AHLI_UTAMA", golongan: "IV/d", ak: 550, urutan: 4 },
  ];

  const jabatanFungsionalNames = ["Dokter", "Dokter Gigi", "Perawat", "Bidan", "Apoteker", "Epidemiolog Kesehatan", "Sanitarian", "Nutrisionis"];
  for (const nama of jabatanFungsionalNames) {
    const jenis = await prisma.jenisJabatanFungsional.upsert({
      where: { nama },
      update: {},
      create: { nama, rumpun: "Kesehatan" },
    });
    const jumlahJenjang = await prisma.parameterJenjangAngkaKredit.count({ where: { jenisJabatanFungsionalId: jenis.id } });
    if (jumlahJenjang === 0) {
      await prisma.parameterJenjangAngkaKredit.createMany({
        data: jenjangTemplate.map((t) => ({
          jenisJabatanFungsionalId: jenis.id,
          jenjang: t.jenjang,
          golonganRuang: t.golongan,
          angkaKreditMinimum: t.ak,
          urutan: t.urutan,
        })),
      });
    }
  }

  // ---- User Super Admin & Admin Kepegawaian ----
  const superAdminPassword = process.env.SEED_SUPERADMIN_PASSWORD || "SimpegKBB#2026";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "AdminKepeg#2026";

  await prisma.user.upsert({
    where: { username: "superadmin" },
    update: {},
    create: {
      username: "superadmin",
      email: "superadmin@dinkeskbb.local",
      passwordHash: await bcrypt.hash(superAdminPassword, 10),
      nama: "Super Administrator",
      role: "SUPER_ADMIN",
    },
  });

  await prisma.user.upsert({
    where: { username: "admin.kepegawaian" },
    update: {},
    create: {
      username: "admin.kepegawaian",
      email: "admin.kepegawaian@dinkeskbb.local",
      passwordHash: await bcrypt.hash(adminPassword, 10),
      nama: "Admin Sub-Bagian Kepegawaian",
      role: "ADMIN_KEPEGAWAIAN",
      unitKerjaId: dinasInduk.id,
    },
  });

  await prisma.user.upsert({
    where: { username: "kadis" },
    update: {},
    create: {
      username: "kadis",
      email: "kadis@dinkeskbb.local",
      passwordHash: await bcrypt.hash(adminPassword, 10),
      nama: "Kepala Dinas Kesehatan KBB",
      role: "KEPALA_DINAS",
    },
  });

  // ---- Contoh data pegawai untuk demo ----
  const contohPegawai = await prisma.pegawai.upsert({
    where: { nip: "198501012010012001" },
    update: {},
    create: {
      nip: "198501012010012001",
      nama: "Contoh Pegawai Demo",
      jenisKelamin: "P",
      statusKepegawaian: "PNS",
      tmtCpns: new Date("2010-01-01"),
      tmtPns: new Date("2011-01-01"),
      statusAktif: "AKTIF",
      unitKerjaId: puskesmasList[0]?.id,
    },
  });

  const punyaRiwayatPangkat = await prisma.riwayatPangkatGolongan.count({ where: { pegawaiId: contohPegawai.id } });
  if (punyaRiwayatPangkat === 0) {
    await prisma.riwayatPangkatGolongan.create({
      data: {
        pegawaiId: contohPegawai.id,
        golonganRuang: "III/b",
        namaPangkat: "Penata Muda Tingkat I",
        tmt: new Date("2021-04-01"),
        nomorSk: "SK-CONTOH/001",
        isAktif: true,
      },
    });
  }

  const punyaRiwayatJabatan = await prisma.riwayatJabatan.count({ where: { pegawaiId: contohPegawai.id } });
  if (punyaRiwayatJabatan === 0) {
    await prisma.riwayatJabatan.create({
      data: {
        pegawaiId: contohPegawai.id,
        jenisJabatan: "FUNGSIONAL_TERTENTU",
        namaJabatan: "Perawat",
        jenjangJabatan: "AHLI_MUDA",
        unitKerjaId: puskesmasList[0]?.id,
        tmtJabatan: new Date("2021-04-01"),
        isAktif: true,
      },
    });
  }

  console.log("Seeding selesai.");
  console.log("=====================================================");
  console.log(`Login Super Admin  : superadmin / ${superAdminPassword}`);
  console.log(`Login Admin Kepeg. : admin.kepegawaian / ${adminPassword}`);
  console.log(`Login Kepala Dinas : kadis / ${adminPassword}`);
  console.log("PENTING: segera ganti password default ini setelah login pertama.");
  console.log("=====================================================");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
