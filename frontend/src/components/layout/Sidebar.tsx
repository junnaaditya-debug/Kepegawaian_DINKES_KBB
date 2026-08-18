import { NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import type { Role } from "../../types";

interface MenuItem {
  to: string;
  label: string;
  icon: string;
  roles?: Role[];
}

const MENU: MenuItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: "📊" },
  { to: "/pegawai", label: "Data Pegawai", icon: "🧑‍⚕️" },
  { to: "/kenaikan-pangkat", label: "Kenaikan Pangkat", icon: "🎖️" },
  { to: "/laporan", label: "Laporan", icon: "📄" },
  { to: "/unit-kerja", label: "Unit Kerja", icon: "🏥", roles: ["SUPER_ADMIN", "ADMIN_KEPEGAWAIAN"] },
  { to: "/pengaturan/parameter", label: "Parameter Aturan", icon: "⚙️", roles: ["SUPER_ADMIN"] },
  { to: "/pengguna", label: "Manajemen User", icon: "👥", roles: ["SUPER_ADMIN"] },
  { to: "/audit-log", label: "Log Aktivitas", icon: "🔍", roles: ["SUPER_ADMIN", "KEPALA_DINAS"] },
];

export function Sidebar() {
  const { user } = useAuth();

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
      <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white font-bold">SD</div>
        <div>
          <p className="text-sm font-bold leading-tight text-slate-800">SIMPEG-DINKES</p>
          <p className="text-xs leading-tight text-slate-500">Kabupaten Bandung Barat</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {MENU.filter((item) => !item.roles || (user && item.roles.includes(user.role))).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100"
              }`
            }
          >
            <span className="text-base">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-slate-100 p-3 text-center text-[11px] text-slate-400">
        SIMPEG-DINKES KBB &copy; {new Date().getFullYear()}
      </div>
    </aside>
  );
}
