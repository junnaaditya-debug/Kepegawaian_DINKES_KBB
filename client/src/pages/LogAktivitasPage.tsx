import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { Card, EmptyState, Input, Spinner } from "../components/ui";
import type { LogAktivitas } from "../types";
import { formatTanggalWaktu } from "../utils/format";

export default function LogAktivitasPage() {
  const [entitas, setEntitas] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery<{ data: LogAktivitas[]; total: number; page: number; pageSize: number }>({
    queryKey: ["log-aktivitas", { entitas, page }],
    queryFn: () => api.get("/log-aktivitas", { params: { entitas: entitas || undefined, page } }).then((r) => r.data),
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Log Aktivitas</h1>
        <p className="text-sm text-slate-500">Audit trail seluruh perubahan data kepegawaian (siapa, kapan, apa)</p>
      </div>

      <Card>
        <div className="mb-4 max-w-xs">
          <Input
            placeholder="Filter berdasarkan entitas (mis. Pegawai)"
            value={entitas}
            onChange={(e) => {
              setPage(1);
              setEntitas(e.target.value);
            }}
          />
        </div>

        {isLoading ? (
          <Spinner />
        ) : !data || data.data.length === 0 ? (
          <EmptyState text="Belum ada log aktivitas" />
        ) : (
          <>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                  <th className="py-2 pr-3">Waktu</th>
                  <th className="py-2 pr-3">User</th>
                  <th className="py-2 pr-3">Aksi</th>
                  <th className="py-2 pr-3">Entitas</th>
                  <th className="py-2 pr-3">Deskripsi</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((l) => (
                  <tr key={l.id} className="border-b border-slate-50">
                    <td className="py-2 pr-3 text-xs text-slate-500">{formatTanggalWaktu(l.createdAt)}</td>
                    <td className="py-2 pr-3">{l.user?.nama || "Sistem"}</td>
                    <td className="py-2 pr-3 font-medium">{l.aksi}</td>
                    <td className="py-2 pr-3">{l.entitas}</td>
                    <td className="py-2 pr-3 text-slate-500">{l.deskripsi || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4 flex justify-between text-sm text-slate-500">
              <span>
                Total {data.total} log
              </span>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="disabled:opacity-40">
                  ← Sebelumnya
                </button>
                <button disabled={data.page * data.pageSize >= data.total} onClick={() => setPage((p) => p + 1)} className="disabled:opacity-40">
                  Berikutnya →
                </button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
