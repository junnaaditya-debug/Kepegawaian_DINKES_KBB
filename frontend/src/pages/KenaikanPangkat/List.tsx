import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import type { KenaikanCandidateDto, UnitKerja } from "../../types";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Select } from "../../components/ui/Input";
import { Badge, StatusBadge } from "../../components/ui/Badge";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../components/ui/Toast";
import { Modal } from "../../components/ui/Modal";
import { Textarea } from "../../components/ui/Input";

const STATUS_OPTIONS = [
  { value: "BELUM_DIPROSES", label: "Belum Diproses" },
  { value: "SEDANG_DIUSULKAN", label: "Sedang Diusulkan" },
  { value: "SK_TERBIT", label: "SK Terbit" },
  { value: "DITUNDA", label: "Ditunda" },
];

export default function KenaikanPangkatList() {
  const { user } = useAuth();
  const { push } = useToast();
  const canEdit = user?.role === "SUPER_ADMIN" || user?.role === "ADMIN_KEPEGAWAIAN";

  const [data, setData] = useState<KenaikanCandidateDto[]>([]);
  const [unitKerjaList, setUnitKerjaList] = useState<UnitKerja[]>([]);
  const [unitKerjaId, setUnitKerjaId] = useState("");
  const [jenisKenaikan, setJenisKenaikan] = useState("SEMUA");
  const [rentangBulan, setRentangBulan] = useState("6");
  const [hanyaSudahWaktunya, setHanyaSudahWaktunya] = useState(false);
  const [loading, setLoading] = useState(true);
  const [statusModal, setStatusModal] = useState<KenaikanCandidateDto | null>(null);

  useEffect(() => {
    api.get<{ data: UnitKerja[] }>("/unit-kerja").then((res) => setUnitKerjaList(res.data));
  }, []);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ rentangBulan, jenisKenaikan });
      if (unitKerjaId) params.set("unitKerjaId", unitKerjaId);
      if (hanyaSudahWaktunya) params.set("hanyaSudahWaktunya", "1");
      const res = await api.get<{ data: KenaikanCandidateDto[] }>(`/kenaikan-pangkat?${params.toString()}`);
      setData(res.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitKerjaId, jenisKenaikan, rentangBulan, hanyaSudahWaktunya]);

  async function handleExport(format: "excel" | "pdf") {
    try {
      await api.download(`/laporan/kenaikan-pangkat/export?format=${format}&rentangBulan=${rentangBulan}`, `usulan-kenaikan-pangkat.${format === "excel" ? "xlsx" : "pdf"}`);
    } catch {
      push("Gagal mengekspor laporan.", "error");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-slate-800">Daftar Kenaikan Pangkat</h2>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => handleExport("excel")}>⬇ Excel</Button>
          <Button variant="secondary" onClick={() => handleExport("pdf")}>⬇ PDF</Button>
        </div>
      </div>

      <Card>
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-5">
          <Select value={unitKerjaId} onChange={(e) => setUnitKerjaId(e.target.value)}>
            <option value="">Semua Unit Kerja</option>
            {unitKerjaList.map((u) => <option key={u.id} value={u.id}>{u.nama}</option>)}
          </Select>
          <Select value={jenisKenaikan} onChange={(e) => setJenisKenaikan(e.target.value)}>
            <option value="SEMUA">Semua Jenis</option>
            <option value="REGULER">Reguler</option>
            <option value="PILIHAN_FUNGSIONAL">Pilihan/Fungsional</option>
          </Select>
          <Select value={rentangBulan} onChange={(e) => setRentangBulan(e.target.value)}>
            <option value="3">3 Bulan ke Depan</option>
            <option value="6">6 Bulan ke Depan</option>
            <option value="12">1 Tahun ke Depan</option>
          </Select>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={hanyaSudahWaktunya} onChange={(e) => setHanyaSudahWaktunya(e.target.checked)} />
            Hanya yang sudah memenuhi syarat
          </label>
          <Button variant="secondary" onClick={load}>Muat Ulang</Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <th className="py-2 pr-4">Pegawai</th>
                <th className="py-2 pr-4">Unit Kerja</th>
                <th className="py-2 pr-4">Jenis</th>
                <th className="py-2 pr-4">Gol/Ruang Saat Ini</th>
                <th className="py-2 pr-4">Masa Kerja / AK</th>
                <th className="py-2 pr-4">Memenuhi Syarat</th>
                <th className="py-2 pr-4">Proyeksi Periode</th>
                <th className="py-2 pr-4">Status Tindak Lanjut</th>
                <th className="py-2 pr-4"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="py-6 text-center text-slate-400">Memuat...</td></tr>
              ) : data.length === 0 ? (
                <tr><td colSpan={9} className="py-6 text-center text-slate-400">Tidak ada pegawai pada rentang ini.</td></tr>
              ) : (
                data.map((k) => (
                  <tr key={`${k.pegawaiId}-${k.proyeksiPeriodeBerikutnya}`} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-2.5 pr-4">
                      <p className="font-medium text-slate-800">{k.nama}</p>
                      <p className="font-mono text-xs text-slate-400">{k.nip}</p>
                    </td>
                    <td className="py-2.5 pr-4 text-slate-600">{k.unitKerjaNama ?? "-"}</td>
                    <td className="py-2.5 pr-4"><Badge color={k.jenisKenaikan === "REGULER" ? "blue" : "purple"}>{k.jenisKenaikan === "REGULER" ? "Reguler" : "Fungsional"}</Badge></td>
                    <td className="py-2.5 pr-4">{k.golonganRuangAktif ?? "-"}</td>
                    <td className="py-2.5 pr-4 text-xs text-slate-600">
                      {k.jenisKenaikan === "REGULER"
                        ? `${k.masaKerjaBulan ?? "-"} / ${k.masaKerjaMinimumBulan ?? "-"} bulan`
                        : `AK ${k.angkaKreditKumulatif ?? "-"} / min ${k.angkaKreditMinimum ?? "-"}${k.angkaKreditGap ? ` (kurang ${k.angkaKreditGap})` : ""}`}
                    </td>
                    <td className="py-2.5 pr-4">{k.memenuhiSyarat ? <Badge color="green">Ya</Badge> : <Badge color="amber">Belum</Badge>}</td>
                    <td className="py-2.5 pr-4">{k.proyeksiPeriodeBerikutnya} <span className="text-xs text-slate-400">({k.bulanMenujuPeriode} bln)</span></td>
                    <td className="py-2.5 pr-4"><StatusBadge status={k.statusTindakLanjut} /></td>
                    <td className="py-2.5 pr-4 text-right">
                      <div className="flex justify-end gap-2">
                        {canEdit && <button onClick={() => setStatusModal(k)} className="text-brand-600 hover:underline">Ubah Status</button>}
                        <Link to={`/pegawai/${k.pegawaiId}`} className="text-slate-500 hover:underline">Detail</Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {statusModal && (
        <StatusModal candidate={statusModal} onClose={() => setStatusModal(null)} onSaved={() => { setStatusModal(null); load(); }} />
      )}
    </div>
  );
}

function StatusModal({ candidate, onClose, onSaved }: { candidate: KenaikanCandidateDto; onClose: () => void; onSaved: () => void }) {
  const { push } = useToast();
  const [status, setStatus] = useState(candidate.statusTindakLanjut);
  const [catatan, setCatatan] = useState(candidate.catatanTindakLanjut ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      await api.put(`/kenaikan-pangkat/${candidate.pegawaiId}/status`, {
        periodeTanggal: candidate.proyeksiPeriodeBerikutnya,
        jenisKenaikan: candidate.jenisKenaikan,
        status,
        catatan,
      });
      push("Status tindak lanjut berhasil diperbarui.", "success");
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal memperbarui status.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Ubah Status — ${candidate.nama}`}>
      <div className="space-y-3">
        <Select label="Status Tindak Lanjut" value={status} onChange={(e) => setStatus(e.target.value as KenaikanCandidateDto["statusTindakLanjut"])}>
          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
        <Textarea label="Catatan" rows={3} value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="Alasan penundaan, catatan proses usulan, dsb." />
        {status === "SK_TERBIT" && (
          <p className="rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-700">
            Untuk mencatat SK secara resmi, gunakan menu "Input SK Kenaikan Pangkat" pada halaman Detail Pegawai — riwayat pangkat akan otomatis diperbarui dan status ini akan tertaut.
          </p>
        )}
        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>Batal</Button>
          <Button onClick={submit} loading={saving}>Simpan</Button>
        </div>
      </div>
    </Modal>
  );
}
