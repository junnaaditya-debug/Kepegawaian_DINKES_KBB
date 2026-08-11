import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, errorMessage } from "../../api/client";
import { Button, Card, EmptyState, Field, Input, Modal } from "../ui";
import { useAuth } from "../../context/AuthContext";
import type { RiwayatPendidikan } from "../../types";

export default function RiwayatPendidikanTab({ pegawaiId, data }: { pegawaiId: string; data: RiwayatPendidikan[] }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const canEdit = user && ["SUPER_ADMIN", "ADMIN_KEPEGAWAIAN"].includes(user.role);

  const sorted = [...data].sort((a, b) => (b.tahunLulus || 0) - (a.tahunLulus || 0));

  return (
    <Card title="Riwayat Pendidikan Formal" actions={canEdit ? <Button onClick={() => setShowAdd(true)}>+ Tambah Pendidikan</Button> : undefined}>
      {sorted.length === 0 ? (
        <EmptyState text="Belum ada riwayat pendidikan" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <th className="py-2 pr-3">Jenjang</th>
                <th className="py-2 pr-3">Jurusan</th>
                <th className="py-2 pr-3">Institusi</th>
                <th className="py-2 pr-3">Tahun Lulus</th>
                <th className="py-2 pr-3">No. Ijazah</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.id} className="border-b border-slate-50">
                  <td className="py-2 pr-3 font-medium">{r.jenjang}</td>
                  <td className="py-2 pr-3">{r.jurusan || "-"}</td>
                  <td className="py-2 pr-3">{r.namaInstitusi || "-"}</td>
                  <td className="py-2 pr-3">{r.tahunLulus || "-"}</td>
                  <td className="py-2 pr-3">{r.nomorIjazah || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <TambahPendidikanModal
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

function TambahPendidikanModal({ pegawaiId, onClose, onSuccess }: { pegawaiId: string; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ jenjang: "", jurusan: "", namaInstitusi: "", tahunLulus: "", nomorIjazah: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError("");
    setLoading(true);
    try {
      await api.post(`/pegawai/${pegawaiId}/riwayat-pendidikan`, { ...form, tahunLulus: form.tahunLulus || undefined });
      onSuccess();
    } catch (err) {
      setError(errorMessage(err, "Gagal menyimpan riwayat pendidikan"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Tambah Riwayat Pendidikan">
      <div className="space-y-3">
        <Field label="Jenjang">
          <Input value={form.jenjang} onChange={(e) => setForm({ ...form, jenjang: e.target.value })} placeholder="mis. S1, D3, SMA/SMK" />
        </Field>
        <Field label="Jurusan">
          <Input value={form.jurusan} onChange={(e) => setForm({ ...form, jurusan: e.target.value })} />
        </Field>
        <Field label="Nama Institusi">
          <Input value={form.namaInstitusi} onChange={(e) => setForm({ ...form, namaInstitusi: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tahun Lulus">
            <Input type="number" value={form.tahunLulus} onChange={(e) => setForm({ ...form, tahunLulus: e.target.value })} />
          </Field>
          <Field label="No. Ijazah">
            <Input value={form.nomorIjazah} onChange={(e) => setForm({ ...form, nomorIjazah: e.target.value })} />
          </Field>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={submit} disabled={loading || !form.jenjang}>
            {loading ? "Menyimpan..." : "Simpan"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
