export type Role = "SUPER_ADMIN" | "ADMIN_KEPEGAWAIAN" | "KEPALA_BIDANG" | "KEPALA_DINAS" | "PEGAWAI";

export interface CurrentUser {
  id: string;
  username: string;
  nama: string;
  role: Role;
  unitKerjaId: string | null;
  pegawaiId: string | null;
  email: string | null;
  unitKerja?: { id: string; nama: string } | null;
}

export interface UnitKerja {
  id: string;
  nama: string;
  jenis: string;
  alamat: string | null;
  parentId: string | null;
  parent?: { id: string; nama: string } | null;
  _count?: { pegawai: number };
}

export type StatusAktifPegawai = "AKTIF" | "PENSIUN" | "MUTASI_KELUAR" | "MENINGGAL" | "CUTI_DI_LUAR_TANGGUNGAN" | "NON_AKTIF_LAINNYA";
export type StatusKepegawaian = "CPNS" | "PNS" | "PPPK";
export type JenisKelamin = "L" | "P";
export type JenisJabatan = "STRUKTURAL" | "FUNGSIONAL_TERTENTU" | "PELAKSANA";
export type JenjangFungsional = "PEMULA" | "TERAMPIL" | "MAHIR" | "PENYELIA" | "AHLI_PERTAMA" | "AHLI_MUDA" | "AHLI_MADYA" | "AHLI_UTAMA";
export type PredikatSkp = "SANGAT_BAIK" | "BAIK" | "CUKUP" | "KURANG" | "SANGAT_KURANG";
export type JenisDokumen =
  | "SK_CPNS"
  | "SK_PNS"
  | "SK_PANGKAT"
  | "IJAZAH"
  | "SERTIFIKAT_DIKLAT"
  | "PAK"
  | "SKP"
  | "USULAN_KENAIKAN_PANGKAT"
  | "FOTO"
  | "LAINNYA";
export type StatusTindakLanjut = "BELUM_DIPROSES" | "SEDANG_DIUSULKAN" | "SK_TERBIT" | "DITUNDA";
export type JenisKenaikanPangkat = "REGULER" | "FUNGSIONAL" | "PILIHAN";

export interface Pegawai {
  id: string;
  nip: string;
  nipLama: string | null;
  nama: string;
  gelarDepan: string | null;
  gelarBelakang: string | null;
  tempatLahir: string | null;
  tanggalLahir: string | null;
  jenisKelamin: JenisKelamin;
  alamat: string | null;
  noHp: string | null;
  email: string | null;
  fotoUrl: string | null;
  agama: string | null;
  statusKepegawaian: StatusKepegawaian;
  tmtCpns: string | null;
  tmtPns: string | null;
  statusAktif: StatusAktifPegawai;
  tanggalNonAktif: string | null;
  keteranganNonAktif: string | null;
  unitKerjaId: string | null;
  unitKerja?: UnitKerja | null;
  riwayatPangkatGolongan?: RiwayatPangkatGolongan[];
  riwayatJabatan?: RiwayatJabatan[];
  riwayatPendidikan?: RiwayatPendidikan[];
  angkaKredit?: AngkaKredit[];
  nilaiSkp?: NilaiSkp[];
  dokumen?: Dokumen[];
  statusUsulanKenaikanPangkat?: StatusUsulan[];
}

export interface RiwayatPangkatGolongan {
  id: string;
  pegawaiId: string;
  golonganRuang: string;
  namaPangkat: string;
  tmt: string;
  nomorSk: string | null;
  tanggalSk: string | null;
  pejabatPenetap: string | null;
  isAktif: boolean;
  dokumenId: string | null;
  dokumen?: Dokumen | null;
}

export interface RiwayatJabatan {
  id: string;
  pegawaiId: string;
  jenisJabatan: JenisJabatan;
  namaJabatan: string;
  jenjangJabatan: JenjangFungsional | null;
  unitKerjaId: string | null;
  unitKerja?: UnitKerja | null;
  tmtJabatan: string;
  tglSelesai: string | null;
  isAktif: boolean;
  nomorSk: string | null;
  tanggalSk: string | null;
  dokumenId: string | null;
  dokumen?: Dokumen | null;
}

