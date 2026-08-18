import type { D1Database } from "@cloudflare/workers-types";

export interface PeriodeKp {
  bulan: number;
  tanggal: number;
  nama_periode: string;
}

export interface MasaKerjaRule {
  golongan_ruang: string | null;
  masa_kerja_minimum_bulan: number;
}

export interface AngkaKreditRule {
  jenis_jabatan_fungsional: string;
  jenjang_jabatan: string;
  angka_kredit_minimum: number;
}

export interface SkpRule {
  predikat_minimum: string;
  urutan_peringkat: number;
}

export interface PegawaiRow {
  id: string;
  nip: string;
  nama: string;
  unit_kerja_id: string | null;
  unit_kerja_nama: string | null;
  status_kepegawaian: string;
  status_aktif: string;
  jenis_jabatan: string | null;
  nama_jabatan: string | null;
  jenjang_jabatan: string | null;
  golongan_ruang_aktif: string | null;
  nama_pangkat_aktif: string | null;
  tmt_pangkat_aktif: string | null;
  predikat_skp_terakhir: string | null;
  angka_kredit_kumulatif: number | null;
}

export interface KenaikanCandidate {
  pegawai: PegawaiRow;
  jenisKenaikan: "REGULER" | "PILIHAN_FUNGSIONAL";
  masaKerjaBulan: number | null;
  masaKerjaMinimumBulan: number | null;
  angkaKreditKumulatif: number | null;
  angkaKreditMinimum: number | null;
  angkaKreditGap: number | null;
  skpTerpenuhi: boolean | null;
  memenuhiSyarat: boolean;
  tanggalMemenuhiSyarat: string | null;
  proyeksiPeriodeBerikutnya: string | null;
  bulanMenujuPeriode: number | null;
}

export function monthsBetween(fromIso: string, toIso: string): number {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  let months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  if (to.getDate() < from.getDate()) months -= 1;
  return months;
}

function addMonths(iso: string, months: number): Date {
  const d = new Date(iso);
  d.setMonth(d.getMonth() + months);
  return d;
}

/** Finds the earliest configured kenaikan-pangkat periode date on/after `fromDate`. */
export function nextPeriodeDate(fromDate: Date, periodes: PeriodeKp[]): Date | null {
  if (periodes.length === 0) return null;
  const candidates: Date[] = [];
  for (let yearOffset = 0; yearOffset <= 1; yearOffset++) {
    for (const p of periodes) {
      const candidate = new Date(Date.UTC(fromDate.getUTCFullYear() + yearOffset, p.bulan - 1, p.tanggal));
      if (candidate >= fromDate) candidates.push(candidate);
    }
  }
  candidates.sort((a, b) => a.getTime() - b.getTime());
  return candidates[0] ?? null;
}

function findMasaKerjaRule(rules: MasaKerjaRule[], golongan: string | null): MasaKerjaRule | null {
  const specific = rules.find((r) => r.golongan_ruang === golongan);
  if (specific) return specific;
  return rules.find((r) => r.golongan_ruang === null) ?? null;
}

function findAngkaKreditRule(rules: AngkaKreditRule[], jenisJabatan: string | null, jenjang: string | null): AngkaKreditRule | null {
  if (!jenisJabatan || !jenjang) return null;
  return (
    rules.find(
      (r) => r.jenis_jabatan_fungsional.toLowerCase() === jenisJabatan.toLowerCase() && r.jenjang_jabatan.toLowerCase() === jenjang.toLowerCase()
    ) ?? null
  );
}

export interface EngineParams {
  periodes: PeriodeKp[];
  masaKerjaRules: MasaKerjaRule[];
  angkaKreditRules: AngkaKreditRule[];
  skpRules: SkpRule[];
}

export async function loadEngineParams(db: D1Database): Promise<EngineParams> {
  const [periodes, masaKerja, angkaKredit, skp] = await Promise.all([
    db.prepare(`SELECT nama_periode, bulan, tanggal FROM parameter_periode_kp WHERE is_active = 1`).all<PeriodeKp>(),
    db.prepare(`SELECT golongan_ruang, masa_kerja_minimum_bulan FROM parameter_masa_kerja_reguler WHERE is_active = 1`).all<MasaKerjaRule>(),
    db
      .prepare(`SELECT jenis_jabatan_fungsional, jenjang_jabatan, angka_kredit_minimum FROM parameter_angka_kredit_jenjang WHERE is_active = 1`)
      .all<AngkaKreditRule>(),
    db.prepare(`SELECT predikat_minimum, urutan_peringkat FROM parameter_skp_minimum WHERE is_active = 1`).all<SkpRule>(),
  ]);
  return {
    periodes: periodes.results,
    masaKerjaRules: masaKerja.results,
    angkaKreditRules: angkaKredit.results,
    skpRules: skp.results,
  };
}

