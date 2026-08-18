import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { LogAktivitas, PaginationMeta } from "../types";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";

const AKSI_COLOR: Record<string, "green" | "blue" | "red" | "amber" | "slate"> = {
  CREATE: "green", UPDATE: "blue", DELETE: "red", LOGIN: "slate", LOGIN_FAILED: "red",
  EXPORT: "amber", UPLOAD: "blue", STATUS_CHANGE: "amber",
};

export default function AuditLogPage() {
  const [items, setItems] = useState<LogAktivitas[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({ page: 1, pageSize: 30, total: 0 });
  const [loading, setLoading] = useState(true);

  async function load(page = 1) {
    setLoading(true);
    const res = await api.get<{ data: LogAktivitas[]; pagination: PaginationMeta }>(`/audit-log?page=${page}&pageSize=30`);
    setItems(res.data);
    setPagination(res.pagination);
    setLoading(false);
  }

  useEffect(() => {
    load(1);
  }, []);

  const totalPages = Math.max(1, Math.ceil(pagination.total / pagination.pageSize));

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-slate-800">Log Aktivitas (Audit Trail)</h2>
      <Card>
        <table className="w-full text-left text-sm">
          <thead><tr className="border-b border-slate-200 text-xs uppercase text-slate-500"><th className="py-2 pr-4">Waktu</th><th>User</th><th>Aksi</th><th>Entitas</th><th>Deskripsi</th></tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="py-6 text-center text-slate-400">Memuat...</td></tr>
            ) : (
              items.map((log) => (
                <tr key={log.id} className="border-b border-slate-100">
                  <td className="py-2 pr-4 text-xs text-slate-500">{new Date(log.created_at).toLocaleString("id-ID")}</td>
                  <td className="py-2 pr-4">{log.username ?? "-"}</td>
                  <td className="py-2 pr-4"><Badge color={AKSI_COLOR[log.aksi] ?? "slate"}>{log.aksi}</Badge></td>
                  <td className="py-2 pr-4 text-xs text-slate-500">{log.entity_type}</td>
                  <td className="py-2 pr-4 text-slate-600">{log.deskripsi ?? "-"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
          <span>Total {pagination.total} log</span>
          <div className="flex items-center gap-2">
            <Button variant="secondary" disabled={pagination.page <= 1} onClick={() => load(pagination.page - 1)}>Sebelumnya</Button>
            <span>Halaman {pagination.page} / {totalPages}</span>
            <Button variant="secondary" disabled={pagination.page >= totalPages} onClick={() => load(pagination.page + 1)}>Berikutnya</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
