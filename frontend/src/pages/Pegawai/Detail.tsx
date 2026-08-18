import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../../api/client";
import type { AngkaKredit, Dokumen, Pegawai, RiwayatJabatan, RiwayatPangkat, RiwayatPendidikan } from "../../types";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { StatusBadge } from "../../components/ui/Badge";
import { useAuth } from "../../context/AuthContext";
import {
  RiwayatJabatanModal,
  RiwayatPangkatModal,
  RiwayatPendidikanModal,
  AngkaKreditModal,
  DokumenUploadModal,
} from "./DetailModals";

interface DetailData {
  pegawai: Pegawai;
  riwayatJabatan: RiwayatJabatan[];
  riwayatPangkat: RiwayatPangkat[];
  riwayatPendidikan: RiwayatPendidikan[];
  angkaKredit: AngkaKredit[];
  dokumen: Dokumen[];
}

const TABS = ["Data Diri", "Riwayat Jabatan", "Riwayat Pangkat", "Angka Kredit", "Dokumen"] as const;
type Tab = (typeof TABS)[number];

const JENIS_DOKUMEN_LABEL: Record<string, string> = {
  SK_CPNS: "SK CPNS", SK_PNS: "SK PNS", SK_PANGKAT: "SK Pangkat", IJAZAH: "Ijazah",
  SERTIFIKAT_DIKLAT: "Sertifikat Diklat", PAK: "PAK", SKP: "SKP", USULAN_KP: "Usulan KP", FOTO: "Foto", LAINNYA: "Lainnya",
};

