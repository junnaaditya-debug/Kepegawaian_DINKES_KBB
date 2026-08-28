export type RoleCode = "super_admin" | "admin_kepegawaian" | "kepala_bidang" | "kepala_dinas" | "pegawai";

export interface AuthUser {
  id: number;
  username: string;
  email: string | null;
  fullName: string;
  role: RoleCode;
  unitKerjaId: number | null;
  pegawaiId: number | null;
  mustChangePassword: boolean;
}

export interface UnitKerja {
  id: number;
  kode: string;
  nama: string;
  jenis: "dinas_induk" | "uptd" | "puskesmas" | "bidang";
  parent_id: number | null;
  alamat: string | null;
  is_active: number;
}

export interface PegawaiListItem {
  id: number;
  nip: string;
  nama: string;
  gelar_depan: string | null;
  gelar_belakang: string | null;
  status_kepegawaian: string;
  status_aktif: string;
  unit_kerja_id: number;
  unit_kerja_nama: string;
  jenis_jabatan: string;
  jabatan_nama_display: string | null;
  golongan_ruang_aktif: string | null;
  nama_pangkat_aktif: string | null;
  tmt_pangkat_aktif: string | null;
}

export interface PegawaiDetail extends PegawaiListItem {
  nip_lama: string | null;
  tempat_lahir: string | null;
  tanggal_lahir: string | null;
  jenis_kelamin: "L" | "P" | null;
  alamat: string | null;
  no_hp: string | null;
  email: string | null;
  tmt_cpns: string | null;
  tmt_pns: string | null;
  tanggal_status_berubah: string | null;
  keterangan_status: string | null;
  jabatan_struktural_nama: string | null;
  jenjang_jabatan_fungsional_id: number | null;
  jenjang_fungsional_nama: string | null;
  jenis_fungsional_nama: string | null;
  skp_predikat_terakhir: string | null;
  skp_tahun_terakhir: number | null;
  masa_kerja_golongan_bulan: number | null;
}

export interface RiwayatPangkat {
  id: number;
  pegawai_id: number;
  golongan_ruang: string;
  nama_pangkat: string;
  tmt_pangkat: string;
  no_sk: string | null;
  tanggal_sk: string | null;
  pejabat_penetap: string | null;
  jenis_kenaikan: string;
  dokumen_id: number | null;
  is_aktif: number;
}

export interface RiwayatJabatan {
  id: number;
  pegawai_id: number;
  jenis: string;
  jabatan_nama: string;
  unit_kerja_nama: string;
  jenjang_nama: string | null;
  no_sk: string | null;
  tanggal_sk: string | null;
  tmt_jabatan: string;
  pejabat_penetap: string | null;
  is_aktif: number;
}

export interface RiwayatPendidikan {
  id: number;
  pegawai_id: number;
  jenjang: string;
  jurusan: string | null;
  nama_institusi: string | null;
  tahun_lulus: number | null;
  no_ijazah: string | null;
  is_pendidikan_terakhir: number;
}

export interface AngkaKredit {
  id: number;
  pegawai_id: number;
  no_pak: string | null;
  tanggal_pak: string | null;
  periode_mulai: string | null;
  periode_selesai: string | null;
  angka_kredit_utama: number;
  angka_kredit_pengembangan_profesi: number;
  angka_kredit_penunjang: number;
  angka_kredit_kumulatif: number;
  is_terbaru: number;
}

export interface AngkaKreditGap {
  jenjangBerikutnyaNama: string | null;
  ambangBatas: number | null;
  kumulatifSaatIni: number;
  sisaKebutuhan: number | null;
}

export interface KenaikanPangkatRow {
  pegawaiId: number;
  nip: string;
  nama: string;
  unitKerjaId: number;
  unitKerjaNama: string;
  statusKepegawaian: string;
  jenisKenaikan: "reguler" | "fungsional";
  golonganSaatIni: string | null;
  golonganBerikutnya: string | null;
  detail: Record<string, unknown>;
  periodeTahun: number;
  periodeBulan: number;
  periodeLabel: string;
  overdue: boolean;
  status: "belum_diproses" | "sedang_diusulkan" | "sk_terbit" | "ditunda" | "dibatalkan";
  catatan: string | null;
  tanggalPengusulan: string | null;
  diverifikasiAtasan: boolean;
  catatanVerifikasi: string | null;
}

export interface DashboardRingkasan {
  totalPegawaiAktif: number;
  komposisiGolongan: { golongan: string; jumlah: number }[];
  komposisiJenisJabatan: { jenis_jabatan: string; jumlah: number }[];
  komposisiUnitKerja: { unit_kerja: string; jumlah: number }[];
  komposisiStatusKepegawaian: { status_kepegawaian: string; jumlah: number }[];
  statusUsulanKenaikanPangkat: { status: string; jumlah: number }[];
  trenKenaikanPangkatTahunan: { tahun: string; jumlah: number }[];
}

export interface ParameterAturan {
  id: number;
  kategori: string;
  kunci: string;
  nilai: unknown;
  deskripsi: string | null;
  updated_at: string;
}

export interface GolonganMasaKerja {
  id: number;
  golongan_ruang: string;
  masa_kerja_minimum_bulan: number;
  golongan_ruang_berikutnya: string | null;
}

export interface JenisJabatanFungsional {
  id: number;
  kode: string;
  nama: string;
  rumpun: string | null;
  is_active: number;
}

export interface JenjangJabatanFungsional {
  id: number;
  jenis_jabatan_fungsional_id: number;
  kode: string;
  nama: string;
  urutan: number;
  golongan_ruang_minimal: string;
  angka_kredit_kumulatif_minimal: number;
  jenis_nama?: string;
}

export interface UserAccount {
  id: number;
  username: string;
  email: string | null;
  full_name: string;
  role_id: number;
  role_code: RoleCode;
  role_name: string;
  unit_kerja_id: number | null;
  unit_kerja_nama: string | null;
  is_active: number;
  must_change_password: number;
  last_login_at: string | null;
}

export interface Role {
  id: number;
  code: RoleCode;
  name: string;
  description: string | null;
}

export interface Dokumen {
  id: number;
  jenis: string;
  nama_file: string;
  mime_type: string;
  ukuran_bytes: number;
  pegawai_id: number | null;
  entitas_terkait_tipe: string | null;
  entitas_terkait_id: number | null;
  versi: number;
  dokumen_induk_id: number | null;
  uploaded_by: number;
  uploaded_at: string;
}

export interface Notifikasi {
  id: number;
  judul: string;
  pesan: string;
  tipe: string;
  is_read: number;
  created_at: string;
}

export interface LogAktivitas {
  id: number;
  user_id: number | null;
  username_snapshot: string | null;
  aksi: string;
  entitas: string;
  entitas_id: number | null;
  detail_json: string | null;
  ip_address: string | null;
  created_at: string;
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}
