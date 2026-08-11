import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, errorMessage } from "../api/client";
import { Button, Card, EmptyState, Field, Input, Modal, Select, Spinner } from "../components/ui";
import type { JenisJabatanFungsional, ParameterAturan, PeriodeKenaikanPangkat } from "../types";
import { BULAN_LABEL, label } from "../utils/format";

export default function PengaturanPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Pengaturan Parameter Aturan</h1>
        <p className="text-sm text-slate-500">
          Seluruh ambang batas kenaikan pangkat dikelola di sini (bukan hardcode), sesuai PRD Bagian 6. Wajib divalidasi oleh bagian kepegawaian
          sesuai regulasi BKN/PANRB terbaru sebelum digunakan untuk produksi.
        </p>
      </div>

      <ParameterUmumSection />
      <PeriodeSection />
      <JabatanFungsionalSection />
    </div>
  );
}

function ParameterUmumSection() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<ParameterAturan>({ queryKey: ["parameter-aturan"], queryFn: () => api.get("/parameter/aturan").then((r) => r.data) });
  const [form, setForm] = useState<ParameterAturan | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  async function simpan() {
    if (!form) return;
    setError("");
    setSaving(true);
    try {
      await api.put("/parameter/aturan", form);
      qc.invalidateQueries({ queryKey: ["parameter-aturan"] });
    } catch (err) {
      setError(errorMessage(err, "Gagal menyimpan parameter"));
    } finally {
      setSaving(false);
    }
  }

  if (isLoading || !form) return <Spinner />;

  return (
    <Card title="Parameter Umum Kenaikan Pangkat (BR-2, BR-4, FR-5.1)">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Masa Kerja Minimum Kenaikan Reguler (tahun)">
          <Input type="number" value={form.masaKerjaMinimumTahun} onChange={(e) => setForm({ ...form, masaKerjaMinimumTahun: Number(e.target.value) })} />
        </Field>
        <Field label="Predikat SKP Minimum">
          <Select value={form.predikatSkpMinimum} onChange={(e) => setForm({ ...form, predikatSkpMinimum: e.target.value as any })}>
            <option value="SANGAT_BAIK">Sangat Baik</option>
            <option value="BAIK">Baik</option>
            <option value="CUKUP">Cukup</option>
            <option value="KURANG">Kurang</option>
          </Select>
        </Field>
        <Field label="Reminder Pertama (bulan sebelum periode)">
          <Input type="number" value={form.reminderBulanSebelum1} onChange={(e) => setForm({ ...form, reminderBulanSebelum1: Number(e.target.value) })} />
        </Field>
        <Field label="Reminder Kedua (bulan sebelum periode)">
          <Input type="number" value={form.reminderBulanSebelum2} onChange={(e) => setForm({ ...form, reminderBulanSebelum2: Number(e.target.value) })} />
        </Field>
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={form.wajibValidasiSkp} onChange={(e) => setForm({ ...form, wajibValidasiSkp: e.target.checked })} />
        Wajibkan validasi nilai SKP sebagai syarat kenaikan pangkat
      </label>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <div className="mt-4">
        <Button onClick={simpan} disabled={saving}>
          {saving ? "Menyimpan..." : "Simpan Parameter"}
        </Button>
      </div>
    </Card>
  );
}

