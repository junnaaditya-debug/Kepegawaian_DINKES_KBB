import { useState, type FormEvent } from "react";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { Input, Select } from "../../components/ui/Input";
import { api, ApiError } from "../../api/client";
import { useToast } from "../../components/ui/Toast";

interface ModalProps {
  pegawaiId: string;
  onClose: () => void;
  onSaved: () => void;
}

function useSubmit(onSaved: () => void, successMsg: string) {
  const { push } = useToast();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<unknown>) {
    setSaving(true);
    setError(null);
    try {
      await fn();
      push(successMsg, "success");
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal menyimpan data.");
    } finally {
      setSaving(false);
    }
  }
  return { saving, error, run };
}

export function RiwayatJabatanModal({ pegawaiId, onClose, onSaved }: ModalProps) {
  const [form, setForm] = useState({ jenisJabatan: "STRUKTURAL", namaJabatan: "", jenjangJabatan: "", noSk: "", tanggalSk: "", tmtJabatan: "", keterangan: "" });
  const { saving, error, run } = useSubmit(onSaved, "Riwayat jabatan berhasil ditambahkan.");

  function submit(e: FormEvent) {
    e.preventDefault();
    run(() => api.post("/riwayat-jabatan", { pegawaiId, ...form }));
  }

  return (
    <Modal open onClose={onClose} title="Tambah Riwayat Jabatan">
      <form onSubmit={submit} className="space-y-3">
        <Select label="Jenis Jabatan" required value={form.jenisJabatan} onChange={(e) => setForm({ ...form, jenisJabatan: e.target.value })}>
          <option value="STRUKTURAL">Struktural</option>
          <option value="FUNGSIONAL_TERTENTU">Fungsional Tertentu</option>
          <option value="PELAKSANA">Pelaksana</option>
        </Select>
        <Input label="Nama Jabatan" required value={form.namaJabatan} onChange={(e) => setForm({ ...form, namaJabatan: e.target.value })} />
        <Input label="Jenjang Jabatan" value={form.jenjangJabatan} onChange={(e) => setForm({ ...form, jenjangJabatan: e.target.value })} />
        <Input label="No. SK" value={form.noSk} onChange={(e) => setForm({ ...form, noSk: e.target.value })} />
        <Input label="Tanggal SK" type="date" value={form.tanggalSk} onChange={(e) => setForm({ ...form, tanggalSk: e.target.value })} />
        <Input label="TMT Jabatan" type="date" required value={form.tmtJabatan} onChange={(e) => setForm({ ...form, tmtJabatan: e.target.value })} />
        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Batal</Button>
          <Button type="submit" loading={saving}>Simpan</Button>
        </div>
      </form>
    </Modal>
  );
}

