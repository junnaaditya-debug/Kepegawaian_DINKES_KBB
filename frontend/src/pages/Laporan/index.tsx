import { useState } from "react";
import { api } from "../../api/client";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Select } from "../../components/ui/Input";
import { useToast } from "../../components/ui/Toast";

export default function LaporanPage() {
  const { push } = useToast();
  const [rentangBulan, setRentangBulan] = useState("6");
  const [busy, setBusy] = useState<string | null>(null);

  async function download(key: string, path: string, filename: string) {
    setBusy(key);
    try {
      await api.download(path, filename);
    } catch {
      push("Gagal mengunduh laporan.", "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-slate-800">Laporan</h2>

      <Card title="Laporan Data Pegawai">
        <p className="mb-4 text-sm text-slate-500">Ekspor seluruh data pegawai aktif sesuai cakupan akses Anda.</p>
        <div className="flex gap-2">
          <Button variant="secondary" loading={busy === "pegawai-excel"} onClick={() => download("pegawai-excel", "/laporan/pegawai/export?format=excel", "data-pegawai.xlsx")}>⬇ Excel</Button>
          <Button variant="secondary" loading={busy === "pegawai-pdf"} onClick={() => download("pegawai-pdf", "/laporan/pegawai/export?format=pdf", "data-pegawai.pdf")}>⬇ PDF</Button>
        </div>
      </Card>

      <Card title="Laporan Usulan Kenaikan Pangkat">
        <p className="mb-4 text-sm text-slate-500">Format siap cetak untuk keperluan administrasi usulan kenaikan pangkat (FR-6.2).</p>
        <div className="mb-4 max-w-xs">
          <Select label="Rentang Proyeksi" value={rentangBulan} onChange={(e) => setRentangBulan(e.target.value)}>
            <option value="3">3 Bulan ke Depan</option>
            <option value="6">6 Bulan ke Depan</option>
            <option value="12">1 Tahun ke Depan</option>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" loading={busy === "kp-excel"} onClick={() => download("kp-excel", `/laporan/kenaikan-pangkat/export?format=excel&rentangBulan=${rentangBulan}`, "usulan-kenaikan-pangkat.xlsx")}>⬇ Excel</Button>
          <Button variant="secondary" loading={busy === "kp-pdf"} onClick={() => download("kp-pdf", `/laporan/kenaikan-pangkat/export?format=pdf&rentangBulan=${rentangBulan}`, "usulan-kenaikan-pangkat.pdf")}>⬇ PDF</Button>
        </div>
      </Card>
    </div>
  );
}
