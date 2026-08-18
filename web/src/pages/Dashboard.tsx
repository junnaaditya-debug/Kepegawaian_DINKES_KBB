import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { DashboardRingkasan } from "../types";
import { PageHeader, Spinner } from "../components/ui";
import { Users, TrendingUp, Building2, ClipboardList } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Link } from "react-router-dom";
import { formatNumber } from "../lib/format";

const COLORS = ["#2563eb", "#0ea5e9", "#22c55e", "#f59e0b", "#a855f7", "#ef4444", "#14b8a6", "#6366f1"];

const STATUS_LABELS: Record<string, string> = {
  belum_diproses: "Belum Diproses",
  sedang_diusulkan: "Sedang Diusulkan",
  sk_terbit: "SK Terbit",
  ditunda: "Ditunda",
};

function StatCard({ label, value, icon, color }: { label: string; value: string | number; icon: React.ReactNode; color: string }) {
  return (
    <div className="card flex items-center gap-4 p-4">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${color}`}>{icon}</div>
      <div>
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className="text-xl font-semibold text-slate-900">{value}</p>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", "ringkasan"],
    queryFn: () => api.get<DashboardRingkasan>("/dashboard/ringkasan"),
  });

  const { data: kenaikan } = useQuery({
    queryKey: ["kenaikan-pangkat", "deteksi", "dashboard-preview"],
    queryFn: () => api.get<{ data: { pegawaiId: number; nama: string; unitKerjaNama: string; periodeLabel: string; jenisKenaikan: string; overdue: boolean }[]; total: number }>(
      "/kenaikan-pangkat/deteksi",
      { rentangBulan: 6 }
    ),
  });

  if (isLoading || !data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="text-brand-600" size={28} />
      </div>
    );
  }

  const totalDueKenaikan = kenaikan?.total ?? 0;
  const totalUnit = data.komposisiUnitKerja.length;
  const skTerbitTahunIni = data.trenKenaikanPangkatTahunan[0]?.jumlah ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" subtitle="Ringkasan data kepegawaian Dinas Kesehatan Kabupaten Bandung Barat" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Pegawai Aktif" value={formatNumber(data.totalPegawaiAktif)} icon={<Users size={20} className="text-white" />} color="bg-brand-600" />
        <StatCard
          label="Due Kenaikan Pangkat (6 bln)"
          value={formatNumber(totalDueKenaikan)}
          icon={<TrendingUp size={20} className="text-white" />}
          color="bg-amber-500"
        />
        <StatCard label="Unit Kerja" value={formatNumber(totalUnit)} icon={<Building2 size={20} className="text-white" />} color="bg-emerald-600" />
        <StatCard label="SK Terbit (Tahun Terbaru)" value={formatNumber(skTerbitTahunIni)} icon={<ClipboardList size={20} className="text-white" />} color="bg-purple-600" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card p-4 lg:col-span-2">
          <h3 className="mb-4 text-sm font-semibold text-slate-800">Komposisi Pegawai per Golongan/Ruang</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.komposisiGolongan}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="golongan" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="jumlah" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-4">
          <h3 className="mb-4 text-sm font-semibold text-slate-800">Jenis Jabatan</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={data.komposisiJenisJabatan}
                dataKey="jumlah"
                nameKey="jenis_jabatan"
                cx="50%"
                cy="45%"
                outerRadius={80}
                labelLine={false}
                label={false}
              >
                {data.komposisiJenisJabatan.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Legend formatter={(v: string) => v} />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card p-4">
          <h3 className="mb-4 text-sm font-semibold text-slate-800">Status Usulan Kenaikan Pangkat</h3>
          {data.statusUsulanKenaikanPangkat.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">Belum ada data usulan</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={data.statusUsulanKenaikanPangkat}
                  dataKey="jumlah"
                  nameKey="status"
                  cx="50%"
                  cy="45%"
                  outerRadius={70}
                  labelLine={false}
                  label={false}
                >
                  {data.statusUsulanKenaikanPangkat.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Legend formatter={(v: string) => STATUS_LABELS[v] ?? v} />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card p-4">
          <h3 className="mb-4 text-sm font-semibold text-slate-800">Tren Kenaikan Pangkat per Tahun</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={[...data.trenKenaikanPangkatTahunan].reverse()}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="tahun" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="jumlah" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800">Segera Naik Pangkat</h3>
            <Link to="/kenaikan-pangkat" className="text-xs font-medium text-brand-600 hover:underline">
              Lihat semua
            </Link>
          </div>
          <div className="space-y-2">
            {(kenaikan?.data ?? []).slice(0, 6).map((r) => (
              <div key={`${r.pegawaiId}-${r.periodeLabel}`} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-xs">
                <div>
                  <p className="font-medium text-slate-800">{r.nama}</p>
                  <p className="text-slate-500">{r.unitKerjaNama}</p>
                </div>
                <span className={`badge ${r.overdue ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}`}>{r.periodeLabel}</span>
              </div>
            ))}
            {(!kenaikan || kenaikan.data.length === 0) && <p className="py-6 text-center text-xs text-slate-400">Tidak ada pegawai due dalam 6 bulan ke depan</p>}
          </div>
        </div>
      </div>

      <div className="card p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-800">Distribusi per Unit Kerja</h3>
        <ResponsiveContainer width="100%" height={Math.max(200, data.komposisiUnitKerja.length * 34)}>
          <BarChart data={data.komposisiUnitKerja} layout="vertical" margin={{ left: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
            <YAxis type="category" dataKey="unit_kerja" width={180} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="jumlah" fill="#0ea5e9" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
