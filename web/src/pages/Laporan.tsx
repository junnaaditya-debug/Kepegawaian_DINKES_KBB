import { useState } from "react";
import toast from "react-hot-toast";
import { Download, FileSpreadsheet, FileText, Users, TrendingUp } from "lucide-react";
import { downloadFile } from "../lib/api";
import { PageHeader, Spinner } from "../components/ui";
import { useUnitKerjaList } from "../hooks/useReference";

export default function Laporan() {
  const { data: unitKerjaList } = useUnitKerjaList();
  const [unitKerjaId, setUnitKerjaId] = useState("");
  const [rentangBulan, setRentangBulan] = useState("6");
  const [loadingKey, setLoadingKey] = useState<string | null>(null);

  async function handle(key: string, path: string, query: Record<string, string | undefined>, filename: string) {
    setLoadingKey(key);
    try {
      await downloadFile(path, query, filename);
      toast.success("Laporan berhasil diunduh");
    } catch {
      toast.error("Gagal mengunduh laporan");
    } finally {
      setLoadingKey(null);
    }
  }

  return (
    <div>
      <PageHeader title="Laporan" subtitle="Generate dan unduh laporan kepegawaian dalam format Excel atau PDF (FR-6)" />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
              <Users size={20} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Laporan Data Pegawai</h3>
              <p className="text-xs text-slate-500">Daftar seluruh pegawai aktif beserta jabatan dan kepangkatan</p>
            </div>
          </div>
          <label className="label">Filter Unit Kerja</label>
          <select className="input mb-4" value={unitKerjaId} onChange={(e) => setUnitKerjaId(e.target.value)}>
            <option value="">Semua Unit Kerja</option>
            {unitKerjaList?.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nama}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <button
              className="btn-secondary flex-1"
              disabled={loadingKey === "pegawai-excel"}
              onClick={() => handle("pegawai-excel", "/laporan/pegawai/excel", { unitKerjaId: unitKerjaId || undefined }, "data-pegawai.xlsx")}
            >
              {loadingKey === "pegawai-excel" ? <Spinner size={14} /> : <FileSpreadsheet size={16} />} Excel
            </button>
            <button
              className="btn-secondary flex-1"
              disabled={loadingKey === "pegawai-pdf"}
              onClick={() => handle("pegawai-pdf", "/laporan/pegawai/pdf", { unitKerjaId: unitKerjaId || undefined }, "data-pegawai.pdf")}
            >
              {loadingKey === "pegawai-pdf" ? <Spinner size={14} /> : <FileText size={16} />} PDF
            </button>
          </div>
        </div>

        <div className="card p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <TrendingUp size={20} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Laporan Usulan Kenaikan Pangkat</h3>
              <p className="text-xs text-slate-500">Daftar usulan kenaikan pangkat siap cetak untuk keperluan administrasi (FR-6.2)</p>
            </div>
          </div>
          <label className="label">Rentang Periode</label>
          <select className="input mb-4" value={rentangBulan} onChange={(e) => setRentangBulan(e.target.value)}>
            <option value="3">3 bulan ke depan</option>
            <option value="6">6 bulan ke depan</option>
            <option value="12">1 tahun ke depan</option>
          </select>
          <div className="flex gap-2">
            <button
              className="btn-secondary flex-1"
              disabled={loadingKey === "kp-excel"}
              onClick={() => handle("kp-excel", "/laporan/kenaikan-pangkat/excel", { rentangBulan }, "usulan-kenaikan-pangkat.xlsx")}
            >
              {loadingKey === "kp-excel" ? <Spinner size={14} /> : <FileSpreadsheet size={16} />} Excel
            </button>
            <button
              className="btn-secondary flex-1"
              disabled={loadingKey === "kp-pdf"}
              onClick={() => handle("kp-pdf", "/laporan/kenaikan-pangkat/pdf", { rentangBulan }, "usulan-kenaikan-pangkat.pdf")}
            >
              {loadingKey === "kp-pdf" ? <Spinner size={14} /> : <Download size={16} />} PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
