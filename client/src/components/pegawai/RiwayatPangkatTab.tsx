import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, errorMessage } from "../../api/client";
import { Badge, Button, Card, EmptyState, Field, Input, Modal } from "../ui";
import { formatTanggal } from "../../utils/format";
import { useAuth } from "../../context/AuthContext";
import type { RiwayatPangkatGolongan } from "../../types";

export default function RiwayatPangkatTab({ pegawaiId, data }: { pegawaiId: string; data: RiwayatPangkatGolongan[] }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const canEdit = user && ["SUPER_ADMIN", "ADMIN_KEPEGAWAIAN"].includes(user.role);

  const sorted = [...data].sort((a, b) => new Date(b.tmt).getTime() - new Date(a.tmt).getTime());

  return (
    <Card
      title="Riwayat Pangkat & Golongan"
      actions={
        canEdit ? (
          <Button onClick={() => setShowAdd(true)} title="Input SK Kenaikan Pangkat baru akan mengarsipkan riwayat aktif sebelumnya">
            + Input SK Kenaikan Pangkat
          </Button>
        ) : undefined
      }
    >
      {sorted.length === 0 ? (
        <EmptyState text="Belum ada riwayat pangkat/golongan" />
      ) : (
        <ol className="space-y-3 border-l-2 border-slate-200 pl-4">
          {sorted.map((r) => (
            <li key={r.id} className="relative">
              <span className="absolute -left-[21px] top-1 h-3 w-3 rounded-full border-2 border-white bg-emerald-600" />
              <div className="flex items-center gap-2">
                <p className="font-medium text-slate-800">
                  {r.golonganRuang} - {r.namaPangkat}
                </p>
                {r.isAktif && <Badge tone="AKTIF">Aktif</Badge>}
              </div>
              <p className="text-xs text-slate-500">TMT {formatTanggal(r.tmt)}</p>
              {r.nomorSk && (
                <p className="text-xs text-slate-500">
                  SK: {r.nomorSk} {r.tanggalSk ? `(${formatTanggal(r.tanggalSk)})` : ""} {r.pejabatPenetap ? `- ${r.pejabatPenetap}` : ""}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}

      {showAdd && (
        <TambahPangkatModal
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

function TambahPangkatModal({ pegawaiId, onClose, onSuccess }: { pegawaiId: string; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ golonganRuang: "", namaPangkat: "", tmt: "", nomorSk: "", tanggalSk: "", pejabatPenetap: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError("");
    setLoading(true);
    try {
      await api.post(`/pegawai/${pegawaiId}/riwayat-pangkat`, { ...form, tanggalSk: form.tanggalSk || undefined });
      onSuccess();
    } catch (err) {
      setError(errorMessage(err, "Gagal menyimpan riwayat pangkat"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Input SK Kenaikan Pangkat">
      <div className="space-y-3">
        <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-800">
          Menyimpan data ini akan mengarsipkan riwayat pangkat aktif sebelumnya dan menetapkan data ini sebagai pangkat/golongan aktif pegawai (BR-6),
          serta menandai status usulan kenaikan pangkat periode terkait menjadi "SK Terbit".
        </p>
        <Field label="Golongan/Ruang">
          <Input value={form.golonganRuang} onChange={(e) => setForm({ ...form, golonganRuang: e.target.value })} placeholder="mis. III/c" />
        </Field>
        <Field label="Nama Pangkat">
          <Input value={form.namaPangkat} onChange={(e) => setForm({ ...form, namaPangkat: e.target.value })} placeholder="mis. Penata" />
        </Field>
        <Field label="TMT Pangkat">
          <Input type="date" value={form.tmt} onChange={(e) => setForm({ ...form, tmt: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nomor SK">
            <Input value={form.nomorSk} onChange={(e) => setForm({ ...form, nomorSk: e.target.value })} />
          </Field>
          <Field label="Tanggal SK">
            <Input type="date" value={form.tanggalSk} onChange={(e) => setForm({ ...form, tanggalSk: e.target.value })} />
          </Field>
        </div>
        <Field label="Pejabat Penetap">
          <Input value={form.pejabatPenetap} onChange={(e) => setForm({ ...form, pejabatPenetap: e.target.value })} />
        </Field>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={submit} disabled={loading || !form.golonganRuang || !form.namaPangkat || !form.tmt}>
            {loading ? "Menyimpan..." : "Simpan"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