export default function PegawaiDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState<DetailData | null>(null);
  const [tab, setTab] = useState<Tab>("Data Diri");
  const [modal, setModal] = useState<null | "jabatan" | "pangkat" | "pendidikan" | "angkaKredit" | "dokumen">(null);
  const canEdit = user?.role === "SUPER_ADMIN" || user?.role === "ADMIN_KEPEGAWAIAN";

  async function load() {
    if (!id) return;
    const res = await api.get<{ data: DetailData }>(`/pegawai/${id}/detail`);
    setData(res.data);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!data) return <p className="text-slate-500">Memuat...</p>;
  const { pegawai } = data;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-slate-400 hover:text-slate-600">← Kembali</button>
          <h2 className="text-xl font-bold text-slate-800">{pegawai.nama}</h2>
          <StatusBadge status={pegawai.status_aktif} />
        </div>
        {canEdit && (
          <Link to={`/pegawai/${pegawai.id}/edit`}>
            <Button variant="secondary">Edit Data Diri</Button>
          </Link>
        )}
      </div>

      <div className="flex flex-wrap gap-4 rounded-xl border border-slate-200 bg-white p-4 text-sm">
        <div><span className="text-slate-400">NIP</span><p className="font-mono font-medium">{pegawai.nip}</p></div>
        <div><span className="text-slate-400">Unit Kerja</span><p className="font-medium">{pegawai.unit_kerja_nama ?? "-"}</p></div>
        <div><span className="text-slate-400">Jabatan</span><p className="font-medium">{pegawai.nama_jabatan ?? "-"} {pegawai.jenjang_jabatan}</p></div>
        <div><span className="text-slate-400">Gol/Ruang</span><p className="font-medium">{pegawai.golongan_ruang_aktif ?? "-"}</p></div>
        <div><span className="text-slate-400">TMT Pangkat</span><p className="font-medium">{pegawai.tmt_pangkat_aktif ?? "-"}</p></div>
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium ${tab === t ? "border-b-2 border-brand-600 text-brand-700" : "text-slate-500 hover:text-slate-700"}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Data Diri" && (
        <Card>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[
              ["Nama Lengkap", `${pegawai.gelar_depan ?? ""} ${pegawai.nama} ${pegawai.gelar_belakang ?? ""}`.trim()],
              ["Tempat, Tanggal Lahir", `${pegawai.tempat_lahir ?? "-"}, ${pegawai.tanggal_lahir ?? "-"}`],
              ["Jenis Kelamin", pegawai.jenis_kelamin === "L" ? "Laki-laki" : pegawai.jenis_kelamin === "P" ? "Perempuan" : "-"],
              ["No. HP", pegawai.no_hp ?? "-"],
              ["Email", pegawai.email ?? "-"],
              ["Alamat", pegawai.alamat ?? "-"],
              ["Status Kepegawaian", pegawai.status_kepegawaian],
              ["TMT CPNS", pegawai.tmt_cpns ?? "-"],
              ["TMT PNS", pegawai.tmt_pns ?? "-"],
              ["Predikat SKP Terakhir", pegawai.predikat_skp_terakhir ?? "Belum diisi"],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-slate-400">{label}</dt>
                <dd className="text-sm font-medium text-slate-800">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-6 border-t border-slate-100 pt-4">
            <h4 className="mb-3 text-sm font-semibold text-slate-700">Riwayat Pendidikan</h4>
            {canEdit && <Button variant="secondary" onClick={() => setModal("pendidikan")} className="mb-3">+ Tambah Pendidikan</Button>}
            <table className="w-full text-left text-sm">
              <thead><tr className="text-xs uppercase text-slate-400"><th className="py-1.5">Jenjang</th><th>Jurusan</th><th>Institusi</th><th>Tahun Lulus</th></tr></thead>
              <tbody>
                {data.riwayatPendidikan.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100">
                    <td className="py-1.5">{r.jenjang_pendidikan}</td><td>{r.jurusan ?? "-"}</td><td>{r.nama_institusi ?? "-"}</td><td>{r.tahun_lulus ?? "-"}</td>
                  </tr>
                ))}
                {data.riwayatPendidikan.length === 0 && <tr><td colSpan={4} className="py-3 text-center text-slate-400">Belum ada data.</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === "Riwayat Jabatan" && (
        <Card actions={canEdit ? <Button onClick={() => setModal("jabatan")}>+ Tambah Riwayat</Button> : undefined}>
          <table className="w-full text-left text-sm">
            <thead><tr className="text-xs uppercase text-slate-400"><th className="py-1.5">Jenis</th><th>Jabatan</th><th>Jenjang</th><th>TMT</th><th>No. SK</th><th>Status</th></tr></thead>
            <tbody>
              {data.riwayatJabatan.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="py-2">{r.jenis_jabatan}</td><td>{r.nama_jabatan}</td><td>{r.jenjang_jabatan ?? "-"}</td>
                  <td>{r.tmt_jabatan}</td><td>{r.no_sk ?? "-"}</td>
                  <td>{r.is_aktif ? <StatusBadge status="AKTIF" /> : <span className="text-xs text-slate-400">Riwayat</span>}</td>
                </tr>
              ))}
              {data.riwayatJabatan.length === 0 && <tr><td colSpan={6} className="py-3 text-center text-slate-400">Belum ada riwayat jabatan.</td></tr>}
            </tbody>
          </table>
        </Card>
      )}

      {tab === "Riwayat Pangkat" && (
        <Card actions={canEdit ? <Button onClick={() => setModal("pangkat")}>+ Input SK Kenaikan Pangkat</Button> : undefined}>
          <table className="w-full text-left text-sm">
            <thead><tr className="text-xs uppercase text-slate-400"><th className="py-1.5">Gol/Ruang</th><th>Pangkat</th><th>TMT</th><th>No. SK</th><th>Jenis</th><th>Status</th></tr></thead>
            <tbody>
              {data.riwayatPangkat.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="py-2 font-medium">{r.golongan_ruang}</td><td>{r.nama_pangkat}</td><td>{r.tmt_pangkat}</td>
                  <td>{r.no_sk ?? "-"}</td><td>{r.jenis_kenaikan ?? "-"}</td>
                  <td>{r.is_aktif ? <StatusBadge status="AKTIF" /> : <span className="text-xs text-slate-400">Riwayat</span>}</td>
                </tr>
              ))}
              {data.riwayatPangkat.length === 0 && <tr><td colSpan={6} className="py-3 text-center text-slate-400">Belum ada riwayat pangkat.</td></tr>}
            </tbody>
          </table>
        </Card>
      )}

      {tab === "Angka Kredit" && (
        <Card actions={canEdit ? <Button onClick={() => setModal("angkaKredit")}>+ Input PAK Baru</Button> : undefined}>
          <table className="w-full text-left text-sm">
            <thead><tr className="text-xs uppercase text-slate-400"><th className="py-1.5">No. PAK</th><th>Tanggal</th><th>Periode</th><th>AK Kumulatif</th><th>Status</th></tr></thead>
            <tbody>
              {data.angkaKredit.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="py-2">{r.nomor_pak ?? "-"}</td><td>{r.tanggal_pak ?? "-"}</td>
                  <td>{r.periode_awal ?? "-"} s/d {r.periode_akhir ?? "-"}</td>
                  <td className="font-semibold">{r.angka_kredit_kumulatif}</td>
                  <td>{r.is_current ? <StatusBadge status="AKTIF" /> : <span className="text-xs text-slate-400">Riwayat</span>}</td>
                </tr>
              ))}
              {data.angkaKredit.length === 0 && <tr><td colSpan={5} className="py-3 text-center text-slate-400">Belum ada data angka kredit.</td></tr>}
            </tbody>
          </table>
        </Card>
      )}

      {tab === "Dokumen" && (
        <Card actions={canEdit ? <Button onClick={() => setModal("dokumen")}>+ Unggah Dokumen</Button> : undefined}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.dokumen.map((d) => (
              <a key={d.id} href={`/api/dokumen/${d.id}/file`} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50">
                <span className="text-2xl">{d.mime_type?.includes("pdf") ? "📄" : "🖼️"}</span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">{d.nama_file}</p>
                  <p className="text-xs text-slate-400">{JENIS_DOKUMEN_LABEL[d.jenis_dokumen] ?? d.jenis_dokumen} · v{d.versi}</p>
                </div>
              </a>
            ))}
            {data.dokumen.length === 0 && <p className="col-span-full py-3 text-center text-slate-400">Belum ada dokumen.</p>}
          </div>
        </Card>
      )}

      {modal === "jabatan" && <RiwayatJabatanModal pegawaiId={pegawai.id} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
      {modal === "pangkat" && <RiwayatPangkatModal pegawaiId={pegawai.id} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
      {modal === "pendidikan" && <RiwayatPendidikanModal pegawaiId={pegawai.id} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
      {modal === "angkaKredit" && <AngkaKreditModal pegawaiId={pegawai.id} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
      {modal === "dokumen" && <DokumenUploadModal pegawaiId={pegawai.id} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
    </div>
  );
}
