import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { api, errorMessage } from "../api/client";
import { Badge, Button, Card, Field, Input, Select, Spinner } from "../components/ui";
import type { Pegawai, UnitKerja } from "../types";
import { formatTanggal, label } from "../utils/format";
import { useAuth } from "../context/AuthContext";
import RiwayatJabatanTab from "../components/pegawai/RiwayatJabatanTab";
import RiwayatPangkatTab from "../components/pegawai/RiwayatPangkatTab";
import AngkaKreditTab from "../components/pegawai/AngkaKreditTab";
import DokumenTab from "../components/pegawai/DokumenTab";
import RiwayatPendidikanTab from "../components/pegawai/RiwayatPendidikanTab";
import SkpTab from "../components/pegawai/SkpTab";

const TABS = ["Data Diri", "Riwayat Jabatan", "Riwayat Pangkat", "Pendidikan", "Angka Kredit", "SKP", "Dokumen"] as const;

export default function PegawaiDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Data Diri");

  const { data: pegawai, isLoading } = useQuery<Pegawai>({
    queryKey: ["pegawai", id],
    queryFn: () => api.get(`/pegawai/${id}`).then((r) => r.data),
    enabled: !!id,
  });

  if (isLoading || !pegawai || !id) return <Spinner />;

  const pangkatAktif = pegawai.riwayatPangkatGolongan?.find((r) => r.isAktif);
  const jabatanAktif = pegawai.riwayatJabatan?.find((r) => r.isAktif);

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-800">
              {pegawai.gelarDepan ? `${pegawai.gelarDepan} ` : ""}
              {pegawai.nama}
              {pegawai.gelarBelakang ? `, ${pegawai.gelarBelakang}` : ""}
            </h1>
            <p className="font-mono text-sm text-slate-500">NIP. {pegawai.nip}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge tone={pegawai.statusAktif}>{label(pegawai.statusAktif)}</Badge>
              <Badge>{label(pegawai.statusKepegawaian)}</Badge>
              {pangkatAktif && <Badge tone="REGULER">{pangkatAktif.golonganRuang} - {pangkatAktif.namaPangkat}</Badge>}
            </div>
          </div>
          <div className="text-right text-sm text-slate-500">
            <p>{pegawai.unitKerja?.nama || "Belum ada unit kerja"}</p>
            <p>{jabatanAktif ? `${label(jabatanAktif.jenisJabatan)} - ${jabatanAktif.namaJabatan}${jabatanAktif.jenjangJabatan ? " (" + label(jabatanAktif.jenjangJabatan) + ")" : ""}` : "Belum ada jabatan"}</p>
          </div>
        </div>
      </Card>

      <div className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={clsx(
              "whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium",
              tab === t ? "border-sky-700 text-sky-700" : "border-transparent text-slate-500 hover:text-slate-700"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Data Diri" && <DataDiriTab pegawai={pegawai} />}
      {tab === "Riwayat Jabatan" && <RiwayatJabatanTab pegawaiId={id} data={pegawai.riwayatJabatan || []} />}
      {tab === "Riwayat Pangkat" && <RiwayatPangkatTab pegawaiId={id} data={pegawai.riwayatPangkatGolongan || []} />}
      {tab === "Pendidikan" && <RiwayatPendidikanTab pegawaiId={id} data={pegawai.riwayatPendidikan || []} />}
      {tab === "Angka Kredit" && <AngkaKreditTab pegawaiId={id} data={pegawai.angkaKredit || []} />}
      {tab === "SKP" && <SkpTab pegawaiId={id} data={pegawai.nilaiSkp || []} />}
      {tab === "Dokumen" && <DokumenTab pegawaiId={id} data={pegawai.dokumen || []} />}
    </div>
  );
}

