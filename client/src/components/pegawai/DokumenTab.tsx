import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, errorMessage } from "../../api/client";
import { Button, Card, EmptyState, Field, Modal, Select } from "../ui";
import { formatTanggalWaktu, formatUkuranFile, label } from "../../utils/format";
import { useAuth } from "../../context/AuthContext";
import type { Dokumen } from "../../types";

export default function DokumenTab({ pegawaiId, data }: { pegawaiId: string; data: Dokumen[] }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showUpload, setShowUpload] = useState(false);
  const canEdit = user && ["SUPER_ADMIN", "ADMIN_KEPEGAWAIAN"].includes(user.role);

  const sorted = [...data].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  async function hapus(id: string) {
    if (!confirm("Hapus dokumen ini?")) return;
    await api.delete(`/dokumen/${id}`);
    qc.invalidateQueries({ queryKey: ["pegawai", pegawaiId] });
  }

  return (
    <Card title="Dokumen Digital" actions={canEdit ? <Button onClick={() => setShowUpload(true)}>+ Upload Dokumen</Button> : undefined}>
      {sorted.length === 0 ? (
        <EmptyState text="Belum ada dokumen yang diunggah" />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((d) => (
            <div key={d.id} className="rounded-md border border-slate-200 p-3">
              <p className="text-xs font-semibold text-sky-700">{label(d.jenisDokumen)}</p>
              <p className="mt-1 truncate text-sm font-medium text-slate-800" title={d.namaAsli}>
                {d.namaAsli}
              </p>
              <p className="text-xs text-slate-500">
                {formatUkuranFile(d.ukuran)} · v{d.versi} · {formatTanggalWaktu(d.createdAt)}
              </p>
              <div className="mt-2 flex gap-3 text-xs">
                <a href={`/uploads/${d.namaFile}`} target="_blank" rel="noreferrer" className="font-medium text-sky-700 hover:underline">
                  Lihat / Unduh
                </a>
                {canEdit && (
                  <button onClick={() => hapus(d.id)} className="font-medium text-red-600 hover:underline">
                    Hapus
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showUpload && (
        <UploadModal
          pegawaiId={pegawaiId}
          onClose={() => setShowUpload(false)}
          onSuccess={() => {
            setShowUpload(false);
            qc.invalidateQueries({ queryKey: ["pegawai", pegawaiId] });
          }}
        />
      )}
    </Card>
  );
}

function UploadModal({ pegawaiId, onClose, onSuccess }: { pegawaiId: string; onClose: () => void; onSuccess: () => void }) {
  const [jenisDokumen, setJenisDokumen] = useState("LAINNYA");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!file) return;
    setError("");
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("jenisDokumen", jenisDokumen);
      fd.append("pegawaiId", pegawaiId);
      await api.post("/dokumen/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      onSuccess();
    } catch (err) {
      setError(errorMessage(err, "Gagal mengunggah dokumen"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Upload Dokumen">
      <div className="space-y-3">
        <Field label="Jenis Dokumen">
          <Select value={jenisDokumen} onChange={(e) => setJenisDokumen(e.target.value)}>
            <option value="SK_CPNS">SK CPNS</option>
            <option value="SK_PNS">SK PNS</option>
            <option value="SK_PANGKAT">SK Pangkat</option>
            <option value="IJAZAH">Ijazah</option>
            <option value="SERTIFIKAT_DIKLAT">Sertifikat Diklat</option>
            <option value="PAK">PAK (Penetapan Angka Kredit)</option>
            <option value="SKP">SKP</option>
            <option value="USULAN_KENAIKAN_PANGKAT">Usulan Kenaikan Pangkat</option>
            <option value="FOTO">Foto</option>
            <option value="LAINNYA">Lainnya</option>
          </Select>
        </Field>
        <Field label="File (PDF/JPG/PNG, maks 10MB)">
          <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={(e) => setFile(e.target.files?.[0] || null)} className="text-sm" />
        </Field>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={submit} disabled={loading || !file}>
            {loading ? "Mengunggah..." : "Upload"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
