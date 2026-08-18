import type { Env } from "../types";
import { nextPeriode, type PeriodeConfig } from "./business";

async function loadParam<T>(env: Env, kunci: string): Promise<T> {
  const row = await env.DB.prepare(`SELECT nilai FROM parameter_aturan WHERE kunci = ?`).bind(kunci).first<{ nilai: string }>();
  if (!row) throw new Error(`Parameter '${kunci}' belum dikonfigurasi`);
  return JSON.parse(row.nilai) as T;
}

/**
 * FR-5.1: notifikasi in-app ke Admin Kepegawaian saat pegawai mendekati masa
 * kenaikan pangkat (H- bulan dikonfigurasi). Dipanggil oleh scheduled() harian
 * dan dapat dipicu manual via POST /api/notifikasi/generate.
 */
export async function generateReminders(env: Env): Promise<{ created: number }> {
  const periodes = await loadParam<PeriodeConfig[]>(env, "periode_tahunan");
  const hMinusList = await loadParam<number[]>(env, "h_minus_bulan");
  const today = new Date();

  const { results: pegawaiRows } = await env.DB.prepare(
    `SELECT id, nama, unit_kerja_id, tmt_pangkat_aktif, golongan_ruang_aktif
     FROM pegawai WHERE status_aktif = 'aktif' AND tmt_pangkat_aktif IS NOT NULL AND golongan_ruang_aktif IS NOT NULL`
  ).all<any>();

  const golonganRows = await env.DB.prepare(`SELECT golongan_ruang, masa_kerja_minimum_bulan FROM golongan_masa_kerja_minimum`).all<{
    golongan_ruang: string;
    masa_kerja_minimum_bulan: number;
  }>();
  const defaultMasaKerja = await loadParam<number>(env, "masa_kerja_minimum_reguler_bulan");
  const golonganMap = new Map(golonganRows.results.map((g) => [g.golongan_ruang, g.masa_kerja_minimum_bulan]));

  let created = 0;
  for (const p of pegawaiRows) {
    const requiredMonths = golonganMap.get(p.golongan_ruang_aktif) ?? defaultMasaKerja;
    const eligibleDate = new Date(p.tmt_pangkat_aktif);
    eligibleDate.setMonth(eligibleDate.getMonth() + requiredMonths);
    const periode = nextPeriode(periodes, eligibleDate);
    const monthsAhead = Math.round((periode.date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24 * 30.44));

    if (!hMinusList.includes(monthsAhead)) continue;

    const judul = `H-${monthsAhead} bulan menuju periode kenaikan pangkat (${periode.label})`;
    const dupe = await env.DB.prepare(
      `SELECT id FROM notifikasi WHERE entitas_tipe = 'kenaikan_pangkat' AND entitas_id = ? AND judul = ?`
    )
      .bind(p.id, judul)
      .first();
    if (dupe) continue;

    await env.DB.prepare(
      `INSERT INTO notifikasi (role_target, unit_kerja_id, judul, pesan, tipe, entitas_tipe, entitas_id)
       VALUES ('admin_kepegawaian', ?, ?, ?, 'reminder_kenaikan_pangkat', 'kenaikan_pangkat', ?)`
    )
      .bind(p.unit_kerja_id, judul, `${p.nama} diproyeksikan memenuhi syarat kenaikan pangkat reguler pada periode ${periode.label}.`, p.id)
      .run();
    created++;
  }
  return { created };
}
