import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { ToastProvider } from "./components/ui/Toast";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AppLayout } from "./components/layout/AppLayout";
import type { Role } from "./types";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import PegawaiList from "./pages/Pegawai/List";
import PegawaiDetail from "./pages/Pegawai/Detail";
import PegawaiForm from "./pages/Pegawai/Form";
import KenaikanPangkatList from "./pages/KenaikanPangkat/List";
import ParameterPage from "./pages/Pengaturan/Parameter";
import UsersList from "./pages/Users/List";
import UnitKerjaList from "./pages/UnitKerja/List";
import LaporanPage from "./pages/Laporan";
import NotifikasiPage from "./pages/Notifikasi";
import ChangePassword from "./pages/ChangePassword";
import AuditLogPage from "./pages/AuditLog";

function Page({ title, roles, children }: { title: string; roles?: Role[]; children: ReactNode }) {
  return (
    <ProtectedRoute roles={roles}>
      <AppLayout title={title}>{children}</AppLayout>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        <Route path="/dashboard" element={<Page title="Dashboard"><Dashboard /></Page>} />
        <Route path="/pegawai" element={<Page title="Data Pegawai"><PegawaiList /></Page>} />
        <Route path="/pegawai/baru" element={<Page title="Tambah Pegawai" roles={["SUPER_ADMIN", "ADMIN_KEPEGAWAIAN"]}><PegawaiForm /></Page>} />
        <Route path="/pegawai/:id" element={<Page title="Detail Pegawai"><PegawaiDetail /></Page>} />
        <Route path="/pegawai/:id/edit" element={<Page title="Edit Pegawai" roles={["SUPER_ADMIN", "ADMIN_KEPEGAWAIAN"]}><PegawaiForm /></Page>} />
        <Route path="/kenaikan-pangkat" element={<Page title="Kenaikan Pangkat"><KenaikanPangkatList /></Page>} />
        <Route path="/laporan" element={<Page title="Laporan"><LaporanPage /></Page>} />
        <Route path="/unit-kerja" element={<Page title="Unit Kerja" roles={["SUPER_ADMIN", "ADMIN_KEPEGAWAIAN"]}><UnitKerjaList /></Page>} />
        <Route path="/pengaturan/parameter" element={<Page title="Parameter Aturan" roles={["SUPER_ADMIN", "ADMIN_KEPEGAWAIAN", "KEPALA_BIDANG", "KEPALA_DINAS"]}><ParameterPage /></Page>} />
        <Route path="/pengguna" element={<Page title="Manajemen User" roles={["SUPER_ADMIN"]}><UsersList /></Page>} />
        <Route path="/audit-log" element={<Page title="Log Aktivitas" roles={["SUPER_ADMIN", "KEPALA_DINAS"]}><AuditLogPage /></Page>} />
        <Route path="/notifikasi" element={<Page title="Notifikasi"><NotifikasiPage /></Page>} />
        <Route path="/ubah-password" element={<Page title="Ubah Password"><ChangePassword /></Page>} />

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </ToastProvider>
  );
}
