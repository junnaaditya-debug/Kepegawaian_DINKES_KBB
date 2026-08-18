import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Pencil, Plus } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import { PageHeader, Spinner, Badge, Modal, EmptyState } from "../../components/ui";
import { useUnitKerjaList } from "../../hooks/useReference";
import type { UnitKerja } from "../../types";

const JENIS_LABELS: Record<string, string> = {
  dinas_induk: "Dinas Induk",
  bidang: "Bidang/Sekretariat",
  uptd: "UPTD",
  puskesmas: "Puskesmas",
};

export default function UnitKerjaPage() {
  const { data, isLoading } = useUnitKerjaList();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<UnitKerja | "new" | null>(null);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["unit-kerja"] });
  }

  return (
    <div>
      <PageHeader
        title="Manajemen Unit Kerja"
        subtitle="Daftar Puskesmas, UPTD, dan Bidang di lingkungan Dinas Kesehatan Kabupaten Bandung Barat"
        actions={
          <button className="btn-primary" onClick={() => setEditing("new")}>
            <Plus size={16} /> Tambah Unit Kerja
          </button>
        }
      />

      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex h-48 items-center justify-center">
            <Spinner className="text-brand-600" size={26} />
          </div>
        ) : !data || data.length === 0 ? (
          <EmptyState title="Belum ada unit kerja" />
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Kode</th>
                <th className="px-4 py-3">Nama</th>
                <th className="px-4 py-3">Jenis</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{u.kode}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{u.nama}</td>
                  <td className="px-4 py-3">
                    <Badge color="blue">{JENIS_LABELS[u.jenis] ?? u.jenis}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge color={u.is_active ? "green" : "slate"}>{u.is_active ? "Aktif" : "Nonaktif"}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button className="btn-ghost px-2 py-1" onClick={() => setEditing(u)}>
                      <Pencil size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <UnitKerjaFormModal
          unitKerja={editing === "new" ? null : editing}
          unitKerjaList={data ?? []}
          onClose={() => setEditing(null)}
          onSuccess={() => {
            setEditing(null);
            invalidate();
          }}
        />
      )}
    </div>
  );
}

function UnitKerjaFormModal({
  unitKerja,
  unitKerjaList,
  onClose,
  onSuccess,
}: {
  unitKerja: UnitKerja | null;
  unitKerjaList: UnitKerja[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    kode: unitKerja?.kode ?? "",
    nama: unitKerja?.nama ?? "",
    jenis: unitKerja?.jenis ?? "puskesmas",
    parent_id: unitKerja?.parent_id ? String(unitKerja.parent_id) : "",
    alamat: unitKerja?.alamat ?? "",
    is_active: unitKerja?.is_active ?? 1,
  });

  const mutation = useMutation({
    mutationFn: () => {
      const payload = { ...form, parent_id: form.parent_id ? Number(form.parent_id) : null };
      return unitKerja ? api.put(`/unit-kerja/${unitKerja.id}`, payload) : api.post("/unit-kerja", payload);
    },
    onSuccess: () => {
      toast.success(unitKerja ? "Unit kerja diperbarui" : "Unit kerja ditambahkan");
      onSuccess();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Gagal menyimpan"),
  });

  return (
    <Modal open onClose={onClose} title={unitKerja ? "Ubah Unit Kerja" : "Tambah Unit Kerja"}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <div>
          <label className="label">Kode *</label>
          <input className="input" required value={form.kode} onChange={(e) => setForm({ ...form, kode: e.target.value })} />
        </div>
        <div>
          <label className="label">Nama *</label>
          <input className="input" required value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} />
        </div>
        <div>
          <label className="label">Jenis *</label>
          <select className="input" value={form.jenis} onChange={(e) => setForm({ ...form, jenis: e.target.value as UnitKerja["jenis"] })}>
            <option value="dinas_induk">Dinas Induk</option>
            <option value="bidang">Bidang/Sekretariat</option>
            <option value="uptd">UPTD</option>
            <option value="puskesmas">Puskesmas</option>
          </select>
        </div>
        <div>
          <label className="label">Induk Unit Kerja</label>
          <select className="input" value={form.parent_id} onChange={(e) => setForm({ ...form, parent_id: e.target.value })}>
            <option value="">- Tidak ada -</option>
            {unitKerjaList
              .filter((u) => u.id !== unitKerja?.id)
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nama}
                </option>
              ))}
          </select>
        </div>
        <div>
          <label className="label">Alamat</label>
          <input className="input" value={form.alamat} onChange={(e) => setForm({ ...form, alamat: e.target.value })} />
        </div>
        {unitKerja && (
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={!!form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked ? 1 : 0 })} />
            Aktif
          </label>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Batal
          </button>
          <button className="btn-primary" disabled={mutation.isPending}>
            {mutation.isPending && <Spinner size={14} />} Simpan
          </button>
        </div>
      </form>
    </Modal>
  );
}
