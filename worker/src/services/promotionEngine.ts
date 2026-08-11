import { and, eq, inArray } from "drizzle-orm";
import type { createDb } from "../db/client";
import {
  pegawai,
  riwayatPangkatGolongan,
  riwayatJabatan,
  angkaKredit,
  nilaiSkp,
  parameterAturan,
  periodeKenaikanPangkat,
  parameterJenjangAngkaKredit,
  jenisJabatanFungsional,
  statusUsulanKenaikanPangkat,
  unitKerja,
} from "../db/schema";

export interface Periode {
  tahun: number;
  bulan: number;
  tanggal: number;
  label: string;
}

type KonfigPeriode = { bulan: number; tanggal: number; label: string };

const DEFAULT_PERIODE: KonfigPeriode[] = [
  { bulan: 4, tanggal: 1, label: "Periode April" },
  { bulan: 10, tanggal: 1, label: "Periode Oktober" },
];

export async function getKonfigurasiPeriode(db: ReturnType<typeof createDb>): Promise<KonfigPeriode[]> {
  const rows = await db.select().from(periodeKenaikanPangkat).where(eq(periodeKenaikanPangkat.aktif, true));
  if (rows.length === 0) return DEFAULT_PERIODE;
  return rows.map((r) => ({ bulan: r.bulan, tanggal: r.tanggal, label: r.label })).sort((a, b) => a.bulan - b.bulan || a.tanggal - b.tanggal);
}

export function matchPeriode(date: Date, konfigurasi: KonfigPeriode[]): Periode {
  const bulan = date.getMonth() + 1;
  const tanggal = date.getDate();
  const tahun = date.getFullYear();

  const sorted = [...konfigurasi].sort((a, b) => a.bulan - b.bulan || a.tanggal - b.tanggal);
  let match: KonfigPeriode | null = null;
  for (const p of sorted) {
    if (p.bulan < bulan || (p.bulan === bulan && p.tanggal <= tanggal)) match = p;
  }
  if (match) return { tahun, bulan: match.bulan, tanggal: match.tanggal, label: match.label };

  const last = sorted[sorted.length - 1];
  return { tahun: tahun - 1, bulan: last.bulan, tanggal: last.tanggal, label: last.label };
}

export async function getPeriodeTerdekat(db: ReturnType<typeof createDb>, date: Date): Promise<Periode> {
  const konfigurasi = await getKonfigurasiPeriode(db);
  return matchPeriode(date, konfigurasi);
}

