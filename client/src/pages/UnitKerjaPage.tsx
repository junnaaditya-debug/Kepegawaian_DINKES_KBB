import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, errorMessage } from "../api/client";
import { Button, Card, EmptyState, Field, Input, Modal, Select, Spinner } from "../components/ui";
import type { UnitKerja } from "../types";

export default function UnitKerjaPage() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const { data, isLoading } = useQuery<UnitKerja[]>({ queryKey: ["unit-kerja"], queryFn: () => api.get("/unit-kerja").then((r) => r.data) });

  async function hapus(id: string) {
    if (!confirm("Hapus unit kerja ini?")) return;
    try {
      await api.delete(`/unit-kerja/${id}`);
      qc.invalidateQueries({ queryKey: ["unit-kerja"] });
    } catch (err) {
      alert(errorMessage(err, "Gagal menghapus unit kerja"));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Unit Kerja</h1>
          <p className="text-sm text-slate-500">Daftar Puskesmas/UPTD/Bidang di lingkungan Dinkes KBB</p>
        </div>
        <Button onClick={() => setShowAdd(true)}>+ Tambah Unit Kerja</Button>
      </div>

      <Card>
        {isLoading ? (
          <Spinner />
        ) : !data || data.length === 0 ? (
          <EmptyState text="Belum ada unit kerja" />
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <th className="py-2 pr-3">Nama</th>
                <th className="py-2 pr-3">Jenis</th>
                <th className="py-2 pr-3">Induk</th>
                <th className="py-2 pr-3">Jumlah Pegawai</th>
                <th className="py-2 pr-3"></th>
              </tr>
            </thead>
            <tbody>
              {data.map((u) => (
                <tr key={u.id} className="border-b border-slate-50">
                  <td className="py-2 pr-3 font-medium">{u.nama}</td>
                  <td className="py-2 pr-3">{u.jenis}</td>
                  <td className="py-2 pr-3">{u.parent?.nama || "-"}</td>
                  <td className="py-2 pr-3">{u._count?.pegawai ?? 0}</td>
                  <td className="py-2 pr-3">
                    <button className="text-xs font-medium text-red-600 hover:underline" onClick={() => hapus(u.id)}>
                      Hapus
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {showAdd && (
        <TambahUnitModal
          units={data || []}
          onClose={() => setShowAdd(false)}
          onSuccess={() => {
            setShowAdd(false);
            qc.invalidateQueries({ queryKey: ["unit-kerja"] });
          }}
        />
      )}
    </div>
  );
}

function TambahUnitModal({ units, onClose, onSuccess }: { units: UnitKerja[]; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ nama: "", jenis: "PUSKESMAS", alamat: "", parentId: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError("");
    setLoading(true);
    try {
      await api.post("/unit-kerja", { ...form, parentId: form.parentId || undefined });
      onSuccess();
    } catch (err) {
      setError(errorMessage(err, "Gagal menyimpan unit kerja"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Tambah Unit Kerja">
      <div className="space-y-3">
        <Field label="Nama Unit Kerja">
          <Input value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} />
        </Field>
        <Field label="Jenis">
          <Select value={form.jenis} onChange={(e) => setForm({ ...form, jenis: e.target.value })}>
            <option value="DINAS_INDUK">Dinas Induk</option>
            <option value="PUSKESMAS">Puskesmas</option>
            <option value="UPTD">UPTD</option>
            <option value="BIDANG">Bidang</option>
          </Select>
        </Field>
        <Field label="Induk Unit Kerja (opsional)">
          <Select value={form.parentId} onChange={(e) => setForm({ ...form, parentId: e.target.value })}>
            <option value="">- Tidak Ada -</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nama}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Alamat">
          <Input value={form.alamat} onChange={(e) => setForm({ ...form, alamat: e.target.value })} />
        </Field>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={submit} disabled={loading || !form.nama}>
            {loading ? "Menyimpan..." : "Simpan"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
