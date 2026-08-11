import { and, eq, gte, inArray } from "drizzle-orm";
import type { createDb } from "../db/client";
import { notifikasi, parameterAturan, user } from "../db/schema";
import { deteksiKenaikanPangkat } from "./promotionEngine";
import { newId, nowIso } from "../utils/id";

const BULAN_LABEL = ["", "Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

function bulanMenujuPeriode(periode: { tahun: number; bulan: number }): number {
  const now = new Date();
  const target = new Date(periode.tahun, periode.bulan - 1, 1);
  return Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30));
}

/**
 * FR-5.1: notifikasi in-app kepada Admin Kepegawaian saat ada pegawai yang mendekati
 * masa kenaikan pangkat. Dipicu oleh Cloudflare Cron Trigger (lihat wrangler.toml),
 * menggantikan node-cron pada versi Express/Node.
 */
export async function jalankanReminderKenaikanPangkat(db: ReturnType<typeof createDb>) {
  const parameterRows = await db.select().from(parameterAturan).limit(1);
  const parameter = parameterRows[0];
  const ambangBulan = [parameter?.reminderBulanSebelum1 ?? 6, parameter?.reminderBulanSebelum2 ?? 3];

  const kandidat = await deteksiKenaikanPangkat(db, { bulanKeDepan: Math.max(...ambangBulan) + 1 });
  const relevan = kandidat.filter((k) => ambangBulan.includes(bulanMenujuPeriode(k.proyeksiPeriode)) && k.statusTindakLanjut === "BELUM_DIPROSES");

  if (relevan.length === 0) return { dibuat: 0 };

  const penerima = await db.select().from(user).where(and(inArray(user.role, ["SUPER_ADMIN", "ADMIN_KEPEGAWAIAN"]), eq(user.isActive, true)));

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  let dibuat = 0;
  for (const u of penerima) {
    const existingToday = await db.select().from(notifikasi).where(and(eq(notifikasi.userId, u.id), gte(notifikasi.createdAt, todayStart.toISOString())));
    const existingJudulSet = new Set(existingToday.map((n) => n.judul));

    for (const k of relevan) {
      const judul = `Pengingat Kenaikan Pangkat: ${k.nama}`;
      if (existingJudulSet.has(judul)) continue;

      const pesan = `${k.nama} (${k.nip}) diproyeksikan naik pangkat pada periode ${BULAN_LABEL[k.proyeksiPeriode.bulan]} ${k.proyeksiPeriode.tahun}. Segera tindak lanjuti.`;
      await db.insert(notifikasi).values({
        id: newId(),
        userId: u.id,
        judul,
        pesan,
        jenis: "KENAIKAN_PANGKAT",
        link: "/kenaikan-pangkat",
        isRead: false,
        createdAt: nowIso(),
      });
      dibuat++;
    }
  }

  return { dibuat };
}
