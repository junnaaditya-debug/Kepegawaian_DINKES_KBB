import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { ArrowLeft, Pencil, Plus } from "lucide-react";
import { api, ApiError } from "../lib/api";
import type { AngkaKredit, AngkaKreditGap, PegawaiDetail as PegawaiDetailType, RiwayatJabatan, RiwayatPangkat, RiwayatPendidikan } from "../types";
import { Badge, EmptyState, Modal, PageHeader, Spinner } from "../components/ui";
import { formatDate, formatMonthsAsYearsMonths, formatNumber } from "../lib/format";
import { useAuth } from "../lib/auth";
import { useJenisJabatanFungsionalList, useJenjangAllList, useUnitKerjaList } from "../hooks/useReference";
import { GOLONGAN_LIST, JENJANG_PENDIDIKAN_OPTIONS, SKP_PREDIKAT_OPTIONS } from "../lib/constants";
import PegawaiFormModal from "../components/PegawaiFormModal";
import DocumentManager from "../components/DocumentManager";

const TABS = ["Data Diri", "Riwayat Jabatan", "Riwayat Pangkat", "Angka Kredit", "Dokumen"] as const;

export default function PegawaiDetail() {
  const { id } = useParams<{ id: string }>();
  const pegawaiId = Number(id);
  const { user } = useAuth();
  const canWrite = user?.role === "super_admin" || user?.role === "admin_kepegawaian";
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Data Diri");
  const [showEdit, setShowEdit] = useState(false);

  const { data: pegawai, isLoading } = useQuery({
    queryKey: ["pegawai", pegawaiId],
    queryFn: () => api.get<PegawaiDetailType>(`/pegawai/${pegawaiId}`),
  });

  if (isLoading || !pegawai) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size={28} className="text-brand-600" />
      </div>
    );
  }

  return (
    <div>
      <Link to="/pegawai" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft size={15} /> Kembali ke Data Pegawai
      </Link>

      <PageHeader
        title={`${pegawai.gelar_depan ? pegawai.gelar_depan + " " : ""}${pegawai.nama}${pegawai.gelar_belakang ? ", " + pegawai.gelar_belakang : ""}`}
        subtitle={`NIP. ${pegawai.nip} · ${pegawai.unit_kerja_nama}`}
        actions={
          canWrite && (
            <button className="btn-secondary" onClick={() => setShowEdit(true)}>
              <Pencil size={15} /> Ubah Data
            </button>
          )
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard label="Status" value={<Badge color={pegawai.status_aktif === "aktif" ? "green" : "slate"}>{pegawai.status_aktif}</Badge>} />
        <SummaryCard label="Golongan / Pangkat" value={`${pegawai.golongan_ruang_aktif ?? "-"} · ${pegawai.nama_pangkat_aktif ?? "-"}`} />
        <SummaryCard label="Masa Kerja Golongan" value={formatMonthsAsYearsMonths(pegawai.masa_kerja_golongan_bulan)} />
        <SummaryCard label="Jabatan" value={pegawai.jabatan_nama_display ?? "-"} />
      </div>

      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === t ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Data Diri" && <DataDiriTab pegawai={pegawai} />}
      {tab === "Riwayat Jabatan" && <RiwayatJabatanTab pegawaiId={pegawaiId} canWrite={canWrite} />}
      {tab === "Riwayat Pangkat" && <RiwayatPangkatTab pegawaiId={pegawaiId} canWrite={canWrite} />}
      {tab === "Angka Kredit" && <AngkaKreditTab pegawaiId={pegawaiId} canWrite={canWrite} isFungsional={pegawai.jenis_jabatan === "fungsional"} />}
      {tab === "Dokumen" && <DocumentManager pegawaiId={pegawaiId} title="Dokumen Pegawai" />}

      {showEdit && (
        <PegawaiFormModal
          mode="edit"
          pegawaiId={pegawaiId}
          initial={pegawai}
          onClose={() => setShowEdit(false)}
          onSuccess={() => {
            setShowEdit(false);
            queryClient.invalidateQueries({ queryKey: ["pegawai", pegawaiId] });
          }}
        />
      )}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="card p-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <div className="mt-1 text-sm font-semibold text-slate-800">{value}</div>
    </div>
  );
}

