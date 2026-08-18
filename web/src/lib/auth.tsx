import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, clearTokens, getAccessToken, setTokens } from "./api";
import type { AuthUser } from "../types";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  async function refreshUser() {
    try {
      const me = await api.get<AuthUser>("/auth/me");
      setUser(me);
    } catch {
      setUser(null);
    }
  }

  useEffect(() => {
    (async () => {
      if (getAccessToken()) {
        await refreshUser();
      }
      setLoading(false);
    })();
  }, []);

  async function login(username: string, password: string) {
    const data = await api.post<{ accessToken: string; refreshToken: string; user: AuthUser }>("/auth/login", {
      username,
      password,
    });
    setTokens(data.accessToken, data.refreshToken);
    setUser(data.user);
  }

  function logout() {
    const refreshToken = localStorage.getItem("simpeg_refresh_token");
    if (refreshToken) {
      api.post("/auth/logout", { refreshToken }).catch(() => {});
    }
    clearTokens();
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  admin_kepegawaian: "Admin Kepegawaian",
  kepala_bidang: "Kepala Bidang/Kasubbag",
  kepala_dinas: "Kepala Dinas",
  pegawai: "Pegawai",
};
