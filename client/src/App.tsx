import { Navigate, Route, Routes } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import PegawaiListPage from "./pages/PegawaiListPage";
import PegawaiDetailPage from "./pages/PegawaiDetailPage";
import KenaikanPangkatPage from "./pages/KenaikanPangkatPage";
import UnitKerjaPage from "./pages/UnitKerjaPage";
import PengaturanPage from "./pages/PengaturanPage";
import PenggunaPage from "./pages/PenggunaPage";
import LaporanPage from "./pages/LaporanPage";
import LogAktivitasPage from "./pages/LogAktivitasPage";
import AppLayout from "./layouts/AppLayout";
import { ProtectedRoute } from "./components/ProtectedRoute";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/pegawai" element={<PegawaiListPage />} />
        <Route path="/pegawai/:id" element={<PegawaiDetailPage />} />
        <Route path="/kenaikan-pangkat" element={<KenaikanPangkatPage />} />
        <Route path="/laporan" element={<LaporanPage />} />
        <Route
          path="/unit-kerja"
          element={
            <ProtectedRoute roles={["SUPER_ADMIN", "ADMIN_KEPEGAWAIAN"]}>
              <UnitKerjaPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/pengaturan"
          element={
            <ProtectedRoute roles={["SUPER_ADMIN"]}>
              <PengaturanPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/pengguna"
          element={
            <ProtectedRoute roles={["SUPER_ADMIN"]}>
              <PenggunaPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/log-aktivitas"
          element={
            <ProtectedRoute roles={["SUPER_ADMIN", "ADMIN_KEPEGAWAIAN"]}>
              <LogAktivitasPage />
            </ProtectedRoute>
          }
        />
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
