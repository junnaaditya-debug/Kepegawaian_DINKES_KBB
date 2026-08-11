import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api, downloadFile, errorMessage } from "../api/client";
import { Badge, Button, Card, EmptyState, Input, Modal, Select, Spinner } from "../components/ui";
import type { Pegawai, UnitKerja } from "../types";
import { label } from "../utils/format";
import { useAuth } from "../context/AuthContext";

interface ListResponse {
  data: Pegawai[];
  total: number;
  page: number;
  pageSize: number;
}

export default function PegawaiListPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [unitKerjaId, setUnitKerjaId] = useState("");
  const [statusAktif, setStatusAktif] = useState("");
  const [page, setPage] = useState(1);
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const canEdit = user && ["SUPER_ADMIN", "ADMIN_KEPEGAWAIAN"].includes(user.role);

  const { data: unitList } = useQuery<UnitKerja[]>({ queryKey: ["unit-kerja"], queryFn: () => api.get("/unit-kerja").then((r) => r.data) });

  const { data, isLoading } = useQuery<ListResponse>({
    queryKey: ["pegawai", { q, unitKerjaId, statusAktif, page }],
    queryFn: () =>
      api
        .get("/pegawai", { params: { q: q || undefined, unitKerjaId: unitKerjaId || undefined, statusAktif: statusAktif || undefined, page } })
        .then((r) => r.data),
  });

  function exportExcel() {
    downloadFile("/laporan/pegawai/excel");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Data Pegawai</h1>
          <p className="text-sm text-slate-500">Database terpusat data induk pegawai Dinkes KBB</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={exportExcel}>
            Export Excel
          </Button>
          {canEdit && (
            <>
              <Button variant="secondary" onClick={() => setShowImport(true)}>
                Import CSV
              </Button>
              <Button onClick={() => setShowAdd(true)}>+ Tambah Pegawai</Button>
            </>
          )}
        </div>
      </div>

      <Card>
        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          <Input
            placeholder="Cari nama / NIP..."
            value={q}
            onChange={(e) => {
              setPage(1);
              setQ(e.target.value);
            }}
          />
          <Select
            value={unitKerjaId}
            onChange={(e) => {
              setPage(1);
              setUnitKerjaId(e.target.value);
            }}
          >
            <option value="">Semua Unit Kerja</option>
            {unitList?.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nama}
              </option>
            ))}
          </Select>
          <Select
            value={statusAktif}
            onChange={(e) => {
              setPage(1);
              setStatusAktif(e.target.value);
            }}
          >
            <option value="">Semua Status</option>
            <option value="AKTIF">Aktif</option>
            <option value="PENSIUN">Pensiun</option>
            <option value="MUTASI_KELUAR">Mutasi Keluar</option>
            <option value="MENINGGAL">Meninggal</option>
            <option value="CUTI_DI_LUAR_TANGGUNGAN">Cuti di Luar Tanggungan</option>
          </Select>
        </div>

        {isLoading ? (
          <Spinner />
        ) : !data || data.data.length === 0 ? (
          <EmptyState text="Belum ada data pegawai" />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                    <th className="py-2 pr-3">NIP</th>
                    <th className="py-2 pr-3">Nama</th>
                    <th className="py-2 pr-3">Unit Kerja</th>
                    <th className="py-2 pr-3">Golongan</th>
                    <th className="py-2 pr-3">Jabatan</th>
                    <th className="py-2 pr-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((p) => (
                    <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="py-2 pr-3 font-mono text-xs">{p.nip}</td>
                      <td className="py-2 pr-3">
                        <Link to={`/pegawai/${p.id}`} className="font-medium text-sky-700 hover:underline">
                          {p.nama}
                        </Link>
                      </td>
                      <td className="py-2 pr-3">{p.unitKerja?.nama || "-"}</td>
                      <td className="py-2 pr-3">{p.riwayatPangkatGolongan?.[0]?.golonganRuang || "-"}</td>
                      <td className="py-2 pr-3">{p.riwayatJabatan?.[0]?.namaJabatan || "-"}</td>
                      <td className="py-2 pr-3">
                        <Badge tone={p.statusAktif}>{label(p.statusAktif)}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
              <span>
                Menampilkan {(data.page - 1) * data.pageSize + 1}-{Math.min(data.page * data.pageSize, data.total)} dari {data.total} pegawai
              </span>
              <div className="flex gap-2">
                <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Sebelumnya
                </Button>
                <Button variant="secondary" disabled={data.page * data.pageSize >= data.total} onClick={() => setPage((p) => p + 1)}>
                  Berikutnya
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>

      {showAdd && (
        <TambahPegawaiModal
          onClose={() => setShowAdd(false)}
          unitList={unitList || []}
          onSuccess={() => {
            setShowAdd(false);
            qc.invalidateQueries({ queryKey: ["pegawai"] });
          }}
        />
      )}
      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ["pegawai"] });
          }}
        />
      )}
    </div>
  );
}

