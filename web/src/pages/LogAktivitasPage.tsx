import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { LogAktivitas, Paginated } from "../types";
import { PageHeader, Spinner, Badge, Pagination, EmptyState } from "../components/ui";
import { formatDateTime } from "../lib/format";

const AKSI_COLORS: Record<string, "green" | "blue" | "red" | "yellow" | "purple" | "slate"> = {
  create: "green",
  update: "blue",
  delete: "red",
  login: "slate",
  login_failed: "red",
  logout: "slate",
  export: "purple",
  upload: "blue",
  status_change: "yellow",
  verify: "green",
};

const ENTITAS_OPTIONS = [
  "pegawai",
  "riwayat_jabatan",
  "riwayat_pangkat_golongan",
  "riwayat_pendidikan",
  "angka_kredit",
  "dokumen",
  "users",
  "unit_kerja",
  "parameter_aturan",
  "golongan_masa_kerja_minimum",
  "jenis_jabatan_fungsional",
  "jenjang_jabatan_fungsional",
  "status_usulan_kenaikan_pangkat",
  "auth",
];

export default function LogAktivitasPage() {
  const [entitas, setEntitas] = useState("");
  const [aksi, setAksi] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 30;

  const { data, isLoading } = useQuery({
    queryKey: ["log-aktivitas", { entitas, aksi, page }],
    queryFn: () =>
      api.get<Paginated<LogAktivitas>>("/log-aktivitas", {
        entitas: entitas || undefined,
        aksi: aksi || undefined,
        page,
        pageSize,
      }),
  });

  return (
    <div>
      <PageHeader title="Log Aktivitas" subtitle="Jejak audit seluruh perubahan data kepegawaian: siapa, kapan, dan apa yang diubah (FR-8.3, NFR-5)" />

      <div className="card mb-4 flex flex-wrap gap-3 p-4">
        <select
          className="input max-w-[220px]"
          value={entitas}
          onChange={(e) => {
            setEntitas(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Semua Entitas</option>
          {ENTITAS_OPTIONS.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
        <select
          className="input max-w-[180px]"
          value={aksi}
          onChange={(e) => {
            setAksi(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Semua Aksi</option>
          {Object.keys(AKSI_COLORS).map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex h-48 items-center justify-center">
            <Spinner className="text-brand-600" size={26} />
          </div>
        ) : !data || data.data.length === 0 ? (
          <EmptyState title="Tidak ada log aktivitas" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Waktu</th>
                  <th className="px-4 py-3">Pengguna</th>
                  <th className="px-4 py-3">Aksi</th>
                  <th className="px-4 py-3">Entitas</th>
                  <th className="px-4 py-3">Detail</th>
                  <th className="px-4 py-3">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.data.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">{formatDateTime(log.created_at)}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{log.username_snapshot ?? "-"}</td>
                    <td className="px-4 py-3">
                      <Badge color={AKSI_COLORS[log.aksi] ?? "slate"}>{log.aksi}</Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {log.entitas}
                      {log.entitas_id ? ` #${log.entitas_id}` : ""}
                    </td>
                    <td className="max-w-xs truncate px-4 py-3 text-xs text-slate-500" title={log.detail_json ?? ""}>
                      {log.detail_json ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">{log.ip_address ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && <Pagination page={page} pageSize={pageSize} total={data.total} onPageChange={setPage} />}
      </div>
    </div>
  );
}
