/**
 * Menghasilkan file seed.sql untuk dieksekusi lewat:
 *   wrangler d1 execute simpeg-db --local --file=./seed.sql
 *   wrangler d1 execute simpeg-db --remote --file=./seed.sql
 *
 * CATATAN PENTING (lihat PRD Bagian 6 & 15): Nilai ambang batas angka kredit dan masa kerja
 * di bawah ini adalah PLACEHOLDER. Bagian kepegawaian Dinkes KBB WAJIB memvalidasi &
 * menyesuaikan nilai ini lewat halaman Pengaturan Parameter sebelum go-live produksi.
 */
import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";

const statements: string[] = [];

function sqlStr(value: string | null | number | boolean): string {
  if (value === null) return "NULL";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "1" : "0";
  return `'${String(value).replace(/'/g, "''")}'`;
}

function insert(table: string, columns: string[], values: Record<string, string | number | boolean | null>[]) {
  for (const row of values) {
    const vals = columns.map((col) => sqlStr(row[col] ?? null));
    statements.push(`INSERT OR IGNORE INTO ${table} (${columns.join(", ")}) VALUES (${vals.join(", ")});`);
  }
}

async function main() {
  const now = new Date().toISOString();

  // ---- Unit Kerja ----
  const dinasIndukId = "unit-dinas-induk";
  const puskesmasNames = ["Puskesmas Lembang", "Puskesmas Cisarua", "Puskesmas Padalarang", "Puskesmas Batujajar", "Puskesmas Cililin"];
  const puskesmasIds = puskesmasNames.map((n) => `unit-${n.toLowerCase().replace(/\s+/g, "-")}`);

  insert("unit_kerja", ["id", "nama", "jenis", "alamat", "parent_id", "created_at", "updated_at"], [
    { id: dinasIndukId, nama: "Dinas Kesehatan Kabupaten Bandung Barat (Induk)", jenis: "DINAS_INDUK", alamat: null, parent_id: null, created_at: now, updated_at: now },
    ...puskesmasNames.map((nama, i) => ({ id: puskesmasIds[i], nama, jenis: "PUSKESMAS", alamat: null, parent_id: dinasIndukId, created_at: now, updated_at: now })),
  ]);

  // ---- Parameter Aturan (BR-1 s.d BR-4) ----
  insert("parameter_aturan", ["id", "masa_kerja_minimum_tahun", "predikat_skp_minimum", "reminder_bulan_sebelum_1", "reminder_bulan_sebelum_2", "wajib_validasi_skp", "updated_at"], [
    { id: 1, masa_kerja_minimum_tahun: 4, predikat_skp_minimum: "BAIK", reminder_bulan_sebelum_1: 6, reminder_bulan_sebelum_2: 3, wajib_validasi_skp: true, updated_at: now },
  ]);

  // ---- Periode Kenaikan Pangkat (BR-1: umumnya 1 April & 1 Oktober) ----
  insert("periode_kenaikan_pangkat", ["id", "bulan", "tanggal", "label", "aktif"], [
    { id: randomUUID(), bulan: 4, tanggal: 1, label: "Periode April", aktif: true },
    { id: randomUUID(), bulan: 10, tanggal: 1, label: "Periode Oktober", aktif: true },
  ]);

  // ---- Jenis Jabatan Fungsional Kesehatan & ambang batas angka kredit (BR-3, PLACEHOLDER) ----
  const jenjangTemplate = [
    { jenjang: "AHLI_PERTAMA", golongan: "III/a", ak: 0, urutan: 1 },
    { jenjang: "AHLI_MUDA", golongan: "III/c", ak: 100, urutan: 2 },
    { jenjang: "AHLI_MADYA", golongan: "IV/a", ak: 200, urutan: 3 },
    { jenjang: "AHLI_UTAMA", golongan: "IV/d", ak: 550, urutan: 4 },
  ];
  const jabatanFungsionalNames = ["Dokter", "Dokter Gigi", "Perawat", "Bidan", "Apoteker", "Epidemiolog Kesehatan", "Sanitarian", "Nutrisionis"];

  const jenisRows: { id: string; nama: string; rumpun: string }[] = jabatanFungsionalNames.map((nama) => ({ id: randomUUID(), nama, rumpun: "Kesehatan" }));
  insert("jenis_jabatan_fungsional", ["id", "nama", "rumpun"], jenisRows);

  for (const jenis of jenisRows) {
    insert(
      "parameter_jenjang_angka_kredit",
      ["id", "jenis_jabatan_fungsional_id", "jenjang", "golongan_ruang", "angka_kredit_minimum", "urutan"],
      jenjangTemplate.map((t) => ({ id: randomUUID(), jenis_jabatan_fungsional_id: jenis.id, jenjang: t.jenjang, golongan_ruang: t.golongan, angka_kredit_minimum: t.ak, urutan: t.urutan }))
    );
  }

  // ---- User Super Admin & Admin Kepegawaian ----
  const superAdminPassword = process.env.SEED_SUPERADMIN_PASSWORD || "SimpegKBB#2026";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "AdminKepeg#2026";

  const superAdminHash = await bcrypt.hash(superAdminPassword, 10);
  const adminHash = await bcrypt.hash(adminPassword, 10);

  insert(
    "user",
    ["id", "username", "email", "password_hash", "nama", "role", "unit_kerja_id", "pegawai_id", "is_active", "last_login_at", "created_at", "updated_at"],
    [
      { id: randomUUID(), username: "superadmin", email: "superadmin@dinkeskbb.local", password_hash: superAdminHash, nama: "Super Administrator", role: "SUPER_ADMIN", unit_kerja_id: null, pegawai_id: null, is_active: true, last_login_at: null, created_at: now, updated_at: now },
      { id: randomUUID(), username: "admin.kepegawaian", email: "admin.kepegawaian@dinkeskbb.local", password_hash: adminHash, nama: "Admin Sub-Bagian Kepegawaian", role: "ADMIN_KEPEGAWAIAN", unit_kerja_id: dinasIndukId, pegawai_id: null, is_active: true, last_login_at: null, created_at: now, updated_at: now },
      { id: randomUUID(), username: "kadis", email: "kadis@dinkeskbb.local", password_hash: adminHash, nama: "Kepala Dinas Kesehatan KBB", role: "KEPALA_DINAS", unit_kerja_id: null, pegawai_id: null, is_active: true, last_login_at: null, created_at: now, updated_at: now },
    ]
  );

  // ---- Contoh data pegawai untuk demo ----
  const pegawaiId = "demo-pegawai-1";
  insert(
    "pegawai",
    ["id", "nip", "nama", "jenis_kelamin", "status_kepegawaian", "tmt_cpns", "tmt_pns", "status_aktif", "unit_kerja_id", "created_at", "updated_at"],
    [{ id: pegawaiId, nip: "198501012010012001", nama: "Contoh Pegawai Demo", jenis_kelamin: "P", status_kepegawaian: "PNS", tmt_cpns: "2010-01-01", tmt_pns: "2011-01-01", status_aktif: "AKTIF", unit_kerja_id: puskesmasIds[0], created_at: now, updated_at: now }]
  );

  insert(
    "riwayat_pangkat_golongan",
    ["id", "pegawai_id", "golongan_ruang", "nama_pangkat", "tmt", "nomor_sk", "is_aktif", "created_at", "updated_at"],
    [{ id: randomUUID(), pegawai_id: pegawaiId, golongan_ruang: "III/b", nama_pangkat: "Penata Muda Tingkat I", tmt: "2021-04-01", nomor_sk: "SK-CONTOH/001", is_aktif: true, created_at: now, updated_at: now }]
  );

  insert(
    "riwayat_jabatan",
    ["id", "pegawai_id", "jenis_jabatan", "nama_jabatan", "jenjang_jabatan", "unit_kerja_id", "tmt_jabatan", "is_aktif", "created_at", "updated_at"],
    [{ id: randomUUID(), pegawai_id: pegawaiId, jenis_jabatan: "FUNGSIONAL_TERTENTU", nama_jabatan: "Perawat", jenjang_jabatan: "AHLI_MUDA", unit_kerja_id: puskesmasIds[0], tmt_jabatan: "2021-04-01", is_aktif: true, created_at: now, updated_at: now }]
  );

  const outPath = path.resolve(__dirname, "../seed.sql");
  fs.writeFileSync(outPath, statements.join("\n") + "\n");

  console.log(`seed.sql berhasil dibuat (${statements.length} statement) di ${outPath}`);
  console.log("=====================================================");
  console.log(`Login Super Admin  : superadmin / ${superAdminPassword}`);
  console.log(`Login Admin Kepeg. : admin.kepegawaian / ${adminPassword}`);
  console.log(`Login Kepala Dinas : kadis / ${adminPassword}`);
  console.log("PENTING: segera ganti password default ini setelah login pertama.");
  console.log("=====================================================");
}

main();