export function RiwayatPangkatModal({ pegawaiId, onClose, onSaved }: ModalProps) {
  const [form, setForm] = useState({ golonganRuang: "", namaPangkat: "", tmtPangkat: "", noSk: "", tanggalSk: "", pejabatPenetap: "", jenisKenaikan: "REGULER" });
  const { saving, error, run } = useSubmit(onSaved, "SK Kenaikan Pangkat berhasil dicatat.");

  function submit(e: FormEvent) {
    e.preventDefault();
    run(() => api.post("/riwayat-pangkat", { pegawaiId, ...form }));
  }

  return (
    <Modal open onClose={onClose} title="Input SK Kenaikan Pangkat">
      <form onSubmit={submit} className="space-y-3">
        <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
          Menyimpan data ini akan mengarsipkan riwayat pangkat aktif sebelumnya dan menjadikan data ini sebagai pangkat/golongan aktif pegawai (BR-6).
        </p>
        <Input label="Golongan/Ruang Baru" required placeholder="mis. III/c" value={form.golonganRuang} onChange={(e) => setForm({ ...form, golonganRuang: e.target.value })} />
        <Input label="Nama Pangkat" required value={form.namaPangkat} onChange={(e) => setForm({ ...form, namaPangkat: e.target.value })} />
        <Input label="TMT Pangkat" type="date" required value={form.tmtPangkat} onChange={(e) => setForm({ ...form, tmtPangkat: e.target.value })} />
        <Select label="Jenis Kenaikan" value={form.jenisKenaikan} onChange={(e) => setForm({ ...form, jenisKenaikan: e.target.value })}>
          <option value="REGULER">Reguler</option>
          <option value="PILIHAN_FUNGSIONAL">Pilihan/Fungsional</option>
          <option value="PENYESUAIAN_IJAZAH">Penyesuaian Ijazah</option>
          <option value="PENGANGKATAN_PERTAMA">Pengangkatan Pertama</option>
          <option value="LAINNYA">Lainnya</option>
        </Select>
        <Input label="No. SK" value={form.noSk} onChange={(e) => setForm({ ...form, noSk: e.target.value })} />
        <Input label="Tanggal SK" type="date" value={form.tanggalSk} onChange={(e) => setForm({ ...form, tanggalSk: e.target.value })} />
        <Input label="Pejabat Penetap" value={form.pejabatPenetap} onChange={(e) => setForm({ ...form, pejabatPenetap: e.target.value })} />
        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Batal</Button>
          <Button type="submit" loading={saving}>Simpan</Button>
        </div>
      </form>
    </Modal>
  );
}

export function RiwayatPendidikanModal({ pegawaiId, onClose, onSaved }: ModalProps) {
  const [form, setForm] = useState({ jenjangPendidikan: "", jurusan: "", namaInstitusi: "", tahunLulus: "", noIjazah: "" });
  const { saving, error, run } = useSubmit(onSaved, "Riwayat pendidikan berhasil ditambahkan.");

  function submit(e: FormEvent) {
    e.preventDefault();
    run(() => api.post("/riwayat-pendidikan", { pegawaiId, ...form, tahunLulus: form.tahunLulus ? Number(form.tahunLulus) : undefined }));
  }

  return (
    <Modal open onClose={onClose} title="Tambah Riwayat Pendidikan">
      <form onSubmit={submit} className="space-y-3">
        <Input label="Jenjang Pendidikan" required placeholder="mis. S1, D3, SMA" value={form.jenjangPendidikan} onChange={(e) => setForm({ ...form, jenjangPendidikan: e.target.value })} />
        <Input label="Jurusan" value={form.jurusan} onChange={(e) => setForm({ ...form, jurusan: e.target.value })} />
        <Input label="Nama Institusi" value={form.namaInstitusi} onChange={(e) => setForm({ ...form, namaInstitusi: e.target.value })} />
        <Input label="Tahun Lulus" type="number" value={form.tahunLulus} onChange={(e) => setForm({ ...form, tahunLulus: e.target.value })} />
        <Input label="No. Ijazah" value={form.noIjazah} onChange={(e) => setForm({ ...form, noIjazah: e.target.value })} />
        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Batal</Button>
          <Button type="submit" loading={saving}>Simpan</Button>
        </div>
      </form>
    </Modal>
  );
}

