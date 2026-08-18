import { type ReactNode, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  TrendingUp,
  FileBarChart,
  Settings,
  UserCog,
  Building2,
  Briefcase,
  ScrollText,
  Bell,
  LogOut,
  Menu,
  X,
  ChevronDown,
} from "lucide-react";
import { useAuth, ROLE_LABELS } from "../lib/auth";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { Notifikasi, RoleCode } from "../types";
import { formatDateTime } from "../lib/format";

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  roles?: RoleCode[];
}

const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Dashboard", icon: <LayoutDashboard size={18} /> },
  { to: "/pegawai", label: "Data Pegawai", icon: <Users size={18} /> },
  { to: "/kenaikan-pangkat", label: "Kenaikan Pangkat", icon: <TrendingUp size={18} /> },
  { to: "/laporan", label: "Laporan", icon: <FileBarChart size={18} /> },
  { to: "/pengaturan/unit-kerja", label: "Unit Kerja", icon: <Building2 size={18} />, roles: ["super_admin"] },
  { to: "/pengaturan/jabatan-fungsional", label: "Jabatan Fungsional", icon: <Briefcase size={18} />, roles: ["super_admin"] },
  { to: "/pengaturan/parameter", label: "Parameter Aturan", icon: <Settings size={18} />, roles: ["super_admin"] },
  { to: "/pengaturan/pengguna", label: "Manajemen Pengguna", icon: <UserCog size={18} />, roles: ["super_admin"] },
  { to: "/log-aktivitas", label: "Log Aktivitas", icon: <ScrollText size={18} />, roles: ["super_admin"] },
];

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const { data: unreadCount } = useQuery({
    queryKey: ["notifikasi", "unread-count"],
    queryFn: () => api.get<{ count: number }>("/notifikasi/unread-count"),
    refetchInterval: 60_000,
  });

  const { data: notifications } = useQuery({
    queryKey: ["notifikasi", "list"],
    queryFn: () => api.get<Notifikasi[]>("/notifikasi"),
    enabled: notifOpen,
  });

  if (!user) return null;
  const visibleItems = NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(user.role));

  async function markAllRead() {
    await api.post("/notifikasi/mark-all-read");
    setNotifOpen(false);
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {sidebarOpen && <div className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <aside
        className={`fixed z-40 flex h-full w-64 flex-col border-r border-slate-200 bg-white transition-transform lg:static lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">DK</div>
          <div>
            <p className="text-sm font-semibold leading-tight text-slate-900">SIMPEG-DINKES</p>
            <p className="text-[11px] leading-tight text-slate-500">Kabupaten Bandung Barat</p>
          </div>
          <button className="ml-auto rounded p-1 text-slate-400 hover:bg-slate-100 lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X size={18} />
          </button>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
          {visibleItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100"
                }`
              }
              onClick={() => setSidebarOpen(false)}
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-200 p-3">
          <button onClick={logout} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
            <LogOut size={18} />
            Keluar
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
          <button className="rounded p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu size={20} />
          </button>
          <div className="flex-1" />

          <div className="relative">
            <button
              className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              onClick={() => setNotifOpen((v) => !v)}
            >
              <Bell size={19} />
              {!!unreadCount?.count && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                  {unreadCount.count > 9 ? "9+" : unreadCount.count}
                </span>
              )}
            </button>
            {notifOpen && (
              <div className="absolute right-0 z-50 mt-2 w-80 rounded-xl border border-slate-200 bg-white shadow-lg">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
                  <p className="text-sm font-semibold text-slate-800">Notifikasi</p>
                  <button className="text-xs font-medium text-brand-600 hover:underline" onClick={markAllRead}>
                    Tandai semua dibaca
                  </button>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {!notifications || notifications.length === 0 ? (
                    <p className="px-4 py-6 text-center text-xs text-slate-400">Tidak ada notifikasi</p>
                  ) : (
                    notifications.map((n) => (
                      <div key={n.id} className={`border-b border-slate-50 px-4 py-2.5 text-sm ${!n.is_read ? "bg-brand-50/50" : ""}`}>
                        <p className="font-medium text-slate-800">{n.judul}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{n.pesan}</p>
                        <p className="mt-1 text-[11px] text-slate-400">{formatDateTime(n.created_at)}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="relative">
            <button className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-100" onClick={() => setUserMenuOpen((v) => !v)}>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
                {user.fullName.charAt(0).toUpperCase()}
              </div>
              <div className="hidden text-left sm:block">
                <p className="text-sm font-medium leading-tight text-slate-800">{user.fullName}</p>
                <p className="text-[11px] leading-tight text-slate-500">{ROLE_LABELS[user.role]}</p>
              </div>
              <ChevronDown size={14} className="text-slate-400" />
            </button>
            {userMenuOpen && (
              <div className="absolute right-0 z-50 mt-2 w-48 rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                <button
                  className="block w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                  onClick={() => {
                    setUserMenuOpen(false);
                    navigate("/ubah-password");
                  }}
                >
                  Ubah Password
                </button>
                <button className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-slate-50" onClick={logout}>
                  Keluar
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
