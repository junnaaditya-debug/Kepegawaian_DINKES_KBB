import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, errorMessage } from "../../api/client";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Select } from "../ui";
import { formatTanggal, label } from "../../utils/format";
import { useAuth } from "../../context/AuthContext";
import type { RiwayatJabatan, UnitKerja } from "../../types";

export default function RiwayatJabatanTab({ pegawaiId, data }: { pegawaiId: string; data: RiwayatJabatan[] }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const canEdit = user && ["SUPER_ADMIN", "ADMIN_KEPEGAWAIAN"].includes(user.role);

  const sorted = [...data].sort((a, b) => new Date(b.tmtJabatan).getTime() - new Date(a.tmtJabatan).getTime());

  return (
    <Card title="Riwayat Jabatan" actions={canEdit ? <Button onClick={() => setShowAdd(true)}>+ Tambah Riwayat</Button> : undefined}>
      {sorted.length === 0 ? (
        <EmptyState text="Belum ada riwayat jabatan" />
      ) : (
        <ol className="space-y-3 border-l-2 border-slate-200 pl-4">
          {sorted.map((r) => (
            <li key={r.id} className="relative">
              <span className="absolute -left-[21px] top-1 h-3 w-3 rounded-full border-2 border-white bg-sky-600" />
              <div className="flex items-center gap-2">
                <p className="font-medium text-slate-800">
                  {r.namaJabatan} {r.jenjangJabatan ? `(${label(r.jenjangJabatan)})` : ""}
                </p>
                {r.isAktif && <Badge tone="AKTIF">Aktif</Badge>}
              </div>
              <p className="text-xs text-slate-500">
                {label(r.jenisJabatan)} · TMT {formatTanggal(r.tmtJabatan)} {r.tglSelesai ? `s.d. ${formatTanggal(r.tglSelesai)}` : ""}
              </p>
              {r.unitKerja && <p className="text-xs text-slate-500">Unit: {r.unitKerja.nama}</p>}
              {r.nomorSk && <p className="text-xs text-slate-500">SK: {r.nomorSk}</p>}
            </li>
          ))}
        </ol>
      )}

      {showAdd && (
        <TambahJabatanModal
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

function TambahJabatanModal({ pegawaiId, onClose, onSuccess }: { pegawaiId: string; onClose: () => void; onSuccess: () => void }) {
  const { data: unitList } = useQuery<UnitKerja[]>({ queryKey: ["unit-kerja"], queryFn: () => api.get("/unit-kerja").then((r) => r.data) });
  const [form, setForm] = useState({
    jenisJabatan: "FUNGSIONAL_TERTENTU",
    namaJabatan: "",
    jenjangJabatan: "",
    unitKerjaId: "",
    tmtJabatan: "",
    nomorSk: "",
    tanggalSk: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError("");
    setLoading(true);
    try {
      await api.post(`/pegawai/${pegawaiId}/riwayat-jabatan`, {
        ...form,
        jenjangJabatan: form.jenjangJabatan || undefined,
        unitKerjaId: form.unitKerjaId || undefined,
        tanggalSk: form.tanggalSk || undefined,
      });
      onSuccess();
    } catch (err) {
      setError(errorMessage(err, "Gagal menyimpan riwayat jabatan"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Tambah Riwayat Jabatan">
      <div className="space-y-3">
        <Field label="Jenis Jabatan">
          <Select value={form.jenisJabatan} onChange={(e) => setForm({ ...form, jenisJabatan: e.target.value })}>
            <option value="STRUKTURAL">Struktural</option>
            <option value="FUNGSIONAL_TERTENTU">Fungsional Tertentu</option>
            <option value="PELAKSANA">Pelaksana</option>
          </Select>
        </Field>
        <Field label="Nama Jabatan">
          <Input value={form.namaJabatan} onChange={(e) => setForm({ ...form, namaJabatan: e.target.value })} placeholder="mis. Perawat, Dokter, Kepala Seksi..." />
        </Field>
        {form.jenisJabatan === "FUNGSIONAL_TERTENTU" && (
          <Field label="Jenjang Jabatan Fungsional">
            <Select value={form.jenjangJabatan} onChange={(e) => setForm({ ...form, jenjangJabatan: e.target.value })}>
              <option value="">- Pilih Jenjang -</option>
              <option value="PEMULA">Pemula</option>
              <option value="TERAMPIL">Terampil</option>
              <option value="MAHIR">Mahir</option>
              <option value="PENYELIA">Penyelia</option>
              <option value="AHLI_PERTAMA">Ahli Pertama</option>
              <option value="AHLI_MUDA">Ahli Muda</option>
              <option value="AHLI_MADYA">Ahli Madya</option>
              <option value="AHLI_UTAMA">Ahli Utama</option>
            </Select>
          </Field>
        )}
        <Field label="Unit Kerja">
          <Select value={form.unitKerjaId} onChange={(e) => setForm({ ...form, unitKerjaId: e.target.value })}>
            <option value="">- Pilih Unit Kerja -</option>
            {unitList?.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nama}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="TMT Jabatan">
          <Input type="date" value={form.tmtJabatan} onChange={(e) => setForm({ ...form, tmtJabatan: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nomor SK">
            <Input value={form.nomorSk} onChange={(e) => setForm({ ...form, nomorSk: e.target.value })} />
          </Field>
          <Field label="Tanggal SK">
            <Input type="date" value={form.tanggalSk} onChange={(e) => setForm({ ...form, tanggalSk: e.target.value })} />
          </Field>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={submit} disabled={loading || !form.namaJabatan || !form.tmtJabatan}>
            {loading ? "Menyimpan..." : "Simpan"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
