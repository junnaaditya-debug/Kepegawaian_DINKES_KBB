const COLORS: Record<string, string> = {
  slate: "bg-slate-100 text-slate-700",
  green: "bg-emerald-100 text-emerald-700",
  amber: "bg-amber-100 text-amber-700",
  red: "bg-red-100 text-red-700",
  blue: "bg-blue-100 text-blue-700",
  purple: "bg-purple-100 text-purple-700",
};

export function Badge({ children, color = "slate" }: { children: React.ReactNode; color?: keyof typeof COLORS }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${COLORS[color]}`}>{children}</span>;
}

const STATUS_COLOR: Record<string, keyof typeof COLORS> = {
  BELUM_DIPROSES: "slate",
  SEDANG_DIUSULKAN: "amber",
  SK_TERBIT: "green",
  DITUNDA: "red",
  AKTIF: "green",
  PENSIUN: "slate",
  MUTASI_KELUAR: "amber",
  CUTI_DILUAR_TANGGUNGAN: "amber",
  MENINGGAL: "red",
  NON_AKTIF_LAINNYA: "slate",
};

const STATUS_LABEL: Record<string, string> = {
  BELUM_DIPROSES: "Belum Diproses",
  SEDANG_DIUSULKAN: "Sedang Diusulkan",
  SK_TERBIT: "SK Terbit",
  DITUNDA: "Ditunda",
  AKTIF: "Aktif",
  PENSIUN: "Pensiun",
  MUTASI_KELUAR: "Mutasi Keluar",
  CUTI_DILUAR_TANGGUNGAN: "CLTN",
  MENINGGAL: "Meninggal",
  NON_AKTIF_LAINNYA: "Non-aktif",
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge color={STATUS_COLOR[status] ?? "slate"}>{STATUS_LABEL[status] ?? status}</Badge>;
}
