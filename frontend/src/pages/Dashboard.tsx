import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid } from "recharts";
import { api } from "../api/client";
import { StatCard, Card } from "../components/ui/Card";

interface SummaryData {
  totalPegawaiAktif: number;
  komposisiGolongan: { label: string | null; jumlah: number }[];
  komposisiJenisJabatan: { label: string | null; jumlah: number }[];
  komposisiStatusKepegawaian: { label: string; jumlah: number }[];
  komposisiUnitKerja: { label: string; jumlah: number }[];
  kenaikanPangkat: { sudahWaktunya: number; due3Bulan: number; due6Bulan: number; due12Bulan: number };
  statusTindakLanjut: { status: string; jumlah: number }[];
  asOf: string;
}

const JENIS_JABATAN_LABEL: Record<string, string> = {
  STRUKTURAL: "Struktural",
  FUNGSIONAL_TERTENTU: "Fungsional Tertentu",
  PELAKSANA: "Pelaksana",
};

const COLORS = ["#2563eb", "#7c3aed", "#059669", "#d97706", "#dc2626", "#0891b2"];

export default function Dashboard() {
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [tren, setTren] = useState<{ tahun: string; jumlah: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<{ data: SummaryData }>("/dashboard/summary"),
      api.get<{ data: { tahun: string; jumlah: number }[] }>("/dashboard/tren-kenaikan-pangkat"),
    ])
      .then(([s, t]) => {
        setSummary(s.data);
        setTren(t.data);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-slate-500">Memuat dashboard...</p>;
  if (!summary) return <p className="text-slate-500">Gagal memuat data dashboard.</p>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Pegawai Aktif" value={summary.totalPegawaiAktif} accent="brand" />
        <StatCard label="Sudah Waktunya Naik Pangkat" value={summary.kenaikanPangkat.sudahWaktunya} accent="rose" sub="Segera tindak lanjuti" />
        <StatCard label="Proyeksi 3 Bulan ke Depan" value={summary.kenaikanPangkat.due3Bulan} accent="amber" />
        <StatCard label="Proyeksi 12 Bulan ke Depan" value={summary.kenaikanPangkat.due12Bulan} accent="emerald" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Komposisi per Golongan/Ruang">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={summary.komposisiGolongan.filter((d) => d.label)}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" fontSize={12} />
              <YAxis allowDecimals={false} fontSize={12} />
              <Tooltip />
              <Bar dataKey="jumlah" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Komposisi per Jenis Jabatan">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={summary.komposisiJenisJabatan.map((d) => ({ ...d, label: JENIS_JABATAN_LABEL[d.label ?? ""] ?? d.label ?? "Belum diisi" }))}
                dataKey="jumlah"
                nameKey="label"
                cx="50%"
                cy="50%"
                outerRadius={90}
                label
              >
                {summary.komposisiJenisJabatan.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Tren Kenaikan Pangkat per Tahun">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={tren}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="tahun" fontSize={12} />
              <YAxis allowDecimals={false} fontSize={12} />
              <Tooltip />
              <Line type="monotone" dataKey="jumlah" stroke="#059669" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Unit Kerja dengan Pegawai Terbanyak">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={summary.komposisiUnitKerja} layout="vertical" margin={{ left: 40 }}>
              <XAxis type="number" allowDecimals={false} fontSize={12} />
              <YAxis type="category" dataKey="label" width={140} fontSize={11} />
              <Tooltip />
              <Bar dataKey="jumlah" fill="#7c3aed" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <p className="text-xs text-slate-400">Data dihitung otomatis dari parameter aturan yang berlaku, per {new Date(summary.asOf).toLocaleString("id-ID")}.</p>
    </div>
  );
}
