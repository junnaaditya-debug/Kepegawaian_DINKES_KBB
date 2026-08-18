import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../api/client";

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN_KEPEGAWAIAN: "Admin Kepegawaian",
  KEPALA_BIDANG: "Kepala Bidang/Kasubbag",
  KEPALA_DINAS: "Kepala Dinas",
  PEGAWAI: "Pegawai",
};

export function Topbar({ title }: { title: string }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let active = true;
    api
      .get<{ unreadCount: number }>("/notifikasi?unreadOnly=1")
      .then((res) => active && setUnreadCount(res.unreadCount))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3.5">
      <h1 className="text-lg font-semibold text-slate-800">{title}</h1>
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate("/notifikasi")}
          className="relative rounded-full p-2 text-slate-500 hover:bg-slate-100"
          aria-label="Notifikasi"
        >
          🔔
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
        <div className="relative">
          <button onClick={() => setMenuOpen((v) => !v)} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-100">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
              {user?.nama_lengkap?.charAt(0)?.toUpperCase() ?? "?"}
            </div>
            <div className="text-left">
              <p className="text-sm font-medium leading-tight text-slate-800">{user?.nama_lengkap}</p>
              <p className="text-xs leading-tight text-slate-500">{user ? ROLE_LABEL[user.role] : ""}</p>
            </div>
          </button>
          {menuOpen && (
            <div className="absolute right-0 z-20 mt-2 w-48 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
              <button
                onClick={() => {
                  setMenuOpen(false);
                  navigate("/ubah-password");
                }}
                className="block w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
              >
                Ubah Password
              </button>
              <button onClick={logout} className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-slate-50">
                Keluar
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
