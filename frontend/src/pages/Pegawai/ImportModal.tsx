import { useState } from "react";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { api } from "../../api/client";
import { useToast } from "../../components/ui/Toast";
import type { UnitKerja } from "../../types";

const TEMPLATE_HEADERS = [
  "nip", "nipLama", "nama", "gelarDepan", "gelarBelakang", "tempatLahir", "tanggalLahir", "jenisKelamin",
  "alamat", "noHp", "email", "statusKepegawaian", "tmtCpns", "tmtPns", "statusAktif", "unitKerjaNama",
  "jenisJabatan", "namaJabatan", "jenjangJabatan", "golonganRuangAktif", "namaPangkatAktif", "tmtPangkatAktif",
];

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n").filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(",").map((c) => c.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h] = cells[i] ?? ""));
    return row;
  });
}

export function ImportModal({
  open,
  onClose,
  onImported,
  unitKerjaList,
}: {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
  unitKerjaList: UnitKerja[];
}) {
  const { push } = useToast();
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ inserted: number; failed: number; errors: { row: number; error: string }[] } | null>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    const reader = new FileReader();
    reader.onload = () => setRows(parseCsv(String(reader.result ?? "")));
    reader.readAsText(file);
  }

  function downloadTemplate() {
    const csv = TEMPLATE_HEADERS.join(",") + "\n" + "198501012010011001,,Contoh Nama,dr.,S.Kep,Bandung,1985-01-01,L,,,,PNS,2010-01-01,2011-01-01,AKTIF,Puskesmas Contoh,FUNGSIONAL_TERTENTU,Dokter,Ahli Pertama,III/b,Penata Muda Tk.I,2020-04-01\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "template-import-pegawai.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleSubmit() {
    if (rows.length === 0) return;
    setSubmitting(true);
    try {
      const unitByName = new Map(unitKerjaList.map((u) => [u.nama.toLowerCase(), u.id]));
      const payloadRows = rows.map((r) => ({
        nip: r.nip,
        nipLama: r.nipLama || undefined,
        nama: r.nama,
        gelarDepan: r.gelarDepan || undefined,
        gelarBelakang: r.gelarBelakang || undefined,
        tempatLahir: r.tempatLahir || undefined,
        tanggalLahir: r.tanggalLahir || undefined,
        jenisKelamin: r.jenisKelamin || undefined,
        alamat: r.alamat || undefined,
        noHp: r.noHp || undefined,
        email: r.email || undefined,
        statusKepegawaian: r.statusKepegawaian,
        tmtCpns: r.tmtCpns || undefined,
        tmtPns: r.tmtPns || undefined,
        statusAktif: r.statusAktif || "AKTIF",
        unitKerjaId: r.unitKerjaNama ? unitByName.get(r.unitKerjaNama.toLowerCase()) : undefined,
        jenisJabatan: r.jenisJabatan || undefined,
        namaJabatan: r.namaJabatan || undefined,
        jenjangJabatan: r.jenjangJabatan || undefined,
        golonganRuangAktif: r.golonganRuangAktif || undefined,
        namaPangkatAktif: r.namaPangkatAktif || undefined,
        tmtPangkatAktif: r.tmtPangkatAktif || undefined,
      }));
      const res = await api.post<{ data: { inserted: number; failed: number; errors: { row: number; error: string }[] } }>("/pegawai/import", { rows: payloadRows });
      setResult(res.data);
      if (res.data.inserted > 0) {
        push(`${res.data.inserted} pegawai berhasil diimpor.`, "success");
        onImported();
      }
    } catch {
      push("Gagal memproses import.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Import Data Pegawai (CSV)" wide>
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Unggah berkas CSV sesuai format template. Kolom <code>unitKerjaNama</code> harus sama persis dengan nama unit kerja yang sudah terdaftar.
        </p>
        <Button variant="secondary" onClick={downloadTemplate}>⬇ Unduh Template CSV</Button>

        <input type="file" accept=".csv" onChange={handleFile} className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100" />

        {fileName && <p className="text-sm text-slate-500">Berkas: {fileName} — {rows.length} baris terdeteksi.</p>}

        {result && (
          <div className="rounded-md bg-slate-50 p-3 text-sm">
            <p className="font-medium text-slate-700">Hasil import: {result.inserted} berhasil, {result.failed} gagal.</p>
            {result.errors.length > 0 && (
              <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs text-red-600">
                {result.errors.map((e, i) => (
                  <li key={i}>Baris {e.row}: {e.error}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Tutup</Button>
          <Button onClick={handleSubmit} loading={submitting} disabled={rows.length === 0}>Proses Import</Button>
        </div>
      </div>
    </Modal>
  );
}