function DataDiriTab({ pegawai }: { pegawai: Pegawai }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const canEdit = user && ["SUPER_ADMIN", "ADMIN_KEPEGAWAIAN"].includes(user.role);

  const { data: unitList } = useQuery<UnitKerja[]>({ queryKey: ["unit-kerja"], queryFn: () => api.get("/unit-kerja").then((r) => r.data) });

  const [form, setForm] = useState({
    nama: pegawai.nama,
    gelarDepan: pegawai.gelarDepan || "",
    gelarBelakang: pegawai.gelarBelakang || "",
    tempatLahir: pegawai.tempatLahir || "",
    tanggalLahir: pegawai.tanggalLahir ? pegawai.tanggalLahir.slice(0, 10) : "",
    jenisKelamin: pegawai.jenisKelamin,
    alamat: pegawai.alamat || "",
    noHp: pegawai.noHp || "",
    email: pegawai.email || "",
    statusKepegawaian: pegawai.statusKepegawaian,
    statusAktif: pegawai.statusAktif,
    unitKerjaId: pegawai.unitKerjaId || "",
    tmtCpns: pegawai.tmtCpns ? pegawai.tmtCpns.slice(0, 10) : "",
    tmtPns: pegawai.tmtPns ? pegawai.tmtPns.slice(0, 10) : "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function simpan() {
    setSaving(true);
    setError("");
    try {
      await api.put(`/pegawai/${pegawai.id}`, form);
      await qc.invalidateQueries({ queryKey: ["pegawai", pegawai.id] });
      setEditing(false);
    } catch (err) {
      setError(errorMessage(err, "Gagal menyimpan perubahan"));
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <Card
        title="Data Diri"
        actions={canEdit ? <Button variant="secondary" onClick={() => setEditing(true)}>Edit</Button> : undefined}
      >
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <Info label="NIP" value={pegawai.nip} />
          <Info label="NIP Lama" value={pegawai.nipLama || "-"} />
          <Info label="Nama Lengkap" value={`${pegawai.gelarDepan ? pegawai.gelarDepan + " " : ""}${pegawai.nama}${pegawai.gelarBelakang ? ", " + pegawai.gelarBelakang : ""}`} />
          <Info label="Jenis Kelamin" value={label(pegawai.jenisKelamin)} />
          <Info label="Tempat, Tanggal Lahir" value={`${pegawai.tempatLahir || "-"}, ${formatTanggal(pegawai.tanggalLahir)}`} />
          <Info label="Alamat" value={pegawai.alamat || "-"} />
          <Info label="No. HP" value={pegawai.noHp || "-"} />
          <Info label="Email" value={pegawai.email || "-"} />
          <Info label="Status Kepegawaian" value={label(pegawai.statusKepegawaian)} />
          <Info label="Status Aktif" value={label(pegawai.statusAktif)} />
          <Info label="TMT CPNS" value={formatTanggal(pegawai.tmtCpns)} />
          <Info label="TMT PNS" value={formatTanggal(pegawai.tmtPns)} />
          <Info label="Unit Kerja" value={pegawai.unitKerja?.nama || "-"} />
        </dl>
      </Card>
    );
  }

  return (
    <Card title="Edit Data Diri">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Nama">
          <Input value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Gelar Depan">
            <Input value={form.gelarDepan} onChange={(e) => setForm({ ...form, gelarDepan: e.target.value })} />
          </Field>
          <Field label="Gelar Belakang">
            <Input value={form.gelarBelakang} onChange={(e) => setForm({ ...form, gelarBelakang: e.target.value })} />
          </Field>
        </div>
        <Field label="Tempat Lahir">
          <Input value={form.tempatLahir} onChange={(e) => setForm({ ...form, tempatLahir: e.target.value })} />
        </Field>
        <Field label="Tanggal Lahir">
          <Input type="date" value={form.tanggalLahir} onChange={(e) => setForm({ ...form, tanggalLahir: e.target.value })} />
        </Field>
        <Field label="Jenis Kelamin">
          <Select value={form.jenisKelamin} onChange={(e) => setForm({ ...form, jenisKelamin: e.target.value as any })}>
            <option value="L">Laki-laki</option>
            <option value="P">Perempuan</option>
          </Select>
        </Field>
        <Field label="Status Kepegawaian">
          <Select value={form.statusKepegawaian} onChange={(e) => setForm({ ...form, statusKepegawaian: e.target.value as any })}>
            <option value="CPNS">CPNS</option>
            <option value="PNS">PNS</option>
            <option value="PPPK">PPPK</option>
          </Select>
        </Field>
        <Field label="Status Aktif">
          <Select value={form.statusAktif} onChange={(e) => setForm({ ...form, statusAktif: e.target.value as any })}>
            <option value="AKTIF">Aktif</option>
            <option value="PENSIUN">Pensiun</option>
            <option value="MUTASI_KELUAR">Mutasi Keluar</option>
            <option value="MENINGGAL">Meninggal</option>
            <option value="CUTI_DI_LUAR_TANGGUNGAN">Cuti di Luar Tanggungan</option>
          </Select>
        </Field>
        <Field label="Unit Kerja">
          <Select value={form.unitKerjaId} onChange={(e) => setForm({ ...form, unitKerjaId: e.target.value })}>
            <option value="">- Pilih -</option>
            {unitList?.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nama}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="No. HP">
          <Input value={form.noHp} onChange={(e) => setForm({ ...form, noHp: e.target.value })} />
        </Field>
        <Field label="Email">
          <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="TMT CPNS">
          <Input type="date" value={form.tmtCpns} onChange={(e) => setForm({ ...form, tmtCpns: e.target.value })} />
        </Field>
        <Field label="TMT PNS">
          <Input type="date" value={form.tmtPns} onChange={(e) => setForm({ ...form, tmtPns: e.target.value })} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Alamat">
            <Input value={form.alamat} onChange={(e) => setForm({ ...form, alamat: e.target.value })} />
          </Field>
        </div>
      </div>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={() => setEditing(false)}>
          Batal
        </Button>
        <Button onClick={simpan} disabled={saving}>
          {saving ? "Menyimpan..." : "Simpan Perubahan"}
        </Button>
      </div>
    </Card>
  );
}

function Info({ label: l, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{l}</dt>
      <dd className="font-medium text-slate-800">{value}</dd>
    </div>
  );
}
