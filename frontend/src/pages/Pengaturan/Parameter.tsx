import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "../../api/client";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../components/ui/Toast";

interface PeriodeKp { id: string; nama_periode: string; bulan: number; tanggal: number; is_active: number }
interface MasaKerja { id: string; golongan_ruang: string | null; masa_kerja_minimum_bulan: number; keterangan: string | null }
interface AngkaKreditParam { id: string; jenis_jabatan_fungsional: string; jenjang_jabatan: string; golongan_ruang: string | null; angka_kredit_minimum: number; keterangan: string | null }
interface SkpParam { id: string; predikat_minimum: string; urutan_peringkat: number; is_active: number }
interface ParameterData { periodeKp: PeriodeKp[]; masaKerjaReguler: MasaKerja[]; angkaKreditJenjang: AngkaKreditParam[]; skpMinimum: SkpParam[] }

export default function ParameterPage() {
  const { user } = useAuth();
  const { push } = useToast();
  const [data, setData] = useState<ParameterData | null>(null);
  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  async function load() {
    const res = await api.get<{ data: ParameterData }>("/parameter");
    setData(res.data);
  }

  useEffect(() => {
    load();
  }, []);

  if (!data) return <p className="text-slate-500">Memuat...</p>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800">Pengaturan Parameter Aturan Kenaikan Pangkat</h2>
        <p className="mt-1 text-sm text-slate-500">
          Seluruh nilai di halaman ini bersifat konfigurasi (bukan hardcode) sesuai catatan PRD — pastikan divalidasi terhadap regulasi BKN/PANRB terbaru sebelum digunakan untuk pengambilan keputusan resmi.
        </p>
      </div>

      <PeriodeKpSection items={data.periodeKp} editable={isSuperAdmin} onChanged={load} push={push} />
      <MasaKerjaSection items={data.masaKerjaReguler} editable={isSuperAdmin} onChanged={load} push={push} />
      <AngkaKreditSection items={data.angkaKreditJenjang} editable={isSuperAdmin} onChanged={load} push={push} />
      <SkpSection items={data.skpMinimum} editable={isSuperAdmin} onChanged={load} push={push} />
    </div>
  );
}

type PushFn = (msg: string, type?: "success" | "error" | "info") => void;

function PeriodeKpSection({ items, editable, onChanged, push }: { items: PeriodeKp[]; editable: boolean; onChanged: () => void; push: PushFn }) {
  const [form, setForm] = useState({ namaPeriode: "", bulan: "", tanggal: "" });
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/parameter/periode-kp", { namaPeriode: form.namaPeriode, bulan: Number(form.bulan), tanggal: Number(form.tanggal) });
      setForm({ namaPeriode: "", bulan: "", tanggal: "" });
      push("Periode kenaikan pangkat ditambahkan.", "success");
      onChanged();
    } catch (err) {
      push(err instanceof ApiError ? err.message : "Gagal menyimpan.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    await api.delete(`/parameter/periode-kp/${id}`);
    push("Periode dihapus.", "success");
    onChanged();
  }

  return (
    <Card title="Periode Kenaikan Pangkat Nasional (BR-1)">
      <table className="w-full text-left text-sm">
        <thead><tr className="text-xs uppercase text-slate-400"><th className="py-1.5">Nama Periode</th><th>Bulan</th><th>Tanggal</th>{editable && <th></th>}</tr></thead>
        <tbody>
          {items.map((p) => (
            <tr key={p.id} className="border-t border-slate-100">
              <td className="py-2">{p.nama_periode}</td><td>{p.bulan}</td><td>{p.tanggal}</td>
              {editable && <td className="text-right"><button onClick={() => remove(p.id)} className="text-xs text-red-600 hover:underline">Hapus</button></td>}
            </tr>
          ))}
        </tbody>
      </table>
      {editable && (
        <form onSubmit={submit} className="mt-4 flex flex-wrap items-end gap-2">
          <Input label="Nama Periode" required value={form.namaPeriode} onChange={(e) => setForm({ ...form, namaPeriode: e.target.value })} className="w-48" />
          <Input label="Bulan (1-12)" type="number" min={1} max={12} required value={form.bulan} onChange={(e) => setForm({ ...form, bulan: e.target.value })} className="w-32" />
          <Input label="Tanggal (1-31)" type="number" min={1} max={31} required value={form.tanggal} onChange={(e) => setForm({ ...form, tanggal: e.target.value })} className="w-32" />
          <Button type="submit" loading={saving}>Tambah</Button>
        </form>
      )}
    </Card>
  );
}

