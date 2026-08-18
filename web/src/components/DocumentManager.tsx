import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { FileText, History, Eye, Trash2, Upload as UploadIcon } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { openDocumentPreview } from "../lib/preview";
import { Modal, Spinner, EmptyState } from "./ui";
import { JENIS_DOKUMEN_OPTIONS } from "../lib/constants";
import { formatBytes, formatDateTime } from "../lib/format";
import type { Dokumen } from "../types";
import { useAuth } from "../lib/auth";

interface Props {
  pegawaiId: number;
  entitasTerkaitTipe?: string;
  entitasTerkaitId?: number;
  title?: string;
  defaultJenis?: string;
}

export default function DocumentManager({ pegawaiId, entitasTerkaitTipe, entitasTerkaitId, title = "Dokumen Terkait", defaultJenis }: Props) {
  const { user } = useAuth();
  const canWrite = user?.role === "super_admin" || user?.role === "admin_kepegawaian";
  const queryClient = useQueryClient();
  const [showUpload, setShowUpload] = useState(false);
  const [versionOf, setVersionOf] = useState<Dokumen | null>(null);

  const queryKey = ["dokumen", pegawaiId, entitasTerkaitTipe, entitasTerkaitId];
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => api.get<Dokumen[]>("/dokumen", { pegawaiId, entitasTerkaitTipe, entitasTerkaitId }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/dokumen/${id}`),
    onSuccess: () => {
      toast.success("Dokumen dihapus");
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Gagal menghapus dokumen"),
  });

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        {canWrite && (
          <button className="btn-secondary" onClick={() => setShowUpload(true)}>
            <UploadIcon size={15} /> Unggah Dokumen
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex h-24 items-center justify-center">
          <Spinner size={22} className="text-brand-600" />
        </div>
      ) : !data || data.length === 0 ? (
        <EmptyState title="Belum ada dokumen" icon={<FileText size={28} className="text-slate-300" />} />
      ) : (
        <div className="divide-y divide-slate-100">
          {data.map((d) => (
            <div key={d.id} className="flex items-center justify-between py-2.5 text-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                  <FileText size={16} />
                </div>
                <div>
                  <p className="font-medium text-slate-800">{d.nama_file}</p>
                  <p className="text-xs text-slate-500">
                    {JENIS_DOKUMEN_OPTIONS.find((j) => j.value === d.jenis)?.label ?? d.jenis} · {formatBytes(d.ukuran_bytes)} · v{d.versi} ·{" "}
                    {formatDateTime(d.uploaded_at)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button className="btn-ghost" title="Lihat" onClick={() => openDocumentPreview(d.id).catch(() => toast.error("Gagal membuka dokumen"))}>
                  <Eye size={16} />
                </button>
                {canWrite && (
                  <button className="btn-ghost" title="Unggah versi baru" onClick={() => setVersionOf(d)}>
                    <History size={16} />
                  </button>
                )}
                {user?.role === "super_admin" && (
                  <button
                    className="btn-ghost text-red-500"
                    title="Hapus"
                    onClick={() => window.confirm("Hapus dokumen ini?") && deleteMutation.mutate(d.id)}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {(showUpload || versionOf) && (
        <UploadModal
          pegawaiId={pegawaiId}
          entitasTerkaitTipe={entitasTerkaitTipe}
          entitasTerkaitId={entitasTerkaitId}
          defaultJenis={versionOf?.jenis ?? defaultJenis}
          dokumenIndukId={versionOf?.dokumen_induk_id ?? versionOf?.id}
          onClose={() => {
            setShowUpload(false);
            setVersionOf(null);
          }}
          onSuccess={() => {
            setShowUpload(false);
            setVersionOf(null);
            queryClient.invalidateQueries({ queryKey });
          }}
        />
      )}
    </div>
  );
}

function UploadModal({
  pegawaiId,
  entitasTerkaitTipe,
  entitasTerkaitId,
  defaultJenis,
  dokumenIndukId,
  onClose,
  onSuccess,
}: {
  pegawaiId: number;
  entitasTerkaitTipe?: string;
  entitasTerkaitId?: number;
  defaultJenis?: string;
  dokumenIndukId?: number;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [jenis, setJenis] = useState(defaultJenis ?? JENIS_DOKUMEN_OPTIONS[0].value);
  const [file, setFile] = useState<File | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Pilih file");
      const form = new FormData();
      form.append("file", file);
      form.append("jenis", jenis);
      form.append("pegawaiId", String(pegawaiId));
      if (entitasTerkaitTipe) form.append("entitasTerkaitTipe", entitasTerkaitTipe);
      if (entitasTerkaitId) form.append("entitasTerkaitId", String(entitasTerkaitId));
      if (dokumenIndukId) form.append("dokumenIndukId", String(dokumenIndukId));
      return api.postForm("/dokumen", form);
    },
    onSuccess: () => {
      toast.success("Dokumen berhasil diunggah");
      onSuccess();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Gagal mengunggah dokumen"),
  });

  return (
    <Modal open onClose={onClose} title={dokumenIndukId ? "Unggah Versi Baru" : "Unggah Dokumen"}>
      <div className="space-y-4">
        <div>
          <label className="label">Jenis Dokumen</label>
          <select className="input" value={jenis} onChange={(e) => setJenis(e.target.value)} disabled={!!dokumenIndukId}>
            {JENIS_DOKUMEN_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">File (PDF/PNG/JPEG/WEBP, maks 15MB)</label>
          <input
            type="file"
            accept="application/pdf,image/png,image/jpeg,image/webp"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full rounded-lg border border-dashed border-slate-300 px-3 py-6 text-sm text-slate-500"
          />
        </div>
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={onClose}>
            Batal
          </button>
          <button className="btn-primary" disabled={!file || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending && <Spinner size={14} />} Unggah
          </button>
        </div>
      </div>
    </Modal>
  );
}
