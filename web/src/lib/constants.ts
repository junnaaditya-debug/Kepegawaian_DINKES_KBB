export const GOLONGAN_LIST = [
  "I/a", "I/b", "I/c", "I/d",
  "II/a", "II/b", "II/c", "II/d",
  "III/a", "III/b", "III/c", "III/d",
  "IV/a", "IV/b", "IV/c", "IV/d", "IV/e",
];

export const JENIS_JABATAN_OPTIONS = [
  { value: "pelaksana", label: "Pelaksana" },
  { value: "struktural", label: "Struktural" },
  { value: "fungsional", label: "Fungsional Tertentu" },
];

export const STATUS_KEPEGAWAIAN_OPTIONS = ["CPNS", "PNS", "PPPK"];

export const STATUS_AKTIF_OPTIONS = [
  { value: "aktif", label: "Aktif" },
  { value: "pensiun", label: "Pensiun" },
  { value: "mutasi_keluar", label: "Mutasi Keluar" },
  { value: "meninggal", label: "Meninggal" },
  { value: "cuti_di_luar_tanggungan", label: "Cuti di Luar Tanggungan" },
];

export const SKP_PREDIKAT_OPTIONS = ["Sangat Baik", "Baik", "Cukup", "Kurang", "Sangat Kurang"];

export const JENJANG_PENDIDIKAN_OPTIONS = ["SD", "SMP", "SMA/SMK", "D1", "D2", "D3", "D4", "S1", "Profesi", "S2", "S3"];

export const JENIS_DOKUMEN_OPTIONS = [
  { value: "sk_cpns", label: "SK CPNS" },
  { value: "sk_pns", label: "SK PNS" },
  { value: "sk_pangkat", label: "SK Kenaikan Pangkat" },
  { value: "sk_jabatan", label: "SK Jabatan" },
  { value: "ijazah", label: "Ijazah" },
  { value: "sertifikat", label: "Sertifikat Diklat" },
  { value: "pak", label: "PAK (Penetapan Angka Kredit)" },
  { value: "skp", label: "SKP" },
  { value: "usulan_kp", label: "Dokumen Usulan Kenaikan Pangkat" },
  { value: "foto", label: "Foto" },
  { value: "lainnya", label: "Lainnya" },
];

export const STATUS_USULAN_LABELS: Record<string, string> = {
  belum_diproses: "Belum Diproses",
  sedang_diusulkan: "Sedang Diusulkan",
  sk_terbit: "SK Terbit",
  ditunda: "Ditunda",
  dibatalkan: "Dibatalkan",
};
