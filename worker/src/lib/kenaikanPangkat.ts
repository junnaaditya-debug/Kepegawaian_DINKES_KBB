import type { Env } from "../types";
import { badRequest } from "./http";
import { monthsBetween, nextPeriode, type PeriodeConfig } from "./business";

const SKP_RANK: Record<string, number> = { "Sangat Kurang": 1, Kurang: 2, Cukup: 3, Baik: 4, "Sangat Baik": 5 };

export interface EligibilityRow {
  pegawaiId: number;
  nip: string;
  nama: string;
  unitKerjaId: number;
  unitKerjaNama: string;
  statusKepegawaian: string;
  jenisKenaikan: "reguler" | "fungsional";
  golonganSaatIni: string | null;
  golonganBerikutnya: string | null;
  detail: Record<string, unknown>;
  periodeTahun: number;
  periodeBulan: number;
  periodeLabel: string;
  overdue: boolean;
  status: string;
  catatan: string | null;
  diverifikasiAtasan: boolean;
  catatanVerifikasi: string | null;
}

async function loadParam<T>(env: Env, kunci: string): Promise<T> {
  const row = await env.DB.prepare(`SELECT nilai FROM parameter_aturan WHERE kunci = ?`).bind(kunci).first<{ nilai: string }>();
  if (!row) throw badRequest(`Parameter '${kunci}' belum dikonfigurasi`);
  return JSON.parse(row.nilai) as T;
}

export interface DeteksiOptions {
  rentangBulan: number;
  jenis?: string;
  unitKerjaId?: number;
  jenisKepegawaian?: string;
}