function DataDiriTab({ pegawai }: { pegawai: PegawaiDetailType }) {
  const [showPendidikanForm, setShowPendidikanForm] = useState(false);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canWrite = user?.role === "super_admin" || user?.role === "admin_kepegawaian";

  const { data: pendidikan } = useQuery({
    queryKey: ["pegawai", pegawai.id, "pendidikan"],
    queryFn: () => api.get<RiwayatPendidikan[]>(`/pegawai/${pegawai.id}/pendidikan`),
  });

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="card p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-800">Informasi Pribadi</h3>
        <dl className="space-y-2 text-sm">
          <Row label="Jenis Kelamin" value={pegawai.jenis_kelamin === "L" ? "Laki-laki" : "Perempuan"} />
          <Row label="Tempat, Tanggal Lahir" value={`${pegawai.tempat_lahir ?? "-"}, ${formatDate(pegawai.tanggal_lahir)}`} />
          <Row label="Alamat" value={pegawai.alamat ?? "-"} />
          <Row label="No. HP" value={pegawai.no_hp ?? "-"} />
          <Row label="Email" value={pegawai.email ?? "-"} />
        </dl>
      </div>
      <div className="card p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-800">Status Kepegawaian</h3>
        <dl className="space-y-2 text-sm">
          <Row label="Status Kepegawaian" value={pegawai.status_kepegawaian} />
          <Row label="TMT CPNS" value={formatDate(pegawai.tmt_cpns)} />
          <Row label="TMT PNS" value={formatDate(pegawai.tmt_pns)} />
          <Row label="Unit Kerja" value={pegawai.unit_kerja_nama} />
          <Row label="Jenis Jabatan" value={pegawai.jenis_jabatan} />
          {pegawai.jenis_jabatan === "fungsional" && (
            <>
              <Row label="Rumpun Fungsional" value={pegawai.jenis_fungsional_nama ?? "-"} />
              <Row label="Jenjang" value={pegawai.jenjang_fungsional_nama ?? "-"} />
            </>
          )}
          <Row label="Predikat SKP Terakhir" value={pegawai.skp_predikat_terakhir ? `${pegawai.skp_predikat_terakhir} (${pegawai.skp_tahun_terakhir ?? "-"})` : "Belum diisi"} />
        </dl>
      </div>

      <div className="card p-4 lg:col-span-2">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">Riwayat Pendidikan</h3>
          {canWrite && (
            <button className="btn-secondary" onClick={() => setShowPendidikanForm(true)}>
              <Plus size={15} /> Tambah
            </button>
          )}
        </div>
        {!pendidikan || pendidikan.length === 0 ? (
          <EmptyState title="Belum ada data pendidikan" />
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs font-semibold uppercase text-slate-400">
              <tr>
                <th className="py-1.5">Jenjang</th>
                <th className="py-1.5">Jurusan</th>
                <th className="py-1.5">Institusi</th>
                <th className="py-1.5">Tahun Lulus</th>
                <th className="py-1.5">No. Ijazah</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pendidikan.map((p) => (
                <tr key={p.id}>
                  <td className="py-2 font-medium">
                    {p.jenjang} {!!p.is_pendidikan_terakhir && <Badge color="blue">Terakhir</Badge>}
                  </td>
                  <td className="py-2">{p.jurusan ?? "-"}</td>
                  <td className="py-2">{p.nama_institusi ?? "-"}</td>
                  <td className="py-2">{p.tahun_lulus ?? "-"}</td>
                  <td className="py-2">{p.no_ijazah ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showPendidikanForm && (
        <PendidikanFormModal
          pegawaiId={pegawai.id}
          onClose={() => setShowPendidikanForm(false)}
          onSuccess={() => {
            setShowPendidikanForm(false);
            queryClient.invalidateQueries({ queryKey: ["pegawai", pegawai.id, "pendidikan"] });
          }}
        />
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-50 pb-2">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-800">{value}</dd>
    </div>
  );
}

function PendidikanFormModal({ pegawaiId, onClose, onSuccess }: { pegawaiId: number; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ jenjang: "S1", jurusan: "", nama_institusi: "", tahun_lulus: "", no_ijazah: "", is_pendidikan_terakhir: true });
  const mutation = useMutation({
    mutationFn: () =>
      api.post(`/pegawai/${pegawaiId}/pendidikan`, {
        ...form,
        tahun_lulus: form.tahun_lulus ? Number(form.tahun_lulus) : null,
      }),
    onSuccess: () => {
      toast.success("Riwayat pendidikan ditambahkan");
      onSuccess();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Gagal menyimpan"),
  });

  return (
    <Modal open onClose={onClose} title="Tambah Riwayat Pendidikan">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <div>
          <label className="label">Jenjang</label>
          <select className="input" value={form.jenjang} onChange={(e) => setForm({ ...form, jenjang: e.target.value })}>
            {JENJANG_PENDIDIKAN_OPTIONS.map((j) => (
              <option key={j} value={j}>
                {j}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Jurusan</label>
          <input className="input" value={form.jurusan} onChange={(e) => setForm({ ...form, jurusan: e.target.value })} />
        </div>
        <div>
          <label className="label">Nama Institusi</label>
          <input className="input" value={form.nama_institusi} onChange={(e) => setForm({ ...form, nama_institusi: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Tahun Lulus</label>
            <input type="number" className="input" value={form.tahun_lulus} onChange={(e) => setForm({ ...form, tahun_lulus: e.target.value })} />
          </div>
          <div>
            <label className="label">No. Ijazah</label>
            <input className="input" value={form.no_ijazah} onChange={(e) => setForm({ ...form, no_ijazah: e.target.value })} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={form.is_pendidikan_terakhir} onChange={(e) => setForm({ ...form, is_pendidikan_terakhir: e.target.checked })} />
          Jadikan pendidikan terakhir
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Batal
          </button>
          <button className="btn-primary" disabled={mutation.isPending}>
            {mutation.isPending && <Spinner size={14} />} Simpan
          </button>
        </div>
      </form>
    </Modal>
  );
}

function RiwayatJabatanTab({ pegawaiId, canWrite }: { pegawaiId: number; canWrite: boolean }) {
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ["pegawai", pegawaiId, "jabatan"],
    queryFn: () => api.get<RiwayatJabatan[]>(`/pegawai/${pegawaiId}/jabatan`),
  });

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">Riwayat Jabatan</h3>
        {canWrite && (
          <button className="btn-secondary" onClick={() => setShowForm(true)}>
            <Plus size={15} /> Tambah
          </button>
        )}
      </div>
      {!data || data.length === 0 ? (
        <EmptyState title="Belum ada riwayat jabatan" />
      ) : (
        <ol className="relative space-y-4 border-l border-slate-200 pl-5">
          {data.map((r) => (
            <li key={r.id} className="relative">
              <span className={`absolute -left-[25px] top-1 h-3 w-3 rounded-full border-2 border-white ${r.is_aktif ? "bg-brand-600" : "bg-slate-300"}`} />
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-slate-800">{r.jabatan_nama}</p>
                {!!r.is_aktif && <Badge color="green">Aktif</Badge>}
                <Badge color="slate">{r.jenis}</Badge>
              </div>
              <p className="text-xs text-slate-500">
                {r.unit_kerja_nama} · TMT {formatDate(r.tmt_jabatan)} {r.no_sk ? `· SK ${r.no_sk}` : ""}
              </p>
            </li>
          ))}
        </ol>
      )}
      {showForm && (
        <RiwayatJabatanFormModal
          pegawaiId={pegawaiId}
          onClose={() => setShowForm(false)}
          onSuccess={() => {
            setShowForm(false);
            queryClient.invalidateQueries({ queryKey: ["pegawai", pegawaiId, "jabatan"] });
            queryClient.invalidateQueries({ queryKey: ["pegawai", pegawaiId] });
          }}
        />
      )}
    </div>
  );
}

function RiwayatJabatanFormModal({ pegawaiId, onClose, onSuccess }: { pegawaiId: number; onClose: () => void; onSuccess: () => void }) {
  const { data: unitKerjaList } = useUnitKerjaList();
  const { data: jenjangList } = useJenjangAllList();
  const [form, setForm] = useState({
    jenis: "pelaksana",
    jabatan_nama: "",
    unit_kerja_id: "",
    jenjang_jabatan_fungsional_id: "",
    no_sk: "",
    tanggal_sk: "",
    tmt_jabatan: "",
    pejabat_penetap: "",
    jadikan_aktif: true,
  });

  const mutation = useMutation({
    mutationFn: () =>
      api.post(`/pegawai/${pegawaiId}/jabatan`, {
        ...form,
        unit_kerja_id: Number(form.unit_kerja_id),
        jenjang_jabatan_fungsional_id: form.jenjang_jabatan_fungsional_id ? Number(form.jenjang_jabatan_fungsional_id) : null,
      }),
    onSuccess: () => {
      toast.success("Riwayat jabatan ditambahkan");
      onSuccess();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Gagal menyimpan"),
  });

  return (
    <Modal open onClose={onClose} title="Tambah Riwayat Jabatan">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <div>
          <label className="label">Jenis Jabatan</label>
          <select className="input" value={form.jenis} onChange={(e) => setForm({ ...form, jenis: e.target.value })}>
            <option value="pelaksana">Pelaksana</option>
            <option value="struktural">Struktural</option>
            <option value="fungsional">Fungsional Tertentu</option>
          </select>
        </div>
        <div>
          <label className="label">Nama Jabatan</label>
          <input className="input" required value={form.jabatan_nama} onChange={(e) => setForm({ ...form, jabatan_nama: e.target.value })} />
        </div>
        {form.jenis === "fungsional" && (
          <div>
            <label className="label">Jenjang Fungsional</label>
            <select className="input" value={form.jenjang_jabatan_fungsional_id} onChange={(e) => setForm({ ...form, jenjang_jabatan_fungsional_id: e.target.value })}>
              <option value="">-</option>
              {jenjangList?.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.jenis_nama} - {j.nama}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="label">Unit Kerja</label>
          <select className="input" required value={form.unit_kerja_id} onChange={(e) => setForm({ ...form, unit_kerja_id: e.target.value })}>
            <option value="">Pilih unit kerja</option>
            {unitKerjaList?.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nama}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">No. SK</label>
            <input className="input" value={form.no_sk} onChange={(e) => setForm({ ...form, no_sk: e.target.value })} />
          </div>
          <div>
            <label className="label">Tanggal SK</label>
            <input type="date" className="input" value={form.tanggal_sk} onChange={(e) => setForm({ ...form, tanggal_sk: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="label">TMT Jabatan</label>
          <input type="date" className="input" required value={form.tmt_jabatan} onChange={(e) => setForm({ ...form, tmt_jabatan: e.target.value })} />
        </div>
        <div>
          <label className="label">Pejabat Penetap</label>
          <input className="input" value={form.pejabat_penetap} onChange={(e) => setForm({ ...form, pejabat_penetap: e.target.value })} />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={form.jadikan_aktif} onChange={(e) => setForm({ ...form, jadikan_aktif: e.target.checked })} />
          Jadikan jabatan aktif saat ini
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Batal
          </button>
          <button className="btn-primary" disabled={mutation.isPending}>
            {mutation.isPending && <Spinner size={14} />} Simpan
          </button>
        </div>
      </form>
    </Modal>
  );
}

function RiwayatPangkatTab({ pegawaiId, canWrite }: { pegawaiId: number; canWrite: boolean }) {
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ["pegawai", pegawaiId, "pangkat"],
    queryFn: () => api.get<RiwayatPangkat[]>(`/pegawai/${pegawaiId}/pangkat`),
  });

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">Riwayat Pangkat & Golongan</h3>
        {canWrite && (
          <button className="btn-secondary" onClick={() => setShowForm(true)}>
            <Plus size={15} /> Input SK Kenaikan Pangkat
          </button>
        )}
      </div>
      {!data || data.length === 0 ? (
        <EmptyState title="Belum ada riwayat pangkat" />
      ) : (
        <ol className="relative space-y-4 border-l border-slate-200 pl-5">
          {data.map((r) => (
            <li key={r.id} className="relative">
              <span className={`absolute -left-[25px] top-1 h-3 w-3 rounded-full border-2 border-white ${r.is_aktif ? "bg-brand-600" : "bg-slate-300"}`} />
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-slate-800">
                  {r.golongan_ruang} · {r.nama_pangkat}
                </p>
                {!!r.is_aktif && <Badge color="green">Aktif</Badge>}
                <Badge color="purple">{r.jenis_kenaikan}</Badge>
              </div>
              <p className="text-xs text-slate-500">
                TMT {formatDate(r.tmt_pangkat)} {r.no_sk ? `· SK ${r.no_sk}` : ""} {r.tanggal_sk ? `(${formatDate(r.tanggal_sk)})` : ""}
              </p>
            </li>
          ))}
        </ol>
      )}
      {showForm && (
        <RiwayatPangkatFormModal
          pegawaiId={pegawaiId}
          onClose={() => setShowForm(false)}
          onSuccess={() => {
            setShowForm(false);
            queryClient.invalidateQueries({ queryKey: ["pegawai", pegawaiId, "pangkat"] });
            queryClient.invalidateQueries({ queryKey: ["pegawai", pegawaiId] });
            queryClient.invalidateQueries({ queryKey: ["kenaikan-pangkat"] });
          }}
        />
      )}
    </div>
  );
}

function RiwayatPangkatFormModal({ pegawaiId, onClose, onSuccess }: { pegawaiId: number; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({
    golongan_ruang: "",
    nama_pangkat: "",
    tmt_pangkat: "",
    no_sk: "",
    tanggal_sk: "",
    pejabat_penetap: "",
    jenis_kenaikan: "reguler",
  });

  const mutation = useMutation({
    mutationFn: () => api.post(`/pegawai/${pegawaiId}/pangkat`, form),
    onSuccess: () => {
      toast.success("SK kenaikan pangkat berhasil diinput. Riwayat lama diarsipkan otomatis.");
      onSuccess();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Gagal menyimpan"),
  });

  return (
    <Modal open onClose={onClose} title="Input SK Kenaikan Pangkat">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Data pangkat/golongan aktif saat ini akan diarsipkan otomatis (read-only) dan digantikan dengan data baru ini (BR-6).
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Golongan/Ruang Baru</label>
            <select className="input" required value={form.golongan_ruang} onChange={(e) => setForm({ ...form, golongan_ruang: e.target.value })}>
              <option value="">-</option>
              {GOLONGAN_LIST.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Nama Pangkat</label>
            <input className="input" required value={form.nama_pangkat} onChange={(e) => setForm({ ...form, nama_pangkat: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="label">TMT Pangkat</label>
          <input type="date" className="input" required value={form.tmt_pangkat} onChange={(e) => setForm({ ...form, tmt_pangkat: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">No. SK</label>
            <input className="input" value={form.no_sk} onChange={(e) => setForm({ ...form, no_sk: e.target.value })} />
          </div>
          <div>
            <label className="label">Tanggal SK</label>
            <input type="date" className="input" value={form.tanggal_sk} onChange={(e) => setForm({ ...form, tanggal_sk: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="label">Pejabat Penetap</label>
          <input className="input" value={form.pejabat_penetap} onChange={(e) => setForm({ ...form, pejabat_penetap: e.target.value })} />
        </div>
        <div>
          <label className="label">Jenis Kenaikan</label>
          <select className="input" value={form.jenis_kenaikan} onChange={(e) => setForm({ ...form, jenis_kenaikan: e.target.value })}>
            <option value="reguler">Reguler</option>
            <option value="pilihan">Pilihan</option>
            <option value="fungsional">Fungsional</option>
            <option value="penyesuaian_ijazah">Penyesuaian Ijazah</option>
            <option value="lainnya">Lainnya</option>
          </select>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Batal
          </button>
          <button className="btn-primary" disabled={mutation.isPending}>
            {mutation.isPending && <Spinner size={14} />} Simpan
          </button>
        </div>
      </form>
    </Modal>
  );
}

function AngkaKreditTab({ pegawaiId, canWrite, isFungsional }: { pegawaiId: number; canWrite: boolean; isFungsional: boolean }) {
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ["pegawai", pegawaiId, "angka-kredit"],
    queryFn: () => api.get<{ data: AngkaKredit[]; gap: AngkaKreditGap | null }>(`/pegawai/${pegawaiId}/angka-kredit`),
  });

  if (!isFungsional) {
    return <EmptyState title="Tidak berlaku" description="Angka kredit hanya berlaku untuk pegawai dengan jabatan fungsional tertentu (JFT)." />;
  }

  return (
    <div className="space-y-4">
      {data?.gap && (
        <div className="card grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
          <SummaryCard label="Angka Kredit Kumulatif" value={formatNumber(data.gap.kumulatifSaatIni)} />
          <SummaryCard label="Jenjang Berikutnya" value={data.gap.jenjangBerikutnyaNama ?? "-"} />
          <SummaryCard label="Ambang Batas" value={formatNumber(data.gap.ambangBatas)} />
          <SummaryCard
            label="Sisa Kebutuhan"
            value={
              data.gap.sisaKebutuhan === 0 ? (
                <Badge color="green">Terpenuhi</Badge>
              ) : (
                formatNumber(data.gap.sisaKebutuhan)
              )
            }
          />
        </div>
      )}

      <div className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">Riwayat Penetapan Angka Kredit (PAK)</h3>
          {canWrite && (
            <button className="btn-secondary" onClick={() => setShowForm(true)}>
              <Plus size={15} /> Tambah PAK
            </button>
          )}
        </div>
        {!data || data.data.length === 0 ? (
          <EmptyState title="Belum ada data angka kredit" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs font-semibold uppercase text-slate-400">
                <tr>
                  <th className="py-1.5">No. PAK</th>
                  <th className="py-1.5">Tanggal</th>
                  <th className="py-1.5">Periode</th>
                  <th className="py-1.5">Utama</th>
                  <th className="py-1.5">Pengembangan</th>
                  <th className="py-1.5">Penunjang</th>
                  <th className="py-1.5">Kumulatif</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.data.map((a) => (
                  <tr key={a.id}>
                    <td className="py-2 font-medium">
                      {a.no_pak ?? "-"} {!!a.is_terbaru && <Badge color="blue">Terbaru</Badge>}
                    </td>
                    <td className="py-2">{formatDate(a.tanggal_pak)}</td>
                    <td className="py-2">
                      {formatDate(a.periode_mulai)} – {formatDate(a.periode_selesai)}
                    </td>
                    <td className="py-2">{formatNumber(a.angka_kredit_utama)}</td>
                    <td className="py-2">{formatNumber(a.angka_kredit_pengembangan_profesi)}</td>
                    <td className="py-2">{formatNumber(a.angka_kredit_penunjang)}</td>
                    <td className="py-2 font-semibold">{formatNumber(a.angka_kredit_kumulatif)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <AngkaKreditFormModal
          pegawaiId={pegawaiId}
          onClose={() => setShowForm(false)}
          onSuccess={() => {
            setShowForm(false);
            queryClient.invalidateQueries({ queryKey: ["pegawai", pegawaiId, "angka-kredit"] });
          }}
        />
      )}
    </div>
  );
}

function AngkaKreditFormModal({ pegawaiId, onClose, onSuccess }: { pegawaiId: number; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({
    no_pak: "",
    tanggal_pak: "",
    periode_mulai: "",
    periode_selesai: "",
    angka_kredit_utama: "",
    angka_kredit_pengembangan_profesi: "",
    angka_kredit_penunjang: "",
  });

  const mutation = useMutation({
    mutationFn: () =>
      api.post(`/pegawai/${pegawaiId}/angka-kredit`, {
        ...form,
        angka_kredit_utama: Number(form.angka_kredit_utama || 0),
        angka_kredit_pengembangan_profesi: Number(form.angka_kredit_pengembangan_profesi || 0),
        angka_kredit_penunjang: Number(form.angka_kredit_penunjang || 0),
      }),
    onSuccess: () => {
      toast.success("Data angka kredit ditambahkan");
      onSuccess();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Gagal menyimpan"),
  });

  return (
    <Modal open onClose={onClose} title="Tambah Penetapan Angka Kredit (PAK)">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">No. PAK</label>
            <input className="input" value={form.no_pak} onChange={(e) => setForm({ ...form, no_pak: e.target.value })} />
          </div>
          <div>
            <label className="label">Tanggal PAK</label>
            <input type="date" className="input" value={form.tanggal_pak} onChange={(e) => setForm({ ...form, tanggal_pak: e.target.value })} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Periode Mulai</label>
            <input type="date" className="input" value={form.periode_mulai} onChange={(e) => setForm({ ...form, periode_mulai: e.target.value })} />
          </div>
          <div>
            <label className="label">Periode Selesai</label>
            <input type="date" className="input" value={form.periode_selesai} onChange={(e) => setForm({ ...form, periode_selesai: e.target.value })} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label">AK Unsur Utama</label>
            <input type="number" step="0.01" className="input" value={form.angka_kredit_utama} onChange={(e) => setForm({ ...form, angka_kredit_utama: e.target.value })} />
          </div>
          <div>
            <label className="label">AK Pengembangan Profesi</label>
            <input
              type="number"
              step="0.01"
              className="input"
              value={form.angka_kredit_pengembangan_profesi}
              onChange={(e) => setForm({ ...form, angka_kredit_pengembangan_profesi: e.target.value })}
            />
          </div>
          <div>
            <label className="label">AK Penunjang</label>
            <input type="number" step="0.01" className="input" value={form.angka_kredit_penunjang} onChange={(e) => setForm({ ...form, angka_kredit_penunjang: e.target.value })} />
          </div>
        </div>
        <p className="text-xs text-slate-500">
          Angka kredit kumulatif dihitung otomatis dari total ketiga unsur di atas (dapat disesuaikan manual bila diperlukan setelah data tersimpan).
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Batal
          </button>
          <button className="btn-primary" disabled={mutation.isPending}>
            {mutation.isPending && <Spinner size={14} />} Simpan
          </button>
        </div>
      </form>
    </Modal>
  );
}
