const ACCESS_TOKEN_KEY = "simpeg_access_token";
const REFRESH_TOKEN_KEY = "simpeg_refresh_token";

/**
 * Base URL of the Worker API. In dev, Vite proxies /api to the local Worker
 * (see vite.config.ts), so this stays empty. In production the frontend
 * (Cloudflare Pages) and API (Cloudflare Worker) are separate deployments —
 * set VITE_API_BASE_URL at build time to the deployed Worker's origin.
 */
export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}
export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}
export function setTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}
export function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    })
      .then(async (res) => {
        if (!res.ok) return false;
        const data = await res.json();
        setTokens(data.accessToken, data.refreshToken);
        return true;
      })
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  isForm?: boolean;
  query?: Record<string, string | number | boolean | undefined | null>;
}

function buildQuery(query?: RequestOptions["query"]): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

async function request<T>(path: string, opts: RequestOptions = {}, isRetry = false): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getAccessToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let body: BodyInit | undefined;
  if (opts.body !== undefined) {
    if (opts.isForm) {
      body = opts.body as FormData;
    } else {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(opts.body);
    }
  }

  const res = await fetch(`${API_BASE}/api${path}${buildQuery(opts.query)}`, {
    method: opts.method ?? "GET",
    headers,
    body,
  });

  if (res.status === 401 && !isRetry && getRefreshToken()) {
    const refreshed = await tryRefresh();
    if (refreshed) return request<T>(path, opts, true);
    clearTokens();
    window.location.href = "/login";
    throw new ApiError(401, "Sesi berakhir, silakan login kembali");
  }

  if (!res.ok) {
    let message = res.statusText;
    let details: unknown;
    try {
      const errBody = await res.json();
      message = errBody.error ?? message;
      details = errBody.details;
    } catch {
      // ignore parse failure
    }
    throw new ApiError(res.status, message, details);
  }

  const contentType = res.headers.get("Content-Type") ?? "";
  if (contentType.includes("application/json")) {
    return res.json() as Promise<T>;
  }
  return res as unknown as T;
}

export const api = {
  get: <T>(path: string, query?: RequestOptions["query"]) => request<T>(path, { method: "GET", query }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  postForm: <T>(path: string, form: FormData) => request<T>(path, { method: "POST", body: form, isForm: true }),
};

export async function downloadFile(path: string, query: RequestOptions["query"], filenameFallback: string) {
  const token = getAccessToken();
  const res = await fetch(`${API_BASE}/api${path}${buildQuery(query)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new ApiError(res.status, "Gagal mengunduh file");
  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = disposition.match(/filename="?([^"]+)"?/);
  const filename = match?.[1] ?? filenameFallback;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