export function getPeriodeBerikutnya(eligibleDate: Date, konfigurasi: KonfigPeriode[]): Periode {
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

export interface KandidatKenaikanPangkat {
  pegawaiId: string;
  nip: string;
  nama: string;
  unitKerjaId: string | null;
  unitKerjaNama: string | null;
  jenisKenaikan: "REGULER" | "FUNGSIONAL";
  golonganSaatIni: string;
  golonganTmt: string;
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
 * Semua ambang batas diambil dari tabel parameter (bukan hardcode), sesuai BR-1..BR-4.
 */
export async function deteksiKenaikanPangkat(
  db: ReturnType<typeof createDb>,
  options: { bulanKeDepan?: number; unitKerjaId?: string } = {}
): Promise<KandidatKenaikanPangkat[]> {
  const bulanKeDepan = options.bulanKeDepan ?? 12;
  const now = new Date();
  const batasProyeksi = new Date(now);
  batasProyeksi.setMonth(batasProyeksi.getMonth() + bulanKeDepan);

  const [parameterRows, konfigurasiPeriode, jenjangRows] = await Promise.all([
    db.select().from(parameterAturan).limit(1),
    getKonfigurasiPeriode(db),
    db
      .select({
        id: parameterJenjangAngkaKredit.id,
        jenisJabatanFungsionalId: parameterJenjangAngkaKredit.jenisJabatanFungsionalId,
        jenjang: parameterJenjangAngkaKredit.jenjang,
        golonganRuang: parameterJenjangAngkaKredit.golonganRuang,
        angkaKreditMinimum: parameterJenjangAngkaKredit.angkaKreditMinimum,
        urutan: parameterJenjangAngkaKredit.urutan,
        namaJabatan: jenisJabatanFungsional.nama,
      })
      .from(parameterJenjangAngkaKredit)
      .innerJoin(jenisJabatanFungsional, eq(parameterJenjangAngkaKredit.jenisJabatanFungsionalId, jenisJabatanFungsional.id)),
  ]);

  const parameter = parameterRows[0];
  const masaKerjaMinimum = parameter?.masaKerjaMinimumTahun ?? 4;
  const predikatMinimum = parameter?.predikatSkpMinimum ?? "BAIK";
  const predikatUrutan = ["SANGAT_KURANG", "KURANG", "CUKUP", "BAIK", "SANGAT_BAIK"];

  const pegawaiList = await db
    .select()
    .from(pegawai)
    .where(and(eq(pegawai.statusAktif, "AKTIF"), options.unitKerjaId ? eq(pegawai.unitKerjaId, options.unitKerjaId) : undefined));

  const hasil: KandidatKenaikanPangkat[] = [];
  if (pegawaiList.length === 0) return hasil;

  // Ambil seluruh data terkait dalam beberapa query batch (bukan per-pegawai) agar tidak
  // melampaui batas subrequest Cloudflare Workers untuk dataset ratusan/ribuan pegawai.
  const pegawaiIds = pegawaiList.map((p) => p.id);
  const [pangkatRows, jabatanRows, angkaKreditRows, skpRows, unitRows] = await Promise.all([
    db.select().from(riwayatPangkatGolongan).where(and(inArray(riwayatPangkatGolongan.pegawaiId, pegawaiIds), eq(riwayatPangkatGolongan.isAktif, true))),
    db.select().from(riwayatJabatan).where(and(inArray(riwayatJabatan.pegawaiId, pegawaiIds), eq(riwayatJabatan.isAktif, true))),
    db.select().from(angkaKredit).where(inArray(angkaKredit.pegawaiId, pegawaiIds)),
    db.select().from(nilaiSkp).where(inArray(nilaiSkp.pegawaiId, pegawaiIds)),
    db.select().from(unitKerja),
  ]);

  const pangkatAktifMap = new Map(pangkatRows.map((r) => [r.pegawaiId, r]));
  const jabatanAktifMap = new Map(jabatanRows.map((r) => [r.pegawaiId, r]));
  const unitNamaMap = new Map(unitRows.map((u) => [u.id, u.nama]));

  const angkaKreditTerakhirMap = new Map<string, (typeof angkaKreditRows)[number]>();
  for (const row of angkaKreditRows) {
    const current = angkaKreditTerakhirMap.get(row.pegawaiId);
    if (!current || new Date(row.tanggalPak) > new Date(current.tanggalPak)) angkaKreditTerakhirMap.set(row.pegawaiId, row);
  }

  const skpTerakhirMap = new Map<string, (typeof skpRows)[number]>();
  for (const row of skpRows) {
    const current = skpTerakhirMap.get(row.pegawaiId);
    if (!current || row.tahun > current.tahun) skpTerakhirMap.set(row.pegawaiId, row);
  }

  for (const peg of pegawaiList) {
    const pangkatAktif = pangkatAktifMap.get(peg.id);
    if (!pangkatAktif) continue;

    const jabatanAktif = jabatanAktifMap.get(peg.id);
    const nilaiSkpTerakhir = skpTerakhirMap.get(peg.id);
    const predikatSkp = nilaiSkpTerakhir?.predikat ?? null;
    const memenuhiSyaratSkp = predikatSkp ? predikatUrutan.indexOf(predikatSkp) >= predikatUrutan.indexOf(predikatMinimum) : true;
    const unitNama = peg.unitKerjaId ? unitNamaMap.get(peg.unitKerjaId) ?? null : null;

    const isFungsional = jabatanAktif?.jenisJabatan === "FUNGSIONAL_TERTENTU";

    if (isFungsional && jabatanAktif) {
      const jabatanFungsional = jenjangRows.find(
        (j) => j.namaJabatan.toLowerCase() === jabatanAktif.namaJabatan.toLowerCase() && j.jenjang === jabatanAktif.jenjangJabatan
      );
      const kumulatif = angkaKreditTerakhirMap.get(peg.id)?.angkaKreditKumulatif ?? null;

      if (jabatanFungsional) {
        const jenjangBerikutnya = jenjangRows.find(
          (j) => j.jenisJabatanFungsionalId === jabatanFungsional.jenisJabatanFungsionalId && j.urutan === jabatanFungsional.urutan + 1
        );

        if (jenjangBerikutnya && kumulatif !== null) {
          const gap = jenjangBerikutnya.angkaKreditMinimum - kumulatif;
          const eligible = gap <= 0;
          const proyeksi = eligible ? getPeriodeBerikutnya(now, konfigurasiPeriode) : getPeriodeBerikutnya(tambahTahun(now, 1), konfigurasiPeriode);

          if (eligible || proyeksi.tahun <= batasProyeksi.getFullYear()) {
            hasil.push({
              pegawaiId: peg.id,
              nip: peg.nip,
              nama: peg.nama,
              unitKerjaId: peg.unitKerjaId,
              unitKerjaNama: unitNama,
              jenisKenaikan: "FUNGSIONAL",
              golonganSaatIni: pangkatAktif.golonganRuang,
              golonganTmt: pangkatAktif.tmt,
              masaKerjaTahun: hitungMasaKerjaTahun(new Date(pangkatAktif.tmt), now),
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

    const tmtDate = new Date(pangkatAktif.tmt);
    const masaKerja = hitungMasaKerjaTahun(tmtDate, now);
    const tanggalEligibleReguler = tambahTahun(tmtDate, masaKerjaMinimum);
    if (tanggalEligibleReguler <= batasProyeksi) {
      const proyeksi = getPeriodeBerikutnya(tanggalEligibleReguler, konfigurasiPeriode);
      hasil.push({
        pegawaiId: peg.id,
        nip: peg.nip,
        nama: peg.nama,
        unitKerjaId: peg.unitKerjaId,
        unitKerjaNama: unitNama,
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

  if (hasil.length > 0) {
    const statusTersimpan = await db
      .select()
      .from(statusUsulanKenaikanPangkat)
      .where(inArray(statusUsulanKenaikanPangkat.pegawaiId, hasil.map((h) => h.pegawaiId)));
    const statusMap = new Map(statusTersimpan.map((s) => [`${s.pegawaiId}-${s.periodeTahun}-${s.periodeBulan}-${s.jenisKenaikan}`, s]));

    for (const item of hasil) {
      const key = `${item.pegawaiId}-${item.proyeksiPeriode.tahun}-${item.proyeksiPeriode.bulan}-${item.jenisKenaikan}`;
      const status = statusMap.get(key);
      if (status) item.statusTindakLanjut = status.status;
    }
  }

  return hasil;
}