export interface RiwayatPendidikan {
  id: string;
  pegawaiId: string;
  jenjang: string;
  jurusan: string | null;
  namaInstitusi: string | null;
  tahunLulus: number | null;
  nomorIjazah: string | null;
  dokumenId: string | null;
  dokumen?: Dokumen | null;
}

export interface AngkaKredit {
  id: string;
  pegawaiId: string;
  nomorPak: string;
  tanggalPak: string;
  periodePenilaianAwal: string;
  periodePenilaianAkhir: string;
  angkaKreditKumulatif: number;
  unsurUtama: number | null;
  unsurPengembanganProfesi: number | null;
  unsurPenunjang: number | null;
  dokumenId: string | null;
  dokumen?: Dokumen | null;
}

export interface NilaiSkp {
  id: string;
  pegawaiId: string;
  tahun: number;
  predikat: PredikatSkp;
  nilaiAngka: number | null;
  keterangan: string | null;
}

export interface Dokumen {
  id: string;
  pegawaiId: string | null;
  jenisDokumen: JenisDokumen;
  namaFile: string;
  namaAsli: string;
  mimeType: string;
  ukuran: number;
  versi: number;
  dokumenIndukId: string | null;
  createdAt: string;
  url?: string;
}

export interface StatusUsulan {
  id: string;
  pegawaiId: string;
  periodeTahun: number;
  periodeBulan: number;
  jenisKenaikan: JenisKenaikanPangkat;
  status: StatusTindakLanjut;
  catatan: string | null;
}

export interface KandidatKenaikanPangkat {
  pegawaiId: string;
  nip: string;
  nama: string;
  unitKerjaId: string | null;
  unitKerjaNama: string | null;
  jenisKenaikan: "REGULER" | "FUNGSIONAL";
  golonganSaatIni: string;
  golonganTmt: string;
  masaKerjaTahun: number | null;
  angkaKreditKumulatif: number | null;
  angkaKreditDibutuhkan: number | null;
  gapAngkaKredit: number | null;
  predikatSkpTerakhir: PredikatSkp | null;
  memenuhiSyaratSkp: boolean;
  proyeksiPeriode: { tahun: number; bulan: number; tanggal: number; label: string };
  statusTindakLanjut: StatusTindakLanjut;
}

export interface ParameterAturan {
  id: number;
  masaKerjaMinimumTahun: number;
  predikatSkpMinimum: PredikatSkp;
  reminderBulanSebelum1: number;
  reminderBulanSebelum2: number;
  wajibValidasiSkp: boolean;
}

export interface PeriodeKenaikanPangkat {
  id: string;
  bulan: number;
  tanggal: number;
  label: string;
  aktif: boolean;
}

export interface JenisJabatanFungsional {
  id: string;
  nama: string;
  rumpun: string | null;
  jenjangAngkaKredit: ParameterJenjangAngkaKredit[];
}

export interface ParameterJenjangAngkaKredit {
  id: string;
  jenisJabatanFungsionalId: string;
  jenjang: JenjangFungsional;
  golonganRuang: string;
  angkaKreditMinimum: number;
  urutan: number;
}

export interface AppUser {
  id: string;
  username: string;
  email: string | null;
  nama: string;
  role: Role;
  unitKerjaId: string | null;
  pegawaiId: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  unitKerja?: { id: string; nama: string } | null;
}

export interface Notifikasi {
  id: string;
  userId: string;
  judul: string;
  pesan: string;
  jenis: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface LogAktivitas {
  id: string;
  userId: string | null;
  aksi: string;
  entitas: string;
  entitasId: string | null;
  deskripsi: string | null;
  createdAt: string;
  user?: { id: string; nama: string; username: string } | null;
}

export interface DashboardRingkasan {
  totalPegawai: number;
  totalAktif: number;
  totalNonAktif: number;
  perGolongan: { golongan: string; jumlah: number }[];
  perJenisKelamin: { jenisKelamin: string; jumlah: number }[];
  perStatusKepegawaian: { status: string; jumlah: number }[];
  perJenisJabatan: { jenis: string; jumlah: number }[];
  dueKenaikanPangkatBerjalan: number;
  dueKenaikanPangkat12Bulan: number;
}