function PeriodeSection() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const { data, isLoading } = useQuery<PeriodeKenaikanPangkat[]>({ queryKey: ["periode"], queryFn: () => api.get("/parameter/periode").then((r) => r.data) });

  async function hapus(id: string) {
    if (!confirm("Hapus periode ini?")) return;
    await api.delete(`/parameter/periode/${id}`);
    qc.invalidateQueries({ queryKey: ["periode"] });
  }

  return (
    <Card title="Periode Kenaikan Pangkat (BR-1)" actions={<Button onClick={() => setShowAdd(true)}>+ Tambah Periode</Button>}>
      {isLoading ? (
        <Spinner />
      ) : !data || data.length === 0 ? (
        <EmptyState text="Belum ada periode dikonfigurasi. Default sistem: 1 April & 1 Oktober." />
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <th className="py-2 pr-3">Label</th>
              <th className="py-2 pr-3">Tanggal</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3"></th>
            </tr>
          </thead>
          <tbody>
            {data.map((p) => (
              <tr key={p.id} className="border-b border-slate-50">
                <td className="py-2 pr-3 font-medium">{p.label}</td>
                <td className="py-2 pr-3">
                  {p.tanggal} {BULAN_LABEL[p.bulan]}
                </td>
                <td className="py-2 pr-3">{p.aktif ? "Aktif" : "Non-aktif"}</td>
                <td className="py-2 pr-3">
                  <button className="text-xs font-medium text-red-600 hover:underline" onClick={() => hapus(p.id)}>
                    Hapus
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showAdd && (
        <TambahPeriodeModal
          onClose={() => setShowAdd(false)}
          onSuccess={() => {
            setShowAdd(false);
            qc.invalidateQueries({ queryKey: ["periode"] });
          }}
        />
      )}
    </Card>
  );
}

function TambahPeriodeModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ label: "", bulan: "4", tanggal: "1" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError("");
    setLoading(true);
    try {
      await api.post("/parameter/periode", { label: form.label, bulan: Number(form.bulan), tanggal: Number(form.tanggal) });
      onSuccess();
    } catch (err) {
      setError(errorMessage(err, "Gagal menyimpan periode"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Tambah Periode Kenaikan Pangkat">
      <div className="space-y-3">
        <Field label="Label">
          <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="mis. Periode April" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Bulan">
            <Select value={form.bulan} onChange={(e) => setForm({ ...form, bulan: e.target.value })}>
              {BULAN_LABEL.slice(1).map((b, i) => (
                <option key={i + 1} value={i + 1}>
                  {b}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Tanggal">
            <Input type="number" min={1} max={31} value={form.tanggal} onChange={(e) => setForm({ ...form, tanggal: e.target.value })} />
          </Field>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={submit} disabled={loading || !form.label}>
            {loading ? "Menyimpan..." : "Simpan"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function JabatanFungsionalSection() {
  const qc = useQueryClient();
  const [showAddJenis, setShowAddJenis] = useState(false);
  const [addJenjangFor, setAddJenjangFor] = useState<JenisJabatanFungsional | null>(null);
  const { data, isLoading } = useQuery<JenisJabatanFungsional[]>({
    queryKey: ["jabatan-fungsional"],
    queryFn: () => api.get("/parameter/jabatan-fungsional").then((r) => r.data),
  });

  async function hapusJenis(id: string) {
    if (!confirm("Hapus jenis jabatan fungsional ini beserta seluruh ambang batasnya?")) return;
    await api.delete(`/parameter/jabatan-fungsional/${id}`);
    qc.invalidateQueries({ queryKey: ["jabatan-fungsional"] });
  }

  async function hapusJenjang(id: string) {
    if (!confirm("Hapus jenjang ini?")) return;
    await api.delete(`/parameter/jenjang/${id}`);
    qc.invalidateQueries({ queryKey: ["jabatan-fungsional"] });
  }

  return (
    <Card title="Jenis Jabatan Fungsional & Ambang Batas Angka Kredit (BR-3)" actions={<Button onClick={() => setShowAddJenis(true)}>+ Tambah Jenis Jabatan</Button>}>
      <p className="mb-3 text-xs text-amber-700">
        Nilai ambang batas angka kredit di bawah ini adalah data awal (placeholder). Wajib disesuaikan dengan SK/regulasi angka kredit jabatan
        fungsional kesehatan yang berlaku saat ini sebelum go-live.
      </p>
      {isLoading ? (
        <Spinner />
      ) : !data || data.length === 0 ? (
        <EmptyState text="Belum ada jenis jabatan fungsional" />
      ) : (
        <div className="space-y-4">
          {data.map((j) => (
            <div key={j.id} className="rounded-md border border-slate-200 p-3">
              <div className="flex items-center justify-between">
                <p className="font-medium text-slate-800">
                  {j.nama} {j.rumpun && <span className="text-xs text-slate-400">({j.rumpun})</span>}
                </p>
                <div className="flex gap-3">
                  <button className="text-xs font-medium text-sky-700 hover:underline" onClick={() => setAddJenjangFor(j)}>
                    + Tambah Jenjang
                  </button>
                  <button className="text-xs font-medium text-red-600 hover:underline" onClick={() => hapusJenis(j.id)}>
                    Hapus
                  </button>
                </div>
              </div>
              {j.jenjangAngkaKredit.length === 0 ? (
                <p className="mt-2 text-xs text-slate-400">Belum ada jenjang dikonfigurasi</p>
              ) : (
                <table className="mt-2 w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 uppercase text-slate-400">
                      <th className="py-1 pr-3">Urutan</th>
                      <th className="py-1 pr-3">Jenjang</th>
                      <th className="py-1 pr-3">Golongan</th>
                      <th className="py-1 pr-3">AK Minimum</th>
                      <th className="py-1 pr-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {j.jenjangAngkaKredit.map((jk) => (
                      <tr key={jk.id} className="border-b border-slate-50">
                        <td className="py-1 pr-3">{jk.urutan}</td>
                        <td className="py-1 pr-3">{label(jk.jenjang)}</td>
                        <td className="py-1 pr-3">{jk.golonganRuang}</td>
                        <td className="py-1 pr-3">{jk.angkaKreditMinimum}</td>
                        <td className="py-1 pr-3">
                          <button className="font-medium text-red-600 hover:underline" onClick={() => hapusJenjang(jk.id)}>
                            Hapus
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </div>
      )}

      {showAddJenis && (
        <TambahJenisModal
          onClose={() => setShowAddJenis(false)}
          onSuccess={() => {
            setShowAddJenis(false);
            qc.invalidateQueries({ queryKey: ["jabatan-fungsional"] });
          }}
        />
      )}
      {addJenjangFor && (
        <TambahJenjangModal
          jenis={addJenjangFor}
          onClose={() => setAddJenjangFor(null)}
          onSuccess={() => {
            setAddJenjangFor(null);
            qc.invalidateQueries({ queryKey: ["jabatan-fungsional"] });
          }}
        />
      )}
    </Card>
  );
}

function TambahJenisModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [nama, setNama] = useState("");
  const [rumpun, setRumpun] = useState("Kesehatan");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError("");
    setLoading(true);
    try {
      await api.post("/parameter/jabatan-fungsional", { nama, rumpun });
      onSuccess();
    } catch (err) {
      setError(errorMessage(err, "Gagal menyimpan jenis jabatan"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Tambah Jenis Jabatan Fungsional">
      <div className="space-y-3">
        <Field label="Nama Jabatan">
          <Input value={nama} onChange={(e) => setNama(e.target.value)} placeholder="mis. Perawat, Bidan, Apoteker" />
        </Field>
        <Field label="Rumpun">
          <Input value={rumpun} onChange={(e) => setRumpun(e.target.value)} />
        </Field>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={submit} disabled={loading || !nama}>
            {loading ? "Menyimpan..." : "Simpan"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function TambahJenjangModal({ jenis, onClose, onSuccess }: { jenis: JenisJabatanFungsional; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ jenjang: "AHLI_PERTAMA", golonganRuang: "", angkaKreditMinimum: "", urutan: String(jenis.jenjangAngkaKredit.length + 1) });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError("");
    setLoading(true);
    try {
      await api.post(`/parameter/jabatan-fungsional/${jenis.id}/jenjang`, {
        ...form,
        angkaKreditMinimum: Number(form.angkaKreditMinimum),
        urutan: Number(form.urutan),
      });
      onSuccess();
    } catch (err) {
      setError(errorMessage(err, "Gagal menyimpan jenjang"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Tambah Jenjang: ${jenis.nama}`}>
      <div className="space-y-3">
        <Field label="Jenjang">
          <Select value={form.jenjang} onChange={(e) => setForm({ ...form, jenjang: e.target.value })}>
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
        <Field label="Golongan/Ruang">
          <Input value={form.golonganRuang} onChange={(e) => setForm({ ...form, golonganRuang: e.target.value })} placeholder="mis. III/c" />
        </Field>
        <Field label="Angka Kredit Minimum">
          <Input type="number" step="0.01" value={form.angkaKreditMinimum} onChange={(e) => setForm({ ...form, angkaKreditMinimum: e.target.value })} />
        </Field>
        <Field label="Urutan Jenjang (untuk menentukan jenjang berikutnya)">
          <Input type="number" value={form.urutan} onChange={(e) => setForm({ ...form, urutan: e.target.value })} />
        </Field>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={submit} disabled={loading || !form.golonganRuang || !form.angkaKreditMinimum}>
            {loading ? "Menyimpan..." : "Simpan"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
