import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, errorMessage } from "../../api/client";
import { Button, Card, EmptyState, Field, Input } from "../ui";
import { Modal } from "../ui";
import { formatTanggal } from "../../utils/format";
import { useAuth } from "../../context/AuthContext";
import type { AngkaKredit } from "../../types";

export default function AngkaKreditTab({ pegawaiId, data }: { pegawaiId: string; data: AngkaKredit[] }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const canEdit = user && ["SUPER_ADMIN", "ADMIN_KEPEGAWAIAN"].includes(user.role);

  const sorted = [...data].sort((a, b) => new Date(b.tanggalPak).getTime() - new Date(a.tanggalPak).getTime());

  return (
    <Card title="Riwayat Penetapan Angka Kredit (PAK)" actions={canEdit ? <Button onClick={() => setShowAdd(true)}>+ Tambah PAK</Button> : undefined}>
      {sorted.length === 0 ? (
        <EmptyState text="Belum ada data PAK. Data ini dibutuhkan untuk deteksi kenaikan pangkat fungsional." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <th className="py-2 pr-3">Nomor PAK</th>
                <th className="py-2 pr-3">Tanggal PAK</th>
                <th className="py-2 pr-3">Periode Penilaian</th>
                <th className="py-2 pr-3">AK Kumulatif</th>
                <th className="py-2 pr-3">Unsur Utama</th>
                <th className="py-2 pr-3">Pengembangan Profesi</th>
                <th className="py-2 pr-3">Unsur Penunjang</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.id} className="border-b border-slate-50">
                  <td className="py-2 pr-3">{r.nomorPak}</td>
                  <td className="py-2 pr-3">{formatTanggal(r.tanggalPak)}</td>
                  <td className="py-2 pr-3">
                    {formatTanggal(r.periodePenilaianAwal)} - {formatTanggal(r.periodePenilaianAkhir)}
                  </td>
                  <td className="py-2 pr-3 font-semibold">{r.angkaKreditKumulatif}</td>
                  <td className="py-2 pr-3">{r.unsurUtama ?? "-"}</td>
                  <td className="py-2 pr-3">{r.unsurPengembanganProfesi ?? "-"}</td>
                  <td className="py-2 pr-3">{r.unsurPenunjang ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <TambahAngkaKreditModal
          pegawaiId={pegawaiId}
          onClose={() => setShowAdd(false)}
          onSuccess={() => {
            setShowAdd(false);
            qc.invalidateQueries({ queryKey: ["pegawai", pegawaiId] });
          }}
        />
      )}
    </Card>
  );
}

function TambahAngkaKreditModal({ pegawaiId, onClose, onSuccess }: { pegawaiId: string; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({
    nomorPak: "",
    tanggalPak: "",
    periodePenilaianAwal: "",
    periodePenilaianAkhir: "",
    angkaKreditKumulatif: "",
    unsurUtama: "",
    unsurPengembanganProfesi: "",
    unsurPenunjang: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError("");
    setLoading(true);
    try {
      await api.post(`/pegawai/${pegawaiId}/angka-kredit`, {
        ...form,
        unsurUtama: form.unsurUtama || undefined,
        unsurPengembanganProfesi: form.unsurPengembanganProfesi || undefined,
        unsurPenunjang: form.unsurPenunjang || undefined,
      });
      onSuccess();
    } catch (err) {
      setError(errorMessage(err, "Gagal menyimpan data angka kredit"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Tambah Penetapan Angka Kredit">
      <div className="space-y-3">
        <Field label="Nomor PAK">
          <Input value={form.nomorPak} onChange={(e) => setForm({ ...form, nomorPak: e.target.value })} />
        </Field>
        <Field label="Tanggal PAK">
          <Input type="date" value={form.tanggalPak} onChange={(e) => setForm({ ...form, tanggalPak: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Periode Penilaian Awal">
            <Input type="date" value={form.periodePenilaianAwal} onChange={(e) => setForm({ ...form, periodePenilaianAwal: e.target.value })} />
          </Field>
          <Field label="Periode Penilaian Akhir">
            <Input type="date" value={form.periodePenilaianAkhir} onChange={(e) => setForm({ ...form, periodePenilaianAkhir: e.target.value })} />
          </Field>
        </div>
        <Field label="Angka Kredit Kumulatif">
          <Input type="number" step="0.01" value={form.angkaKreditKumulatif} onChange={(e) => setForm({ ...form, angkaKreditKumulatif: e.target.value })} />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Unsur Utama">
            <Input type="number" step="0.01" value={form.unsurUtama} onChange={(e) => setForm({ ...form, unsurUtama: e.target.value })} />
          </Field>
          <Field label="Pengembangan Profesi">
            <Input type="number" step="0.01" value={form.unsurPengembanganProfesi} onChange={(e) => setForm({ ...form, unsurPengembanganProfesi: e.target.value })} />
          </Field>
          <Field label="Unsur Penunjang">
            <Input type="number" step="0.01" value={form.unsurPenunjang} onChange={(e) => setForm({ ...form, unsurPenunjang: e.target.value })} />
          </Field>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button
            onClick={submit}
            disabled={loading || !form.nomorPak || !form.tanggalPak || !form.periodePenilaianAwal || !form.periodePenilaianAkhir || !form.angkaKreditKumulatif}
          >
            {loading ? "Menyimpan..." : "Simpan"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
