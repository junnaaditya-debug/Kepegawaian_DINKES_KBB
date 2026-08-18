import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "../../api/client";
import type { UnitKerja } from "../../types";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input, Select } from "../../components/ui/Input";
import { useToast } from "../../components/ui/Toast";

const JENIS_LABEL: Record<string, string> = {
  DINAS_INDUK: "Dinas Induk", BIDANG: "Bidang", UPTD: "UPTD", PUSKESMAS: "Puskesmas", LAINNYA: "Lainnya",
};

export default function UnitKerjaList() {
  const { push } = useToast();
  const [items, setItems] = useState<UnitKerja[]>([]);
  const [form, setForm] = useState({ nama: "", jenis: "PUSKESMAS", parentId: "", alamat: "" });
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await api.get<{ data: UnitKerja[] }>("/unit-kerja?includeInactive=1");
    setItems(res.data);
  }

  useEffect(() => {
    load();
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/unit-kerja", { nama: form.nama, jenis: form.jenis, parentId: form.parentId || null, alamat: form.alamat });
      setForm({ nama: "", jenis: "PUSKESMAS", parentId: "", alamat: "" });
      push("Unit kerja ditambahkan.", "success");
      load();
    } catch (err) {
      push(err instanceof ApiError ? err.message : "Gagal menyimpan.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(u: UnitKerja) {
    try {
      if (u.is_active) {
        await api.delete(`/unit-kerja/${u.id}`);
      } else {
        await api.put(`/unit-kerja/${u.id}`, { isActive: true });
      }
      load();
    } catch (err) {
      push(err instanceof ApiError ? err.message : "Gagal memperbarui.", "error");
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-slate-800">Unit Kerja</h2>
      <Card>
        <table className="w-full text-left text-sm">
          <thead><tr className="border-b border-slate-200 text-xs uppercase text-slate-500"><th className="py-2 pr-4">Nama</th><th>Jenis</th><th>Induk</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {items.map((u) => (
              <tr key={u.id} className="border-b border-slate-100">
                <td className="py-2.5 pr-4 font-medium">{u.nama}</td>
                <td>{JENIS_LABEL[u.jenis] ?? u.jenis}</td>
                <td className="text-slate-500">{items.find((p) => p.id === u.parent_id)?.nama ?? "-"}</td>
                <td>{u.is_active ? <span className="text-emerald-600">Aktif</span> : <span className="text-slate-400">Nonaktif</span>}</td>
                <td className="text-right"><button onClick={() => toggleActive(u)} className="text-xs text-brand-600 hover:underline">{u.is_active ? "Nonaktifkan" : "Aktifkan"}</button></td>
              </tr>
            ))}
          </tbody>
        </table>

        <form onSubmit={submit} className="mt-5 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-4">
          <Input label="Nama Unit Kerja" required value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} className="w-56" />
          <Select label="Jenis" value={form.jenis} onChange={(e) => setForm({ ...form, jenis: e.target.value })} className="w-40">
            {Object.entries(JENIS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
          <Select label="Induk Unit" value={form.parentId} onChange={(e) => setForm({ ...form, parentId: e.target.value })} className="w-56">
            <option value="">- Tidak ada -</option>
            {items.map((u) => <option key={u.id} value={u.id}>{u.nama}</option>)}
          </Select>
          <Input label="Alamat" value={form.alamat} onChange={(e) => setForm({ ...form, alamat: e.target.value })} className="w-64" />
          <Button type="submit" loading={saving}>Tambah</Button>
        </form>
      </Card>
    </div>
  );
}