function TambahPegawaiModal({ onClose, onSuccess, unitList }: { onClose: () => void; onSuccess: () => void; unitList: UnitKerja[] }) {
  const [form, setForm] = useState({ nip: "", nama: "", jenisKelamin: "L", statusKepegawaian: "PNS", unitKerjaId: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError("");
    setLoading(true);
    try {
      await api.post("/pegawai", { ...form, unitKerjaId: form.unitKerjaId || undefined });
      onSuccess();
    } catch (err) {
      setError(errorMessage(err, "Gagal menyimpan pegawai"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Tambah Pegawai">
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">NIP</label>
          <Input value={form.nip} onChange={(e) => setForm({ ...form, nip: e.target.value })} required />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Nama</label>
          <Input value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Jenis Kelamin</label>
            <Select value={form.jenisKelamin} onChange={(e) => setForm({ ...form, jenisKelamin: e.target.value })}>
              <option value="L">Laki-laki</option>
              <option value="P">Perempuan</option>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Status Kepegawaian</label>
            <Select value={form.statusKepegawaian} onChange={(e) => setForm({ ...form, statusKepegawaian: e.target.value })}>
              <option value="CPNS">CPNS</option>
              <option value="PNS">PNS</option>
              <option value="PPPK">PPPK</option>
            </Select>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Unit Kerja</label>
          <Select value={form.unitKerjaId} onChange={(e) => setForm({ ...form, unitKerjaId: e.target.value })}>
            <option value="">- Pilih Unit Kerja -</option>
            {unitList.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nama}
              </option>
            ))}
          </Select>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={submit} disabled={loading || !form.nip || !form.nama}>
            {loading ? "Menyimpan..." : "Simpan"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function ImportModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<{ sukses: number; gagal: { baris: number; alasan: string }[] } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!file) return;
    setError("");
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api.post("/pegawai/import", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setResult(res.data);
      onSuccess();
    } catch (err) {
      setError(errorMessage(err, "Gagal mengimpor data"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Import Data Pegawai (CSV)">
      <div className="space-y-3">
        <p className="text-sm text-slate-600">
          File CSV (baris pertama = header) dengan kolom minimal <code className="rounded bg-slate-100 px-1">nip</code> dan{" "}
          <code className="rounded bg-slate-100 px-1">nama</code>. Kolom opsional: <code className="rounded bg-slate-100 px-1">nipLama</code>,{" "}
          <code className="rounded bg-slate-100 px-1">jenisKelamin</code>, <code className="rounded bg-slate-100 px-1">statusKepegawaian</code>,{" "}
          <code className="rounded bg-slate-100 px-1">unitKerjaNama</code>. Simpan file Excel sebagai CSV (File → Save As → CSV) sebelum diunggah.
        </p>
        <input type="file" accept=".csv" onChange={(e) => setFile(e.target.files?.[0] || null)} className="text-sm" />
        {error && <p className="text-sm text-red-600">{error}</p>}
        {result && (
          <div className="rounded-md bg-slate-50 p-3 text-sm">
            <p className="font-medium text-green-700">{result.sukses} baris berhasil diimpor</p>
            {result.gagal.length > 0 && (
              <div className="mt-2 text-red-600">
                <p className="font-medium">{result.gagal.length} baris gagal:</p>
                <ul className="list-disc pl-5">
                  {result.gagal.slice(0, 10).map((g, i) => (
                    <li key={i}>
                      Baris {g.baris}: {g.alasan}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Tutup
          </Button>
          <Button onClick={submit} disabled={!file || loading}>
            {loading ? "Mengimpor..." : "Import"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
