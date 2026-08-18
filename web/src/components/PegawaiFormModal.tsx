import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { api, ApiError } from "../lib/api";
import { Modal, Spinner } from "./ui";
import { useUnitKerjaList } from "../hooks/useReference";
import { GOLONGAN_LIST, JENIS_JABATAN_OPTIONS, STATUS_KEPEGAWAIAN_OPTIONS } from "../lib/constants";
import type { PegawaiDetail } from "../types";

interface Props {
  onClose: () => void;
  onSuccess: (id?: number) => void;
  initial?: Partial<PegawaiDetail>;
  mode?: "create" | "edit";
  pegawaiId?: number;
}

export default function PegawaiFormModal({ onClose, onSuccess, initial, mode = "create", pegawaiId }: Props) {
  const { data: unitKerjaList } = useUnitKerjaList();
  const [form, setForm] = useState({
    nip: initial?.nip ?? "",
    nama: initial?.nama ?? "",
    gelar_depan: initial?.gelar_depan ?? "",
    gelar_belakang: initial?.gelar_belakang ?? "",
    jenis_kelamin: initial?.jenis_kelamin ?? "L",
    tempat_lahir: initial?.tempat_lahir ?? "",
    tanggal_lahir: initial?.tanggal_lahir ?? "",
    alamat: initial?.alamat ?? "",
    no_hp: initial?.no_hp ?? "",
    email: initial?.email ?? "",
    status_kepegawaian: initial?.status_kepegawaian ?? "PNS",
    tmt_cpns: initial?.tmt_cpns ?? "",
    tmt_pns: initial?.tmt_pns ?? "",
    unit_kerja_id: initial?.unit_kerja_id ? String(initial.unit_kerja_id) : "",
    jenis_jabatan: initial?.jenis_jabatan ?? "pelaksana",
    jabatan_struktural_nama: initial?.jabatan_struktural_nama ?? "",
    golongan_ruang_aktif: initial?.golongan_ruang_aktif ?? "",
    nama_pangkat_aktif: initial?.nama_pangkat_aktif ?? "",
    tmt_pangkat_aktif: initial?.tmt_pangkat_aktif ?? "",
  });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = { ...form, unit_kerja_id: Number(form.unit_kerja_id) };
      if (mode === "edit" && pegawaiId) {
        return api.put(`/pegawai/${pegawaiId}`, payload);
      }
      return api.post<{ id: number }>("/pegawai", payload);
    },
    onSuccess: (res: any) => {
      toast.success(mode === "edit" ? "Data pegawai berhasil diperbarui" : "Pegawai baru berhasil ditambahkan");
      onSuccess(res?.id);
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Gagal menyimpan data"),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate();
  }

  return (
    <Modal open onClose={onClose} title={mode === "edit" ? "Ubah Data Pegawai" : "Tambah Pegawai Baru"} width="max-w-3xl">
      <form onSubmit={handleSubmit} className="space-y-5">
        <fieldset className="space-y-3">
          <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Identitas</legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label">NIP *</label>
              <input className="input" required value={form.nip} onChange={(e) => set("nip", e.target.value)} />
            </div>
            <div>
              <label className="label">Nama Lengkap *</label>
              <input className="input" required value={form.nama} onChange={(e) => set("nama", e.target.value)} />
            </div>
            <div>
              <label className="label">Gelar Depan</label>
              <input className="input" value={form.gelar_depan} onChange={(e) => set("gelar_depan", e.target.value)} />
            </div>
            <div>
              <label className="label">Gelar Belakang</label>
              <input className="input" value={form.gelar_belakang} onChange={(e) => set("gelar_belakang", e.target.value)} />
            </div>
            <div>
              <label className="label">Jenis Kelamin</label>
              <select className="input" value={form.jenis_kelamin} onChange={(e) => set("jenis_kelamin", e.target.value as "L" | "P")}>
                <option value="L">Laki-laki</option>
                <option value="P">Perempuan</option>
              </select>
            </div>
            <div>
              <label className="label">Tempat Lahir</label>
              <input className="input" value={form.tempat_lahir} onChange={(e) => set("tempat_lahir", e.target.value)} />
            </div>
            <div>
              <label className="label">Tanggal Lahir</label>
              <input type="date" className="input" value={form.tanggal_lahir} onChange={(e) => set("tanggal_lahir", e.target.value)} />
            </div>
            <div>
              <label className="label">No. HP</label>
              <input className="input" value={form.no_hp} onChange={(e) => set("no_hp", e.target.value)} />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" className="input" value={form.email} onChange={(e) => set("email", e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Alamat</label>
              <input className="input" value={form.alamat} onChange={(e) => set("alamat", e.target.value)} />
            </div>
          </div>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Status Kepegawaian & Penempatan</legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Status Kepegawaian *</label>
              <select className="input" required value={form.status_kepegawaian} onChange={(e) => set("status_kepegawaian", e.target.value)}>
                {STATUS_KEPEGAWAIAN_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Unit Kerja *</label>
              <select className="input" required value={form.unit_kerja_id} onChange={(e) => set("unit_kerja_id", e.target.value)}>
                <option value="">Pilih unit kerja</option>
                {unitKerjaList?.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nama}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">TMT CPNS</label>
              <input type="date" className="input" value={form.tmt_cpns} onChange={(e) => set("tmt_cpns", e.target.value)} />
            </div>
            <div>
              <label className="label">TMT PNS</label>
              <input type="date" className="input" value={form.tmt_pns} onChange={(e) => set("tmt_pns", e.target.value)} />
            </div>
            <div>
              <label className="label">Jenis Jabatan *</label>
              <select className="input" required value={form.jenis_jabatan} onChange={(e) => set("jenis_jabatan", e.target.value)}>
                {JENIS_JABATAN_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            {form.jenis_jabatan === "struktural" && (
              <div>
                <label className="label">Nama Jabatan Struktural</label>
                <input className="input" value={form.jabatan_struktural_nama} onChange={(e) => set("jabatan_struktural_nama", e.target.value)} />
              </div>
            )}
          </div>
        </fieldset>

        {mode === "create" && (
          <fieldset className="space-y-3">
            <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Pangkat/Golongan Awal (opsional)</legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="label">Golongan/Ruang</label>
                <select className="input" value={form.golongan_ruang_aktif} onChange={(e) => set("golongan_ruang_aktif", e.target.value)}>
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
                <input className="input" value={form.nama_pangkat_aktif} onChange={(e) => set("nama_pangkat_aktif", e.target.value)} />
              </div>
              <div>
                <label className="label">TMT Pangkat</label>
                <input type="date" className="input" value={form.tmt_pangkat_aktif} onChange={(e) => set("tmt_pangkat_aktif", e.target.value)} />
              </div>
            </div>
          </fieldset>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Batal
          </button>
          <button type="submit" className="btn-primary" disabled={mutation.isPending}>
            {mutation.isPending && <Spinner size={14} />} Simpan
          </button>
        </div>
      </form>
    </Modal>
  );
}
