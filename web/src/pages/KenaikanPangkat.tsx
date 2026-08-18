import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { Download, FileText, ShieldCheck } from "lucide-react";
import { api, ApiError, downloadFile } from "../lib/api";
import type { KenaikanPangkatRow } from "../types";
import { Badge, EmptyState, PageHeader, Spinner } from "../components/ui";
import { useUnitKerjaList } from "../hooks/useReference";
import { useAuth } from "../lib/auth";
import { STATUS_KEPEGAWAIAN_OPTIONS, STATUS_USULAN_LABELS } from "../lib/constants";
import { formatNumber } from "../lib/format";

const STATUS_COLORS: Record<string, "slate" | "blue" | "green" | "yellow"> = {
  belum_diproses: "slate",
  sedang_diusulkan: "blue",
  sk_terbit: "green",
  ditunda: "yellow",
};

export default function KenaikanPangkat() {
  const { user } = useAuth();
  const canWrite = user?.role === "super_admin" || user?.role === "admin_kepegawaian";
  const canVerify = user?.role === "kepala_bidang" || user?.role === "super_admin";
  const queryClient = useQueryClient();
  const { data: unitKerjaList } = useUnitKerjaList();

  const [jenis, setJenis] = useState("all");
  const [unitKerjaId, setUnitKerjaId] = useState("");
  const [jenisKepegawaian, setJenisKepegawaian] = useState("");
  const [rentangBulan, setRentangBulan] = useState("6");
  const [noteFor, setNoteFor] = useState<KenaikanPangkatRow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["kenaikan-pangkat", "deteksi", { jenis, unitKerjaId, jenisKepegawaian, rentangBulan }],
    queryFn: () =>
      api.get<{ data: KenaikanPangkatRow[]; total: number }>("/kenaikan-pangkat/deteksi", {
        jenis: jenis === "all" ? undefined : jenis,
        unitKerjaId: unitKerjaId || undefined,
        jenisKepegawaian: jenisKepegawaian || undefined,
        rentangBulan,
      }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ row, status, catatan }: { row: KenaikanPangkatRow; status: string; catatan?: string }) =>
      api.patch(`/kenaikan-pangkat/status/${row.pegawaiId}/${row.periodeTahun}/${row.periodeBulan}`, {
        status,
        catatan,
        jenisKenaikan: row.jenisKenaikan,
      }),
    onSuccess: () => {
      toast.success("Status tindak lanjut diperbarui");
      queryClient.invalidateQueries({ queryKey: ["kenaikan-pangkat"] });
      setNoteFor(null);
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Gagal memperbarui status"),
  });

  const verifyMutation = useMutation({
    mutationFn: (row: KenaikanPangkatRow) =>
      api.patch(`/kenaikan-pangkat/status/${row.pegawaiId}/${row.periodeTahun}/${row.periodeBulan}/verifikasi`, {
        jenisKenaikan: row.jenisKenaikan,
      }),
    onSuccess: () => {
      toast.success("Data diverifikasi");
      queryClient.invalidateQueries({ queryKey: ["kenaikan-pangkat"] });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Gagal memverifikasi"),
  });

  async function handleExport(format: "excel" | "pdf") {
    try {
      await downloadFile(
        `/laporan/kenaikan-pangkat/${format}`,
        { jenis: jenis === "all" ? undefined : jenis, unitKerjaId: unitKerjaId || undefined, jenisKepegawaian: jenisKepegawaian || undefined, rentangBulan },
        `usulan-kenaikan-pangkat.${format === "excel" ? "xlsx" : "pdf"}`
      );
    } catch {
      toast.error("Gagal mengunduh laporan");
    }
  }

  return (
    <div>
      <PageHeader
        title="Daftar Kenaikan Pangkat"
        subtitle="Deteksi otomatis pegawai yang sudah/akan waktunya naik pangkat & golongan (FR-4)"
        actions={
          <>
            <button className="btn-secondary" onClick={() => handleExport("excel")}>
              <Download size={16} /> Excel
            </button>
            <button className="btn-secondary" onClick={() => handleExport("pdf")}>
              <FileText size={16} /> PDF
            </button>
          </>
        }
      />

      <div className="card mb-4 flex flex-wrap gap-3 p-4">
        <select className="input max-w-[200px]" value={jenis} onChange={(e) => setJenis(e.target.value)}>
          <option value="all">Semua Jenis Kenaikan</option>
          <option value="reguler">Reguler</option>
          <option value="fungsional">Fungsional</option>
        </select>
        <select className="input max-w-[220px]" value={unitKerjaId} onChange={(e) => setUnitKerjaId(e.target.value)}>
          <option value="">Semua Unit Kerja</option>
          {unitKerjaList?.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nama}
            </option>
          ))}
        </select>
        <select className="input max-w-[180px]" value={jenisKepegawaian} onChange={(e) => setJenisKepegawaian(e.target.value)}>
          <option value="">Semua Status Kepegawaian</option>
          {STATUS_KEPEGAWAIAN_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select className="input max-w-[220px]" value={rentangBulan} onChange={(e) => setRentangBulan(e.target.value)}>
          <option value="3">3 bulan ke depan</option>
          <option value="6">6 bulan ke depan</option>
          <option value="12">1 tahun ke depan</option>
          <option value="24">2 tahun ke depan</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex h-48 items-center justify-center">
            <Spinner className="text-brand-600" size={26} />
          </div>
        ) : !data || data.data.length === 0 ? (
          <EmptyState title="Tidak ada pegawai yang memenuhi kriteria" description="Coba perluas rentang periode atau ubah filter." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Pegawai</th>
                  <th className="px-4 py-3">Unit Kerja</th>
                  <th className="px-4 py-3">Jenis</th>
                  <th className="px-4 py-3">Golongan</th>
                  <th className="px-4 py-3">Periode</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.data.map((r) => (
                  <tr key={`${r.pegawaiId}-${r.periodeTahun}-${r.periodeBulan}-${r.jenisKenaikan}`} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link to={`/pegawai/${r.pegawaiId}`} className="font-medium text-brand-700 hover:underline">
                        {r.nama}
                      </Link>
                      <p className="text-xs text-slate-500">{r.nip}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{r.unitKerjaNama}</td>
                    <td className="px-4 py-3">
                      <Badge color={r.jenisKenaikan === "reguler" ? "blue" : "purple"}>{r.jenisKenaikan}</Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {r.golonganSaatIni} → <span className="font-medium text-slate-800">{r.golonganBerikutnya}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={r.overdue ? "font-medium text-red-600" : "text-slate-600"}>{r.periodeLabel}</span>
                      {r.overdue && <p className="text-[11px] text-red-500">Sudah lewat periode</p>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <Badge color={STATUS_COLORS[r.status]}>{STATUS_USULAN_LABELS[r.status]}</Badge>
                        {r.diverifikasiAtasan && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600">
                            <ShieldCheck size={12} /> Diverifikasi atasan
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {canWrite && (
                          <>
                            <button
                              className="btn-ghost px-2 py-1 text-xs"
                              disabled={r.status === "sedang_diusulkan"}
                              onClick={() => statusMutation.mutate({ row: r, status: "sedang_diusulkan" })}
                            >
                              Usulkan
                            </button>
                            <button className="btn-ghost px-2 py-1 text-xs text-amber-600" onClick={() => setNoteFor(r)}>
                              Tunda
                            </button>
                          </>
                        )}
                        {canVerify && !r.diverifikasiAtasan && (
                          <button className="btn-ghost px-2 py-1 text-xs text-emerald-600" onClick={() => verifyMutation.mutate(r)}>
                            Verifikasi
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {data && <p className="mt-2 text-xs text-slate-500">Total {formatNumber(data.total)} pegawai memenuhi kriteria pada rentang yang dipilih.</p>}

      {noteFor && (
        <TundaModal
          row={noteFor}
          onClose={() => setNoteFor(null)}
          onSubmit={(catatan) => statusMutation.mutate({ row: noteFor, status: "ditunda", catatan })}
          loading={statusMutation.isPending}
        />
      )}
    </div>
  );
}

function TundaModal({ row, onClose, onSubmit, loading }: { row: KenaikanPangkatRow; onClose: () => void; onSubmit: (catatan: string) => void; loading: boolean }) {
  const [catatan, setCatatan] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-1 text-base font-semibold text-slate-900">Tunda Usulan Kenaikan Pangkat</h2>
        <p className="mb-4 text-sm text-slate-500">{row.nama} — {row.periodeLabel}</p>
        <label className="label">Catatan Alasan Penundaan *</label>
        <textarea className="input" rows={3} value={catatan} onChange={(e) => setCatatan(e.target.value)} required />
        <div className="mt-4 flex justify-end gap-2">
          <button className="btn-secondary" onClick={onClose}>
            Batal
          </button>
          <button className="btn-primary" disabled={!catatan || loading} onClick={() => onSubmit(catatan)}>
            {loading && <Spinner size={14} />} Simpan
          </button>
        </div>
      </div>
    </div>
  );
}
