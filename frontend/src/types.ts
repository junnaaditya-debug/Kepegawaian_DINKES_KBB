export type Role = "SUPER_ADMIN" | "ADMIN_KEPEGAWAIAN" | "KEPALA_BIDANG" | "KEPALA_DINAS" | "PEGAWAI";

export interface AuthUser {
  id: string;
  username: string;
  email: string | null;
  nama_lengkap: string;
  role: Role;
  unit_kerja_id: string | null;
  pegawai_id: string | null;
  unit_kerja_nama?: string | null;
}

export interface UnitKerja {
  id: string;
  kode: string | null;
  nama: string;
  jenis: string;
  parent_id: string | null;
  alamat: string | null;
  is_active: number;
}

export interface Pegawai {
  id: string;
  nip: string;
  nip_lama: string | null;
  nama: string;
  gelar_depan: string | null;
  gelar_belakang: string | null;
  tempat_lahir: string | null;
  tanggal_lahir: string | null;
  jenis_kelamin: "L" | "P" | null;
  alamat: string | null;
  no_hp: string | null;
  email: string | null;
  foto_url: string | null;
  status_kepegawaian: "CPNS" | "PNS" | "PPPK";
  tmt_cpns: string | null;
  tmt_pns: string | null;
  status_aktif: string;
  unit_kerja_id: string | null;
  unit_kerja_nama?: string | null;
  jenis_jabatan: string | null;
  nama_jabatan: string | null;
  jenjang_jabatan: string | null;
  golongan_ruang_aktif: string | null;
  nama_pangkat_aktif: string | null;
  tmt_pangkat_aktif: string | null;
  nilai_skp_terakhir: number | null;
  predikat_skp_terakhir: string | null;
  periode_skp_terakhir: string | null;
}

export interface RiwayatJabatan {
  id: string;
  pegawai_id: string;
  jenis_jabatan: string;
  nama_jabatan: string;
  jenjang_jabatan: string | null;
  unit_kerja_id: string | null;
  unit_kerja_nama?: string | null;
  no_sk: string | null;
  tanggal_sk: string | null;
  tmt_jabatan: string;
  tmt_berakhir: string | null;
  is_aktif: number;
  keterangan: string | null;
}

export interface RiwayatPangkat {
  id: string;
  pegawai_id: string;
  golongan_ruang: string;
  nama_pangkat: string;
  tmt_pangkat: string;
  no_sk: string | null;
  tanggal_sk: string | null;
  pejabat_penetap: string | null;
  jenis_kenaikan: string | null;
  is_aktif: number;
  keterangan: string | null;
}

export interface RiwayatPendidikan {
  id: string;
  pegawai_id: string;
  jenjang_pendidikan: string;
  jurusan: string | null;
  nama_institusi: string | null;
  tahun_lulus: number | null;
  no_ijazah: string | null;
}

export interface AngkaKredit {
  id: string;
  pegawai_id: string;
  nomor_pak: string | null;
  tanggal_pak: string | null;
  periode_awal: string | null;
  periode_akhir: string | null;
  angka_kredit_kumulatif: number;
  unsur_utama: number | null;
  pengembangan_profesi: number | null;
  unsur_penunjang: number | null;
  keterangan: string | null;
  is_current: number;
}

export interface Dokumen {
  id: string;
  pegawai_id: string | null;
  entity_type: string;
  entity_id: string | null;
  jenis_dokumen: string;
  nama_file: string;
  mime_type: string | null;
  ukuran_bytes: number | null;
  versi: number;
  is_current_version: number;
  keterangan: string | null;
  uploaded_by: string | null;
  uploaded_at: string;
}

export interface KenaikanCandidateDto {
  pegawaiId: string;
  nip: string;
  nama: string;
  unitKerjaId: string | null;
  unitKerjaNama: string | null;
  statusKepegawaian: string;
  jenisJabatan: string | null;
  namaJabatan: string | null;
  jenjangJabatan: string | null;
  golonganRuangAktif: string | null;
  namaPangkatAktif: string | null;
  tmtPangkatAktif: string | null;
  jenisKenaikan: "REGULER" | "PILIHAN_FUNGSIONAL";
  masaKerjaBulan: number | null;
  masaKerjaMinimumBulan: number | null;
  angkaKreditKumulatif: number | null;
  angkaKreditMinimum: number | null;
  angkaKreditGap: number | null;
  skpTerpenuhi: boolean | null;
  memenuhiSyarat: boolean;
  proyeksiPeriodeBerikutnya: string | null;
  bulanMenujuPeriode: number | null;
  statusUsulanId: string | null;
  statusTindakLanjut: "BELUM_DIPROSES" | "SEDANG_DIUSULKAN" | "SK_TERBIT" | "DITUNDA";
  catatanTindakLanjut: string | null;
}

export interface AppUser {
  id: string;
  username: string;
  email: string | null;
  nama_lengkap: string;
  role: Role;
  unit_kerja_id: string | null;
  unit_kerja_nama?: string | null;
  pegawai_id: string | null;
  is_active: number;
  last_login_at: string | null;
  created_at: string;
}

export interface LogAktivitas {
  id: string;
  user_id: string | null;
  username: string | null;
  aksi: string;
  entity_type: string;
  entity_id: string | null;
  deskripsi: string | null;
  created_at: string;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
}
