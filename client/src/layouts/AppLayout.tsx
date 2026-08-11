import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { label } from "../utils/format";
import type { Notifikasi } from "../types";

interface NavItem {
  to: string;
  text: string;
  roles?: string[];
}

const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", text: "Dashboard" },
  { to: "/pegawai", text: "Data Pegawai" },
  { to: "/kenaikan-pangkat", text: "Kenaikan Pangkat" },
  { to: "/laporan", text: "Laporan" },
  { to: "/unit-kerja", text: "Unit Kerja", roles: ["SUPER_ADMIN", "ADMIN_KEPEGAWAIAN"] },
  { to: "/pengaturan", text: "Pengaturan Parameter", roles: ["SUPER_ADMIN"] },
  { to: "/pengguna", text: "Manajemen User", roles: ["SUPER_ADMIN"] },
  { to: "/log-aktivitas", text: "Log Aktivitas", roles: ["SUPER_ADMIN", "ADMIN_KEPEGAWAIAN"] },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [notif, setNotif] = useState<{ data: Notifikasi[]; unreadCount: number }>({ data: [], unreadCount: 0 });
  const [showNotif, setShowNotif] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = () => {
      api
        .get("/notifikasi")
        .then((res) => mounted && setNotif(res.data))
        .catch(() => {});
    };
    load();
    const interval = setInterval(load, 60000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  async function bacaSemua() {
    await api.put("/notifikasi/baca-semua");
    setNotif((n) => ({ data: n.data.map((d) => ({ ...d, isRead: true })), unreadCount: 0 }));
  }

  const items = NAV_ITEMS.filter((item) => !item.roles || (user && item.roles.includes(user.role)));

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="flex w-64 flex-col border-r border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-4">
          <p className="text-sm font-bold text-sky-800">SIMPEG-DINKES KBB</p>
          <p className="text-xs text-slate-500">Dinas Kesehatan Kab. Bandung Barat</p>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                clsx("block rounded-md px-3 py-2 text-sm font-medium", isActive ? "bg-sky-700 text-white" : "text-slate-600 hover:bg-slate-100")
              }
            >
              {item.text}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-100 p-3">
          <p className="truncate text-sm font-medium text-slate-800">{user?.nama}</p>
          <p className="text-xs text-slate-500">{label(user?.role)}</p>
          <button onClick={logout} className="mt-2 text-xs font-medium text-red-600 hover:underline">
            Keluar
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-end gap-4 border-b border-slate-200 bg-white px-6 py-3">
          <div className="relative">
            <button onClick={() => setShowNotif((s) => !s)} className="relative rounded-md p-2 text-slate-500 hover:bg-slate-100">
              🔔
              {notif.unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] text-white">
                  {notif.unreadCount > 9 ? "9+" : notif.unreadCount}
                </span>
              )}
            </button>
            {showNotif && (
              <div className="absolute right-0 z-40 mt-2 w-80 rounded-lg border border-slate-200 bg-white shadow-lg">
                <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
                  <p className="text-sm font-semibold">Notifikasi</p>
                  <button onClick={bacaSemua} className="text-xs text-sky-700 hover:underline">
                    Tandai semua dibaca
                  </button>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {notif.data.length === 0 && <p className="p-4 text-center text-sm text-slate-400">Tidak ada notifikasi</p>}
                  {notif.data.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => {
                        setShowNotif(false);
                        if (n.link) navigate(n.link);
                      }}
                      className={clsx("block w-full border-b border-slate-50 px-3 py-2 text-left hover:bg-slate-50", !n.isRead && "bg-sky-50")}
                    >
                      <p className="text-sm font-medium text-slate-800">{n.judul}</p>
                      <p className="text-xs text-slate-500">{n.pesan}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
