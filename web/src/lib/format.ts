export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z");
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function formatMonthsAsYearsMonths(totalMonths: number | null | undefined): string {
  if (totalMonths == null) return "-";
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  const parts: string[] = [];
  if (years > 0) parts.push(`${years} tahun`);
  parts.push(`${months} bulan`);
  return parts.join(" ");
}

export function formatNumber(n: number | null | undefined): string {
  if (n == null) return "-";
  return n.toLocaleString("id-ID");
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