function MasaKerjaSection({ items, editable, onChanged, push }: { items: MasaKerja[]; editable: boolean; onChanged: () => void; push: PushFn }) {
  const [form, setForm] = useState({ golonganRuang: "", masaKerjaMinimumBulan: "", keterangan: "" });
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/parameter/masa-kerja-reguler", { golonganRuang: form.golonganRuang || undefined, masaKerjaMinimumBulan: Number(form.masaKerjaMinimumBulan), keterangan: form.keterangan });
      setForm({ golonganRuang: "", masaKerjaMinimumBulan: "", keterangan: "" });
      push("Aturan masa kerja ditambahkan.", "success");
      onChanged();
    } catch (err) {
      push(err instanceof ApiError ? err.message : "Gagal menyimpan.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    await api.delete(`/parameter/masa-kerja-reguler/${id}`);
    push("Aturan dihapus.", "success");
    onChanged();
  }

  return (
    <Card title="Masa Kerja Minimum Kenaikan Pangkat Reguler (BR-2)">
      <table className="w-full text-left text-sm">
        <thead><tr className="text-xs uppercase text-slate-400"><th className="py-1.5">Golongan/Ruang</th><th>Min. Bulan</th><th>Keterangan</th>{editable && <th></th>}</tr></thead>
        <tbody>
          {items.map((m) => (
            <tr key={m.id} className="border-t border-slate-100">
              <td className="py-2">{m.golongan_ruang ?? "Semua Golongan"}</td><td>{m.masa_kerja_minimum_bulan}</td><td className="text-xs text-slate-500">{m.keterangan}</td>
              {editable && <td className="text-right"><button onClick={() => remove(m.id)} className="text-xs text-red-600 hover:underline">Hapus</button></td>}
            </tr>
          ))}
        </tbody>
      </table>
      {editable && (
        <form onSubmit={submit} className="mt-4 flex flex-wrap items-end gap-2">
          <Input label="Golongan/Ruang (kosongkan = semua)" value={form.golonganRuang} onChange={(e) => setForm({ ...form, golonganRuang: e.target.value })} className="w-56" />
          <Input label="Masa Kerja Minimum (bulan)" type="number" required value={form.masaKerjaMinimumBulan} onChange={(e) => setForm({ ...form, masaKerjaMinimumBulan: e.target.value })} className="w-48" />
          <Input label="Keterangan" value={form.keterangan} onChange={(e) => setForm({ ...form, keterangan: e.target.value })} className="w-64" />
          <Button type="submit" loading={saving}>Tambah</Button>
        </form>
      )}
    </Card>
  );
}