async function computeEligibility(env: Env, opts: DeteksiOptions): Promise<Omit<EligibilityRow, "status" | "catatan" | "diverifikasiAtasan" | "catatanVerifikasi">[]> {
  const today = new Date();
  const periodes = await loadParam<PeriodeConfig[]>(env, "periode_tahunan");
  const defaultMasaKerja = await loadParam<number>(env, "masa_kerja_minimum_reguler_bulan");
  const skpMinimum = await loadParam<string>(env, "predikat_skp_minimum");
  const golonganOverrides = await env.DB.prepare(`SELECT golongan_ruang, masa_kerja_minimum_bulan, golongan_ruang_berikutnya FROM golongan_masa_kerja_minimum`).all<{
    golongan_ruang: string;
    masa_kerja_minimum_bulan: number;
    golongan_ruang_berikutnya: string | null;
  }>();
  // Golongan/ruang ditulis dengan berbagai konvensi huruf (III/d vs III/D) tergantung
  // sumber data (input manual vs impor massal) — normalisasi ke huruf besar supaya
  // pencocokan TMT riwayat pangkat & golongan tidak pernah gagal karena beda kapitalisasi.
  const normGol = (g: string | null | undefined) => (g ?? "").trim().toUpperCase();
  const golonganMap = new Map(golonganOverrides.results.map((g) => [normGol(g.golongan_ruang), g]));

  const rows: Omit<EligibilityRow, "status" | "catatan" | "diverifikasiAtasan" | "catatanVerifikasi">[] = [];

  if (!opts.jenis || opts.jenis === "reguler" || opts.jenis === "all") {
    const { results } = await env.DB.prepare(
      `SELECT p.id, p.nip, p.nama, p.unit_kerja_id, uk.nama as unit_kerja_nama, p.status_kepegawaian,
              p.golongan_ruang_aktif, p.tmt_pangkat_aktif, p.skp_predikat_terakhir
       FROM pegawai p JOIN unit_kerja uk ON uk.id = p.unit_kerja_id
       WHERE p.status_aktif = 'aktif' AND p.tmt_pangkat_aktif IS NOT NULL AND p.golongan_ruang_aktif IS NOT NULL`
    ).all<any>();

    for (const p of results) {
      const golCfg = golonganMap.get(normGol(p.golongan_ruang_aktif));
      const requiredMonths = golCfg?.masa_kerja_minimum_bulan ?? defaultMasaKerja;
      const golonganBerikutnya = golCfg?.golongan_ruang_berikutnya ?? null;
      if (!golonganBerikutnya) continue;
      if (p.skp_predikat_terakhir && SKP_RANK[p.skp_predikat_terakhir] < SKP_RANK[skpMinimum]) continue;

      // Rumusan reguler (BR-2): layak naik pangkat setiap `requiredMonths` (default 4 tahun /
      // 48 bulan) terhitung sejak TMT riwayat pangkat & golongan terakhir (p.tmt_pangkat_aktif,
      // selalu sinkron dengan baris aktif di riwayat_pangkat_golongan lewat rute POST-nya).
      const eligibleDate = new Date(p.tmt_pangkat_aktif);
      eligibleDate.setMonth(eligibleDate.getMonth() + requiredMonths);
      const periode = nextPeriode(periodes, eligibleDate);
      const monthsAhead = (periode.date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
      if (monthsAhead > opts.rentangBulan) continue;

      rows.push({
        pegawaiId: p.id,
        nip: p.nip,
        nama: p.nama,
        unitKerjaId: p.unit_kerja_id,
        unitKerjaNama: p.unit_kerja_nama,
        statusKepegawaian: p.status_kepegawaian,
        jenisKenaikan: "reguler",
        golonganSaatIni: p.golongan_ruang_aktif,
        golonganBerikutnya,
        detail: {
          masaKerjaBulanBerjalan: monthsBetween(p.tmt_pangkat_aktif, today),
          masaKerjaMinimumBulan: requiredMonths,
          skpPredikatTerakhir: p.skp_predikat_terakhir,
          skpMinimum,
        },
        periodeTahun: periode.date.getUTCFullYear(),
        periodeBulan: periode.date.getUTCMonth() + 1,
        periodeLabel: periode.label,
        overdue: periode.date.getTime() < today.getTime(),
      });
    }
  }

  if (!opts.jenis || opts.jenis === "fungsional" || opts.jenis === "all") {
    const masaKerjaJabatanBulan = await loadParam<number>(env, "masa_kerja_minimum_jabatan_fungsional_bulan");
    const { results } = await env.DB.prepare(
      `SELECT p.id, p.nip, p.nama, p.unit_kerja_id, uk.nama as unit_kerja_nama, p.status_kepegawaian,
              p.golongan_ruang_aktif, p.tmt_pangkat_aktif, jf.id as jenjang_id, jf.nama as jenjang_nama, jf.urutan, jf.jenis_jabatan_fungsional_id,
              (SELECT ak.angka_kredit_kumulatif FROM angka_kredit ak WHERE ak.pegawai_id = p.id AND ak.is_terbaru = 1 ORDER BY ak.tanggal_pak DESC LIMIT 1) as ak_kumulatif,
              (SELECT rj.tmt_jabatan FROM riwayat_jabatan rj WHERE rj.pegawai_id = p.id AND rj.jenis = 'fungsional' AND rj.is_aktif = 1 ORDER BY rj.tmt_jabatan DESC LIMIT 1) as tmt_jabatan_aktif
       FROM pegawai p
       JOIN unit_kerja uk ON uk.id = p.unit_kerja_id
       JOIN jenjang_jabatan_fungsional jf ON jf.id = p.jenjang_jabatan_fungsional_id
       WHERE p.status_aktif = 'aktif' AND p.jenis_jabatan = 'fungsional'`
    ).all<any>();

    for (const p of results) {
      if (p.ak_kumulatif == null) continue;
      const next = await env.DB.prepare(
        `SELECT nama, golongan_ruang_minimal, angka_kredit_kumulatif_minimal FROM jenjang_jabatan_fungsional
         WHERE jenis_jabatan_fungsional_id = ? AND urutan = ?`
      )
        .bind(p.jenis_jabatan_fungsional_id, p.urutan + 1)
        .first<{ nama: string; golongan_ruang_minimal: string; angka_kredit_kumulatif_minimal: number }>();
      if (!next) continue;
      if (p.ak_kumulatif < next.angka_kredit_kumulatif_minimal) continue;

      // TMT terakhir dalam jabatan: pakai riwayat_jabatan aktif jika ada, jika belum tercatat
      // fallback ke tmt_pangkat_aktif (TMT terakhir pegawai yang selalu tersedia).
      const tmtTerakhir = p.tmt_jabatan_aktif ?? p.tmt_pangkat_aktif;
      if (!tmtTerakhir) continue;

      const eligibleDate = new Date(tmtTerakhir);
      eligibleDate.setMonth(eligibleDate.getMonth() + masaKerjaJabatanBulan);
      const periode = nextPeriode(periodes, eligibleDate);
      const monthsAhead = (periode.date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
      if (monthsAhead > opts.rentangBulan) continue;

      rows.push({
        pegawaiId: p.id,
        nip: p.nip,
        nama: p.nama,
        unitKerjaId: p.unit_kerja_id,
        unitKerjaNama: p.unit_kerja_nama,
        statusKepegawaian: p.status_kepegawaian,
        jenisKenaikan: "fungsional",
        golonganSaatIni: p.golongan_ruang_aktif,
        golonganBerikutnya: next.golongan_ruang_minimal,
        detail: {
          jenjangSaatIni: p.jenjang_nama,
          jenjangBerikutnya: next.nama,
          angkaKreditKumulatif: p.ak_kumulatif,
          angkaKreditAmbangBatas: next.angka_kredit_kumulatif_minimal,
          tmtTerakhir,
          masaKerjaJabatanBulanBerjalan: monthsBetween(tmtTerakhir, today),
          masaKerjaJabatanMinimumBulan: masaKerjaJabatanBulan,
        },
        periodeTahun: periode.date.getUTCFullYear(),
        periodeBulan: periode.date.getUTCMonth() + 1,
        periodeLabel: periode.label,
        overdue: periode.date.getTime() < today.getTime(),
      });
    }
  }

  let filtered = rows;
  if (opts.unitKerjaId) filtered = filtered.filter((r) => r.unitKerjaId === opts.unitKerjaId);
  if (opts.jenisKepegawaian) filtered = filtered.filter((r) => r.statusKepegawaian === opts.jenisKepegawaian);
  return filtered.sort((a, b) => a.periodeTahun - b.periodeTahun || a.periodeBulan - b.periodeBulan || a.nama.localeCompare(b.nama));
}

/** FR-4.x core detection engine, enriched with tindak-lanjut status (FR-4.5) and filtered per FR-4.6. */
export async function getDeteksiKenaikanPangkat(env: Env, opts: DeteksiOptions): Promise<EligibilityRow[]> {
  const rows = await computeEligibility(env, opts);

  const statusRows = await env.DB.prepare(
    `SELECT pegawai_id, periode_tahun, periode_bulan, status, catatan, diverifikasi_atasan, catatan_verifikasi
     FROM status_usulan_kenaikan_pangkat`
  ).all<any>();
  const statusMap = new Map(statusRows.results.map((s) => [`${s.pegawai_id}-${s.periode_tahun}-${s.periode_bulan}`, s]));

  return rows
    .map((r) => {
      const st = statusMap.get(`${r.pegawaiId}-${r.periodeTahun}-${r.periodeBulan}`);
      return {
        ...r,
        status: st?.status ?? "belum_diproses",
        catatan: st?.catatan ?? null,
        diverifikasiAtasan: !!st?.diverifikasi_atasan,
        catatanVerifikasi: st?.catatan_verifikasi ?? null,
      };
    })
    .filter((r) => r.status !== "sk_terbit");
}
