import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api, downloadFile, errorMessage } from "../api/client";
import { Badge, Button, Card, EmptyState, Field, Modal, Select, Spinner } from "../components/ui";
import type { KandidatKenaikanPangkat, UnitKerja } from "../types";
import { BULAN_LABEL, label } from "../utils/format";
import { useAuth } from "../context/AuthContext";

export default function KenaikanPangkatPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [unitKerjaId, setUnitKerjaId] = useState("");
  const [jenisKenaikan, setJenisKenaikan] = useState("");
  const [status, setStatus] = useState("");
  const [bulanKeDepan, setBulanKeDepan] = useState("12");
  const [editing, setEditing] = useState<KandidatKenaikanPangkat | null>(null);

  const canEdit = user && ["SUPER_ADMIN", "ADMIN_KEPEGAWAIAN"].includes(user.role);

  const { data: unitList } = useQuery<UnitKerja[]>({ queryKey: ["unit-kerja"], queryFn: () => api.get("/unit-kerja").then((r) => r.data) });

  const { data, isLoading } = useQuery<{ data: KandidatKenaikanPangkat[]; total: number }>({
    queryKey: ["kenaikan-pangkat", { unitKerjaId, jenisKenaikan, status, bulanKeDepan }],
    queryFn: () =>
      api
        .get("/kenaikan-pangkat", {
          params: { unitKerjaId: unitKerjaId || undefined, jenisKenaikan: jenisKenaikan || undefined, status: status || undefined, bulanKeDepan },
        })
        .then((r) => r.data),
  });

  const exportParams = {
    ...(unitKerjaId ? { unitKerjaId } : {}),
    ...(jenisKenaikan ? { jenisKenaikan } : {}),
    bulanKeDepan,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Daftar Kenaikan Pangkat</h1>
          <p className="text-sm text-slate-500">Deteksi otomatis pegawai yang sudah/akan waktunya naik pangkat & golongan</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => downloadFile("/laporan/kenaikan-pangkat/excel", undefined, exportParams)}>
            Export Excel
          </Button>
          <Button variant="secondary" onClick={() => downloadFile("/laporan/kenaikan-pangkat/pdf", undefined, exportParams)}>
            Export PDF
          </Button>
        </div>
      </div>

      <Card>
        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          <Select value={unitKerjaId} onChange={(e) => setUnitKerjaId(e.target.value)}>
            <option value="">Semua Unit Kerja</option>
            {unitList?.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nama}
              </option>
            ))}
          </Select>
          <Select value={jenisKenaikan} onChange={(e) => setJenisKenaikan(e.target.value)}>
            <option value="">Semua Jenis Kenaikan</option>
            <option value="REGULER">Reguler</option>
            <option value="FUNGSIONAL">Fungsional</option>
          </Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Semua Status</option>
            <option value="BELUM_DIPROSES">Belum Diproses</option>
            <option value="SEDANG_DIUSULKAN">Sedang Diusulkan</option>
            <option value="SK_TERBIT">SK Terbit</option>
            <option value="DITUNDA">Ditunda</option>
          </Select>
          <Select value={bulanKeDepan} onChange={(e) => setBulanKeDepan(e.target.value)}>
            <option value="3">3 Bulan ke Depan</option>
            <option value="6">6 Bulan ke Depan</option>
            <option value="12">1 Tahun ke Depan</option>
            <option value="24">2 Tahun ke Depan</option>
          </Select>
        </div>

        {isLoading ? (
          <Spinner />
        ) : !data || data.data.length === 0 ? (
          <EmptyState text="Tidak ada pegawai yang sesuai kriteria" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                  <th className="py-2 pr-3">Nama / NIP</th>
                  <th className="py-2 pr-3">Unit Kerja</th>
                  <th className="py-2 pr-3">Jenis</th>
                  <th className="py-2 pr-3">Golongan Saat Ini</th>
                  <th className="py-2 pr-3">Masa Kerja / AK</th>
                  <th className="py-2 pr-3">SKP</th>
                  <th className="py-2 pr-3">Proyeksi Periode</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3"></th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((k) => (
                  <tr key={`${k.pegawaiId}-${k.jenisKenaikan}-${k.proyeksiPeriode.tahun}-${k.proyeksiPeriode.bulan}`} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="py-2 pr-3">
                      <Link to={`/pegawai/${k.pegawaiId}`} className="font-medium text-sky-700 hover:underline">
                        {k.nama}
                      </Link>
                      <p className="font-mono text-xs text-slate-400">{k.nip}</p>
                    </td>
                    <td className="py-2 pr-3">{k.unitKerjaNama || "-"}</td>
                    <td className="py-2 pr-3">
                      <Badge tone={k.jenisKenaikan}>{label(k.jenisKenaikan)}</Badge>
                    </td>
                    <td className="py-2 pr-3">{k.golonganSaatIni}</td>
                    <td className="py-2 pr-3">
                      {k.jenisKenaikan === "REGULER" ? (
                        `${k.masaKerjaTahun} tahun`
                      ) : (
                        <span>
                          {k.angkaKreditKumulatif} / {k.angkaKreditDibutuhkan}
                          {k.gapAngkaKredit != null && k.gapAngkaKredit > 0 && <span className="text-amber-600"> (kurang {k.gapAngkaKredit})</span>}
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      {k.predikatSkpTerakhir ? <Badge tone={k.predikatSkpTerakhir}>{label(k.predikatSkpTerakhir)}</Badge> : <span className="text-slate-400">Belum ada</span>}
                    </td>
                    <td className="py-2 pr-3">
                      {BULAN_LABEL[k.proyeksiPeriode.bulan]} {k.proyeksiPeriode.tahun}
                    </td>
                    <td className="py-2 pr-3">
                      <Badge tone={k.statusTindakLanjut}>{label(k.statusTindakLanjut)}</Badge>
                    </td>
                    <td className="py-2 pr-3">
                      {canEdit && (
                        <button className="text-xs font-medium text-sky-700 hover:underline" onClick={() => setEditing(k)}>
                          Ubah Status
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {editing && (
        <StatusModal
          kandidat={editing}
          onClose={() => setEditing(null)}
          onSuccess={() => {
            setEditing(null);
            qc.invalidateQueries({ queryKey: ["kenaikan-pangkat"] });
          }}
        />
      )}
    </div>
  );
}

function StatusModal({ kandidat, onClose, onSuccess }: { kandidat: KandidatKenaikanPangkat; onClose: () => void; onSuccess: () => void }) {
  const [status, setStatus] = useState(kandidat.statusTindakLanjut);
  const [catatan, setCatatan] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError("");
    setLoading(true);
    try {
      await api.put("/kenaikan-pangkat/status", {
        pegawaiId: kandidat.pegawaiId,
        periodeTahun: kandidat.proyeksiPeriode.tahun,
        periodeBulan: kandidat.proyeksiPeriode.bulan,
        jenisKenaikan: kandidat.jenisKenaikan,
        status,
        catatan: catatan || undefined,
      });
      onSuccess();
    } catch (err) {
      setError(errorMessage(err, "Gagal mengubah status"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Ubah Status: ${kandidat.nama}`}>
      <div className="space-y-3">
        <Field label="Status Tindak Lanjut">
          <Select value={status} onChange={(e) => setStatus(e.target.value as any)}>
            <option value="BELUM_DIPROSES">Belum Diproses</option>
            <option value="SEDANG_DIUSULKAN">Sedang Diusulkan</option>
            <option value="SK_TERBIT">SK Terbit</option>
            <option value="DITUNDA">Ditunda</option>
          </Select>
        </Field>
        <Field label="Catatan (mis. alasan ditunda)">
          <textarea
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
            rows={3}
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
          />
        </Field>
        {status === "SK_TERBIT" && (
          <p className="rounded-md bg-sky-50 p-2 text-xs text-sky-800">
            Untuk menyelesaikan proses kenaikan pangkat secara resmi, input SK baru pada tab "Riwayat Pangkat" di halaman detail pegawai — sistem akan
            otomatis mengarsipkan riwayat lama dan menandai status ini sebagai SK Terbit.
          </p>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={submit} disabled={loading}>
            {loading ? "Menyimpan..." : "Simpan"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
