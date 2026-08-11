import { prisma } from "../utils/prisma";
import { JenjangFungsional } from "@prisma/client";

export interface Periode {
  tahun: number;
  bulan: number;
  tanggal: number;
  label: string;
}

/**
 * Mengembalikan seluruh periode kenaikan pangkat aktif yang dikonfigurasi
 * (default BR-1: 1 April & 1 Oktober), diurutkan berdasarkan bulan/tanggal.
 */
export async function getKonfigurasiPeriode() {
  const periode = await prisma.periodeKenaikanPangkat.findMany({ where: { aktif: true }, orderBy: [{ bulan: "asc" }, { tanggal: "asc" }] });
  if (periode.length === 0) {
    // fallback default jika admin belum mengkonfigurasi
    return [
      { id: "default-1", bulan: 4, tanggal: 1, label: "Periode April", aktif: true },
      { id: "default-2", bulan: 10, tanggal: 1, label: "Periode Oktober", aktif: true },
    ];
  }
  return periode;
}

/**
 * Menentukan periode (tahun/bulan) tempat sebuah tanggal (mis. TMT SK baru) berada,
 * dengan mencari periode terkonfigurasi yang paling dekat pada/sebelum tanggal tsb.
 */
export function matchPeriode(date: Date, konfigurasi: { bulan: number; tanggal: number; label: string }[]): Periode {
  const bulan = date.getMonth() + 1;
  const tanggal = date.getDate();
  const tahun = date.getFullYear();

  const sorted = [...konfigurasi].sort((a, b) => a.bulan - b.bulan || a.tanggal - b.tanggal);
  let match = null as null | { bulan: number; tanggal: number; label: string };
  for (const p of sorted) {
    if (p.bulan < bulan || (p.bulan === bulan && p.tanggal <= tanggal)) {
      match = p;
    }
  }
  if (match) return { tahun, bulan: match.bulan, tanggal: match.tanggal, label: match.label };

  const last = sorted[sorted.length - 1];
  return { tahun: tahun - 1, bulan: last.bulan, tanggal: last.tanggal, label: last.label };
}

export async function getPeriodeTerdekat(date: Date): Promise<Periode> {
  const konfigurasi = await getKonfigurasiPeriode();
  return matchPeriode(date, konfigurasi);
}

/**
 * Menentukan periode berikutnya (>=) setelah suatu tanggal kelayakan (mis. tanggal pegawai
 * genap memenuhi masa kerja minimum). Dipakai untuk proyeksi (FR-4.3).
 */
export function getPeriodeBerikutnya(eligibleDate: Date, konfigurasi: { bulan: number; tanggal: number; label: string }[]): Periode {
  const bulan = eligibleDate.getMonth() + 1;
  const tanggal = eligibleDate.getDate();
  const tahun = eligibleDate.getFullYear();

  const sorted = [...konfigurasi].sort((a, b) => a.bulan - b.bulan || a.tanggal - b.tanggal);
  for (const p of sorted) {
    if (p.bulan > bulan || (p.bulan === bulan && p.tanggal >= tanggal)) {
      return { tahun, bulan: p.bulan, tanggal: p.tanggal, label: p.label };
    }
  }
  const first = sorted[0];
  return { tahun: tahun + 1, bulan: first.bulan, tanggal: first.tanggal, label: first.label };
}

export function hitungMasaKerjaTahun(tmt: Date, asOf: Date): number {
  let years = asOf.getFullYear() - tmt.getFullYear();
  const monthDiff = asOf.getMonth() - tmt.getMonth();
  const dayDiff = asOf.getDate() - tmt.getDate();
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) years -= 1;
  return years;
}

function tambahTahun(date: Date, years: number): Date {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + years);
  return d;
}

const JENJANG_URUTAN: JenjangFungsional[] = [
  "PEMULA",
  "TERAMPIL",
  "MAHIR",
  "PENYELIA",
  "AHLI_PERTAMA",
  "AHLI_MUDA",
  "AHLI_MADYA",
  "AHLI_UTAMA",
];

