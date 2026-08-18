import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./lib/auth";
import { Layout } from "./components/Layout";
import { Spinner } from "./components/ui";
import type { RoleCode } from "./types";

import Login from "./pages/Login";
import ChangePassword from "./pages/ChangePassword";
import Dashboard from "./pages/Dashboard";
import PegawaiList from "./pages/PegawaiList";
import PegawaiDetail from "./pages/PegawaiDetail";
import KenaikanPangkat from "./pages/KenaikanPangkat";
import Laporan from "./pages/Laporan";
import UnitKerjaPage from "./pages/pengaturan/UnitKerjaPage";
import JabatanFungsionalPage from "./pages/pengaturan/JabatanFungsionalPage";
import ParameterPage from "./pages/pengaturan/ParameterPage";
import PenggunaPage from "./pages/pengaturan/PenggunaPage";
import LogAktivitasPage from "./pages/LogAktivitasPage";
import NotFound from "./pages/NotFound";

function RequireAuth({ children, roles }: { children: React.ReactNode; roles?: RoleCode[] }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner size={28} className="text-brand-600" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  const { user, loading } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={loading ? null : user ? <Navigate to="/" replace /> : <Login />} />

      <Route
        path="/"
        element={
          <RequireAuth>
            <Dashboard />
          </RequireAuth>
        }
      />
      <Route
        path="/ubah-password"
        element={
          <RequireAuth>
            <ChangePassword />
          </RequireAuth>
        }
      />
      <Route
        path="/pegawai"
        element={
          <RequireAuth>
            <PegawaiList />
          </RequireAuth>
        }
      />
      <Route
        path="/pegawai/:id"
        element={
          <RequireAuth>
            <PegawaiDetail />
          </RequireAuth>
        }
      />
      <Route
        path="/kenaikan-pangkat"
        element={
          <RequireAuth>
            <KenaikanPangkat />
          </RequireAuth>
        }
      />
      <Route
        path="/laporan"
        element={
          <RequireAuth>
            <Laporan />
          </RequireAuth>
        }
      />
      <Route
        path="/pengaturan/unit-kerja"
        element={
          <RequireAuth roles={["super_admin"]}>
            <UnitKerjaPage />
          </RequireAuth>
        }
      />
      <Route
        path="/pengaturan/jabatan-fungsional"
        element={
          <RequireAuth roles={["super_admin"]}>
            <JabatanFungsionalPage />
          </RequireAuth>
        }
      />
      <Route
        path="/pengaturan/parameter"
        element={
          <RequireAuth roles={["super_admin"]}>
            <ParameterPage />
          </RequireAuth>
        }
      />
      <Route
        path="/pengaturan/pengguna"
        element={
          <RequireAuth roles={["super_admin"]}>
            <PenggunaPage />
          </RequireAuth>
        }
      />
      <Route
        path="/log-aktivitas"
        element={
          <RequireAuth roles={["super_admin"]}>
            <LogAktivitasPage />
          </RequireAuth>
        }
      />

      <Route
        path="*"
        element={
          <RequireAuth>
            <NotFound />
          </RequireAuth>
        }
      />
    </Routes>
  );
}
