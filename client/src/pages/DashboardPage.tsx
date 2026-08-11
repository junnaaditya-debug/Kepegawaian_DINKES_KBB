import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../api/client";
import { Card, Spinner } from "../components/ui";
import type { DashboardRingkasan } from "../types";
import { label } from "../utils/format";

const COLORS = ["#0369a1", "#7c3aed", "#059669", "#d97706", "#dc2626", "#0891b2", "#4338ca"];

function StatCard({ title, value, tone }: { title: string; value: number | string; tone?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-slate-500">{title}</p>
      <p className={`mt-1 text-2xl font-bold ${tone || "text-slate-800"}`}>{value}</p>
    </div>
  );
}

export default function DashboardPage() {
  const { data, isLoading } = useQuery<DashboardRingkasan>({
    queryKey: ["dashboard-ringkasan"],
    queryFn: () => api.get("/dashboard/ringkasan").then((r) => r.data),
  });

  if (isLoading || !data) return <Spinner />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-sm text-slate-500">Ringkasan data kepegawaian Dinkes KBB</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard title="Total Pegawai" value={data.totalPegawai} />
        <StatCard title="Pegawai Aktif" value={data.totalAktif} tone="text-green-700" />
        <StatCard title="Due Kenaikan Pangkat (berjalan)" value={data.dueKenaikanPangkatBerjalan} tone="text-amber-700" />
        <StatCard title="Due Kenaikan Pangkat (12 bulan)" value={data.dueKenaikanPangkat12Bulan} tone="text-sky-700" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Komposisi per Golongan">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.perGolongan}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="golongan" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="jumlah" fill="#0369a1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Komposisi per Jenis Jabatan">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={data.perJenisJabatan} dataKey="jumlah" nameKey="jenis" cx="50%" cy="50%" outerRadius={100} isAnimationActive={false} label={(entry: any) => label(entry.jenis)}>
                {data.perJenisJabatan.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: any, _n: any, item: any) => [value, label(item.payload.jenis)]} />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Komposisi Jenis Kelamin">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={data.perJenisKelamin} dataKey="jumlah" nameKey="jenisKelamin" cx="50%" cy="50%" outerRadius={90} isAnimationActive={false} label={(entry: any) => label(entry.jenisKelamin)}>
                {data.perJenisKelamin.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: any, _n: any, item: any) => [value, label(item.payload.jenisKelamin)]} />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Komposisi Status Kepegawaian">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.perStatusKepegawaian} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
              <YAxis type="category" dataKey="status" tick={{ fontSize: 12 }} width={70} />
              <Tooltip />
              <Bar dataKey="jumlah" fill="#059669" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}