/**
 * Core PRD FR-4.1..FR-4.3 logic: for each active pegawai, determines whether
 * they already meet, or will soon meet, the configured promotion rules, and
 * projects the nearest applicable kenaikan-pangkat periode.
 */
export function evaluatePegawai(pegawai: PegawaiRow, params: EngineParams, asOfIso: string): KenaikanCandidate | null {
  if (pegawai.status_aktif !== "AKTIF") return null; // BR-5
  if (!pegawai.tmt_pangkat_aktif) return null;

  const isFungsional = pegawai.jenis_jabatan === "FUNGSIONAL_TERTENTU";
  const minAcceptableUrutan = params.skpRules.length > 0 ? Math.min(...params.skpRules.map((r) => r.urutan_peringkat)) : null;
  const matchedSkpRule = pegawai.predikat_skp_terakhir
    ? params.skpRules.find((r) => r.predikat_minimum.toLowerCase() === pegawai.predikat_skp_terakhir!.toLowerCase())
    : undefined;
  const skpTerpenuhi = !pegawai.predikat_skp_terakhir || minAcceptableUrutan === null ? null : (matchedSkpRule?.urutan_peringkat ?? 0) >= minAcceptableUrutan;

  if (isFungsional) {
    const rule = findAngkaKreditRule(params.angkaKreditRules, pegawai.nama_jabatan, pegawai.jenjang_jabatan);
    if (!rule) return null; // No configured threshold for this jenjang — cannot evaluate.
    const kumulatif = pegawai.angka_kredit_kumulatif ?? 0;
    const gap = rule.angka_kredit_minimum - kumulatif;
    const memenuhiSyarat = gap <= 0 && skpTerpenuhi !== false;

    const proyeksi = memenuhiSyarat ? nextPeriodeDate(new Date(asOfIso), params.periodes) : null;

    return {
      pegawai,
      jenisKenaikan: "PILIHAN_FUNGSIONAL",
      masaKerjaBulan: pegawai.tmt_pangkat_aktif ? monthsBetween(pegawai.tmt_pangkat_aktif, asOfIso) : null,
      masaKerjaMinimumBulan: null,
      angkaKreditKumulatif: kumulatif,
      angkaKreditMinimum: rule.angka_kredit_minimum,
      angkaKreditGap: Math.max(0, gap),
      skpTerpenuhi,
      memenuhiSyarat,
      tanggalMemenuhiSyarat: memenuhiSyarat ? asOfIso : null,
      proyeksiPeriodeBerikutnya: proyeksi ? proyeksi.toISOString().slice(0, 10) : null,
      bulanMenujuPeriode: proyeksi ? monthsBetween(asOfIso, proyeksi.toISOString()) : null,
    };
  }

  const rule = findMasaKerjaRule(params.masaKerjaRules, pegawai.golongan_ruang_aktif);
  if (!rule) return null;

  const masaKerjaBulan = monthsBetween(pegawai.tmt_pangkat_aktif, asOfIso);
  const memenuhiSyarat = masaKerjaBulan >= rule.masa_kerja_minimum_bulan && skpTerpenuhi !== false;

  const tanggalMemenuhi = addMonths(pegawai.tmt_pangkat_aktif, rule.masa_kerja_minimum_bulan);
  const proyeksi = nextPeriodeDate(tanggalMemenuhi > new Date(asOfIso) ? tanggalMemenuhi : new Date(asOfIso), params.periodes);

  return {
    pegawai,
    jenisKenaikan: "REGULER",
    masaKerjaBulan,
    masaKerjaMinimumBulan: rule.masa_kerja_minimum_bulan,
    angkaKreditKumulatif: null,
    angkaKreditMinimum: null,
    angkaKreditGap: null,
    skpTerpenuhi,
    memenuhiSyarat,
    tanggalMemenuhiSyarat: tanggalMemenuhi.toISOString().slice(0, 10),
    proyeksiPeriodeBerikutnya: proyeksi ? proyeksi.toISOString().slice(0, 10) : null,
    bulanMenujuPeriode: proyeksi ? monthsBetween(asOfIso, proyeksi.toISOString()) : null,
  };
}