export function AngkaKreditModal({ pegawaiId, onClose, onSaved }: ModalProps) {
  const [form, setForm] = useState({ nomorPak: "", tanggalPak: "", periodeAwal: "", periodeAkhir: "", angkaKreditKumulatif: "", unsurUtama: "", pengembanganProfesi: "", unsurPenunjang: "" });
  const { saving, error, run } = useSubmit(onSaved, "PAK baru berhasil dicatat.");

  function submit(e: FormEvent) {
    e.preventDefault();
    run(() =>
      api.post("/angka-kredit", {
        pegawaiId,
        nomorPak: form.nomorPak,
        tanggalPak: form.tanggalPak,
        periodeAwal: form.periodeAwal,
        periodeAkhir: form.periodeAkhir,
        angkaKreditKumulatif: Number(form.angkaKreditKumulatif),
        unsurUtama: form.unsurUtama ? Number(form.unsurUtama) : undefined,
        pengembanganProfesi: form.pengembanganProfesi ? Number(form.pengembanganProfesi) : undefined,
        unsurPenunjang: form.unsurPenunjang ? Number(form.unsurPenunjang) : undefined,
      })
    );
  }

  return (
    <Modal open onClose={onClose} title="Input Penetapan Angka Kredit (PAK)">
      <form onSubmit={submit} className="space-y-3">
        <Input label="Nomor PAK" value={form.nomorPak} onChange={(e) => setForm({ ...form, nomorPak: e.target.value })} />
        <Input label="Tanggal PAK" type="date" value={form.tanggalPak} onChange={(e) => setForm({ ...form, tanggalPak: e.target.value })} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Periode Awal" type="date" value={form.periodeAwal} onChange={(e) => setForm({ ...form, periodeAwal: e.target.value })} />
          <Input label="Periode Akhir" type="date" value={form.periodeAkhir} onChange={(e) => setForm({ ...form, periodeAkhir: e.target.value })} />
        </div>
        <Input label="Angka Kredit Kumulatif" type="number" step="0.01" required value={form.angkaKreditKumulatif} onChange={(e) => setForm({ ...form, angkaKreditKumulatif: e.target.value })} />
        <div className="grid grid-cols-3 gap-3">
          <Input label="Unsur Utama" type="number" step="0.01" value={form.unsurUtama} onChange={(e) => setForm({ ...form, unsurUtama: e.target.value })} />
          <Input label="Pengembangan Profesi" type="number" step="0.01" value={form.pengembanganProfesi} onChange={(e) => setForm({ ...form, pengembanganProfesi: e.target.value })} />
          <Input label="Unsur Penunjang" type="number" step="0.01" value={form.unsurPenunjang} onChange={(e) => setForm({ ...form, unsurPenunjang: e.target.value })} />
        </div>
        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Batal</Button>
          <Button type="submit" loading={saving}>Simpan</Button>
        </div>
      </form>
    </Modal>
  );
}

export function DokumenUploadModal({ pegawaiId, onClose, onSaved }: ModalProps) {
  const [jenisDokumen, setJenisDokumen] = useState("SK_PANGKAT");
  const [keterangan, setKeterangan] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const { saving, error, run } = useSubmit(onSaved, "Dokumen berhasil diunggah.");

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    fd.append("pegawaiId", pegawaiId);
    fd.append("entityType", "PEGAWAI");
    fd.append("jenisDokumen", jenisDokumen);
    fd.append("keterangan", keterangan);
    run(() => api.upload("/dokumen/upload", fd));
  }

  return (
    <Modal open onClose={onClose} title="Unggah Dokumen">
      <form onSubmit={submit} className="space-y-3">
        <Select label="Jenis Dokumen" value={jenisDokumen} onChange={(e) => setJenisDokumen(e.target.value)}>
          <option value="SK_CPNS">SK CPNS</option>
          <option value="SK_PNS">SK PNS</option>
          <option value="SK_PANGKAT">SK Pangkat</option>
          <option value="IJAZAH">Ijazah</option>
          <option value="SERTIFIKAT_DIKLAT">Sertifikat Diklat</option>
          <option value="PAK">PAK</option>
          <option value="SKP">SKP</option>
          <option value="USULAN_KP">Usulan Kenaikan Pangkat</option>
          <option value="LAINNYA">Lainnya</option>
        </Select>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Berkas (PDF/JPG/PNG, maks 15MB)</span>
          <input
            type="file"
            required
            accept=".pdf,image/jpeg,image/png,image/webp"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100"
          />
        </label>
        <Input label="Keterangan" value={keterangan} onChange={(e) => setKeterangan(e.target.value)} />
        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Batal</Button>
          <Button type="submit" loading={saving} disabled={!file}>Unggah</Button>
        </div>
      </form>
    </Modal>
  );
}
