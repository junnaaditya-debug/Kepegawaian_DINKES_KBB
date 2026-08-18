import { API_BASE, getAccessToken } from "./api";

/** Fetches a dokumen with the auth header and opens it in a new tab (FR-7.2 preview). */
export async function openDocumentPreview(dokumenId: number) {
  const token = getAccessToken();
  const res = await fetch(`${API_BASE}/api/dokumen/${dokumenId}/file`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Gagal memuat dokumen");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
