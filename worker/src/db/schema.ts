import { sqliteTable, text, integer, real, uniqueIndex, index } from "drizzle-orm/sqlite-core";

// ==========================================================
// Union types dipakai sebagai pengganti enum Postgres (D1/SQLite tidak
// punya tipe enum native — disimpan sebagai TEXT, divalidasi di aplikasi).
// ==========================================================
export const ROLES = ["SUPER_ADMIN", "ADMIN_KEPEGAWAIAN", "KEPALA_BIDANG", "KEPALA_DINAS", "PEGAWAI"] as const;
export const JENIS_KELAMIN = ["L", "P"] as const;
export const STATUS_KEPEGAWAIAN = ["CPNS", "PNS", "PPPK"] as const;
export const STATUS_AKTIF_PEGAWAI = ["AKTIF", "PENSIUN", "MUTASI_KELUAR", "MENINGGAL", "CUTI_DI_LUAR_TANGGUNGAN", "NON_AKTIF_LAINNYA"] as const;
export const JENIS_JABATAN = ["STRUKTURAL", "FUNGSIONAL_TERTENTU", "PELAKSANA"] as const;
export const JENJANG_FUNGSIONAL = ["PEMULA", "TERAMPIL", "MAHIR", "PENYELIA", "AHLI_PERTAMA", "AHLI_MUDA", "AHLI_MADYA", "AHLI_UTAMA"] as const;
export const PREDIKAT_SKP = ["SANGAT_BAIK", "BAIK", "CUKUP", "KURANG", "SANGAT_KURANG"] as const;
export const JENIS_DOKUMEN = [
  "SK_CPNS", "SK_PNS", "SK_PANGKAT", "IJAZAH", "SERTIFIKAT_DIKLAT", "PAK", "SKP", "USULAN_KENAIKAN_PANGKAT", "FOTO", "LAINNYA",
] as const;
export const STATUS_TINDAK_LANJUT = ["BELUM_DIPROSES", "SEDANG_DIUSULKAN", "SK_TERBIT", "DITUNDA"] as const;
export const JENIS_KENAIKAN_PANGKAT = ["REGULER", "FUNGSIONAL", "PILIHAN"] as const;

