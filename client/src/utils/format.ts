export const BULAN_LABEL = ["", "Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

export function formatTanggal(value?: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
}

export function formatTanggalWaktu(value?: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("id-ID");
}

export const LABEL_MAP: Record<string, string> = {
  L: "Laki-laki",
  P: "Perempuan",
  CPNS: "CPNS",
  PNS: "PNS",
  PPPK: "PPPK",
  AKTIF: "Aktif",
  PENSIUN: "Pensiun",
  MUTASI_KELUAR: "Mutasi Keluar",
  MENINGGAL: "Meninggal",
  CUTI_DI_LUAR_TANGGUNGAN: "Cuti di Luar Tanggungan",
  NON_AKTIF_LAINNYA: "Non-aktif Lainnya",
  STRUKTURAL: "Struktural",
  FUNGSIONAL_TERTENTU: "Fungsional Tertentu",
  PELAKSANA: "Pelaksana",
  PEMULA: "Pemula",
  TERAMPIL: "Terampil",
  MAHIR: "Mahir",
  PENYELIA: "Penyelia",
  AHLI_PERTAMA: "Ahli Pertama",
  AHLI_MUDA: "Ahli Muda",
  AHLI_MADYA: "Ahli Madya",
  AHLI_UTAMA: "Ahli Utama",
  SANGAT_BAIK: "Sangat Baik",
  BAIK: "Baik",
  CUKUP: "Cukup",
  KURANG: "Kurang",
  SANGAT_KURANG: "Sangat Kurang",
  BELUM_DIPROSES: "Belum Diproses",
  SEDANG_DIUSULKAN: "Sedang Diusulkan",
  SK_TERBIT: "SK Terbit",
  DITUNDA: "Ditunda",
  REGULER: "Reguler",
  FUNGSIONAL: "Fungsional",
  PILIHAN: "Pilihan",
  SUPER_ADMIN: "Super Admin",
  ADMIN_KEPEGAWAIAN: "Admin Kepegawaian",
  KEPALA_BIDANG: "Kepala Bidang/Kasubbag",
  KEPALA_DINAS: "Kepala Dinas",
  PEGAWAI: "Pegawai",
  SK_CPNS: "SK CPNS",
  SK_PNS: "SK PNS",
  SK_PANGKAT: "SK Pangkat",
  IJAZAH: "Ijazah",
  SERTIFIKAT_DIKLAT: "Sertifikat Diklat",
  PAK: "PAK (Penetapan Angka Kredit)",
  SKP: "SKP",
  USULAN_KENAIKAN_PANGKAT: "Usulan Kenaikan Pangkat",
  FOTO: "Foto",
  LAINNYA: "Lainnya",
};

export function label(value?: string | null): string {
  if (!value) return "-";
  return LABEL_MAP[value] || value;
}

export function formatUkuranFile(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
