import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Pencil, Plus } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import { PageHeader, Spinner, Modal, EmptyState } from "../../components/ui";
import { useJenisJabatanFungsionalList } from "../../hooks/useReference";
import type { JenjangJabatanFungsional } from "../../types";
import { GOLONGAN_LIST } from "../../lib/constants";

export default function JabatanFungsionalPage() {
  const { data: jenisList, isLoading } = useJenisJabatanFungsionalList();
  const queryClient = useQueryClient();
  const [selectedJenisId, setSelectedJenisId] = useState<number | null>(null);
  const [showAddJenis, setShowAddJenis] = useState(false);
  const [editingJenjang, setEditingJenjang] = useState<JenjangJabatanFungsional | "new" | null>(null);

  const activeJenisId = selectedJenisId ?? jenisList?.[0]?.id ?? null;

  const { data: jenjangList } = useQuery({
    queryKey: ["jabatan-fungsional", "jenjang", activeJenisId],
    queryFn: () => api.get<JenjangJabatanFungsional[]>(`/jabatan-fungsional/${activeJenisId}/jenjang`),
    enabled: !!activeJenisId,
  });

  return (
    <div>
      <PageHeader
        title="Jabatan Fungsional & Angka Kredit"
        subtitle="Kelola jenis jabatan fungsional kesehatan beserta ambang batas angka kredit per jenjang (FR-3.2, BR-3)"
        actions={
          <button className="btn-primary" onClick={() => setShowAddJenis(true)}>
            <Plus size={16} /> Tambah Jenis Jabatan
          </button>
        }
      />

      <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
        Nilai ambang batas angka kredit di bawah ini adalah contoh default yang harus divalidasi bersama bagian kepegawaian sesuai regulasi BKN/PANRB
        terbaru sebelum digunakan untuk pengambilan keputusan resmi.
      </p>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <div className="card p-3 lg:col-span-1">
          {isLoading ? (
            <Spinner size={20} className="text-brand-600" />
          ) : (
            <div className="space-y-1">
              {jenisList?.map((j) => (
                <button
                  key={j.id}
                  onClick={() => setSelectedJenisId(j.id)}
                  className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${
                    activeJenisId === j.id ? "bg-brand-50 font-medium text-brand-700" : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {j.nama}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="card p-4 lg:col-span-3">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800">Jenjang & Ambang Batas Angka Kredit</h3>
            {activeJenisId && (
              <button className="btn-secondary" onClick={() => setEditingJenjang("new")}>
                <Plus size={15} /> Tambah Jenjang
              </button>
            )}
          </div>
          {!jenjangList || jenjangList.length === 0 ? (
            <EmptyState title="Belum ada jenjang untuk jabatan ini" />
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs font-semibold uppercase text-slate-400">
                <tr>
                  <th className="py-1.5">Urutan</th>
                  <th className="py-1.5">Jenjang</th>
                  <th className="py-1.5">Gol. Minimal</th>
                  <th className="py-1.5">AK Kumulatif Minimal</th>
                  <th className="py-1.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {jenjangList
                  .sort((a, b) => a.urutan - b.urutan)
                  .map((j) => (
                    <tr key={j.id}>
                      <td className="py-2">{j.urutan}</td>
                      <td className="py-2 font-medium">{j.nama}</td>
                      <td className="py-2">{j.golongan_ruang_minimal}</td>
                      <td className="py-2">{j.angka_kredit_kumulatif_minimal}</td>
                      <td className="py-2 text-right">
                        <button className="btn-ghost px-2 py-1" onClick={() => setEditingJenjang(j)}>
                          <Pencil size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showAddJenis && (
        <JenisFormModal
          onClose={() => setShowAddJenis(false)}
          onSuccess={() => {
            setShowAddJenis(false);
            queryClient.invalidateQueries({ queryKey: ["jabatan-fungsional", "jenis"] });
          }}
        />
      )}

      {editingJenjang && activeJenisId && (
        <JenjangFormModal
          jenisId={activeJenisId}
          jenjang={editingJenjang === "new" ? null : editingJenjang}
          onClose={() => setEditingJenjang(null)}
          onSuccess={() => {
            setEditingJenjang(null);
            queryClient.invalidateQueries({ queryKey: ["jabatan-fungsional", "jenjang", activeJenisId] });
            queryClient.invalidateQueries({ queryKey: ["jabatan-fungsional", "jenjang", "all"] });
          }}
        />
      )}
    </div>
  );
}

function JenisFormModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ kode: "", nama: "", rumpun: "Kesehatan" });
  const mutation = useMutation({
    mutationFn: () => api.post("/jabatan-fungsional", form),
    onSuccess: () => {
      toast.success("Jenis jabatan fungsional ditambahkan");
      onSuccess();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Gagal menyimpan"),
  });

  return (
    <Modal open onClose={onClose} title="Tambah Jenis Jabatan Fungsional">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <div>
          <label className="label">Kode *</label>
          <input className="input" required value={form.kode} onChange={(e) => setForm({ ...form, kode: e.target.value.toUpperCase() })} />
        </div>
        <div>
          <label className="label">Nama *</label>
          <input className="input" required value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} />
        </div>
        <div>
          <label className="label">Rumpun</label>
          <input className="input" value={form.rumpun} onChange={(e) => setForm({ ...form, rumpun: e.target.value })} />
        </div>
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

function JenjangFormModal({
  jenisId,
  jenjang,
  onClose,
  onSuccess,
}: {
  jenisId: number;
  jenjang: JenjangJabatanFungsional | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    kode: jenjang?.kode ?? "",
    nama: jenjang?.nama ?? "",
    urutan: jenjang?.urutan ?? 1,
    golongan_ruang_minimal: jenjang?.golongan_ruang_minimal ?? "III/a",
    angka_kredit_kumulatif_minimal: jenjang?.angka_kredit_kumulatif_minimal ?? 0,
  });

  const mutation = useMutation({
    mutationFn: () => (jenjang ? api.put(`/jabatan-fungsional/jenjang/${jenjang.id}`, form) : api.post(`/jabatan-fungsional/${jenisId}/jenjang`, form)),
    onSuccess: () => {
      toast.success("Jenjang tersimpan");
      onSuccess();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Gagal menyimpan"),
  });

  return (
    <Modal open onClose={onClose} title={jenjang ? "Ubah Jenjang" : "Tambah Jenjang"}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        {!jenjang && (
          <div>
            <label className="label">Kode *</label>
            <input className="input" required value={form.kode} onChange={(e) => setForm({ ...form, kode: e.target.value.toUpperCase() })} />
          </div>
        )}
        <div>
          <label className="label">Nama Jenjang *</label>
          <input className="input" required value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} />
        </div>
        <div>
          <label className="label">Urutan (1 = paling rendah)</label>
          <input type="number" min={1} className="input" value={form.urutan} onChange={(e) => setForm({ ...form, urutan: Number(e.target.value) })} />
        </div>
        <div>
          <label className="label">Golongan/Ruang Minimal</label>
          <select className="input" value={form.golongan_ruang_minimal} onChange={(e) => setForm({ ...form, golongan_ruang_minimal: e.target.value })}>
            {GOLONGAN_LIST.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Angka Kredit Kumulatif Minimal</label>
          <input
            type="number"
            step="0.01"
            className="input"
            value={form.angka_kredit_kumulatif_minimal}
            onChange={(e) => setForm({ ...form, angka_kredit_kumulatif_minimal: Number(e.target.value) })}
          />
        </div>
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