function AngkaKreditSection({ items, editable, onChanged, push }: { items: AngkaKreditParam[]; editable: boolean; onChanged: () => void; push: PushFn }) {
  const [form, setForm] = useState({ jenisJabatanFungsional: "", jenjangJabatan: "", golonganRuang: "", angkaKreditMinimum: "", keterangan: "" });
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/parameter/angka-kredit-jenjang", {
        jenisJabatanFungsional: form.jenisJabatanFungsional,
        jenjangJabatan: form.jenjangJabatan,
        golonganRuang: form.golonganRuang || undefined,
        angkaKreditMinimum: Number(form.angkaKreditMinimum),
        keterangan: form.keterangan,
      });
      setForm({ jenisJabatanFungsional: "", jenjangJabatan: "", golonganRuang: "", angkaKreditMinimum: "", keterangan: "" });
      push("Ambang batas angka kredit ditambahkan.", "success");
      onChanged();
    } catch (err) {
      push(err instanceof ApiError ? err.message : "Gagal menyimpan.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    await api.delete(`/parameter/angka-kredit-jenjang/${id}`);
    push("Ambang batas dihapus.", "success");
    onChanged();
  }

  return (
    <Card title="Ambang Batas Angka Kredit per Jenjang Jabatan Fungsional (BR-3)">
      <p className="mb-3 text-xs text-amber-600">Belum ada nilai default — wajib diisi Super Admin berdasarkan regulasi jabatan fungsional kesehatan terkini sebelum modul fungsional dapat mendeteksi kenaikan pangkat.</p>
      <table className="w-full text-left text-sm">
        <thead><tr className="text-xs uppercase text-slate-400"><th className="py-1.5">Jabatan Fungsional</th><th>Jenjang</th><th>Golongan</th><th>AK Minimum</th>{editable && <th></th>}</tr></thead>
        <tbody>
          {items.map((a) => (
            <tr key={a.id} className="border-t border-slate-100">
              <td className="py-2">{a.jenis_jabatan_fungsional}</td><td>{a.jenjang_jabatan}</td><td>{a.golongan_ruang ?? "-"}</td><td className="font-semibold">{a.angka_kredit_minimum}</td>
              {editable && <td className="text-right"><button onClick={() => remove(a.id)} className="text-xs text-red-600 hover:underline">Hapus</button></td>}
            </tr>
          ))}
          {items.length === 0 && <tr><td colSpan={5} className="py-3 text-center text-slate-400">Belum ada data.</td></tr>}
        </tbody>
      </table>
      {editable && (
        <form onSubmit={submit} className="mt-4 flex flex-wrap items-end gap-2">
          <Input label="Nama Jabatan Fungsional" required placeholder="mis. Perawat" value={form.jenisJabatanFungsional} onChange={(e) => setForm({ ...form, jenisJabatanFungsional: e.target.value })} className="w-48" />
          <Input label="Jenjang" required placeholder="mis. Ahli Pertama" value={form.jenjangJabatan} onChange={(e) => setForm({ ...form, jenjangJabatan: e.target.value })} className="w-48" />
          <Input label="Golongan (opsional)" value={form.golonganRuang} onChange={(e) => setForm({ ...form, golonganRuang: e.target.value })} className="w-32" />
          <Input label="AK Minimum" type="number" step="0.01" required value={form.angkaKreditMinimum} onChange={(e) => setForm({ ...form, angkaKreditMinimum: e.target.value })} className="w-32" />
          <Button type="submit" loading={saving}>Tambah</Button>
        </form>
      )}
    </Card>
  );
}

function SkpSection({ items, editable, onChanged, push }: { items: SkpParam[]; editable: boolean; onChanged: () => void; push: PushFn }) {
  const [form, setForm] = useState({ predikatMinimum: "", urutanPeringkat: "" });
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/parameter/skp-minimum", { predikatMinimum: form.predikatMinimum, urutanPeringkat: Number(form.urutanPeringkat) });
      setForm({ predikatMinimum: "", urutanPeringkat: "" });
      push("Predikat SKP ditambahkan.", "success");
      onChanged();
    } catch (err) {
      push(err instanceof ApiError ? err.message : "Gagal menyimpan.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card title="Predikat SKP Minimum yang Diterima (BR-4)">
      <table className="w-full text-left text-sm">
        <thead><tr className="text-xs uppercase text-slate-400"><th className="py-1.5">Predikat</th><th>Urutan Peringkat</th><th>Diterima</th></tr></thead>
        <tbody>
          {items.map((s) => (
            <tr key={s.id} className="border-t border-slate-100">
              <td className="py-2">{s.predikat_minimum}</td><td>{s.urutan_peringkat}</td><td>{s.is_active ? "Ya" : "Tidak"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {editable && (
        <form onSubmit={submit} className="mt-4 flex flex-wrap items-end gap-2">
          <Input label="Predikat" required value={form.predikatMinimum} onChange={(e) => setForm({ ...form, predikatMinimum: e.target.value })} className="w-48" />
          <Input label="Urutan Peringkat" type="number" required value={form.urutanPeringkat} onChange={(e) => setForm({ ...form, urutanPeringkat: e.target.value })} className="w-40" />
          <Button type="submit" loading={saving}>Tambah</Button>
        </form>
      )}
    </Card>
  );
}
