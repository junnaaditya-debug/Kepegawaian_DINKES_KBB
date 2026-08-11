import axios from "axios";

// URL Worker Cloudflare (mis. https://simpeg-dinkes-kbb-api.<subdomain>.workers.dev).
// Kosong berarti backend di-serve pada origin yang sama (mis. lewat Pages Functions/_redirects).
export const API_BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

export const api = axios.create({ baseURL: `${API_BASE_URL}/api` });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("simpeg_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("simpeg_token");
      localStorage.removeItem("simpeg_user");
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export function errorMessage(err: unknown, fallback = "Terjadi kesalahan"): string {
  if (axios.isAxiosError(err)) {
    return err.response?.data?.message || err.message || fallback;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}

/**
 * Endpoint export/dokumen mewajibkan JWT Bearer token, sehingga tidak bisa dibuka lewat
 * window.open()/<a href> biasa (browser tidak menyertakan Authorization header). Helper ini
 * mengambil file sebagai blob lewat axios (header otomatis terpasang oleh interceptor di atas),
 * lalu memicu unduhan lewat elemen <a> sementara.
 */
export async function downloadFile(url: string, filename?: string, params?: Record<string, unknown>) {
  const res = await api.get(url, { responseType: "blob", params });
  const disposition = res.headers["content-disposition"] as string | undefined;
  const match = disposition?.match(/filename="?([^"]+)"?/);
  const resolvedName = filename || match?.[1] || "unduhan";

  const blobUrl = URL.createObjectURL(res.data);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = resolvedName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(blobUrl);
}

/** Membuka dokumen (mis. hasil upload) di tab baru, dengan header autentikasi tersemat. */
export async function openFileInNewTab(url: string) {
  const res = await api.get(url, { responseType: "blob" });
  const blobUrl = URL.createObjectURL(res.data);
  window.open(blobUrl, "_blank");
}