export const unitKerja = sqliteTable("unit_kerja", {
  id: text("id").primaryKey(),
  nama: text("nama").notNull(),
  jenis: text("jenis").notNull(),
  alamat: text("alamat"),
  parentId: text("parent_id"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  username: text("username").notNull(),
  email: text("email"),
  passwordHash: text("password_hash").notNull(),
  nama: text("nama").notNull(),
  role: text("role", { enum: ROLES }).notNull(),
  unitKerjaId: text("unit_kerja_id"),
  pegawaiId: text("pegawai_id"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  lastLoginAt: text("last_login_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (t) => ({
  usernameIdx: uniqueIndex("user_username_idx").on(t.username),
}));

export const pegawai = sqliteTable("pegawai", {
  id: text("id").primaryKey(),
  nip: text("nip").notNull(),
  nipLama: text("nip_lama"),
  nama: text("nama").notNull(),
  gelarDepan: text("gelar_depan"),
  gelarBelakang: text("gelar_belakang"),
  tempatLahir: text("tempat_lahir"),
  tanggalLahir: text("tanggal_lahir"),
  jenisKelamin: text("jenis_kelamin", { enum: JENIS_KELAMIN }).notNull(),
  alamat: text("alamat"),
  noHp: text("no_hp"),
  email: text("email"),
  fotoUrl: text("foto_url"),
  agama: text("agama"),
  statusKepegawaian: text("status_kepegawaian", { enum: STATUS_KEPEGAWAIAN }).notNull(),
  tmtCpns: text("tmt_cpns"),
  tmtPns: text("tmt_pns"),
  statusAktif: text("status_aktif", { enum: STATUS_AKTIF_PEGAWAI }).notNull().default("AKTIF"),
  tanggalNonAktif: text("tanggal_non_aktif"),
  keteranganNonAktif: text("keterangan_non_aktif"),
  unitKerjaId: text("unit_kerja_id"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  createdBy: text("created_by"),
  updatedBy: text("updated_by"),
}, (t) => ({
  nipIdx: uniqueIndex("pegawai_nip_idx").on(t.nip),
  namaIdx: index("pegawai_nama_idx").on(t.nama),
  statusAktifIdx: index("pegawai_status_aktif_idx").on(t.statusAktif),
}));

export const riwayatPendidikan = sqliteTable("riwayat_pendidikan", {
  id: text("id").primaryKey(),
  pegawaiId: text("pegawai_id").notNull(),
  jenjang: text("jenjang").notNull(),
  jurusan: text("jurusan"),
  namaInstitusi: text("nama_institusi"),
  tahunLulus: integer("tahun_lulus"),
  nomorIjazah: text("nomor_ijazah"),
  dokumenId: text("dokumen_id"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const riwayatJabatan = sqliteTable("riwayat_jabatan", {
  id: text("id").primaryKey(),
  pegawaiId: text("pegawai_id").notNull(),
  jenisJabatan: text("jenis_jabatan", { enum: JENIS_JABATAN }).notNull(),
  namaJabatan: text("nama_jabatan").notNull(),
  jenjangJabatan: text("jenjang_jabatan", { enum: JENJANG_FUNGSIONAL }),
  unitKerjaId: text("unit_kerja_id"),
  tmtJabatan: text("tmt_jabatan").notNull(),
  tglSelesai: text("tgl_selesai"),
  isAktif: integer("is_aktif", { mode: "boolean" }).notNull().default(true),
  nomorSk: text("nomor_sk"),
  tanggalSk: text("tanggal_sk"),
  dokumenId: text("dokumen_id"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (t) => ({
  pegawaiAktifIdx: index("riwayat_jabatan_pegawai_aktif_idx").on(t.pegawaiId, t.isAktif),
}));

export const riwayatPangkatGolongan = sqliteTable("riwayat_pangkat_golongan", {
  id: text("id").primaryKey(),
  pegawaiId: text("pegawai_id").notNull(),
  golonganRuang: text("golongan_ruang").notNull(),
  namaPangkat: text("nama_pangkat").notNull(),
  tmt: text("tmt").notNull(),
  nomorSk: text("nomor_sk"),
  tanggalSk: text("tanggal_sk"),
  pejabatPenetap: text("pejabat_penetap"),
  isAktif: integer("is_aktif", { mode: "boolean" }).notNull().default(true),
  dokumenId: text("dokumen_id"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (t) => ({
  pegawaiAktifIdx: index("riwayat_pangkat_pegawai_aktif_idx").on(t.pegawaiId, t.isAktif),
}));

export const angkaKredit = sqliteTable("angka_kredit", {
  id: text("id").primaryKey(),
  pegawaiId: text("pegawai_id").notNull(),
  nomorPak: text("nomor_pak").notNull(),
  tanggalPak: text("tanggal_pak").notNull(),
  periodePenilaianAwal: text("periode_penilaian_awal").notNull(),
  periodePenilaianAkhir: text("periode_penilaian_akhir").notNull(),
  angkaKreditKumulatif: real("angka_kredit_kumulatif").notNull(),
  unsurUtama: real("unsur_utama"),
  unsurPengembanganProfesi: real("unsur_pengembangan_profesi"),
  unsurPenunjang: real("unsur_penunjang"),
  dokumenId: text("dokumen_id"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (t) => ({
  pegawaiIdx: index("angka_kredit_pegawai_idx").on(t.pegawaiId),
}));

export const nilaiSkp = sqliteTable("nilai_skp", {
  id: text("id").primaryKey(),
  pegawaiId: text("pegawai_id").notNull(),
  tahun: integer("tahun").notNull(),
  predikat: text("predikat", { enum: PREDIKAT_SKP }).notNull(),
  nilaiAngka: real("nilai_angka"),
  keterangan: text("keterangan"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (t) => ({
  pegawaiTahunIdx: uniqueIndex("nilai_skp_pegawai_tahun_idx").on(t.pegawaiId, t.tahun),
}));

export const parameterAturan = sqliteTable("parameter_aturan", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  masaKerjaMinimumTahun: integer("masa_kerja_minimum_tahun").notNull().default(4),
  predikatSkpMinimum: text("predikat_skp_minimum", { enum: PREDIKAT_SKP }).notNull().default("BAIK"),
  reminderBulanSebelum1: integer("reminder_bulan_sebelum_1").notNull().default(6),
  reminderBulanSebelum2: integer("reminder_bulan_sebelum_2").notNull().default(3),
  wajibValidasiSkp: integer("wajib_validasi_skp", { mode: "boolean" }).notNull().default(true),
  updatedAt: text("updated_at").notNull(),
  updatedBy: text("updated_by"),
});

export const periodeKenaikanPangkat = sqliteTable("periode_kenaikan_pangkat", {
  id: text("id").primaryKey(),
  bulan: integer("bulan").notNull(),
  tanggal: integer("tanggal").notNull(),
  label: text("label").notNull(),
  aktif: integer("aktif", { mode: "boolean" }).notNull().default(true),
});

export const jenisJabatanFungsional = sqliteTable("jenis_jabatan_fungsional", {
  id: text("id").primaryKey(),
  nama: text("nama").notNull(),
  rumpun: text("rumpun"),
}, (t) => ({
  namaIdx: uniqueIndex("jenis_jabatan_fungsional_nama_idx").on(t.nama),
}));

export const parameterJenjangAngkaKredit = sqliteTable("parameter_jenjang_angka_kredit", {
  id: text("id").primaryKey(),
  jenisJabatanFungsionalId: text("jenis_jabatan_fungsional_id").notNull(),
  jenjang: text("jenjang", { enum: JENJANG_FUNGSIONAL }).notNull(),
  golonganRuang: text("golongan_ruang").notNull(),
  angkaKreditMinimum: real("angka_kredit_minimum").notNull(),
  urutan: integer("urutan").notNull(),
}, (t) => ({
  jenisJenjangIdx: uniqueIndex("jenjang_ak_jenis_jenjang_idx").on(t.jenisJabatanFungsionalId, t.jenjang),
}));

export const statusUsulanKenaikanPangkat = sqliteTable("status_usulan_kenaikan_pangkat", {
  id: text("id").primaryKey(),
  pegawaiId: text("pegawai_id").notNull(),
  periodeTahun: integer("periode_tahun").notNull(),
  periodeBulan: integer("periode_bulan").notNull(),
  jenisKenaikan: text("jenis_kenaikan", { enum: JENIS_KENAIKAN_PANGKAT }).notNull(),
  status: text("status", { enum: STATUS_TINDAK_LANJUT }).notNull().default("BELUM_DIPROSES"),
  catatan: text("catatan"),
  updatedById: text("updated_by_id"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (t) => ({
  uniqueKey: uniqueIndex("status_usulan_unique_idx").on(t.pegawaiId, t.periodeTahun, t.periodeBulan, t.jenisKenaikan),
  periodeIdx: index("status_usulan_periode_idx").on(t.periodeTahun, t.periodeBulan),
}));

export const dokumen = sqliteTable("dokumen", {
  id: text("id").primaryKey(),
  pegawaiId: text("pegawai_id"),
  jenisDokumen: text("jenis_dokumen", { enum: JENIS_DOKUMEN }).notNull(),
  namaFile: text("nama_file").notNull(),
  namaAsli: text("nama_asli").notNull(),
  r2Key: text("r2_key").notNull(),
  mimeType: text("mime_type").notNull(),
  ukuran: integer("ukuran").notNull(),
  versi: integer("versi").notNull().default(1),
  dokumenIndukId: text("dokumen_induk_id"),
  uploadedById: text("uploaded_by_id"),
  createdAt: text("created_at").notNull(),
}, (t) => ({
  pegawaiIdx: index("dokumen_pegawai_idx").on(t.pegawaiId),
}));

export const notifikasi = sqliteTable("notifikasi", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  judul: text("judul").notNull(),
  pesan: text("pesan").notNull(),
  jenis: text("jenis").notNull(),
  link: text("link"),
  isRead: integer("is_read", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
}, (t) => ({
  userReadIdx: index("notifikasi_user_read_idx").on(t.userId, t.isRead),
}));

export const logAktivitas = sqliteTable("log_aktivitas", {
  id: text("id").primaryKey(),
  userId: text("user_id"),
  aksi: text("aksi").notNull(),
  entitas: text("entitas").notNull(),
  entitasId: text("entitas_id"),
  deskripsi: text("deskripsi"),
  dataSebelum: text("data_sebelum"),
  dataSesudah: text("data_sesudah"),
  ipAddress: text("ip_address"),
  createdAt: text("created_at").notNull(),
}, (t) => ({
  entitasIdx: index("log_entitas_idx").on(t.entitas, t.entitasId),
  userIdx: index("log_user_idx").on(t.userId),
  createdAtIdx: index("log_created_at_idx").on(t.createdAt),
}));
