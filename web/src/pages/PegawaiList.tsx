import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { Plus, Search, Upload, Download, FileText } from "lucide-react";
import { api, ApiError, downloadFile } from "../lib/api";
import type { Paginated, PegawaiListItem } from "../types";
import { PageHeader, Pagination, Spinner, Badge, Modal, EmptyState } from "../components/ui";
import { useUnitKerjaList } from "../hooks/useReference";
import { useAuth } from "../lib/auth";
import { GOLONGAN_LIST, JENIS_JABATAN_OPTIONS } from "../lib/constants";
import PegawaiFormModal from "../components/PegawaiFormModal";

export default function PegawaiList() {
  const { user } = useAuth();
  const canWrite = user?.role === "super_admin" || user?.role === "admin_kepegawaian";
  const queryClient = useQueryClient();
  const { data: unitKerjaList } = useUnitKerjaList();

  const [search, setSearch] = useState("");
  const [unitKerjaId, setUnitKerjaId] = useState("");
  const [jenisJabatan, setJenisJabatan] = useState("");
  const [golongan, setGolongan] = useState("");
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const pageSize = 20;

  const { data, isLoading } = useQuery({
    queryKey: ["pegawai", "list", { search, unitKerjaId, jenisJabatan, golongan, page }],
    queryFn: () =>
      api.get<Paginated<PegawaiListItem>>("/pegawai", {
        search: search || undefined,
        unitKerjaId: unitKerjaId || undefined,
        jenisJabatan: jenisJabatan || undefined,
        golongan: golongan || undefined,
        page,
        pageSize,
      }),
  });

  function onFilterChange(setter: (v: string) => void) {
    return (v: string) => {
      setter(v);
      setPage(1);
    };
  }

  async function handleExport(format: "excel" | "pdf") {
    try {
      await downloadFile(`/laporan/pegawai/${format}`, { unitKerjaId: unitKerjaId || undefined }, `data-pegawai.${format === "excel" ? "xlsx" : "pdf"}`);
    } catch {
      toast.error("Gagal mengunduh laporan");
    }
  }

  return (
    <div>
      <PageHeader
        title="Data Pegawai"
        subtitle="Database terpusat data induk pegawai ASN Dinas Kesehatan"
        actions={
          <>
            <button className="btn-secondary" onClick={() => handleExport("excel")}>
              <Download size={16} /> Excel
            </button>
            <button className="btn-secondary" onClick={() => handleExport("pdf")}>
              <FileText size={16} /> PDF
            </button>
            {canWrite && (
              <>
                <button className="btn-secondary" onClick={() => setShowImport(true)}>
                  <Upload size={16} /> Import
                </button>
                <button className="btn-primary" onClick={() => setShowCreate(true)}>
                  <Plus size={16} /> Tambah Pegawai
                </button>
              </>
            )}
          </>
        }
      />

      <div className="card mb-4 flex flex-wrap gap-3 p-4">
        <div className="relative min-w-[220px] flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-9"
            placeholder="Cari nama atau NIP..."
            value={search}
            onChange={(e) => onFilterChange(setSearch)(e.target.value)}
          />
        </div>
        <select className="input max-w-[220px]" value={unitKerjaId} onChange={(e) => onFilterChange(setUnitKerjaId)(e.target.value)}>
          <option value="">Semua Unit Kerja</option>
          {unitKerjaList?.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nama}
            </option>
          ))}
        </select>
        <select className="input max-w-[180px]" value={jenisJabatan} onChange={(e) => onFilterChange(setJenisJabatan)(e.target.value)}>
          <option value="">Semua Jenis Jabatan</option>
          {JENIS_JABATAN_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select className="input max-w-[140px]" value={golongan} onChange={(e) => onFilterChange(setGolongan)(e.target.value)}>
          <option value="">Semua Golongan</option>
          {GOLONGAN_LIST.map((g) => (
            <option key={g} value={g}>
              {g}
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
          <EmptyState title="Tidak ada data pegawai" description="Coba ubah filter pencarian atau tambahkan data pegawai baru." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">NIP / Nama</th>
                  <th className="px-4 py-3">Unit Kerja</th>
                  <th className="px-4 py-3">Jabatan</th>
                  <th className="px-4 py-3">Golongan/Pangkat</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.data.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link to={`/pegawai/${p.id}`} className="font-medium text-brand-700 hover:underline">
                        {p.gelar_depan ? `${p.gelar_depan} ` : ""}
                        {p.nama}
                        {p.gelar_belakang ? `, ${p.gelar_belakang}` : ""}
                      </Link>
                      <p className="text-xs text-slate-500">{p.nip}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{p.unit_kerja_nama}</td>
                    <td className="px-4 py-3 text-slate-600">{p.jabatan_nama_display ?? "-"}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {p.golongan_ruang_aktif ?? "-"} · {p.nama_pangkat_aktif ?? "-"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge color={p.status_aktif === "aktif" ? "green" : "slate"}>{p.status_aktif}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && <Pagination page={page} pageSize={pageSize} total={data.total} onPageChange={setPage} />}
      </div>

      {showCreate && (
        <PegawaiFormModal
          onClose={() => setShowCreate(false)}
          onSuccess={() => {
            setShowCreate(false);
            queryClient.invalidateQueries({ queryKey: ["pegawai", "list"] });
          }}
        />
      )}

      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["pegawai", "list"] });
          }}
        />
      )}
    </div>
  );
}

function ImportModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<{ inserted: number; totalRows: number; errors: { row: number; message: string }[] } | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Pilih file terlebih dahulu");
      const form = new FormData();
      form.append("file", file);
      return api.postForm<{ inserted: number; totalRows: number; errors: { row: number; message: string }[] }>("/pegawai/import", form);
    },
    onSuccess: (res) => {
      setResult(res);
      onSuccess();
      if (res.errors.length === 0) toast.success(`${res.inserted} pegawai berhasil diimpor`);
      else toast(`${res.inserted} baris berhasil, ${res.errors.length} baris gagal`, { icon: "⚠️" });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Gagal mengimpor data"),
  });

  return (
    <Modal open onClose={onClose} title="Import Data Pegawai (Excel/CSV)" width="max-w-2xl">
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Kolom yang dibaca: <code className="text-xs">nip, nip_lama, nama, gelar_depan, gelar_belakang, tempat_lahir, tanggal_lahir, jenis_kelamin (L/P),
          alamat, no_hp, email, status_kepegawaian, tmt_cpns, tmt_pns, unit_kerja_kode, jenis_jabatan, jabatan_struktural_nama, golongan_ruang_aktif,
          nama_pangkat_aktif, tmt_pangkat_aktif</code>. Kolom <code className="text-xs">unit_kerja_kode</code> harus cocok dengan kode Unit Kerja terdaftar.
        </p>
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full rounded-lg border border-dashed border-slate-300 px-3 py-6 text-sm text-slate-500"
        />
        {result && (
          <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200 text-xs">
            <p className="border-b border-slate-100 bg-slate-50 px-3 py-2 font-medium">
              {result.inserted} dari {result.totalRows} baris berhasil diimpor
            </p>
            {result.errors.map((e, i) => (
              <p key={i} className="border-b border-slate-50 px-3 py-1.5 text-red-600">
                Baris {e.row}: {e.message}
              </p>
            ))}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={onClose}>
            Tutup
          </button>
          <button className="btn-primary" disabled={!file || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending && <Spinner size={14} />} Proses Import
          </button>
        </div>
      </div>
    </Modal>
  );
}
