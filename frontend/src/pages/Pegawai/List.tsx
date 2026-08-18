import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import type { Pegawai, PaginationMeta, UnitKerja } from "../../types";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input, Select } from "../../components/ui/Input";
import { StatusBadge } from "../../components/ui/Badge";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../components/ui/Toast";
import { ImportModal } from "./ImportModal";

export default function PegawaiList() {
  const { user } = useAuth();
  const { push } = useToast();
  const [data, setData] = useState<Pegawai[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({ page: 1, pageSize: 20, total: 0 });
  const [unitKerjaList, setUnitKerjaList] = useState<UnitKerja[]>([]);
  const [search, setSearch] = useState("");
  const [unitKerjaId, setUnitKerjaId] = useState("");
  const [statusAktif, setStatusAktif] = useState("AKTIF");
  const [loading, setLoading] = useState(true);
  const [importOpen, setImportOpen] = useState(false);

  const canEdit = user?.role === "SUPER_ADMIN" || user?.role === "ADMIN_KEPEGAWAIAN";

  useEffect(() => {
    api.get<{ data: UnitKerja[] }>("/unit-kerja").then((res) => setUnitKerjaList(res.data));
  }, []);

  async function load(page = 1) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "20", statusAktif });
      if (search) params.set("search", search);
      if (unitKerjaId) params.set("unitKerjaId", unitKerjaId);
      const res = await api.get<{ data: Pegawai[]; pagination: PaginationMeta }>(`/pegawai?${params.toString()}`);
      setData(res.data);
      setPagination(res.pagination);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusAktif]);

  async function handleExport(format: "excel" | "pdf") {
    try {
      await api.download(`/laporan/pegawai/export?format=${format}`, `data-pegawai.${format === "excel" ? "xlsx" : "pdf"}`);
    } catch {
      push("Gagal mengekspor laporan.", "error");
    }
  }

  const totalPages = Math.max(1, Math.ceil(pagination.total / pagination.pageSize));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-slate-800">Data Pegawai</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => handleExport("excel")}>⬇ Excel</Button>
          <Button variant="secondary" onClick={() => handleExport("pdf")}>⬇ PDF</Button>
          {canEdit && (
            <>
              <Button variant="secondary" onClick={() => setImportOpen(true)}>Import Data</Button>
              <Link to="/pegawai/baru">
                <Button>+ Tambah Pegawai</Button>
              </Link>
            </>
          )}
        </div>
      </div>

      <Card>
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
          <Input
            placeholder="Cari nama / NIP..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load(1)}
          />
          <Select value={unitKerjaId} onChange={(e) => setUnitKerjaId(e.target.value)}>
            <option value="">Semua Unit Kerja</option>
            {unitKerjaList.map((u) => (
              <option key={u.id} value={u.id}>{u.nama}</option>
            ))}
          </Select>
          <Select value={statusAktif} onChange={(e) => setStatusAktif(e.target.value)}>
            <option value="AKTIF">Status: Aktif</option>
            <option value="SEMUA">Status: Semua</option>
            <option value="PENSIUN">Status: Pensiun</option>
            <option value="MUTASI_KELUAR">Status: Mutasi Keluar</option>
          </Select>
          <Button variant="secondary" onClick={() => load(1)}>Terapkan Filter</Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <th className="py-2 pr-4">NIP</th>
                <th className="py-2 pr-4">Nama</th>
                <th className="py-2 pr-4">Unit Kerja</th>
                <th className="py-2 pr-4">Jabatan</th>
                <th className="py-2 pr-4">Gol/Ruang</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="py-6 text-center text-slate-400">Memuat...</td></tr>
              ) : data.length === 0 ? (
                <tr><td colSpan={7} className="py-6 text-center text-slate-400">Tidak ada data pegawai.</td></tr>
              ) : (
                data.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-2.5 pr-4 font-mono text-xs">{p.nip}</td>
                    <td className="py-2.5 pr-4 font-medium text-slate-800">{p.nama}</td>
                    <td className="py-2.5 pr-4 text-slate-600">{p.unit_kerja_nama ?? "-"}</td>
                    <td className="py-2.5 pr-4 text-slate-600">{p.nama_jabatan ?? "-"}</td>
                    <td className="py-2.5 pr-4 text-slate-600">{p.golongan_ruang_aktif ?? "-"}</td>
                    <td className="py-2.5 pr-4"><StatusBadge status={p.status_aktif} /></td>
                    <td className="py-2.5 pr-4 text-right">
                      <Link to={`/pegawai/${p.id}`} className="text-brand-600 hover:underline">Detail</Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
          <span>Total {pagination.total} pegawai</span>
          <div className="flex items-center gap-2">
            <Button variant="secondary" disabled={pagination.page <= 1} onClick={() => load(pagination.page - 1)}>Sebelumnya</Button>
            <span>Halaman {pagination.page} / {totalPages}</span>
            <Button variant="secondary" disabled={pagination.page >= totalPages} onClick={() => load(pagination.page + 1)}>Berikutnya</Button>
          </div>
        </div>
      </Card>

      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} onImported={() => { setImportOpen(false); load(1); }} unitKerjaList={unitKerjaList} />
    </div>
  );
}
