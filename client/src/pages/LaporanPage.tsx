import { Card, Button } from "../components/ui";
import { downloadFile } from "../api/client";

const REPORTS = [
  {
    title: "Daftar Usulan Kenaikan Pangkat",
    desc: "Daftar pegawai yang sudah/akan waktunya naik pangkat, lengkap dengan status tindak lanjut. Siap cetak untuk keperluan administrasi.",
    excel: "/laporan/kenaikan-pangkat/excel",
    pdf: "/laporan/kenaikan-pangkat/pdf",
    params: { bulanKeDepan: 12 },
  },
  {
    title: "Daftar Pegawai",
    desc: "Seluruh data induk pegawai beserta golongan dan jabatan aktif saat ini.",
    excel: "/laporan/pegawai/excel",
  },
];

export default function LaporanPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Laporan</h1>
        <p className="text-sm text-slate-500">Generate dan unduh laporan kepegawaian</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {REPORTS.map((r) => (
          <Card key={r.title} title={r.title}>
            <p className="mb-4 text-sm text-slate-600">{r.desc}</p>
            <div className="flex gap-2">
              <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => downloadFile(r.excel, undefined, r.params)}>
                Unduh Excel
              </Button>
              {r.pdf && (
                <Button variant="danger" onClick={() => downloadFile(r.pdf!, undefined, r.params)}>
                  Unduh PDF
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>

      <p className="text-xs text-slate-400">
        Untuk laporan kenaikan pangkat dengan filter unit kerja/jenis/periode tertentu, gunakan tombol Export di halaman "Kenaikan Pangkat".
      </p>
    </div>
  );
}
