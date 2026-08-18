import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Pencil, Save } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import { PageHeader, Spinner, Modal } from "../../components/ui";
import type { GolonganMasaKerja, ParameterAturan } from "../../types";
import { SKP_PREDIKAT_OPTIONS } from "../../lib/constants";

export default function ParameterPage() {
  const queryClient = useQueryClient();
  const { data: params, isLoading } = useQuery({
    queryKey: ["parameter-aturan"],
    queryFn: () => api.get<ParameterAturan[]>("/parameter-aturan"),
  });
  const { data: golonganList } = useQuery({
    queryKey: ["parameter-aturan", "golongan-masa-kerja"],
    queryFn: () => api.get<GolonganMasaKerja[]>("/parameter-aturan/golongan-masa-kerja"),
  });

  const [editingParam, setEditingParam] = useState<ParameterAturan | null>(null);
  const [editingGolongan, setEditingGolongan] = useState<GolonganMasaKerja | null>(null);

  return (
    <div>
      <PageHeader title="Parameter Aturan Kenaikan Pangkat" subtitle="Konfigurasi aturan bisnis (BR-1 s.d. BR-4) — tidak di-hardcode di kode program" />

      <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
        Parameter berikut adalah nilai default umum yang <strong>wajib divalidasi</strong> oleh bagian kepegawaian Dinkes KBB sesuai regulasi BKN/PANRB
        yang berlaku saat ini sebelum digunakan sebagai acuan resmi (lihat catatan PRD Bagian 6).
      </p>

      <div className="card mb-4 overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-800">Parameter Umum</h3>
        </div>
        {isLoading ? (
          <div className="flex h-32 items-center justify-center">
            <Spinner size={22} className="text-brand-600" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              {params?.map((p) => (
                <tr key={p.id}>
                  <td className="w-64 px-4 py-3 align-top font-medium text-slate-700">{p.kunci}</td>
                  <td className="px-4 py-3 align-top">
                    <code className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{JSON.stringify(p.nilai)}</code>
                    <p className="mt-1 text-xs text-slate-500">{p.deskripsi}</p>
                  </td>
                  <td className="px-4 py-3 text-right align-top">
                    <button className="btn-ghost px-2 py-1" onClick={() => setEditingParam(p)}>
                      <Pencil size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-800">Masa Kerja Minimum per Golongan/Ruang (BR-2)</h3>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2">Golongan</th>
              <th className="px-4 py-2">Masa Kerja Minimum</th>
              <th className="px-4 py-2">Golongan Berikutnya</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {golonganList?.map((g) => (
              <tr key={g.id}>
                <td className="px-4 py-2 font-medium">{g.golongan_ruang}</td>
                <td className="px-4 py-2">{g.masa_kerja_minimum_bulan} bulan</td>
                <td className="px-4 py-2">{g.golongan_ruang_berikutnya ?? "- (puncak)"}</td>
                <td className="px-4 py-2 text-right">
                  <button className="btn-ghost px-2 py-1" onClick={() => setEditingGolongan(g)}>
                    <Pencil size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingParam && (
        <ParamEditModal
          param={editingParam}
          onClose={() => setEditingParam(null)}
          onSuccess={() => {
            setEditingParam(null);
            queryClient.invalidateQueries({ queryKey: ["parameter-aturan"] });
          }}
        />
      )}

      {editingGolongan && (
        <GolonganEditModal
          golongan={editingGolongan}
          onClose={() => setEditingGolongan(null)}
          onSuccess={() => {
            setEditingGolongan(null);
            queryClient.invalidateQueries({ queryKey: ["parameter-aturan", "golongan-masa-kerja"] });
          }}
        />
      )}
    </div>
  );
}

function ParamEditModal({ param, onClose, onSuccess }: { param: ParameterAturan; onClose: () => void; onSuccess: () => void }) {
  const [raw, setRaw] = useState(JSON.stringify(param.nilai, null, 2));

  const mutation = useMutation({
    mutationFn: () => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        throw new Error("Format JSON tidak valid");
      }
      return api.put(`/parameter-aturan/${param.kunci}`, { nilai: parsed });
    },
    onSuccess: () => {
      toast.success("Parameter berhasil diperbarui");
      onSuccess();
    },
    onError: (err) => toast.error(err instanceof ApiError || err instanceof Error ? err.message : "Gagal menyimpan"),
  });

  return (
    <Modal open onClose={onClose} title={`Ubah Parameter: ${param.kunci}`} width="max-w-xl">
      <div className="space-y-3">
        <p className="text-xs text-slate-500">{param.deskripsi}</p>
        <label className="label">Nilai (format JSON)</label>
        <textarea className="input font-mono text-xs" rows={8} value={raw} onChange={(e) => setRaw(e.target.value)} />
        <div className="flex justify-end gap-2 pt-2">
          <button className="btn-secondary" onClick={onClose}>
            Batal
          </button>
          <button className="btn-primary" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? <Spinner size={14} /> : <Save size={15} />} Simpan
          </button>
        </div>
        {param.kunci === "predikat_skp_minimum" && (
          <p className="text-xs text-slate-400">Nilai valid: {SKP_PREDIKAT_OPTIONS.map((s) => `"${s}"`).join(", ")}</p>
        )}
      </div>
    </Modal>
  );
}

function GolonganEditModal({ golongan, onClose, onSuccess }: { golongan: GolonganMasaKerja; onClose: () => void; onSuccess: () => void }) {
  const [masaKerja, setMasaKerja] = useState(golongan.masa_kerja_minimum_bulan);

  const mutation = useMutation({
    mutationFn: () => api.put(`/parameter-aturan/golongan-masa-kerja/${encodeURIComponent(golongan.golongan_ruang)}`, { masa_kerja_minimum_bulan: masaKerja }),
    onSuccess: () => {
      toast.success("Masa kerja minimum diperbarui");
      onSuccess();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Gagal menyimpan"),
  });

  return (
    <Modal open onClose={onClose} title={`Ubah Masa Kerja Minimum: ${golongan.golongan_ruang}`}>
      <div className="space-y-3">
        <label className="label">Masa Kerja Minimum (bulan)</label>
        <input type="number" min={1} className="input" value={masaKerja} onChange={(e) => setMasaKerja(Number(e.target.value))} />
        <div className="flex justify-end gap-2 pt-2">
          <button className="btn-secondary" onClick={onClose}>
            Batal
          </button>
          <button className="btn-primary" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending && <Spinner size={14} />} Simpan
          </button>
        </div>
      </div>
    </Modal>
  );
}
