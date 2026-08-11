import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, errorMessage } from "../../api/client";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Select } from "../ui";
import { label } from "../../utils/format";
import { useAuth } from "../../context/AuthContext";
import type { NilaiSkp } from "../../types";

export default function SkpTab({ pegawaiId, data }: { pegawaiId: string; data: NilaiSkp[] }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const canEdit = user && ["SUPER_ADMIN", "ADMIN_KEPEGAWAIAN"].includes(user.role);

  const sorted = [...data].sort((a, b) => b.tahun - a.tahun);

  return (
    <Card
      title="Nilai SKP / Prestasi Kerja"
      actions={canEdit ? <Button onClick={() => setShowAdd(true)}>+ Input Nilai SKP</Button> : undefined}
    >
      <p className="mb-3 text-xs text-slate-500">
        Fase 1 hanya menyimpan predikat/nilai SKP sebagai syarat validasi kenaikan pangkat (BR-4), bukan sistem penilaian kinerja penuh.
      </p>
      {sorted.length === 0 ? (
        <EmptyState text="Belum ada data nilai SKP" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <th className="py-2 pr-3">Tahun</th>
                <th className="py-2 pr-3">Predikat</th>
                <th className="py-2 pr-3">Nilai</th>
                <th className="py-2 pr-3">Keterangan</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.id} className="border-b border-slate-50">
                  <td className="py-2 pr-3 font-medium">{r.tahun}</td>
                  <td className="py-2 pr-3">
                    <Badge tone={r.predikat}>{label(r.predikat)}</Badge>
                  </td>
                  <td className="py-2 pr-3">{r.nilaiAngka ?? "-"}</td>
                  <td className="py-2 pr-3">{r.keterangan || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <TambahSkpModal
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

function TambahSkpModal({ pegawaiId, onClose, onSuccess }: { pegawaiId: string; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ tahun: String(new Date().getFullYear()), predikat: "BAIK", nilaiAngka: "", keterangan: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError("");
    setLoading(true);
    try {
      await api.post(`/pegawai/${pegawaiId}/nilai-skp`, { ...form, nilaiAngka: form.nilaiAngka || undefined });
      onSuccess();
    } catch (err) {
      setError(errorMessage(err, "Gagal menyimpan nilai SKP"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Input Nilai SKP">
      <div className="space-y-3">
        <Field label="Tahun">
          <Input type="number" value={form.tahun} onChange={(e) => setForm({ ...form, tahun: e.target.value })} />
        </Field>
        <Field label="Predikat">
          <Select value={form.predikat} onChange={(e) => setForm({ ...form, predikat: e.target.value })}>
            <option value="SANGAT_BAIK">Sangat Baik</option>
            <option value="BAIK">Baik</option>
            <option value="CUKUP">Cukup</option>
            <option value="KURANG">Kurang</option>
            <option value="SANGAT_KURANG">Sangat Kurang</option>
          </Select>
        </Field>
        <Field label="Nilai Angka (opsional)">
          <Input type="number" step="0.01" value={form.nilaiAngka} onChange={(e) => setForm({ ...form, nilaiAngka: e.target.value })} />
        </Field>
        <Field label="Keterangan">
          <Input value={form.keterangan} onChange={(e) => setForm({ ...form, keterangan: e.target.value })} />
        </Field>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={submit} disabled={loading || !form.tahun}>
            {loading ? "Menyimpan..." : "Simpan"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
