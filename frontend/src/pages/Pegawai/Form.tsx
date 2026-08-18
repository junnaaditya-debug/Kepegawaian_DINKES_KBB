import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import type { Pegawai, UnitKerja } from "../../types";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input, Select } from "../../components/ui/Input";
import { useToast } from "../../components/ui/Toast";

type FormState = Partial<Pegawai>;

export default function PegawaiForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { push } = useToast();
  const [form, setForm] = useState<FormState>({ statusKepegawaian: undefined } as never);
  const [unitKerjaList, setUnitKerjaList] = useState<UnitKerja[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(isEdit);

  useEffect(() => {
    api.get<{ data: UnitKerja[] }>("/unit-kerja").then((res) => setUnitKerjaList(res.data));
    if (isEdit && id) {
      api.get<{ data: Pegawai }>(`/pegawai/${id}`).then((res) => {
        setForm(res.data);
        setLoading(false);
      });
    }
  }, [id, isEdit]);

  function set<K extends keyof Pegawai>(key: K, value: Pegawai[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const body = {
      nip: form.nip,
      nipLama: form.nip_lama,
      nama: form.nama,
      gelarDepan: form.gelar_depan,
      gelarBelakang: form.gelar_belakang,
      tempatLahir: form.tempat_lahir,
      tanggalLahir: form.tanggal_lahir,
      jenisKelamin: form.jenis_kelamin,
      alamat: form.alamat,
      noHp: form.no_hp,
      email: form.email,
      statusKepegawaian: form.status_kepegawaian,
      tmtCpns: form.tmt_cpns,
      tmtPns: form.tmt_pns,
      statusAktif: form.status_aktif,
      unitKerjaId: form.unit_kerja_id,
      jenisJabatan: form.jenis_jabatan,
      namaJabatan: form.nama_jabatan,
      jenjangJabatan: form.jenjang_jabatan,
      golonganRuangAktif: form.golongan_ruang_aktif,
      namaPangkatAktif: form.nama_pangkat_aktif,
      tmtPangkatAktif: form.tmt_pangkat_aktif,
      predikatSkpTerakhir: form.predikat_skp_terakhir,
      periodeSkpTerakhir: form.periode_skp_terakhir,
    };
    try {
      if (isEdit && id) {
        await api.put(`/pegawai/${id}`, body);
        push("Data pegawai berhasil diperbarui.", "success");
        navigate(`/pegawai/${id}`);
      } else {
        const res = await api.post<{ data: { id: string } }>("/pegawai", body);
        push("Pegawai baru berhasil ditambahkan.", "success");
        navigate(`/pegawai/${res.data.id}`);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal menyimpan data.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-slate-500">Memuat...</p>;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <h2 className="text-xl font-bold text-slate-800">{isEdit ? "Edit Data Pegawai" : "Tambah Pegawai Baru"}</h2>
      <form onSubmit={handleSubmit}>
        <Card title="Identitas Pegawai">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="NIP" required value={form.nip ?? ""} onChange={(e) => set("nip", e.target.value)} />
            <Input label="NIP Lama" value={form.nip_lama ?? ""} onChange={(e) => set("nip_lama", e.target.value)} />
            <Input label="Nama Lengkap" required value={form.nama ?? ""} onChange={(e) => set("nama", e.target.value)} className="sm:col-span-2" />
            <Input label="Gelar Depan" value={form.gelar_depan ?? ""} onChange={(e) => set("gelar_depan", e.target.value)} />
            <Input label="Gelar Belakang" value={form.gelar_belakang ?? ""} onChange={(e) => set("gelar_belakang", e.target.value)} />
            <Input label="Tempat Lahir" value={form.tempat_lahir ?? ""} onChange={(e) => set("tempat_lahir", e.target.value)} />
            <Input label="Tanggal Lahir" type="date" value={form.tanggal_lahir ?? ""} onChange={(e) => set("tanggal_lahir", e.target.value)} />
            <Select label="Jenis Kelamin" value={form.jenis_kelamin ?? ""} onChange={(e) => set("jenis_kelamin", e.target.value as Pegawai["jenis_kelamin"])}>
              <option value="">Pilih</option>
              <option value="L">Laki-laki</option>
              <option value="P">Perempuan</option>
            </Select>
            <Input label="No. HP" value={form.no_hp ?? ""} onChange={(e) => set("no_hp", e.target.value)} />
            <Input label="Email" type="email" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} />
            <Input label="Alamat" value={form.alamat ?? ""} onChange={(e) => set("alamat", e.target.value)} className="sm:col-span-2" />
          </div>
        </Card>

        <div className="h-4" />
        <Card title="Status Kepegawaian & Penempatan">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select label="Status Kepegawaian" required value={form.status_kepegawaian ?? ""} onChange={(e) => set("status_kepegawaian", e.target.value as Pegawai["status_kepegawaian"])}>
              <option value="">Pilih</option>
              <option value="CPNS">CPNS</option>
              <option value="PNS">PNS</option>
              <option value="PPPK">PPPK</option>
            </Select>
            <Select label="Status Aktif" value={form.status_aktif ?? "AKTIF"} onChange={(e) => set("status_aktif", e.target.value)}>
              <option value="AKTIF">Aktif</option>
              <option value="PENSIUN">Pensiun</option>
              <option value="MUTASI_KELUAR">Mutasi Keluar</option>
              <option value="CUTI_DILUAR_TANGGUNGAN">Cuti di Luar Tanggungan</option>
              <option value="MENINGGAL">Meninggal</option>
              <option value="NON_AKTIF_LAINNYA">Non-aktif Lainnya</option>
            </Select>
            <Input label="TMT CPNS" type="date" value={form.tmt_cpns ?? ""} onChange={(e) => set("tmt_cpns", e.target.value)} />
            <Input label="TMT PNS" type="date" value={form.tmt_pns ?? ""} onChange={(e) => set("tmt_pns", e.target.value)} />
            <Select label="Unit Kerja" value={form.unit_kerja_id ?? ""} onChange={(e) => set("unit_kerja_id", e.target.value)} className="sm:col-span-2">
              <option value="">Pilih Unit Kerja</option>
              {unitKerjaList.map((u) => (
                <option key={u.id} value={u.id}>{u.nama}</option>
              ))}
            </Select>
          </div>
        </Card>

        <div className="h-4" />
        <Card title="Jabatan & Pangkat Saat Ini">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select label="Jenis Jabatan" value={form.jenis_jabatan ?? ""} onChange={(e) => set("jenis_jabatan", e.target.value)}>
              <option value="">Pilih</option>
              <option value="STRUKTURAL">Struktural</option>
              <option value="FUNGSIONAL_TERTENTU">Fungsional Tertentu</option>
              <option value="PELAKSANA">Pelaksana</option>
            </Select>
            <Input label="Nama Jabatan" hint="Untuk fungsional, isi sesuai nama jabatan (mis. Dokter, Perawat)." value={form.nama_jabatan ?? ""} onChange={(e) => set("nama_jabatan", e.target.value)} />
            <Input label="Jenjang Jabatan" hint="Mis. Ahli Pertama, Ahli Muda (untuk fungsional)." value={form.jenjang_jabatan ?? ""} onChange={(e) => set("jenjang_jabatan", e.target.value)} />
            <Input label="Golongan/Ruang Aktif" placeholder="mis. III/b" value={form.golongan_ruang_aktif ?? ""} onChange={(e) => set("golongan_ruang_aktif", e.target.value)} />
            <Input label="Nama Pangkat Aktif" value={form.nama_pangkat_aktif ?? ""} onChange={(e) => set("nama_pangkat_aktif", e.target.value)} />
            <Input label="TMT Pangkat Aktif" type="date" value={form.tmt_pangkat_aktif ?? ""} onChange={(e) => set("tmt_pangkat_aktif", e.target.value)} />
          </div>
        </Card>

        <div className="h-4" />
        <Card title="SKP Terakhir (opsional, input pendukung validasi)">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select label="Predikat SKP Terakhir" value={form.predikat_skp_terakhir ?? ""} onChange={(e) => set("predikat_skp_terakhir", e.target.value)}>
              <option value="">Belum diisi</option>
              <option value="Sangat Baik">Sangat Baik</option>
              <option value="Baik">Baik</option>
              <option value="Cukup">Cukup</option>
              <option value="Kurang">Kurang</option>
              <option value="Sangat Kurang">Sangat Kurang</option>
            </Select>
            <Input label="Periode SKP" placeholder="mis. 2025" value={form.periode_skp_terakhir ?? ""} onChange={(e) => set("periode_skp_terakhir", e.target.value)} />
          </div>
        </Card>

        {error && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => navigate(-1)}>Batal</Button>
          <Button type="submit" loading={saving}>Simpan</Button>
        </div>
      </form>
    </div>
  );
}