export interface KandidatKenaikanPangkat {
  pegawaiId: string;
  nip: string;
  nama: string;
  unitKerjaId: string | null;
  unitKerjaNama: string | null;
  jenisKenaikan: "REGULER" | "FUNGSIONAL";
  golonganSaatIni: string;
  golonganTmt: Date;
  masaKerjaTahun: number | null;
  angkaKreditKumulatif: number | null;
  angkaKreditDibutuhkan: number | null;
  gapAngkaKredit: number | null;
  predikatSkpTerakhir: string | null;
  memenuhiSyaratSkp: boolean;
  proyeksiPeriode: Periode;
  statusTindakLanjut: string;
}

/**
 * Modul inti FR-4: mendeteksi pegawai yang sudah/akan waktunya naik pangkat.
 * Menghasilkan dua jenis kandidat: REGULER (berbasis masa kerja) dan FUNGSIONAL (berbasis angka kredit).
 * Semua ambang batas diambil dari tabel parameter (bukan hardcode), sesuai BR-1..BR-4.
 */
export async function deteksiKenaikanPangkat(options: { bulanKeDepan?: number; unitKerjaId?: string } = {}) {
  const bulanKeDepan = options.bulanKeDepan ?? 12;
  const now = new Date();
  const batasProyeksi = new Date(now);
  batasProyeksi.setMonth(batasProyeksi.getMonth() + bulanKeDepan);

  const [parameter, konfigurasiPeriode, jenjangAngkaKredit] = await Promise.all([
    prisma.parameterAturan.findFirst(),
    getKonfigurasiPeriode(),
    prisma.parameterJenjangAngkaKredit.findMany({ include: { jenisJabatanFungsional: true } }),
  ]);

  const masaKerjaMinimum = parameter?.masaKerjaMinimumTahun ?? 4;
  const predikatMinimum = parameter?.predikatSkpMinimum ?? "BAIK";
  const predikatUrutan = ["SANGAT_KURANG", "KURANG", "CUKUP", "BAIK", "SANGAT_BAIK"];

  const pegawaiList = await prisma.pegawai.findMany({
    where: {
      statusAktif: "AKTIF",
      ...(options.unitKerjaId ? { unitKerjaId: options.unitKerjaId } : {}),
    },
    include: {
      unitKerja: true,
      riwayatPangkatGolongan: { where: { isAktif: true }, take: 1 },
      riwayatJabatan: { where: { isAktif: true }, take: 1 },
      angkaKredit: { orderBy: { tanggalPak: "desc" }, take: 1 },
      nilaiSkp: { orderBy: { tahun: "desc" }, take: 1 },
    },
  });

  const hasil: KandidatKenaikanPangkat[] = [];

  for (const pegawai of pegawaiList) {
    const pangkatAktif = pegawai.riwayatPangkatGolongan[0];
    if (!pangkatAktif) continue;

    const jabatanAktif = pegawai.riwayatJabatan[0];
    const nilaiSkpTerakhir = pegawai.nilaiSkp[0];
    const predikatSkp = nilaiSkpTerakhir?.predikat ?? null;
    const memenuhiSyaratSkp = predikatSkp ? predikatUrutan.indexOf(predikatSkp) >= predikatUrutan.indexOf(predikatMinimum) : !parameter?.wajibValidasiSkp === false;

    const isFungsional = jabatanAktif?.jenisJabatan === "FUNGSIONAL_TERTENTU";

    if (isFungsional && jabatanAktif) {
      const jabatanFungsional = jenjangAngkaKredit.find(
        (j) => j.jenisJabatanFungsional.nama.toLowerCase() === jabatanAktif.namaJabatan.toLowerCase() && j.jenjang === jabatanAktif.jenjangJabatan
      );
      const kumulatif = pegawai.angkaKredit[0]?.angkaKreditKumulatif ?? null;

      if (jabatanFungsional) {
        const jenjangBerikutnya = jenjangAngkaKredit.find(
          (j) =>
            j.jenisJabatanFungsionalId === jabatanFungsional.jenisJabatanFungsionalId &&
            j.urutan === jabatanFungsional.urutan + 1
        );

        if (jenjangBerikutnya && kumulatif !== null) {
          const gap = jenjangBerikutnya.angkaKreditMinimum - kumulatif;
          const eligible = gap <= 0;
          const eligibleDate = eligible ? now : null;
          const proyeksi = eligible
            ? getPeriodeBerikutnya(now, konfigurasiPeriode)
            : getPeriodeBerikutnya(tambahTahun(now, 1), konfigurasiPeriode); // proyeksi kasar jika belum cukup

          if (eligible || proyeksi.tahun <= batasProyeksi.getFullYear()) {
            hasil.push({
              pegawaiId: pegawai.id,
              nip: pegawai.nip,
              nama: pegawai.nama,
              unitKerjaId: pegawai.unitKerjaId,
              unitKerjaNama: pegawai.unitKerja?.nama ?? null,
              jenisKenaikan: "FUNGSIONAL",
              golonganSaatIni: pangkatAktif.golonganRuang,
              golonganTmt: pangkatAktif.tmt,
              masaKerjaTahun: hitungMasaKerjaTahun(pangkatAktif.tmt, now),
              angkaKreditKumulatif: kumulatif,
              angkaKreditDibutuhkan: jenjangBerikutnya.angkaKreditMinimum,
              gapAngkaKredit: gap,
              predikatSkpTerakhir: predikatSkp,
              memenuhiSyaratSkp,
              proyeksiPeriode: proyeksi,
              statusTindakLanjut: "BELUM_DIPROSES",
            });
          }
        }
      }
    }

    // Deteksi reguler tetap dihitung untuk seluruh pegawai aktif (termasuk fungsional yang juga
    // dapat naik pangkat reguler apabila belum ada kenaikan berbasis angka kredit).
    const masaKerja = hitungMasaKerjaTahun(pangkatAktif.tmt, now);
    const tanggalEligibleReguler = tambahTahun(pangkatAktif.tmt, masaKerjaMinimum);
    if (tanggalEligibleReguler <= batasProyeksi) {
      const proyeksi = getPeriodeBerikutnya(tanggalEligibleReguler, konfigurasiPeriode);
      hasil.push({
        pegawaiId: pegawai.id,
        nip: pegawai.nip,
        nama: pegawai.nama,
        unitKerjaId: pegawai.unitKerjaId,
        unitKerjaNama: pegawai.unitKerja?.nama ?? null,
        jenisKenaikan: "REGULER",
        golonganSaatIni: pangkatAktif.golonganRuang,
        golonganTmt: pangkatAktif.tmt,
        masaKerjaTahun: masaKerja,
        angkaKreditKumulatif: null,
        angkaKreditDibutuhkan: null,
        gapAngkaKredit: null,
        predikatSkpTerakhir: predikatSkp,
        memenuhiSyaratSkp,
        proyeksiPeriode: proyeksi,
        statusTindakLanjut: "BELUM_DIPROSES",
      });
    }
  }

  // lampirkan status tindak lanjut yang sudah tersimpan (jika admin sudah mulai memproses)
  const statusTersimpan = await prisma.statusUsulanKenaikanPangkat.findMany({
    where: { pegawaiId: { in: hasil.map((h) => h.pegawaiId) } },
  });
  const statusMap = new Map(statusTersimpan.map((s) => [`${s.pegawaiId}-${s.periodeTahun}-${s.periodeBulan}-${s.jenisKenaikan}`, s]));

  for (const item of hasil) {
    const key = `${item.pegawaiId}-${item.proyeksiPeriode.tahun}-${item.proyeksiPeriode.bulan}-${item.jenisKenaikan}`;
    const status = statusMap.get(key);
    if (status) item.statusTindakLanjut = status.status;
  }

  return hasil;
}
